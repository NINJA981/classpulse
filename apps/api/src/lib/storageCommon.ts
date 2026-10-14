/**
 * Shared pieces of the storage drivers (lib/storage.ts, lib/storageS3.ts): the interface, key and
 * prefix validation, and the temp-dir check. Kept separate so the S3 driver can be loaded lazily
 * without a circular import.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import {
  DEVICE_AUDIO_FORMAT,
  DEVICE_CHUNK_MAX_BYTES,
  DEVICE_MAX_CHUNKS_PER_SESSION,
  MATERIAL_MAX_MB,
  SUBMISSION_FILE_MAX_MB,
} from '@classiq/shared';
import { env } from '../config/env.js';
import { AppError, badRequest } from './errors.js';

/** Keys are `<prefix>/<segment>[/<segment>…]`; already safe as S3 object names and as relative paths. */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-zA-Z0-9][a-zA-Z0-9._-]*)+$/;

export interface ObjectStat {
  size: number;
  modifiedAt: Date;
}

export interface ObjectInfo extends ObjectStat {
  key: string;
}

export type ByteRange = { start: number; end: number };

export interface Storage {
  readonly driver: 'local' | 's3';
  /** Absolute directory for temporary files (multer uploads, ffmpeg scratch). Always on local disk. */
  readonly tmpDir: string;
  put(key: string, body: Buffer | Readable): Promise<ObjectStat>;
  /** Move a local file (usually under tmpDir) into storage. The local file is consumed on success. */
  putFile(key: string, localPath: string): Promise<ObjectStat>;
  /** Null when the object does not exist (or the key is invalid). Backend failures throw. */
  stat(key: string): Promise<ObjectStat | null>;
  /** Stream an object, optionally a byte range with both ends inclusive. */
  read(key: string, range?: ByteRange): Promise<Readable>;
  /**
   * Run `fn` with a local file holding the object (for tools that need a path, like ffmpeg or the STT
   * clients). The local driver passes the stored file itself, which `fn` must not modify or delete; S3
   * downloads to a temp file that is removed afterwards.
   */
  withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T>;
  /** Every object under `prefix/` (in no particular order). */
  list(prefix: string): AsyncIterable<ObjectInfo>;
  /** The direct child "folders" of `prefix/`, as prefixes without the trailing slash (e.g. `recordings/<id>`). */
  listPrefixes(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
  /** Delete every object under `prefix/` (never `prefix` + other characters). */
  deletePrefix(prefix: string): Promise<void>;
  newTmpPath(ext?: string): string;
  /** The backend is reachable and writable (local: a probe write; S3: HeadBucket). */
  checkReady(): Promise<void>;
}

export function assertKey(key: string): string {
  if (!KEY_PATTERN.test(key) || key.includes('..')) throw badRequest('Invalid storage key');
  return key;
}

/** Validate a key prefix and return it with exactly one trailing slash, e.g. `audio/<id>/`. */
export function normalizePrefix(prefix: string): string {
  const clean = prefix.replace(/\/+$/, '');
  assertKey(`${clean}/x`);
  return `${clean}/`;
}

const MB = 1024 * 1024;
const WAV_HEADER_BYTES = 44;
/** Stored lesson audio is 16 kHz mono 16-bit WAV (normalizeToWav, device recordings). */
const PCM_BYTES_PER_SEC = DEVICE_AUDIO_FORMAT.sampleRate * DEVICE_AUDIO_FORMAT.channels * 2;
/** Objects outside the known prefixes. */
export const DEFAULT_MAX_OBJECT_BYTES = 25 * MB;

/**
 * Largest object accepted under a key's prefix: a backstop behind the upload limits (multer, the
 * device chunk limit, the lesson length cap), never the primary check.
 * - audio: the longest WAV we can produce, a full device session or MAX_LESSON_AUDIO_SEC (+1 s rounding);
 * - recordings: one device chunk; submissions and materials: their per-file upload limits.
 */
export function maxObjectBytes(key: string): number {
  switch (key.slice(0, key.indexOf('/'))) {
    case 'audio':
      return (
        WAV_HEADER_BYTES +
        Math.max(DEVICE_CHUNK_MAX_BYTES * DEVICE_MAX_CHUNKS_PER_SESSION, (env.MAX_LESSON_AUDIO_SEC + 1) * PCM_BYTES_PER_SEC)
      );
    case 'recordings':
      return DEVICE_CHUNK_MAX_BYTES;
    case 'submissions':
      return SUBMISSION_FILE_MAX_MB * MB;
    case 'materials':
      return MATERIAL_MAX_MB * MB;
    default:
      return DEFAULT_MAX_OBJECT_BYTES;
  }
}

function tooLarge(key: string): AppError {
  return new AppError('PAYLOAD_TOO_LARGE', `The file is larger than the ${Math.floor(maxObjectBytes(key) / MB)} MB storage limit`);
}

export function assertObjectSize(key: string, size: number): void {
  if (size > maxObjectBytes(key)) throw tooLarge(key);
}

/** Pass-through stream that fails once more than the key's limit has gone through it. */
export function sizeLimiter(key: string): Transform {
  const max = maxObjectBytes(key);
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      cb(seen > max ? tooLarge(key) : null, chunk);
    },
  });
}

/** `body` piped through sizeLimiter(key); an error in `body` destroys the result too. */
export function limitedStream(key: string, body: Readable): Readable {
  const limited = sizeLimiter(key);
  body.once('error', (err) => limited.destroy(err));
  limited.once('error', () => body.destroy());
  return body.pipe(limited);
}

export function tmpPathIn(tmpDir: string, ext = ''): string {
  return path.join(tmpDir, `${randomUUID()}${ext}`);
}

/** The temp dir exists and accepts writes (uploads, transcodes and S3 downloads all need it). */
export async function checkTmpWritable(tmpDir: string): Promise<void> {
  await fs.mkdir(tmpDir, { recursive: true });
  const probe = path.join(tmpDir, `.probe-${randomUUID()}`);
  await fs.writeFile(probe, 'ok');
  await fs.rm(probe, { force: true });
}
