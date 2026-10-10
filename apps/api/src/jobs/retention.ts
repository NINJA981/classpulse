/** Deletes lecture audio past audio_expires_at (AUDIO_RETENTION_DAYS) and clears the lesson's audio fields. */
import { and, asc, inArray, isNotNull, lt, notInArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { lessons } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import type { PeriodicTask } from './periodic.js';

const BATCH = 100;

/** Run one retention sweep. Returns the number of audio objects removed. */
export async function purgeExpiredAudio(now = new Date()): Promise<number> {
  let purged = 0;
  for (;;) {
    const expired = await db
      .select({ id: lessons.id, key: lessons.audioObjectKey })
      .from(lessons)
      .where(
        and(
          isNotNull(lessons.audioObjectKey),
          lt(lessons.audioExpiresAt, now),
          // Never pull audio out from under a running job or recording.
          notInArray(lessons.status, ['queued', 'transcribing', 'generating', 'recording']),
        ),
      )
      .orderBy(asc(lessons.audioExpiresAt))
      .limit(BATCH);
    if (!expired.length) break;

    const cleared: string[] = [];
    for (const row of expired) {
      try {
        await storage.delete(row.key!);
        cleared.push(row.id);
      } catch (err) {
        logger.warn({ err, lessonId: row.id }, 'Failed to delete expired lesson audio');
      }
    }
    if (cleared.length) {
      await db
        .update(lessons)
        .set({ audioObjectKey: null, audioMimeType: null, audioSizeBytes: null, audioExpiresAt: null })
        .where(inArray(lessons.id, cleared));
      purged += cleared.length;
    }
    if (cleared.length < expired.length || expired.length < BATCH) break; // avoid spinning on undeletable objects
  }
  if (purged) logger.info({ purged }, 'Expired lesson audio deleted');
  return purged;
}

export const retentionTask: PeriodicTask = {
  name: 'audio-retention',
  intervalMs: 6 * 3600_000,
  run: async () => {
    await purgeExpiredAudio();
  },
};
