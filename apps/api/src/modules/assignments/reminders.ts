/**
 * Due-date reminders: once per (assignment, student), 24 hours or less before the due date, to enrolled
 * students with an email who have not submitted. The assignment_reminders row is written before the email
 * is queued, so a reminder is never sent twice (a failed delivery is retried by the email queue).
 */
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  assignmentReminders,
  assignments,
  assignmentSubmissions,
  enrollments,
  institutions,
  lessons,
  users,
} from '../../db/schema/index.js';
import { enqueueEmail } from '../../jobs/emailQueue.js';
import type { PeriodicTask } from '../../jobs/periodic.js';
import { logger } from '../../lib/logger.js';
import { emailEnabled } from '../../lib/mailer.js';
import { formatDue, reminderEmail } from './emails.js';

const WINDOW_MS = 24 * 3600_000;
const BATCH = 500;

/** Send the reminders that are due. Returns the number queued. */
export async function sendAssignmentReminders(now = new Date()): Promise<number> {
  if (!emailEnabled()) return 0;
  const rows = await db
    .select({
      assignmentId: assignments.id,
      title: assignments.title,
      dueAt: assignments.dueAt,
      studentId: users.id,
      name: users.name,
      email: users.email,
      schoolName: institutions.name,
      timezone: institutions.timezone,
    })
    .from(assignments)
    .innerJoin(enrollments, eq(enrollments.sectionId, assignments.sectionId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .innerJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(lessons, eq(lessons.id, assignments.lessonId))
    .where(
      and(
        eq(assignments.status, 'published'),
        eq(assignments.reminders, true),
        gt(assignments.dueAt, now),
        lte(assignments.dueAt, new Date(now.getTime() + WINDOW_MS)),
        or(isNull(assignments.lessonId), eq(lessons.status, 'published')),
        isNotNull(users.email),
        eq(users.status, 'active'),
        sql`not exists (select 1 from ${assignmentSubmissions} s where s.assignment_id = ${assignments.id} and s.student_id = ${users.id})`,
        sql`not exists (select 1 from ${assignmentReminders} r where r.assignment_id = ${assignments.id} and r.student_id = ${users.id})`,
      ),
    )
    .limit(BATCH);

  let sent = 0;
  for (const row of rows) {
    const claimed = await db
      .insert(assignmentReminders)
      .values({ assignmentId: row.assignmentId, studentId: row.studentId })
      .onConflictDoNothing()
      .returning({ studentId: assignmentReminders.studentId });
    if (!claimed.length) continue; // another process got there first
    await enqueueEmail({
      kind: 'assignment-reminder',
      message: reminderEmail({
        to: row.email!,
        schoolName: row.schoolName,
        studentName: row.name,
        title: row.title,
        due: formatDue(row.dueAt!, row.timezone),
      }),
    });
    sent++;
  }
  if (sent) logger.info({ sent }, 'Assignment reminders queued');
  return sent;
}

export const assignmentReminderTask: PeriodicTask = {
  name: 'assignment-reminders',
  intervalMs: 3600_000,
  run: async () => {
    await sendAssignmentReminders();
  },
};
