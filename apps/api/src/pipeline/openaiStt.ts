/**
 * Speech-to-text with OpenAI's transcription API (Whisper), using segment-level
 * timestamps. The API accepts files up to 25 MB, so the normalized 16 kHz mono WAV
 * (~1.9 MB/min) is sliced into ≤10-minute parts and the part offsets are added back.
 * There is NO fallback transcript: any failure throws a PipelineError.
 */
import { readFile, rm } from 'node:fs/promises';
import type { Language, TranscriptSegment } from '@classiq/shared';
import { env } from '../config/env.js';
import { trackAiCall } from '../lib/aiUsage.js';
import { sliceWav } from '../lib/ffmpeg.js';
import { storage } from '../lib/storage.js';
import { PipelineError } from './errors.js';
import { fetchStep, readJson } from './http.js';
import { coalesceSegments, distributeSentences } from './segments.js';
import type { TranscribeInput, TranscribeResult } from './types.js';

export const OPENAI_STT_DEFAULT_MODEL = 'whisper-1';
const PART_SEC = 10 * 60;
const STT_FAILED = 'Speech-to-text failed. Please try again in a few minutes.';
const STT_AUTH = 'Speech-to-text credentials were rejected. Ask your administrator to check the OpenAI API key.';

/** "hi-IN" → "hi" (ISO-639-1); Odia's BCP-47 code is "or". */
function isoLanguage(language: Language): string {
  const code = language.split('-')[0]!;
  return code === 'od' ? 'or' : code;
}

interface VerboseTranscription {
  text?: string;
  segments?: { start?: number; end?: number; text?: string }[];
}

async function transcribePart(filePath: string, model: string, language: Language): Promise<VerboseTranscription> {
  const form = new FormData();
  form.append('file', new Blob([await readFile(filePath)], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', model);
  form.append('language', isoLanguage(language));
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const res = await fetchStep(
    `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/audio/transcriptions`,
    { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form },
    { step: 'openai:transcribe', timeoutMs: 5 * 60_000, userMessage: STT_FAILED, authUserMessage: STT_AUTH },
  );
  return (await readJson(res, 'openai:transcribe', STT_FAILED)) as VerboseTranscription;
}

export async function transcribeWithOpenAI(input: TranscribeInput): Promise<TranscribeResult> {
  if (!env.OPENAI_API_KEY) {
    throw new PipelineError('OPENAI_API_KEY missing', { retryable: false, userMessage: 'Speech-to-text is not configured.' });
  }
  const model = input.model && !input.model.startsWith('saaras') ? input.model : OPENAI_STT_DEFAULT_MODEL;
  const duration = Math.max(input.durationSec, 0);
  const parts: { path: string; offset: number; temp: boolean }[] = [];
  if (duration <= PART_SEC) {
    parts.push({ path: input.audioPath, offset: 0, temp: false });
  } else {
    for (let offset = 0; offset < duration; offset += PART_SEC) {
      const out = storage.newTmpPath('.wav');
      await sliceWav(input.audioPath, out, offset, Math.min(PART_SEC, duration - offset));
      parts.push({ path: out, offset, temp: true });
    }
  }

  const segments: TranscriptSegment[] = [];
  const texts: string[] = [];
  let approximate = false;
  try {
    for (const part of parts) {
      // One Whisper request per part, each recorded with its share of the audio.
      const partSec = Math.min(PART_SEC, duration - part.offset) || duration;
      const result = await trackAiCall(input.usage, { provider: 'openai', model }, () => transcribePart(part.path, model, input.language), () => ({
        audioSeconds: partSec,
      }));
      const text = (result.text ?? '').trim();
      if (!text) continue;
      texts.push(text);
      const timed = (result.segments ?? []).filter(
        (s): s is { start: number; end: number; text: string } =>
          typeof s.start === 'number' && typeof s.end === 'number' && typeof s.text === 'string' && s.text.trim() !== '',
      );
      if (timed.length) {
        segments.push(...timed.map((s) => ({ startSec: s.start + part.offset, endSec: s.end + part.offset, text: s.text.trim() })));
      } else {
        approximate = true;
        const partDuration = Math.min(PART_SEC, duration - part.offset) || duration;
        segments.push(...distributeSentences(text, partDuration, part.offset));
      }
    }
  } finally {
    await Promise.all(parts.filter((p) => p.temp).map((p) => rm(p.path, { force: true })));
  }

  const transcript = texts.join('\n\n').trim();
  if (!transcript) {
    throw new PipelineError('Empty transcript', {
      retryable: false,
      userMessage: 'No speech was detected in the recording. Check the microphone and try again.',
    });
  }
  return {
    transcript,
    segments: coalesceSegments(segments),
    meta: { provider: 'openai', model, approximateTimestamps: approximate, demoFallback: false },
  };
}
