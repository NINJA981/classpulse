/**
 * Browser audio upload: multer disk storage into storage.tmpDir (never memory),
 * MIME + extension allowlists, size limit, server-generated file names. The
 * file is validated and normalized with ffmpeg, then moved into storage.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import type { LessonDetail, SessionUser } from '@classpulse/shared';
import { env } from '../../config/env.js';
import { AppError, badRequest } from '../../lib/errors.js';
import { normalizeToWav, probeDurationSec } from '../../lib/ffmpeg.js';
import { storage, storageKeys } from '../../lib/storage.js';
import { attachLessonAudio } from './audio.js';
import { assertCanUploadAudio, buildLessonDetail } from './service.js';
import { getOwnedLesson } from './repo.js';

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
]);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.aac', '.ogg', '.oga', '.opus', '.webm', '.flac']);

const unsupported = () =>
  new AppError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported file type. Upload MP3, WAV, M4A, AAC, OGG, WEBM or FLAC audio.');

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir(storage.tmpDir, { recursive: true }).then(
      () => cb(null, storage.tmpDir),
      (err: Error) => cb(err, storage.tmpDir),
    );
  },
  // Server-generated name; only a validated extension is kept from the client.
  filename: (_req, file, cb) => cb(null, `upload-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

/** Built per request so the size limit always reflects the current config. */
export const audioUploadMiddleware: RequestHandler = (req, res, next) => {
  const upload = multer({
    storage: diskStorage,
    limits: { fileSize: env.MAX_AUDIO_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10, parts: 12 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!AUDIO_MIME_TYPES.has(file.mimetype.toLowerCase()) || !AUDIO_EXTENSIONS.has(ext)) return cb(unsupported());
      cb(null, true);
    },
  }).single('file');
  upload(req, res, next);
};

export async function processUploadedAudio(
  user: SessionUser,
  lessonId: string,
  file: Express.Multer.File | undefined,
): Promise<LessonDetail> {
  if (!file) throw badRequest('Attach an audio file in the "file" field.');
  const wavPath = storage.newTmpPath('.wav');
  let storedKey: string | null = null;
  try {
    const durationSec = await probeDurationSec(file.path);
    await normalizeToWav(file.path, wavPath);
    await assertCanUploadAudio(user, lessonId); // state may have changed while transcoding
    storedKey = storageKeys.lessonAudio(lessonId);
    const stat = await storage.putFile(storedKey, wavPath);
    await attachLessonAudio({ lessonId, objectKey: storedKey, sizeBytes: stat.size, durationSec, sourceType: 'upload' });
    storedKey = null; // now owned by the lesson
    return buildLessonDetail(await getOwnedLesson(user, lessonId));
  } finally {
    await rm(file.path, { force: true }).catch(() => undefined);
    await rm(wavPath, { force: true }).catch(() => undefined);
    if (storedKey) await storage.delete(storedKey).catch(() => undefined);
  }
}
