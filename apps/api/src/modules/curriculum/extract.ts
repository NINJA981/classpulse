/**
 * Plain-text extraction from teacher materials (PDF via unpdf, DOCX via mammoth, TXT/MD as UTF-8).
 * The file type is decided by the validated extension AND the file's magic bytes, never by the
 * client's MIME type alone. Text is whitespace-normalised and capped at MATERIAL_TEXT_MAX_CHARS.
 */
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import type { MaterialKind } from '@classpulse/shared';
import { AppError, badRequest } from '../../lib/errors.js';

export const MATERIAL_TEXT_MAX_CHARS = 200_000;

export const MATERIAL_EXTENSIONS: Record<string, MaterialKind> = { '.pdf': 'pdf', '.docx': 'docx', '.txt': 'text', '.md': 'text' };

const unsupported = () => new AppError('UNSUPPORTED_MEDIA_TYPE', 'Upload a PDF, Word (.docx) or text (.txt) file.');

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

export async function extractMaterialText(kind: MaterialKind, buffer: Buffer): Promise<string> {
  let text: string;
  if (kind === 'pdf') {
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw unsupported();
    try {
      text = (await extractText(new Uint8Array(buffer), { mergePages: true })).text;
    } catch {
      throw badRequest('This PDF could not be read. It may be damaged or password-protected.');
    }
  } else if (kind === 'docx') {
    if (buffer.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') throw unsupported();
    try {
      text = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw badRequest('This Word file could not be read. Save it as .docx and try again.');
    }
  } else {
    if (buffer.includes(0)) throw unsupported();
    text = buffer.toString('utf8');
  }
  const clean = normalizeText(text);
  if (!clean) {
    throw badRequest('No text could be read from this file. Scanned PDFs (images of pages) are not supported — upload a text-based PDF, DOCX or TXT.');
  }
  return clean;
}
