/**
 * Object storage abstraction. Callers deal only in opaque *keys* such as
 * `audio/<lessonId>/<uuid>.wav` — never in filesystem paths. The local driver
 * maps keys under STORAGE_DIR and rejects anything that could escape it.
 *
 * Only the `local` driver is implemented for the single-VPS pilot; an S3/R2
 * driver can implement the same interface later.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-zA-Z0-9][a-zA-Z0-9._-]*)+$/;

export interface ObjectStat {
  size: number;
  modifiedAt: Date;
}

export interface Storage {
  /** Absolute directory for temporary files (multer uploads, ffmpeg scratch). */
  readonly tmpDir: string;
  put(key: string, body: Buffer | Readable): Promise<ObjectStat>;
  /** Move a local temp file into storage (atomic rename on the same volume). */
  putFile(key: string, localPath: string): Promise<ObjectStat>;
  stat(key: string): Promise<ObjectStat | null>;
  read(key: string, range?: { start: number; end: number }): Readable;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** Absolute local path for tools like ffmpeg (local driver only). */
  localPath(key: string): string;
  newTmpPath(ext?: string): string;
  ensureWritable(): Promise<void>;
}

class LocalStorage implements Storage {
  readonly root: string;
  readonly tmpDir: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
    this.tmpDir = path.join(this.root, 'tmp');
  }

  localPath(key: string): string {
    if (!KEY_PATTERN.test(key) || key.includes('..')) throw badRequest('Invalid storage key');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw badRequest('Invalid storage key');
    return full;
  }

  private assertPrefix(prefix: string): string {
    const clean = prefix.replace(/\/+$/, '');
    return this.localPath(`${clean}/x`).slice(0, -2);
  }

  newTmpPath(ext = ''): string {
    return path.join(this.tmpDir, `${randomUUID()}${ext}`);
  }

  async put(key: string, body: Buffer | Readable): Promise<ObjectStat> {
    const dest = this.localPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${randomUUID()}.part`;
    if (Buffer.isBuffer(body)) await fs.writeFile(tmp, body);
    else await pipeline(body, createWriteStream(tmp));
    await fs.rename(tmp, dest);
    return (await this.stat(key))!;
  }

  async putFile(key: string, localPath: string): Promise<ObjectStat> {
    const dest = this.localPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(localPath, dest);
    } catch {
      await fs.copyFile(localPath, dest);
      await fs.rm(localPath, { force: true });
    }
    return (await this.stat(key))!;
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      const s = await fs.stat(this.localPath(key));
      return { size: s.size, modifiedAt: s.mtime };
    } catch {
      return null;
    }
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    return createReadStream(this.localPath(key), range);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.localPath(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await fs.rm(this.assertPrefix(prefix), { recursive: true, force: true });
  }

  async ensureWritable(): Promise<void> {
    await fs.mkdir(this.tmpDir, { recursive: true });
    const probe = path.join(this.tmpDir, `.probe-${randomUUID()}`);
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
  }
}

export const storage: Storage = new LocalStorage(env.STORAGE_DIR);

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
