/**
 * Plain-text extraction from teacher materials (PDF via unpdf, DOCX via mammoth, TXT/MD as UTF-8).
 * The file type is decided by the validated extension AND the file's magic bytes, never by the
 * client's MIME type alone. Text is whitespace-normalised and capped at MATERIAL_TEXT_MAX_CHARS.
 *
 * PDF and DOCX parsing never runs on the API's event loop: each file is parsed in a worker thread
 * (extractWorker.ts) with a small heap and a hard timeout, at most EXTRACTION_CONCURRENCY at a time.
 * A file that exhausts the worker's memory or time, or a DOCX that fails the zip-bomb checks, gets
 * 422 UNPROCESSABLE "This file couldn't be read".
 */
import { Worker } from 'node:worker_threads';
import type { MaterialKind } from '@classpulse/shared';
import { AppError, badRequest } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { ExtractJob, ExtractReply } from './extractWorker.js';
import { DOCX_ZIP_LIMITS } from './zipScan.js';

export const MATERIAL_TEXT_MAX_CHARS = 200_000;
/** PDFs: only the first MATERIAL_PDF_MAX_PAGES pages are read. */
export const MATERIAL_PDF_MAX_PAGES = 300;

/** Worker sandbox limits (mutable for tests). */
export const extractionLimits = {
  timeoutMs: 20_000,
  heapMb: 256,
};
const EXTRACTION_CONCURRENCY = 2;

export const MATERIAL_EXTENSIONS: Record<string, MaterialKind> = { '.pdf': 'pdf', '.docx': 'docx', '.txt': 'text', '.md': 'text' };

const unsupported = () => new AppError('UNSUPPORTED_MEDIA_TYPE', 'Upload a PDF, Word (.docx) or text (.txt) file.');
export const UNREADABLE_FILE_MESSAGE =
  "This file couldn't be read: it is too large or complex to open safely. Split it into smaller files, or save it again and retry.";
const unprocessable = () => new AppError('UNPROCESSABLE', UNREADABLE_FILE_MESSAGE);

/** Collapse runs of spaces, keep paragraph breaks, drop control characters, cap the length. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t\xa0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MATERIAL_TEXT_MAX_CHARS);
}

/* ------------------------------- worker sandbox ------------------------------- */

let running = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (running < EXTRACTION_CONCURRENCY) {
    running++;
    return;
  }
  // release() hands its slot straight to the next waiter.
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

/** The compiled worker in production; the TypeScript source (loaded through tsx) in dev and tests. */
function workerTarget(): { url: URL; execArgv: string[] } {
  const isTs = import.meta.url.endsWith('.ts');
  return {
    url: new URL(isTs ? './extractWorker.ts' : './extractWorker.js', import.meta.url),
    execArgv: isTs ? ['--import', 'tsx'] : [],
  };
}

type Outcome = ExtractReply | { ok: false; reason: 'timeout' | 'crashed'; detail: string };

function runInWorker(job: ExtractJob): Promise<Outcome> {
  const { url, execArgv } = workerTarget();
  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(url, {
      workerData: job,
      execArgv,
      resourceLimits: { maxOldGenerationSizeMb: extractionLimits.heapMb, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
      // Parser warnings stay out of the API's logs.
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    const finish = (outcome: Outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(outcome);
    };
    const timer = setTimeout(
      () => finish({ ok: false, reason: 'timeout', detail: `over ${extractionLimits.timeoutMs} ms` }),
      extractionLimits.timeoutMs,
    );
    worker.on('message', (reply: ExtractReply) => finish(reply));
    // ERR_WORKER_OUT_OF_MEMORY and any uncaught error in the worker.
    worker.on('error', (err: NodeJS.ErrnoException) => finish({ ok: false, reason: 'crashed', detail: err.code ?? err.name }));
    worker.on('exit', (code) => finish({ ok: false, reason: 'crashed', detail: `exited with code ${code}` }));
  });
}

async function extractInSandbox(kind: 'pdf' | 'docx', buffer: Buffer): Promise<string> {
  await acquire();
  let outcome: Outcome;
  try {
    outcome = await runInWorker({
      kind,
      data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      maxPages: MATERIAL_PDF_MAX_PAGES,
      // Raw text before whitespace normalisation; normalizeText applies the final cap.
      maxChars: MATERIAL_TEXT_MAX_CHARS * 2,
      zipLimits: DOCX_ZIP_LIMITS,
    });
  } finally {
    release();
  }
  if (outcome.ok) return outcome.text;
  if (outcome.reason === 'unreadable') {
    throw kind === 'pdf'
      ? badRequest('This PDF could not be read. It may be damaged or password-protected.')
      : badRequest('This Word file could not be read. Save it as .docx and try again.');
  }
  logger.warn({ kind, reason: outcome.reason, detail: outcome.detail, bytes: buffer.length }, 'Material extraction refused');
  throw unprocessable();
}

/* --------------------------------- entry point --------------------------------- */

export async function extractMaterialText(kind: MaterialKind, buffer: Buffer): Promise<string> {
  let text: string;
  if (kind === 'pdf') {
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw unsupported();
    text = await extractInSandbox('pdf', buffer);
  } else if (kind === 'docx') {
    if (buffer.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') throw unsupported();
    text = await extractInSandbox('docx', buffer);
  } else {
    if (buffer.includes(0)) throw unsupported();
    // Plain text needs no sandbox; only the start can survive the cap anyway.
    text = buffer.subarray(0, MATERIAL_TEXT_MAX_CHARS * 8).toString('utf8');
  }
  const clean = normalizeText(text);
  if (!clean) {
    throw badRequest('No text could be read from this file. Scanned PDFs (images of pages) are not supported — upload a text-based PDF, DOCX or TXT.');
  }
  return clean;
}
