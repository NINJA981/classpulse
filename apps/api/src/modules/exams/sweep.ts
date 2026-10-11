/**
 * Periodic exam maintenance (runs in exactly one process):
 *  - attempts still in progress past their deadline (plus the save grace) are
 *    auto-submitted and graded — covers students who closed the tab;
 *  - published exams past their closing time become `closed`. Attempts that
 *    still have teacher-granted extra time keep running until their own deadline.
 */
import { and, eq, lt, lte } from 'drizzle-orm';
import { EXAM_SAVE_GRACE_SEC } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { examAttempts, exams } from '../../db/schema/index.js';
import type { PeriodicTask } from '../../jobs/periodic.js';
import { logger } from '../../lib/logger.js';
import { finalizeAttempt } from './repo.js';

export async function sweepExams(now = new Date()): Promise<{ autoSubmitted: number; closed: number }> {
  const cutoff = new Date(now.getTime() - EXAM_SAVE_GRACE_SEC * 1000);
  const expired = await db
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(and(eq(examAttempts.status, 'in_progress'), lt(examAttempts.deadlineAt, cutoff)));
  let autoSubmitted = 0;
  for (const a of expired) {
    if (await db.transaction((tx) => finalizeAttempt(tx, a.id, 'auto_submitted', now))) autoSubmitted++;
  }

  const closed = await db
    .update(exams)
    .set({ status: 'closed', closedAt: now })
    .where(and(eq(exams.status, 'published'), lte(exams.closesAt, now)))
    .returning({ id: exams.id });

  if (autoSubmitted || closed.length)
    logger.info({ autoSubmitted, closedExams: closed.length }, 'Exam sweep');
  return { autoSubmitted, closed: closed.length };
}

export const examSweepTask: PeriodicTask = {
  name: 'exam-sweep',
  intervalMs: 30_000,
  run: async () => {
    await sweepExams();
  },
};
