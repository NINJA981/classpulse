import fs from 'fs';
import { ingestLectureFileInProcess } from '../pipeline/embeddedPipeline.js';
import type { PipelineQuestion, PipelineIngestResult } from '../pipeline/types.js';

export type { PipelineQuestion, PipelineIngestResult };

/**
 * Unified Pipeline Client:
 * - Default: Embedded in-process execution (Zero external services required)
 * - Optional: Remote mode if PIPELINE_MODE=remote is explicitly configured
 */

const PIPELINE_MODE = process.env.PIPELINE_MODE || 'embedded';
const PIPELINE_URL = (process.env.PIPELINE_URL || 'http://localhost:4000').replace(/\/$/, '');
const PIPELINE_API_KEY = process.env.PIPELINE_API_KEY || process.env.EMBED_API_KEY || '';

export class PipelineError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PipelineError';
    this.status = status;
  }
}

/**
 * Ingest a full lecture recording:
 * By default runs the embedded pipeline in-process.
 */
export async function ingestLectureFile(params: {
  filePath: string;
  title: string;
  subject: string;
  teacherId: string;
  language?: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<PipelineIngestResult> {
  // 1. In-process embedded execution (Option 3 default)
  if (PIPELINE_MODE !== 'remote') {
    try {
      return await ingestLectureFileInProcess(params);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new PipelineError(500, `Embedded pipeline error: ${msg}`);
    }
  }

  // 2. Remote fallback execution (if explicitly configured)
  const buffer = await fs.promises.readFile(params.filePath);
  const ext = params.filePath.split('.').pop()?.toLowerCase() || 'webm';
  const mimeByExt: Record<string, string> = {
    webm: 'audio/webm',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/x-m4a',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac'
  };
  const mimeType = mimeByExt[ext] || 'application/octet-stream';

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), `lecture.${ext}`);
  form.append('title', params.title);
  form.append('subject', params.subject);
  form.append('language', params.language || 'en-IN');
  form.append('externalIds', JSON.stringify({ teacherId: params.teacherId }));
  form.append('questionCount', String(params.questionCount ?? 5));
  form.append('difficulty', params.difficulty ?? 'medium');
  form.append('types', JSON.stringify(['mcq', 'true_false']));

  const headers: Record<string, string> = {};
  if (PIPELINE_API_KEY) {
    headers['x-api-key'] = PIPELINE_API_KEY;
  }

  const res = await fetch(`${PIPELINE_URL}/v1/ingest/audio-file`, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(900_000)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      detail = parsed.error || text;
    } catch {
      /* keep raw */
    }
    throw new PipelineError(res.status, `Remote pipeline ingest: ${detail.slice(0, 400)}`);
  }
  return (await res.json()) as PipelineIngestResult;
}

/** Health probe used by /api/health to report pipeline connectivity. */
export async function pipelineHealth(): Promise<{ ok: boolean; detail: string; mode: string }> {
  if (PIPELINE_MODE !== 'remote') {
    return {
      ok: true,
      mode: 'embedded',
      detail: 'In-process lecture pipeline active (Sarvam STT + AI assessment)'
    };
  }

  try {
    const res = await fetch(`${PIPELINE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, mode: 'remote', detail: `HTTP ${res.status}` };
    const body = (await res.json()) as { status?: string };
    return { ok: body.status === 'healthy', mode: 'remote', detail: body.status || 'unknown' };
  } catch (err) {
    return { ok: false, mode: 'remote', detail: String(err) };
  }
}
