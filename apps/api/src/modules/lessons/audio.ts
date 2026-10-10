/**
 * Shared by browser uploads (lessons module) and classroom-device recordings
 * (recordings module): attach normalized audio to a lesson and queue generation.
 */
import { addDays } from '../../lib/time.js';
import { and, eq, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { db, type DbOrTx } from '../../db/client.js';
import { lessons } from '../../db/schema/index.js';
import { enqueueLessonGeneration } from '../../jobs/queue.js';
import { storage } from '../../lib/storage.js';
import { AppError, notFound } from '../../lib/errors.js';
import type { LessonSourceType } from '@classpulse/shared';

export interface AttachAudioInput {
  lessonId: string;
  objectKey: string;
  sizeBytes: number;
  durationSec: number;
  sourceType: LessonSourceType;
}

/** Store the audio reference on the lesson (replacing any previous audio object). */
export async function attachLessonAudio(input: AttachAudioInput, tx: DbOrTx = db): Promise<void> {
  const [previous] = await tx
    .select({ key: lessons.audioObjectKey })
    .from(lessons)
    .where(eq(lessons.id, input.lessonId));
  if (!previous) throw notFound('Lesson');

  await tx
    .update(lessons)
    .set({
      audioObjectKey: input.objectKey,
      audioMimeType: 'audio/wav',
      audioSizeBytes: input.sizeBytes,
      durationSec: input.durationSec,
      audioExpiresAt: addDays(new Date(), env.AUDIO_RETENTION_DAYS),
      sourceType: input.sourceType,
    })
    .where(eq(lessons.id, input.lessonId));

  if (previous.key && previous.key !== input.objectKey) await storage.delete(previous.key).catch(() => undefined);
}

/**
 * Move the lesson to `queued`, bump its generation attempt and enqueue the job.
 * Callers must already have validated ownership and state.
 */
export async function queueLessonGeneration(lessonId: string): Promise<string> {
  const [row] = await db
    .update(lessons)
    .set({
      status: 'queued',
      generationAttempt: sql`${lessons.generationAttempt} + 1`,
      progressPct: 0,
      progressMessage: 'Waiting for a worker',
      failureReason: null,
    })
    .where(eq(lessons.id, lessonId))
    .returning({ attempt: lessons.generationAttempt });
  if (!row) throw notFound('Lesson');
  try {
    return await enqueueLessonGeneration({ lessonId, attempt: row.attempt });
  } catch (err) {
    // Don't leave the lesson stuck in `queued` when the queue is unreachable.
    logger.error({ err, lessonId }, 'Failed to enqueue lesson generation');
    await db
      .update(lessons)
      .set({ status: 'failed', failureReason: 'Could not start processing. Please try again.', progressMessage: null })
      .where(and(eq(lessons.id, lessonId), eq(lessons.generationAttempt, row.attempt)));
    throw new AppError('INTERNAL', 'Could not start processing. Please try again.');
  }
}
