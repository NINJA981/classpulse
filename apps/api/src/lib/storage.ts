/**
 * Object storage abstraction. Callers deal only in opaque *keys* such as
 * `audio/<lessonId>/<uuid>.wav` — never in filesystem paths.
 *
 * Drivers (STORAGE_DRIVER):
 * - `local` (default): keys map to files under STORAGE_DIR; anything that could escape it is rejected.
 * - `s3`: an S3-compatible bucket (self-hosted Garage), see lib/storageS3.ts. Loaded lazily so the
 *   local driver never pays for the AWS SDK.
 *
 * Temporary files (uploads in progress, transcodes, S3 downloads) always live on local disk in TMP_DIR.
 */
import { createReadStream, createWriteStream, type Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';
import {
  assertKey,
  assertObjectSize,
  checkTmpWritable,
  sizeLimiter,
  normalizePrefix,
  tmpPathIn,
  type ByteRange,
  type ObjectInfo,
  type ObjectStat,
  type Storage,
} from './storageCommon.js';

export { checkTmpWritable, KEY_PATTERN, maxObjectBytes, type ByteRange, type ObjectInfo, type ObjectStat, type Storage } from './storageCommon.js';

export class LocalStorage implements Storage {
  readonly driver = 'local' as const;
  readonly root: string;
  readonly tmpDir: string;

  constructor(dir: string, tmpDir = path.join(dir, 'tmp')) {
    this.root = path.resolve(dir);
    this.tmpDir = path.resolve(tmpDir);
  }

  /** Absolute path of a key under the root. Local driver only (tests, the migration script). */
  pathOf(key: string): string {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw badRequest('Invalid storage key');
    return full;
  }

  private dirOf(prefix: string): string {
    return this.pathOf(`${normalizePrefix(prefix)}x`).slice(0, -2);
  }

  newTmpPath(ext = ''): string {
    return tmpPathIn(this.tmpDir, ext);
  }

  async put(key: string, body: Buffer | Readable): Promise<ObjectStat> {
    const dest = this.pathOf(key);
    if (Buffer.isBuffer(body)) assertObjectSize(key, body.length);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${randomUUID()}.part`;
    try {
      if (Buffer.isBuffer(body)) await fs.writeFile(tmp, body);
      else await pipeline(body, sizeLimiter(key), createWriteStream(tmp));
      await fs.rename(tmp, dest);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
    return (await this.stat(key))!;
  }

  async putFile(key: string, localPath: string): Promise<ObjectStat> {
    const dest = this.pathOf(key);
    assertObjectSize(key, (await fs.stat(localPath)).size);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(localPath, dest);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
      // TMP_DIR is on another volume: copy next to the destination, then rename (still atomic for readers).
      const part = `${dest}.${randomUUID()}.part`;
      try {
        await fs.copyFile(localPath, part);
        await fs.rename(part, dest);
      } catch (copyErr) {
        await fs.rm(part, { force: true }).catch(() => undefined);
        throw copyErr;
      }
      await fs.rm(localPath, { force: true });
    }
    return (await this.stat(key))!;
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      const s = await fs.stat(this.pathOf(key));
      return s.isFile() ? { size: s.size, modifiedAt: s.mtime } : null;
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange): Promise<Readable> {
    const stream = createReadStream(this.pathOf(key), range);
    // Surface a missing file as a rejection (like S3), not as a later stream error.
    await new Promise<void>((resolve, reject) => {
      stream.once('open', () => resolve());
      stream.once('error', reject);
    });
    return stream;
  }

  async withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    const file = this.pathOf(key);
    await fs.access(file); // missing objects reject, as with S3
    return fn(file);
  }

  async *list(prefix: string): AsyncIterable<ObjectInfo> {
    const base = this.dirOf(prefix);
    const walk = async function* (root: string, dir: string): AsyncGenerator<ObjectInfo> {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return; // the prefix doesn't exist (yet), or vanished meanwhile
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(root, full);
        else if (entry.isFile()) {
          // Symlinks and special files are never storage objects.
          const s = await fs.stat(full).catch(() => null);
          if (s) yield { key: path.relative(root, full).split(path.sep).join('/'), size: s.size, modifiedAt: s.mtime };
        }
      }
    };
    yield* walk(this.root, base);
  }

  async listPrefixes(prefix: string): Promise<string[]> {
    const clean = normalizePrefix(prefix);
    const entries = await fs.readdir(this.dirOf(prefix), { withFileTypes: true }).catch(() => [] as Dirent[]);
    return entries.filter((e) => e.isDirectory()).map((e) => `${clean}${e.name}`);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.pathOf(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await fs.rm(this.dirOf(prefix), { recursive: true, force: true });
  }

  async checkReady(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const probe = path.join(this.root, `.probe-${randomUUID()}`);
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
  }

  /** Tests only: backdate an object's modification time (the S3 driver has no equivalent). */
  async setModifiedAtForTests(key: string, when: Date): Promise<void> {
    await fs.utimes(this.pathOf(key), when, when);
  }
}

async function createStorage(): Promise<Storage> {
  if (env.STORAGE_DRIVER === 'local') return new LocalStorage(env.STORAGE_DIR, env.TMP_DIR);
  const { S3Storage } = await import('./storageS3.js');
  return new S3Storage({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    tmpDir: env.TMP_DIR,
  });
}

export const storage: Storage = await createStorage();

/** Readiness (boot and /api/health/ready): the backend answers and the local temp dir is writable. */
export async function storageReady(): Promise<void> {
  await Promise.all([storage.checkReady(), checkTmpWritable(storage.tmpDir)]);
}

/** Temp files older than this are leftovers of crashed or killed uploads and transcodes. */
export const TMP_MAX_AGE_MS = 2 * 3600_000;

/**
 * Delete entries under storage.tmpDir not modified for `maxAgeMs` (files first, then directories that
 * are old and empty). Symlinks are removed, never followed. Returns the number of files removed.
 * Uploads in progress keep touching their file, so they are never old enough to be swept.
 */
export async function sweepTmpDir(maxAgeMs = TMP_MAX_AGE_MS, now = Date.now()): Promise<number> {
  const cutoff = now - maxAgeMs;
  let removed = 0;
  const sweep = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await sweep(full);
        const st = await fs.lstat(full).catch(() => null);
        if (st && st.mtimeMs < cutoff) await fs.rmdir(full).catch(() => undefined); // only succeeds when empty
        continue;
      }
      const st = await fs.lstat(full).catch(() => null);
      if (!st || st.mtimeMs >= cutoff) continue;
      try {
        await fs.rm(full, { force: true });
        removed++;
      } catch {
        // In use (Windows) or already gone: the next sweep retries.
      }
    }
  };
  await sweep(storage.tmpDir);
  return removed;
}

export const storageKeys = {
  lessonAudio: (lessonId: string) => `audio/${lessonId}/${randomUUID()}.wav`,
  recordingChunk: (sessionId: string, idx: number) => `recordings/${sessionId}/${String(idx).padStart(5, '0')}.pcm`,
  recordingPrefix: (sessionId: string) => `recordings/${sessionId}`,
  /** `ext` must be a validated extension such as ".pdf" (never taken unchecked from the client). */
  submissionFile: (assignmentId: string, studentId: string, ext: string) => `submissions/${assignmentId}/${studentId}/${randomUUID()}${ext}`,
};
