/**
 * Lesson data retention:
 *  - lecture audio past audio_expires_at (AUDIO_RETENTION_DAYS) is deleted and the lesson's audio fields cleared;
 *  - lessons stuck recording or processing for STUCK_LESSON_HOURS are failed, so their audio becomes
 *    subject to retention like any other;
 *  - transcripts of lessons older than TRANSCRIPT_RETENTION_DAYS are deleted (the lesson, its summary
 *    and its published quiz stay).
 */
import { and, asc, eq, inArray, isNotNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { lessons, recordingSessions } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import { ACTIVE_RECORDING_STATUSES, failRecordingSession } from '../modules/recordings/service.js';
import { notifyLessonFailed } from './lessonNotify.js';
import type { PeriodicTask } from './periodic.js';

const BATCH = 100;
const BUSY_STATUSES = ['queued', 'transcribing', 'generating', 'recording'] as const;
/** A lesson recording or processing longer than this is stuck (a crashed worker, a lost device). */
export const STUCK_LESSON_HOURS = 48;
const STUCK_REASON = 'Recording or processing did not finish. Upload the audio again or try once more.';

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
          notInArray(lessons.status, [...BUSY_STATUSES]),
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

/**
 * Fail lessons that have been recording or processing for STUCK_LESSON_HOURS: their recording
 * session fails with them, and audio without an expiry gets one, so retention can delete it.
 * Returns the number of lessons failed.
 */
export async function failStuckLessons(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - STUCK_LESSON_HOURS * 3600_000);
  const stuck = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(inArray(lessons.status, [...BUSY_STATUSES]), lt(lessons.updatedAt, before)));
  if (!stuck.length) return 0;
  const ids = stuck.map((l) => l.id);

  // Recordings first (they fail their lesson too and free the classroom device).
  const sessions = await db
    .select({ id: recordingSessions.id })
    .from(recordingSessions)
    .where(and(inArray(recordingSessions.lessonId, ids), inArray(recordingSessions.status, [...ACTIVE_RECORDING_STATUSES])));
  for (const s of sessions) await failRecordingSession(s.id, STUCK_REASON);

  const expiry = new Date(now.getTime() + env.AUDIO_RETENTION_DAYS * 86400_000);
  const failed = await db
    .update(lessons)
    .set({
      status: 'failed',
      failureReason: STUCK_REASON,
      progressMessage: null,
      quizRequest: null,
      audioExpiresAt: sql`case when ${lessons.audioObjectKey} is null then ${lessons.audioExpiresAt} else coalesce(${lessons.audioExpiresAt}, ${expiry}) end`,
    })
    .where(and(inArray(lessons.id, ids), or(inArray(lessons.status, [...BUSY_STATUSES]), eq(lessons.status, 'failed'))))
    .returning({
      id: lessons.id,
      title: lessons.title,
      teacherId: lessons.teacherId,
      institutionId: lessons.institutionId,
      generationAttempt: lessons.generationAttempt,
    });
  // Tell each teacher (rows failed just above by their recording session are included; the notification
  // de-duplicates per lesson attempt, so a lesson the pipeline failed in the meantime is not reported twice).
  for (const lesson of failed) notifyLessonFailed(lesson, STUCK_REASON);
  logger.warn({ lessons: failed.length }, 'Stuck lessons marked failed');
  return failed.length;
}

/**
 * Delete the transcripts of lessons created more than TRANSCRIPT_RETENTION_DAYS ago. Questions
 * (and their citations), summaries and attempts are untouched, so published quizzes keep working.
 * Returns the number of lessons cleared.
 */
export async function purgeOldTranscripts(now = new Date(), days = env.TRANSCRIPT_RETENTION_DAYS): Promise<number> {
  const before = new Date(now.getTime() - days * 86400_000);
  let cleared = 0;
  for (;;) {
    const batch = db
      .select({ id: lessons.id })
      .from(lessons)
      .where(
        and(
          lt(lessons.createdAt, before),
          or(isNotNull(lessons.transcript), isNotNull(lessons.transcriptSegments)),
          notInArray(lessons.status, [...BUSY_STATUSES]),
        ),
      )
      .limit(500);
    const rows = await db
      .update(lessons)
      .set({ transcript: null, transcriptSegments: null })
      .where(inArray(lessons.id, batch))
      .returning({ id: lessons.id });
    cleared += rows.length;
    if (rows.length < 500) break;
  }
  if (cleared) logger.info({ lessons: cleared }, 'Old lesson transcripts deleted');
  return cleared;
}

export const retentionTask: PeriodicTask = {
  name: 'audio-retention',
  intervalMs: 6 * 3600_000,
  run: async () => {
    await failStuckLessons();
    await purgeExpiredAudio();
    await purgeOldTranscripts();
  },
};
