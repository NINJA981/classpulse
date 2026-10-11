/**
 * Speech-to-text with Sarvam's Batch API (timestamps enabled).
 *
 * Flow (Sarvam batch STT):
 *   1. POST /speech-to-text/job/v1                 { job_parameters } -> { job_id }
 *   2. POST /speech-to-text/job/v1/upload-files    { job_id, files }  -> { upload_urls: { name: { file_url } } }
 *   3. PUT  <file_url> (Azure blob, x-ms-blob-type: BlockBlob)
 *   4. POST /speech-to-text/job/v1/:jobId/start
 *   5. GET  /speech-to-text/job/v1/:jobId/status   (poll until Completed / PartiallyCompleted / Failed)
 *   6. POST /speech-to-text/job/v1/download-files  { job_id, files } -> { download_urls: { name: { file_url } } }
 *   7. GET  <file_url> -> JSON { transcript, timestamps: { words, start_time_seconds, end_time_seconds }, ... }
 *
 * Long recordings are split into parts (one job, several files) and the part
 * offsets are added back so every segment carries a real lecture timestamp.
 * There is NO fallback transcript: any failure throws a PipelineError.
 */
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { TranscriptSegment } from '@classpulse/shared';
import { env } from '../config/env.js';
import { trackAiCall } from '../lib/aiUsage.js';
import { sliceWav } from '../lib/ffmpeg.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import { PipelineError } from './errors.js';
import { fetchStep, readJson, sleep } from './http.js';
import { coalesceSegments, distributeSentences } from './segments.js';
import type { TranscribeInput, TranscribeResult } from './types.js';

/** Timing knobs (mutable for tests). Independent of env on purpose. */
export const sarvamTiming = {
  pollIntervalMs: 5_000,
  /** Overall polling budget; extended by `perHourExtraMs` for each hour of audio beyond the first. */
  pollTimeoutMs: 20 * 60_000,
  perHourExtraMs: 5 * 60_000,
  /** Audio longer than this is split into several files within one job. */
  maxPartSec: 50 * 60,
};

const STT_FAILED = 'Speech-to-text failed. Please try again in a few minutes.';
const STT_AUTH = 'Speech-to-text credentials were rejected. Ask your administrator to check the Sarvam API key.';

type UrlMap = Record<string, { file_url?: string } | undefined>;

interface JobDetail {
  inputs?: { file_name?: string }[];
  outputs?: { file_name?: string }[];
  state?: string;
  error_message?: string;
}

interface JobStatus {
  job_state?: string;
  job_details?: JobDetail[];
  error_message?: string;
}

interface Part {
  name: string;
  localPath: string;
  offsetSec: number;
  durationSec: number;
  temp: boolean;
}

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Extract the transcript text and (if present) timestamped segments from one Sarvam output file. */
export function parseSarvamOutput(raw: unknown): { text: string; segments: TranscriptSegment[] | null } {
  let obj = asObject(raw) ?? {};
  if (Array.isArray(obj.transcripts) && obj.transcripts.length) obj = asObject(obj.transcripts[0]) ?? obj;
  else if (asObject(obj.transcription)) obj = asObject(obj.transcription)!;

  const text = typeof obj.transcript === 'string' ? obj.transcript.trim() : '';

  // Preferred: timestamps { words[], start_time_seconds[], end_time_seconds[] }
  const ts = asObject(obj.timestamps);
  if (ts) {
    const words = Array.isArray(ts.words) ? ts.words : Array.isArray(ts.chunks) ? ts.chunks : [];
    const starts = Array.isArray(ts.start_time_seconds) ? ts.start_time_seconds : [];
    const ends = Array.isArray(ts.end_time_seconds) ? ts.end_time_seconds : [];
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < words.length; i++) {
      const w: unknown = words[i];
      const start = num(starts[i]);
      const end = num(ends[i]);
      if (typeof w !== 'string' || !w.trim() || start === null || end === null || start < 0) continue;
      segments.push({ startSec: start, endSec: Math.max(start, end), text: w.trim() });
    }
    if (segments.length) return { text: text || segments.map((s) => s.text).join(' '), segments };
  }

  // Alternative: diarized_transcript { entries: [{ transcript, start_time_seconds, end_time_seconds }] }
  const diarized = asObject(obj.diarized_transcript);
  if (diarized && Array.isArray(diarized.entries)) {
    const segments: TranscriptSegment[] = [];
    for (const e of diarized.entries) {
      const entry = asObject(e);
      if (!entry || typeof entry.transcript !== 'string' || !entry.transcript.trim()) continue;
      const start = num(entry.start_time_seconds);
      const end = num(entry.end_time_seconds);
      if (start === null || end === null || start < 0) continue;
      segments.push({ startSec: start, endSec: Math.max(start, end), text: entry.transcript.trim() });
    }
    if (segments.length) return { text: text || segments.map((s) => s.text).join(' '), segments };
  }

  return { text, segments: null };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Shift a part's segments to lecture time; merge word-level timestamps into readable phrases. */
function placeSegments(segments: TranscriptSegment[], part: Part): TranscriptSegment[] {
  const avg = segments.reduce((n, s) => n + (s.endSec - s.startSec), 0) / segments.length;
  const merged = avg < 2 ? coalesceSegments(segments, 8, 160) : segments;
  return merged.map((s) => ({
    startSec: round2(part.offsetSec + Math.min(s.startSec, part.durationSec)),
    endSec: round2(part.offsetSec + Math.min(s.endSec, part.durationSec)),
    text: s.text,
  }));
}

async function splitParts(input: TranscribeInput): Promise<Part[]> {
  const ext = path.extname(input.audioPath) || '.wav';
  if (input.durationSec <= sarvamTiming.maxPartSec) {
    return [{ name: `lecture${ext}`, localPath: input.audioPath, offsetSec: 0, durationSec: input.durationSec, temp: false }];
  }
  const parts: Part[] = [];
  try {
    for (let offset = 0, i = 0; offset < input.durationSec; offset += sarvamTiming.maxPartSec, i++) {
      const duration = Math.min(sarvamTiming.maxPartSec, input.durationSec - offset);
      const localPath = storage.newTmpPath('.wav');
      parts.push({ name: `part-${String(i).padStart(3, '0')}.wav`, localPath, offsetSec: offset, durationSec: duration, temp: true });
      await sliceWav(input.audioPath, localPath, offset, duration);
    }
  } catch (err) {
    await cleanupParts(parts);
    throw new PipelineError('Failed to split audio for speech-to-text', {
      retryable: false,
      userMessage: 'The recording could not be prepared for speech-to-text.',
      cause: err,
    });
  }
  return parts;
}

const cleanupParts = (parts: Part[]) =>
  Promise.all(parts.filter((p) => p.temp).map((p) => rm(p.localPath, { force: true }).catch(() => undefined)));

function pickUrl(map: UrlMap | undefined, name: string, single: boolean): string | null {
  if (!map) return null;
  const direct = map[name]?.file_url;
  if (direct) return direct;
  if (single) return Object.values(map).find((v) => v?.file_url)?.file_url ?? null;
  return null;
}

/** Map each input part to its output file name using job_details. */
function outputNames(status: JobStatus, parts: Part[]): Map<string, string> {
  const map = new Map<string, string>();
  const details = status.job_details ?? [];
  const allOutputs = details.flatMap((d) => (d.outputs ?? []).map((o) => o.file_name).filter((n): n is string => !!n));
  for (const part of parts) {
    const base = part.name.replace(/\.[^.]+$/, '');
    const detail = details.find((d) => d.inputs?.some((i) => i.file_name === part.name));
    if (detail?.state && /fail/i.test(detail.state)) continue;
    const fromDetail = detail?.outputs?.find((o) => o.file_name)?.file_name;
    const byName = allOutputs.find((n) => n.startsWith(base));
    const single = parts.length === 1 ? (allOutputs.find((n) => n.endsWith('.json')) ?? allOutputs[0]) : undefined;
    const name = fromDetail ?? byName ?? single;
    if (name) map.set(part.name, name);
  }
  return map;
}

/**
 * saaras:v3 supports output modes. Classroom speech is usually code-mixed (e.g. Tamil + English terms), and
 * `codemix` keeps English words in Latin script, which the question generator handles far better than
 * transliterated English. saarika models take no mode.
 */
export function sarvamMode(model: string): { mode?: 'codemix' } {
  return model.startsWith('saaras:v3') ? { mode: 'codemix' } : {};
}

/** One Sarvam batch job, recorded in ai_usage (audio seconds on success) when `input.usage` is given. */
export function transcribeWithSarvam(input: TranscribeInput): Promise<TranscribeResult> {
  return trackAiCall(input.usage, { provider: 'sarvam', model: input.model }, () => runSarvamJob(input), () => ({
    audioSeconds: input.durationSec,
  }));
}

async function runSarvamJob(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new PipelineError('SARVAM_API_KEY is not set', { retryable: false, userMessage: 'Speech-to-text is not configured' });
  }
  const base = env.SARVAM_BASE_URL.replace(/\/+$/, '');
  const headers = { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' };
  const step = (name: string, timeoutMs = 60_000) => ({
    step: `sarvam:${name}`,
    timeoutMs,
    userMessage: STT_FAILED,
    authUserMessage: STT_AUTH,
  });

  const parts = await splitParts(input);
  try {
    // 1. Create the job
    const initRes = await fetchStep(
      `${base}/speech-to-text/job/v1`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          job_parameters: { language_code: input.language, model: input.model, ...sarvamMode(input.model), with_timestamps: true },
        }),
      },
      step('init'),
    );
    const init = asObject(await readJson(initRes, 'sarvam:init', STT_FAILED));
    const jobId = typeof init?.job_id === 'string' ? init.job_id : null;
    if (!jobId) throw new PipelineError('sarvam:init returned no job_id', { retryable: true, userMessage: STT_FAILED });
    const log = logger.child({ sarvamJobId: jobId });
    const jobPath = `${base}/speech-to-text/job/v1/${encodeURIComponent(jobId)}`;

    // 2. Presigned upload URLs
    const upRes = await fetchStep(
      `${base}/speech-to-text/job/v1/upload-files`,
      { method: 'POST', headers, body: JSON.stringify({ job_id: jobId, files: parts.map((p) => p.name) }) },
      step('upload-urls'),
    );
    const uploadUrls = asObject(await readJson(upRes, 'sarvam:upload-urls', STT_FAILED))?.upload_urls as UrlMap | undefined;

    // 3. Upload each part
    for (const part of parts) {
      const url = pickUrl(uploadUrls, part.name, parts.length === 1);
      if (!url) throw new PipelineError('sarvam:upload-urls missing URL', { retryable: true, userMessage: STT_FAILED });
      const body = await readFile(part.localPath);
      await fetchStep(
        url,
        { method: 'PUT', body: new Uint8Array(body), headers: { 'Content-Type': 'audio/wav', 'x-ms-blob-type': 'BlockBlob' } },
        step('upload', 10 * 60_000),
      );
    }

    // 4. Start
    await fetchStep(`${jobPath}/start`, { method: 'POST', headers }, step('start'));
    log.info({ parts: parts.length, durationSec: input.durationSec }, 'Sarvam batch job started');

    // 5. Poll
    const extraHours = Math.max(0, Math.ceil(input.durationSec / 3600) - 1);
    const deadline = Date.now() + sarvamTiming.pollTimeoutMs + extraHours * sarvamTiming.perHourExtraMs;
    let status: JobStatus | null = null;
    while (Date.now() < deadline) {
      await sleep(sarvamTiming.pollIntervalMs);
      const res = await fetchStep(`${jobPath}/status`, { method: 'GET', headers: { 'api-subscription-key': apiKey } }, step('status', 30_000));
      const current = (asObject(await readJson(res, 'sarvam:status', STT_FAILED)) ?? {}) as JobStatus;
      if (current.job_state === 'Completed' || current.job_state === 'PartiallyCompleted' || current.job_state === 'Failed') {
        status = current;
        break;
      }
    }
    if (!status) {
      throw new PipelineError('Sarvam batch job polling timed out', {
        retryable: true,
        userMessage: 'Speech-to-text took too long. Please try again.',
      });
    }
    if (status.job_state === 'Failed') {
      // Audio was already validated by ffmpeg, so a failed job is most likely transient on the provider side.
      throw new PipelineError('Sarvam batch job failed', { retryable: true, userMessage: STT_FAILED });
    }

    const names = outputNames(status, parts);
    if (names.size !== parts.length) {
      throw new PipelineError(`Sarvam job ${status.job_state ?? '?'}: ${parts.length - names.size} output(s) missing`, {
        retryable: true,
        userMessage: STT_FAILED,
      });
    }

    // 6. Download URLs
    const dlRes = await fetchStep(
      `${base}/speech-to-text/job/v1/download-files`,
      { method: 'POST', headers, body: JSON.stringify({ job_id: jobId, files: [...names.values()] }) },
      step('download-urls'),
    );
    const downloadUrls = asObject(await readJson(dlRes, 'sarvam:download-urls', STT_FAILED))?.download_urls as UrlMap | undefined;

    // 7. Download + parse each part
    const texts: string[] = [];
    const segments: TranscriptSegment[] = [];
    let approximate = false;
    for (const part of parts) {
      const url = pickUrl(downloadUrls, names.get(part.name)!, parts.length === 1);
      if (!url) throw new PipelineError('sarvam:download-urls missing URL', { retryable: true, userMessage: STT_FAILED });
      const fileRes = await fetchStep(url, { method: 'GET' }, step('download', 120_000));
      const parsed = parseSarvamOutput(await readJson(fileRes, 'sarvam:download', STT_FAILED));
      if (!parsed.text) continue;
      texts.push(parsed.text);
      if (parsed.segments) {
        segments.push(...placeSegments(parsed.segments, part));
      } else {
        approximate = true;
        segments.push(...distributeSentences(parsed.text, part.durationSec, part.offsetSec));
      }
    }

    const transcript = texts.join('\n').trim();
    if (!transcript) {
      throw new PipelineError('Sarvam returned an empty transcript', {
        retryable: false,
        userMessage: 'No speech was detected in the recording. Check the microphone and try again.',
      });
    }
    if (approximate) log.warn('Sarvam output had no timestamps; segment times were distributed over the audio duration');
    return {
      transcript,
      segments,
      meta: { provider: 'sarvam', model: input.model, approximateTimestamps: approximate, demoFallback: false },
    };
  } finally {
    await cleanupParts(parts);
  }
}
