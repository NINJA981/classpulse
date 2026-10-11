/**
 * Submission file upload: multer disk storage into storage.tmpDir (never memory), MIME AND extension
 * allowlists (SUBMISSION_FILE_TYPES), a per-file size limit and server-generated file names. Files are moved
 * into storage by the student service once the submission is accepted; temp files are always removed.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { MAX_SUBMISSION_FILES, SUBMISSION_FILE_MAX_MB, SUBMISSION_FILE_TYPES } from '@classpulse/shared';
import { AppError } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';

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
  }).array('files', MAX_SUBMISSION_FILES)(req, res, next);
};

/** Remove multer temp files (after they were moved into storage, or on failure). */
export async function cleanupUploads(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((f) => rm(f.path, { force: true }).catch(() => undefined)));
}
