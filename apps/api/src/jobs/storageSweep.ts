/**
 * Orphan sweep: storage objects that no database row refers to any more (a crash between the file
 * write and the insert, a failed delete after a cascade, rows removed by hand). Objects are
 * deleted only when their modification time is older than ORPHAN_MIN_AGE_MS, so an upload in
 * progress (file written, row not yet committed) is never touched. Only the known key prefixes are swept; `tmp/` and
 * anything else under the storage root are left alone.
 *
 * Raw recording chunks (`recordings/<sessionId>/`) are needed only until the recording is
 * assembled: the folder of a recording that ended (finalized, failed or cancelled) more than
 * ORPHAN_MIN_AGE_MS ago, or that has no session row and no chunk newer than that, is deleted.
 */
import { inArray } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { lessons, recordingSessions, submissionFiles, teacherMaterials } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import type { PeriodicTask } from './periodic.js';

export const ORPHAN_MIN_AGE_MS = 24 * 3600_000;
const LOOKUP_BATCH = 500;

/** Each swept prefix and the column holding the keys stored under it. */
const PREFIXES: ReadonlyArray<{ prefix: string; column: PgColumn }> = [
  { prefix: 'audio', column: lessons.audioObjectKey },
  { prefix: 'submissions', column: submissionFiles.objectKey },
  { prefix: 'materials', column: teacherMaterials.objectKey },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ENDED_RECORDING = new Set(['finalized', 'failed', 'cancelled']);

/** Delete the chunk folders of recordings that ended long ago (or are unknown). Returns folders deleted. */
async function sweepRecordingChunks(before: number): Promise<number> {
  const ids = (await storage.listPrefixes('recordings')).map((p) => p.slice('recordings/'.length)).filter((id) => UUID.test(id));
  let deleted = 0;
  for (let i = 0; i < ids.length; i += LOOKUP_BATCH) {
    const batch = ids.slice(i, i + LOOKUP_BATCH);
    const sessions = await db
      .select({ id: recordingSessions.id, status: recordingSessions.status, updatedAt: recordingSessions.updatedAt })
      .from(recordingSessions)
      .where(inArray(recordingSessions.id, batch));
    const byId = new Map(sessions.map((s) => [s.id, s]));
    for (const id of batch) {
      const session = byId.get(id);
      if (session) {
        if (!ENDED_RECORDING.has(session.status) || session.updatedAt.getTime() >= before) continue;
      } else {
        // No row: only once the newest chunk is old (the session row may still be committing).
        let newest = 0;
        for await (const o of storage.list(`recordings/${id}`)) newest = Math.max(newest, o.modifiedAt.getTime());
        if (newest >= before) continue;
      }
      try {
        await storage.deletePrefix(`recordings/${id}`);
        deleted++;
      } catch (err) {
        logger.warn({ err: (err as Error).message, sessionId: id }, 'Could not delete recording chunks');
      }
    }
  }
  return deleted;
}

/** Keys of the objects under `prefix/` last modified before `before`. */
async function oldKeys(prefix: string, before: number): Promise<string[]> {
  const keys: string[] = [];
  for await (const o of storage.list(prefix)) if (o.modifiedAt.getTime() < before) keys.push(o.key);
  return keys;
}

/** Delete old storage objects with no database row. Returns the number deleted. */
export async function sweepOrphanedObjects(now = new Date()): Promise<number> {
  const before = now.getTime() - ORPHAN_MIN_AGE_MS;
  let deleted = 0;
  for (const { prefix, column } of PREFIXES) {
    const keys = await oldKeys(prefix, before);
    for (let i = 0; i < keys.length; i += LOOKUP_BATCH) {
      const batch = keys.slice(i, i + LOOKUP_BATCH);
      const rows = await db.select({ key: column }).from(column.table).where(inArray(column, batch));
      const referenced = new Set(rows.map((r) => r.key as string));
      for (const key of batch) {
        if (referenced.has(key)) continue;
        try {
          await storage.delete(key);
          deleted++;
        } catch (err) {
          logger.warn({ err: (err as Error).message, prefix }, 'Could not delete an orphaned storage object');
        }
      }
    }
  }
  const recordings = await sweepRecordingChunks(before);
  if (deleted || recordings) logger.info({ deleted, recordings }, 'Orphaned storage objects deleted');
  return deleted + recordings;
}

export const storageSweepTask: PeriodicTask = {
  name: 'storage-orphan-sweep',
  intervalMs: 24 * 3600_000,
  run: async () => {
    await sweepOrphanedObjects();
  },
};
