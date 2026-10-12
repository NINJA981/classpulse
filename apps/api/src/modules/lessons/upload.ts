/**
 * Browser audio upload: multer disk storage into storage.tmpDir (never memory),
 * MIME + extension allowlists, size limit, server-generated file names, and a
 * per-teacher upload rate limit. The file's first bytes must look like an audio
 * container; it is then probed and normalized with ffmpeg (local files and safe
 * demuxers only), capped at MAX_LESSON_AUDIO_SEC, checked against the school's
 * storage limit and moved into storage.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import type { LessonDetail, SessionUser } from '@classpulse/shared';
import { env } from '../../config/env.js';
import { AppError, badRequest } from '../../lib/errors.js';
import { assertAudioContainer, normalizedWavDurationSec, normalizeToWav, probeAudioDurationSec } from '../../lib/ffmpeg.js';
import { storage, storageKeys } from '../../lib/storage.js';
import { assertStorageAvailable } from '../../lib/storageQuota.js';
import { lessonAudioUploadLimiter, limited } from '../../middleware/uploadLimit.js';
import { attachLessonAudio, queueLessonGeneration } from './audio.js';
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
  // Phone recorders and messaging apps often save audio in an MP4/MPEG container; browsers then report a
  // video/* type. The file is probed and normalized by ffmpeg afterwards, so a file with no audio still fails.
  'video/mp4',
  'video/mpeg',
]);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.aac', '.ogg', '.oga', '.opus', '.webm', '.flac', '.mpeg', '.mpga']);

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

/** Built per request so the size limit always reflects the current config. Rate-limited per teacher. */
export const audioUploadMiddleware: RequestHandler = limited(lessonAudioUploadLimiter, (req, res, next) => {
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
});

/** "4 hours", "90 minutes": the lesson audio limit for messages. */
export function formatAudioLimit(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600} hour${sec === 3600 ? '' : 's'}`;
  const minutes = Math.round(sec / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

const tooLong = () =>
  new AppError(
    'PAYLOAD_TOO_LARGE',
    `Recordings can be at most ${formatAudioLimit(env.MAX_LESSON_AUDIO_SEC)} long. Trim the recording or split it into shorter lessons.`,
  );

export async function processUploadedAudio(
  user: SessionUser,
  lessonId: string,
  file: Express.Multer.File | undefined,
): Promise<LessonDetail> {
  if (!file) throw badRequest('Attach an audio file in the "file" field.');
  const wavPath = storage.newTmpPath('.wav');
  let storedKey: string | null = null;
  try {
    await assertAudioContainer(file.path);
    // The container's claim is checked first (cheap); a missing or false claim is caught by `-t` below.
    const claimedSec = await probeAudioDurationSec(file.path);
    if (claimedSec !== null && claimedSec > env.MAX_LESSON_AUDIO_SEC) throw tooLong();
    await normalizeToWav(file.path, wavPath, { maxSec: env.MAX_LESSON_AUDIO_SEC });
    // What was actually decoded is the duration used for transcription quotas.
    const durationSec = await normalizedWavDurationSec(wavPath);
    if (durationSec <= 0) throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The file could not be read as audio');
    const lesson = await assertCanUploadAudio(user, lessonId); // state may have changed while transcoding
    const wavBytes = (await stat(wavPath)).size;
    await assertStorageAvailable(user.institutionId, wavBytes, lesson.audioObjectKey ? (lesson.audioSizeBytes ?? 0) : 0);
    storedKey = storageKeys.lessonAudio(lessonId);
    const stored = await storage.putFile(storedKey, wavPath);
    await attachLessonAudio({ lessonId, objectKey: storedKey, sizeBytes: stored.size, durationSec, sourceType: 'upload' });
    storedKey = null; // now owned by the lesson
    // Transcribe right away; the teacher then chooses the number of questions and difficulty.
    await queueLessonGeneration(lessonId, null);
    return buildLessonDetail(await getOwnedLesson(user, lessonId));
  } finally {
    await rm(file.path, { force: true }).catch(() => undefined);
    await rm(wavPath, { force: true }).catch(() => undefined);
    if (storedKey) await storage.delete(storedKey).catch(() => undefined);
  }
}
