/**
 * Voice prompts: a teacher speaks their request (any Indian language, up to 60 s) and gets the text back.
 * The upload must start like an audio container, its claimed length is checked before decoding, and it is
 * normalised to 16 kHz mono WAV with ffmpeg (cut at VOICE_MAX_SEC + 1 s whatever the container claims;
 * the decoded length is what is billed), then transcribed synchronously with the school's
 * STT provider: Sarvam's REST endpoint (saaras:v3 in codemix mode keeps English terms in Latin script,
 * language auto-detected) or OpenAI whisper-1. Audio is never stored; temp files are always removed.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import { DEFAULT_MODEL_SETTINGS, type SessionUser, type VoicePromptResult } from '@classpulse/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { modelSettings } from '../../db/schema/index.js';
import { trackAiCall } from '../../lib/aiUsage.js';
import { AppError, badRequest } from '../../lib/errors.js';
import { assertAudioContainer, normalizedWavDurationSec, normalizeToWav, probeAudioDurationSec } from '../../lib/ffmpeg.js';
import { storage } from '../../lib/storage.js';
import { limited, voicePromptLimiter } from '../../middleware/uploadLimit.js';
import { isPipelineError, PipelineError } from '../../pipeline/errors.js';
import { fetchStep, readJson } from '../../pipeline/http.js';
import { sarvamMode } from '../../pipeline/sarvam.js';

export const VOICE_MAX_SEC = 60;
export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = new Set(['.webm', '.ogg', '.oga', '.opus', '.m4a', '.mp4', '.aac', '.wav', '.mp3', '.mpeg']);
const VOICE_FAILED = 'Could not transcribe your voice prompt. Please try again or type your request.';
const VOICE_AUTH = 'Speech-to-text credentials were rejected. Ask your administrator to check the speech-to-text API key.';

const unsupported = () => new AppError('UNSUPPORTED_MEDIA_TYPE', 'Record again: the voice prompt must be WEBM, OGG, M4A, WAV or MP3 audio.');

function allowed(file: Express.Multer.File): boolean {
  const mime = file.mimetype.toLowerCase().split(';')[0]!.trim();
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = mime.startsWith('audio/') || mime === 'video/webm' || mime === 'video/mp4' || mime === 'application/octet-stream';
  return mimeOk && (ext === '' || EXTENSIONS.has(ext));
}

/** Multipart field `audio` (one file, ≤ 5 MB) into the storage temp dir with a server-generated name. Rate-limited per teacher. */
export const voiceUploadMiddleware: RequestHandler = limited(voicePromptLimiter, (req, res, next) => {
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(storage.tmpDir, { recursive: true }).then(
          () => cb(null, storage.tmpDir),
          (err: Error) => cb(err, storage.tmpDir),
        );
      },
      filename: (_req, _file, cb) => cb(null, `voice-${randomUUID()}.upload`),
    }),
    limits: { fileSize: VOICE_MAX_BYTES, files: 1, fields: 2, parts: 3 },
    fileFilter: (_req, file, cb) => (allowed(file) ? cb(null, true) : cb(unsupported())),
  }).single('audio')(req, res, next);
});

async function transcribeSarvam(wavPath: string, model: string): Promise<VoicePromptResult> {
  if (!env.SARVAM_API_KEY) throw new PipelineError('SARVAM_API_KEY is not set', { retryable: false, userMessage: 'Voice input is not configured.' });
  const form = new FormData();
  form.append('file', new Blob([await readFile(wavPath)], { type: 'audio/wav' }), 'prompt.wav');
  form.append('model', model);
  const mode = sarvamMode(model).mode;
  if (mode) form.append('mode', mode);
  form.append('language_code', 'unknown');
  const res = await fetchStep(
    `${env.SARVAM_BASE_URL.replace(/\/+$/, '')}/speech-to-text`,
    { method: 'POST', headers: { 'api-subscription-key': env.SARVAM_API_KEY }, body: form },
    { step: 'sarvam:voice', timeoutMs: 60_000, userMessage: VOICE_FAILED, authUserMessage: VOICE_AUTH },
  );
  const body = (await readJson(res, 'sarvam:voice', VOICE_FAILED)) as { transcript?: unknown; language_code?: unknown };
  return {
    text: typeof body.transcript === 'string' ? body.transcript.trim() : '',
    languageCode: typeof body.language_code === 'string' ? body.language_code : null,
  };
}

async function transcribeOpenAI(wavPath: string, model: string): Promise<VoicePromptResult> {
  if (!env.OPENAI_API_KEY) throw new PipelineError('OPENAI_API_KEY is not set', { retryable: false, userMessage: 'Voice input is not configured.' });
  const form = new FormData();
  form.append('file', new Blob([await readFile(wavPath)], { type: 'audio/wav' }), 'prompt.wav');
  form.append('model', model);
  form.append('response_format', 'json');
  const res = await fetchStep(
    `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/audio/transcriptions`,
    { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form },
    { step: 'openai:voice', timeoutMs: 60_000, userMessage: VOICE_FAILED, authUserMessage: VOICE_AUTH },
  );
  const body = (await readJson(res, 'openai:voice', VOICE_FAILED)) as { text?: unknown };
  return { text: typeof body.text === 'string' ? body.text.trim() : '', languageCode: null };
}

export async function transcribeVoicePrompt(user: SessionUser, file: Express.Multer.File | undefined): Promise<VoicePromptResult> {
  if (!file) throw badRequest('Attach the recording as "audio"');
  const wav = storage.newTmpPath('.wav');
  try {
    const tooLong = () => badRequest(`Voice prompts can be at most ${VOICE_MAX_SEC} seconds long`);
    await assertAudioContainer(file.path);
    // Check the claimed length BEFORE decoding; a missing or false claim is cut by `maxSec`.
    const claimed = await probeAudioDurationSec(file.path);
    if (claimed !== null && claimed > VOICE_MAX_SEC + 1) throw tooLong();
    await normalizeToWav(file.path, wav, { maxSec: VOICE_MAX_SEC + 1 });
    const duration = await normalizedWavDurationSec(wav);
    if (duration <= 0) throw unsupported();
    if (duration > VOICE_MAX_SEC + 1) throw tooLong();

    const settings = (await db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, user.institutionId) })) ?? DEFAULT_MODEL_SETTINGS;
    const openai = settings.sttProvider === 'openai';
    const model = openai
      ? settings.sttModel && !/^(saaras|saarika)/.test(settings.sttModel)
        ? settings.sttModel
        : 'whisper-1'
      : /^(saaras|saarika)/.test(settings.sttModel)
        ? settings.sttModel
        : 'saaras:v3';
    const key = openai ? env.OPENAI_API_KEY : env.SARVAM_API_KEY;
    if (!key && env.PIPELINE_DEMO_FALLBACK) return { text: '[Demo] Make a 10-question worksheet on fractions for Class 6.', languageCode: 'en-IN' };

    let result: VoicePromptResult;
    try {
      result = await trackAiCall(
        { institutionId: user.institutionId, kind: 'voice' },
        { provider: openai ? 'openai' : 'sarvam', model },
        () => (openai ? transcribeOpenAI(wav, model) : transcribeSarvam(wav, model)),
        () => ({ audioSeconds: duration }),
      );
    } catch (err) {
      if (isPipelineError(err)) throw new AppError('UPSTREAM_FAILED', err.userMessage);
      throw err;
    }
    if (!result.text) throw badRequest('No speech was heard. Speak closer to the microphone and try again.');
    return result;
  } finally {
    await Promise.all([rm(file.path, { force: true }), rm(wav, { force: true })]).catch(() => undefined);
  }
}
