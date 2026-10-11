/**
 * Teacher assignments: standalone or lesson-attached homework, the submission tracker, grading and returning
 * work. A teacher manages every assignment of the sections they teach (section_teachers); anything else is 404.
 *
 * Publishing: standalone assignments are published on their own. Lesson-attached ones are published and
 * unpublished together with their lesson; one can also be published on its own (e.g. added after the lesson
 * went out, or re-opened after closing) but only while its lesson is published, so students never see
 * homework for a lesson they cannot open.
 */
import { and, asc, count, desc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import type {
  Assignment,
  AssignmentSummary,
  CreateAssignmentInput,
  GradeSubmissionInput,
  ListAssignmentsQuery,
  ReturnSubmissionsResult,
  SessionUser,
  SubmissionDetail,
  SubmissionTrackerRow,
  TrackerStatus,
  UpdateAssignmentInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import {
  assignmentReminders,
  assignments,
  assignmentSubmissions,
  enrollments,
  lessons,
  sections,
  sectionTeachers,
  submissionFiles,
  users,
} from '../../db/schema/index.js';
import { badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { iso } from '../../lib/time.js';
import { toAssignment, type AssignmentRow } from '../lessons/mappers.js';
import { isBusy } from '../lessons/repo.js';
import { sendReturnedEmails } from './emails.js';
import {
  clampToRubric,
  filesBySubmission,
  getTeacherAssignment,
  maxMarksOf,
  teachesSectionSql,
  toSubmissionFile,
  type SubmissionFileRow,
  type SubmissionRow,
} from './repo.js';

/** Column values for the fields present in `input` (absent fields are left unchanged). */
export function assignmentValues(input: UpdateAssignmentInput): Partial<typeof assignments.$inferInsert> {
  const values: Partial<typeof assignments.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.prompt !== undefined) values.prompt = input.prompt;
  if (input.rubric !== undefined) values.rubric = input.rubric;
  if (input.estimatedMinutes !== undefined) values.estimatedMinutes = input.estimatedMinutes;
  if (input.dueAt !== undefined) values.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (input.latePolicy !== undefined) values.latePolicy = input.latePolicy;
  if (input.allowFiles !== undefined) values.allowFiles = input.allowFiles;
  if (input.maxFiles !== undefined) values.maxFiles = input.maxFiles;
  if (input.reminders !== undefined) values.reminders = input.reminders;
  return values;
}

export async function createAssignment(user: SessionUser, input: CreateAssignmentInput): Promise<Assignment> {
  const [section] = await db
    .select({ id: sections.id, teacherId: sectionTeachers.teacherId })
    .from(sections)
    .leftJoin(sectionTeachers, and(eq(sectionTeachers.sectionId, sections.id), eq(sectionTeachers.teacherId, user.id)))
    .where(and(eq(sections.id, input.sectionId), eq(sections.institutionId, user.institutionId)));
  if (!section) throw notFound('Section');
  if (!section.teacherId) throw forbidden('You can only create assignments for sections you teach');
  if (input.lessonId) {
    const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, input.lessonId) });
    if (!lesson || lesson.teacherId !== user.id) throw notFound('Lesson');
    if (lesson.sectionId !== input.sectionId) throw badRequest('That lesson belongs to a different section');
  }
  const [row] = await db
    .insert(assignments)
    .values({
      ...assignmentValues(input),
      title: input.title,
      prompt: input.prompt,
      sectionId: input.sectionId,
      teacherId: user.id,
      lessonId: input.lessonId ?? null,
      isPrimary: false,
      status: 'draft',
    })
    .returning();
  return toAssignment(row!);
}

/** Submissions of currently enrolled students matching `filter` (correlated with the outer assignment row). */
const countSubmissions = (filter: SQL) => sql<number>`(
  select count(*)::int from ${assignmentSubmissions} s
  join ${enrollments} e on e.student_id = s.student_id and e.section_id = ${assignments.sectionId}
  where s.assignment_id = ${assignments.id} and ${filter}
)`;

export async function listAssignments(user: SessionUser, query: ListAssignmentsQuery): Promise<AssignmentSummary[]> {
  const rows = await db
    .select({
      a: assignments,
      sectionName: sections.name,
      lessonTitle: lessons.title,
      enrolled: sql<number>`(select count(*)::int from ${enrollments} e where e.section_id = ${assignments.sectionId})`,
      submitted: countSubmissions(sql`true`),
      late: countSubmissions(sql`s.is_late`),
      returned: countSubmissions(sql`s.status = 'returned'`),
    })
    .from(assignments)
    .innerJoin(sections, eq(sections.id, assignments.sectionId))
    .leftJoin(lessons, eq(lessons.id, assignments.lessonId))
    .where(
      and(
        teachesSectionSql(user.id),
        query.sectionId ? eq(assignments.sectionId, query.sectionId) : undefined,
        query.lessonId ? eq(assignments.lessonId, query.lessonId) : undefined,
        query.status ? eq(assignments.status, query.status) : undefined,
      ),
    )
    .orderBy(desc(assignments.createdAt), desc(assignments.id));
  return rows.map(({ a, ...r }) => ({
    id: a.id,
    title: a.title,
    section: { id: a.sectionId, name: r.sectionName },
    lesson: a.lessonId && r.lessonTitle !== null ? { id: a.lessonId, title: r.lessonTitle } : null,
    status: a.status,
    dueAt: iso(a.dueAt),
    latePolicy: a.latePolicy,
    enrolled: r.enrolled,
    submitted: r.submitted,
    late: r.late,
    returned: r.returned,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function getAssignment(user: SessionUser, id: string): Promise<Assignment> {
  return toAssignment(await getTeacherAssignment(user, id));
}

/** The primary assignment is rewritten by lesson generation, so it cannot be edited while a job runs. */
async function assertNotBeingGenerated(a: AssignmentRow): Promise<void> {
  if (!a.isPrimary || !a.lessonId) return;
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, a.lessonId), columns: { status: true } });
  if (lesson && isBusy(lesson.status)) throw invalidState('The lesson is being processed. Wait for it to finish before making changes.');
}

export async function updateAssignment(user: SessionUser, id: string, input: UpdateAssignmentInput): Promise<Assignment> {
  const a = await getTeacherAssignment(user, id);
  const values = assignmentValues(input);
  if (!Object.keys(values).length) return toAssignment(a);
  await assertNotBeingGenerated(a);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(assignments).set(values).where(eq(assignments.id, id)).returning();
    // A new due date earns a new reminder.
    if (values.dueAt !== undefined && (values.dueAt?.getTime() ?? null) !== (a.dueAt?.getTime() ?? null)) {
      await tx.delete(assignmentReminders).where(eq(assignmentReminders.assignmentId, id));
    }
    return toAssignment(row!);
  });
}

export async function deleteAssignment(user: SessionUser, id: string): Promise<void> {
  await getTeacherAssignment(user, id);
  const [subs] = await db.select({ n: count() }).from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
  if ((subs?.n ?? 0) > 0) throw invalidState('Students have submitted work for this assignment, so it cannot be deleted. Close it instead.');
  await db.delete(assignments).where(eq(assignments.id, id));
}

/** Publish a draft, or re-open a closed assignment. Lesson-attached ones need their lesson to be published. */
export async function publishAssignment(user: SessionUser, id: string): Promise<Assignment> {
  const a = await getTeacherAssignment(user, id);
  if (a.status === 'published') return toAssignment(a);
  if (a.lessonId) {
    const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, a.lessonId), columns: { status: true } });
    if (lesson?.status !== 'published') {
      throw invalidState('Publish the lesson first. Its assignments are published together with it.');
    }
  }
  const [row] = await db
    .update(assignments)
    .set({ status: 'published', publishedAt: a.publishedAt ?? new Date() })
    .where(eq(assignments.id, id))
    .returning();
  return toAssignment(row!);
}

/** Stop accepting work. Students still see the assignment (and their returned work). */
export async function closeAssignment(user: SessionUser, id: string): Promise<Assignment> {
  const a = await getTeacherAssignment(user, id);
  if (a.status === 'closed') return toAssignment(a);
  if (a.status !== 'published') throw invalidState('Only published assignments can be closed.');
  const [row] = await db.update(assignments).set({ status: 'closed' }).where(eq(assignments.id, id)).returning();
  return toAssignment(row!);
}

/* ----------------------------------------------------------------------------
 * Submissions
 * ------------------------------------------------------------------------- */

function trackerStatus(sub: SubmissionRow | null): TrackerStatus {
  if (!sub) return 'missing';
  if (sub.status === 'returned') return 'returned';
  return sub.isLate ? 'late' : 'submitted';
}

/** One row per enrolled student, with or without a submission. */
export async function listSubmissions(user: SessionUser, id: string): Promise<SubmissionTrackerRow[]> {
  const a = await getTeacherAssignment(user, id);
  const rows = await db
    .select({
      studentId: users.id,
      name: users.name,
      rollNumber: users.rollNumber,
      sub: assignmentSubmissions,
      fileCount: sql<number>`(select count(*)::int from ${submissionFiles} f where f.submission_id = ${assignmentSubmissions.id})`,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .leftJoin(
      assignmentSubmissions,
      and(eq(assignmentSubmissions.assignmentId, a.id), eq(assignmentSubmissions.studentId, users.id)),
    )
    .where(eq(enrollments.sectionId, a.sectionId))
    .orderBy(asc(users.name), asc(users.id));
  const maxMarks = maxMarksOf(a.rubric);
  return rows.map((r) => ({
    student: { id: r.studentId, name: r.name, rollNumber: r.rollNumber },
    submissionId: r.sub?.id ?? null,
    status: trackerStatus(r.sub),
    isLate: r.sub?.isLate ?? false,
    submittedAt: iso(r.sub?.submittedAt),
    fileCount: r.sub ? r.fileCount : 0,
    totalMarks: r.sub?.totalMarks ?? null,
    maxMarks,
    gradedAt: iso(r.sub?.gradedAt),
    returnedAt: iso(r.sub?.returnedAt),
  }));
}

function toSubmissionDetail(
  a: AssignmentRow,
  sub: SubmissionRow,
  student: SubmissionDetail['student'],
  files: SubmissionFileRow[],
): SubmissionDetail {
  return {
    id: sub.id,
    assignmentId: a.id,
    student,
    text: sub.text,
    files: files.map(toSubmissionFile),
    submittedAt: sub.submittedAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    isLate: sub.isLate,
    status: sub.status,
    rubricMarks: sub.rubricMarks,
    totalMarks: sub.totalMarks,
    maxMarks: maxMarksOf(a.rubric),
    feedback: sub.feedback,
    gradedAt: iso(sub.gradedAt),
    returnedAt: iso(sub.returnedAt),
    aiSuggestion: sub.aiSuggestion,
  };
}

/** A submission of assignment `a`, else 404. */
export async function getSubmissionRow(a: AssignmentRow, submissionId: string): Promise<SubmissionRow> {
  const [row] = await db
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.id, submissionId), eq(assignmentSubmissions.assignmentId, a.id)));
  if (!row) throw notFound('Submission');
  return row;
}

async function loadDetail(a: AssignmentRow, submissionId: string): Promise<SubmissionDetail> {
  const [row] = await db
    .select({ sub: assignmentSubmissions, name: users.name, rollNumber: users.rollNumber })
    .from(assignmentSubmissions)
    .innerJoin(users, eq(users.id, assignmentSubmissions.studentId))
    .where(and(eq(assignmentSubmissions.id, submissionId), eq(assignmentSubmissions.assignmentId, a.id)));
  if (!row) throw notFound('Submission');
  const files = (await filesBySubmission([row.sub.id])).get(row.sub.id) ?? [];
  return toSubmissionDetail(a, row.sub, { id: row.sub.studentId, name: row.name, rollNumber: row.rollNumber }, files);
}

export async function getSubmission(user: SessionUser, id: string, submissionId: string): Promise<SubmissionDetail> {
  return loadDetail(await getTeacherAssignment(user, id), submissionId);
}

/** Save marks (clamped to each criterion's maximum) and feedback. Returned work can still be corrected. */
export async function gradeSubmission(
  user: SessionUser,
  id: string,
  submissionId: string,
  input: GradeSubmissionInput,
): Promise<SubmissionDetail> {
  const a = await getTeacherAssignment(user, id);
  await getSubmissionRow(a, submissionId);
  const rubricMarks = clampToRubric(a.rubric, input.rubricMarks, true);
  await db
    .update(assignmentSubmissions)
    .set({
      rubricMarks,
      totalMarks: a.rubric.length ? rubricMarks.reduce((sum, m) => sum + m.marks, 0) : null,
      feedback: input.feedback || null,
      gradedBy: user.id,
      gradedAt: new Date(),
    })
    .where(eq(assignmentSubmissions.id, submissionId));
  return loadDetail(a, submissionId);
}

/** Return graded work to the student; it is then locked for the student. */
export async function returnSubmission(user: SessionUser, id: string, submissionId: string): Promise<SubmissionDetail> {
  const a = await getTeacherAssignment(user, id);
  const sub = await getSubmissionRow(a, submissionId);
  if (sub.status === 'returned') return loadDetail(a, submissionId);
  if (!sub.gradedAt) throw invalidState('Save marks or feedback before returning the work.');
  const updated = await db
    .update(assignmentSubmissions)
    .set({ status: 'returned', returnedAt: new Date() })
    .where(and(eq(assignmentSubmissions.id, submissionId), eq(assignmentSubmissions.status, 'submitted')))
    .returning({ studentId: assignmentSubmissions.studentId });
  await sendReturnedEmails(a.title, updated.map((u) => u.studentId));
  return loadDetail(a, submissionId);
}

/** Return every graded submission that has not been returned yet. */
export async function returnAllGraded(user: SessionUser, id: string): Promise<ReturnSubmissionsResult> {
  const a = await getTeacherAssignment(user, id);
  const updated = await db
    .update(assignmentSubmissions)
    .set({ status: 'returned', returnedAt: new Date() })
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, a.id),
        eq(assignmentSubmissions.status, 'submitted'),
        isNotNull(assignmentSubmissions.gradedAt),
      ),
    )
    .returning({ studentId: assignmentSubmissions.studentId });
  await sendReturnedEmails(a.title, updated.map((u) => u.studentId));
  return { returned: updated.length };
}

/* ----------------------------------------------------------------------------
 * Files (download route, both roles)
 * ------------------------------------------------------------------------- */

/** The file if `user` may read it, else 404. */
export async function getReadableFile(user: SessionUser, fileId: string): Promise<SubmissionFileRow> {
  const [row] = await db
    .select({ file: submissionFiles, studentId: assignmentSubmissions.studentId, isTeacher: teachesSectionSql(user.id) })
    .from(submissionFiles)
    .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, submissionFiles.submissionId))
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .where(eq(submissionFiles.id, fileId));
  const allowed =
    row && ((user.role === 'student' && row.studentId === user.id) || (user.role === 'teacher' && row.isTeacher === true));
  if (!row || !allowed) throw notFound('File');
  return row.file;
}
