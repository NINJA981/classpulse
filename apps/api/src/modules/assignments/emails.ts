/** Assignment emails: due-date reminders and "your work was returned". Sending never fails the caller. */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { institutions, users } from '../../db/schema/index.js';
import { enqueueEmail } from '../../jobs/emailQueue.js';
import { appUrl, renderEmail } from '../../lib/emailTemplates.js';
import { logger } from '../../lib/logger.js';

export function formatDue(dueAt: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(dueAt);
  } catch {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(dueAt);
  }
}

export function reminderEmail(r: { to: string; schoolName: string; studentName: string; title: string; due: string }) {
  return renderEmail({
    to: r.to,
    subject: `Reminder: ${r.title} is due ${r.due}`,
    schoolName: r.schoolName,
    heading: `${r.title} is due soon`,
    paragraphs: [`Hi ${r.studentName},`, `Your assignment "${r.title}" is due ${r.due}, and we have not received your work yet.`],
    button: { label: 'Open my assignments', url: appUrl('/student/assignments') },
    footnote: 'You get this reminder once per assignment.',
  });
}

/** Tell students (those with an email) that their work on `title` was returned. */
export async function sendReturnedEmails(title: string, studentIds: string[]): Promise<void> {
  if (!studentIds.length) return;
  try {
    const rows = await db
      .select({ email: users.email, name: users.name, schoolName: institutions.name })
      .from(users)
      .innerJoin(institutions, eq(institutions.id, users.institutionId))
      .where(and(inArray(users.id, studentIds), isNotNull(users.email), eq(users.status, 'active')));
    for (const row of rows) {
      await enqueueEmail({
        kind: 'assignment-returned',
        message: renderEmail({
          to: row.email!,
          subject: `Your work on ${title} was returned`,
          schoolName: row.schoolName,
          heading: 'Your work was returned',
          paragraphs: [`Hi ${row.name},`, `Your teacher has returned your work on "${title}" with marks and feedback.`],
          button: { label: 'See my feedback', url: appUrl('/student/assignments') },
        }),
      });
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Could not queue assignment-returned emails');
  }
}
