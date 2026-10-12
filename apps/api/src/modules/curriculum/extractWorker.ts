/**
 * Extraction sandbox: runs in a worker_threads Worker started by extract.ts with a small heap
 * (resourceLimits) and a hard timeout, so a hostile PDF or DOCX can exhaust only this worker, never the
 * API's event loop or heap. Receives one job in `workerData`, posts one ExtractReply and exits.
 *
 * PDFs are read page by page (at most `maxPages`) and reading stops once `maxChars` characters were
 * collected. DOCX zips are scanned (entry count, declared and actual uncompressed size, compression
 * ratio) before mammoth parses them.
 */
import { parentPort, workerData } from 'node:worker_threads';
import mammoth from 'mammoth';
import { getDocumentProxy } from 'unpdf';
import { scanZip, verifyZipInflation, ZipLimitError, type ZipLimits } from './zipScan.js';

export interface ExtractJob {
  kind: 'pdf' | 'docx';
  data: Uint8Array;
  maxPages: number;
  maxChars: number;
  zipLimits: ZipLimits;
}

export type ExtractReply =
  | { ok: true; text: string }
  /** `too_large`: over a size/zip limit (422); `unreadable`: damaged or not this format (400). */
  | { ok: false; reason: 'too_large' | 'unreadable'; detail: string };

async function extractPdf(job: ExtractJob): Promise<string> {
  const pdf = await getDocumentProxy(job.data);
  try {
    const pages = Math.min(pdf.numPages, job.maxPages);
    const parts: string[] = [];
    let chars = 0;
    for (let i = 1; i <= pages && chars < job.maxChars; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        const t = item as { str?: unknown; hasEOL?: unknown };
        if (typeof t.str === 'string') text += t.str + (t.hasEOL ? '\n' : '');
      }
      page.cleanup();
      parts.push(text);
      chars += text.length;
    }
    return parts.join('\n').slice(0, job.maxChars);
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function extractDocx(job: ExtractJob): Promise<string> {
  const buffer = Buffer.from(job.data.buffer, job.data.byteOffset, job.data.byteLength);
  verifyZipInflation(buffer, scanZip(buffer, job.zipLimits));
  const text = (await mammoth.extractRawText({ buffer })).value;
  return text.slice(0, job.maxChars);
}

export async function runExtractJob(job: ExtractJob): Promise<ExtractReply> {
  try {
    const text = job.kind === 'pdf' ? await extractPdf(job) : await extractDocx(job);
    return { ok: true, text };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 200) : 'error';
    return { ok: false, reason: err instanceof ZipLimitError ? 'too_large' : 'unreadable', detail };
  }
}

if (parentPort && workerData) {
  const port = parentPort;
  void runExtractJob(workerData as ExtractJob).then((reply) => port.postMessage(reply));
}
