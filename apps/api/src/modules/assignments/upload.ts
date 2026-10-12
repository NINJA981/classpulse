/**
 * Submission file upload: multer disk storage into storage.tmpDir (never memory), MIME AND extension
 * allowlists (SUBMISSION_FILE_TYPES), a per-file size limit and server-generated file names. After upload
 * each file's first bytes must match its declared type (magic bytes), and the school's storage limit is
 * checked. Files are moved into storage by the student service once the submission is accepted; temp
 * files are always removed.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { MAX_SUBMISSION_FILES, SUBMISSION_FILE_MAX_MB, SUBMISSION_FILE_TYPES } from '@classpulse/shared';
import { AppError } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { assertStorageAvailable } from '../../lib/storageQuota.js';
import { currentUser } from '../../middleware/auth.js';

const ALLOWED = new Map<string, readonly string[]>(Object.entries(SUBMISSION_FILE_TYPES));

/** The validated, lower-case extension of an accepted upload. */
export const uploadExtension = (file: Express.Multer.File) => path.extname(file.originalname).toLowerCase();

export function isAllowedSubmissionFile(mime: string, originalName: string): boolean {
  return ALLOWED.get(mime.toLowerCase())?.includes(path.extname(originalName).toLowerCase()) ?? false;
}

const unsupported = () =>
  new AppError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported file type. Upload PDF, JPEG, PNG, HEIC or Word (.docx) files.');

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir(storage.tmpDir, { recursive: true }).then(
      () => cb(null, storage.tmpDir),
      (err: Error) => cb(err, storage.tmpDir),
    );
  },
  // Server-generated name; only a validated extension is kept from the client.
  filename: (_req, file, cb) => cb(null, `submission-${randomUUID()}${uploadExtension(file)}`),
});

const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);
/** How far into a PDF the `%PDF-` header may start (readers accept a little leading junk). */
const PDF_HEADER_WINDOW = 1024;

/** True when the file's first bytes match its declared MIME type. */
export function matchesMagicBytes(mime: string, head: Buffer): boolean {
  const ascii = (start: number, end: number) => head.subarray(start, end).toString('latin1');
  switch (mime.toLowerCase()) {
    case 'application/pdf':
      return head.subarray(0, PDF_HEADER_WINDOW).includes('%PDF-', 0, 'latin1');
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/heic':
    case 'image/heif':
      return ascii(4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(8, 12));
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return ascii(0, 4) === 'PK\u0003\u0004';
    default:
      return false;
  }
}

async function readHead(filePath: string, bytes: number): Promise<Buffer> {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Content and storage-limit checks once multer has written the files; removes them all on failure. */
async function checkUploadedFiles(req: Parameters<RequestHandler>[0], files: Express.Multer.File[]): Promise<void> {
  try {
    for (const f of files) {
      if (!matchesMagicBytes(f.mimetype, await readHead(f.path, PDF_HEADER_WINDOW))) throw unsupported();
    }
    await assertStorageAvailable(currentUser(req).institutionId, files.reduce((sum, f) => sum + f.size, 0));
  } catch (err) {
    await cleanupUploads(files);
    throw err;
  }
}

/** Field `files` (array) plus text fields. Non-multipart (JSON) requests pass through untouched. */
export const submissionUploadMiddleware: RequestHandler = (req, res, next) => {
  multer({
    storage: diskStorage,
    // UTF-8 file names (busboy defaults to latin1).
    defParamCharset: 'utf8',
    limits: { fileSize: SUBMISSION_FILE_MAX_MB * 1024 * 1024, files: MAX_SUBMISSION_FILES, fields: 5, parts: MAX_SUBMISSION_FILES + 5 },
    fileFilter: (_req, file, cb) => {
      if (!isAllowedSubmissionFile(file.mimetype, file.originalname)) return cb(unsupported());
      cb(null, true);
    },
  }).array('files', MAX_SUBMISSION_FILES)(req, res, (err?: unknown) => {
    if (err) return next(err);
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return next();
    checkUploadedFiles(req, files).then(() => next(), next);
  });
};

/** Remove multer temp files (after they were moved into storage, or on failure). */
export async function cleanupUploads(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((f) => rm(f.path, { force: true }).catch(() => undefined)));
}
