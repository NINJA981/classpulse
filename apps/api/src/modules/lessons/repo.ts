/** Lesson queries shared by the lessons, questions and job code. */
import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { LESSON_PROCESSING_STATUSES, type LessonStatus, type Paginated, type SessionUser } from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { assignments, lessons, questions, sections, users } from '../../db/schema/index.js';
import { forbidden, invalidState, notFound } from '../../lib/errors.js';
import type { AssignmentRow, LessonRow, LessonSummaryRow, QuestionRow } from './mappers.js';

/** Statuses during which questions/assignment are being (re)written by a job or recording. */
export const BUSY_STATUSES: readonly LessonStatus[] = [...LESSON_PROCESSING_STATUSES, 'recording'];

export const isBusy = (status: LessonStatus) => BUSY_STATUSES.includes(status);

/** Where-clause restricting lessons to what `user` may read (owner teacher, or admin of the institution). */
export function visibleLessonsWhere(user: SessionUser): SQL {
  return user.role === 'admin' ? eq(lessons.institutionId, user.institutionId) : eq(lessons.teacherId, user.id);
}

function canRead(user: SessionUser, lesson: LessonRow): boolean {
  if (user.role === 'admin') return lesson.institutionId === user.institutionId;
  return user.role === 'teacher' && lesson.teacherId === user.id;
}

/** Lesson readable by `user`, else 404 (existence is not revealed). */
export async function getVisibleLesson(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<LessonRow> {
  const lesson = await dbx.query.lessons.findFirst({ where: eq(lessons.id, id) });
  if (!lesson || !canRead(user, lesson)) throw notFound('Lesson');
  return lesson;
}

/** Lesson writable by `user` (its owning teacher). 404 if not visible, 403 if visible but not the owner. */
export async function getOwnedLesson(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<LessonRow> {
  const lesson = await getVisibleLesson(user, id, dbx);
  if (user.role !== 'teacher' || lesson.teacherId !== user.id) throw forbidden('Only the teacher who owns this lesson can change it');
  return lesson;
}

/** Questions and assignment are editable only when the lesson is not published and no job is rewriting them. */
export function assertContentEditable(lesson: LessonRow): void {
  if (lesson.status === 'published') throw invalidState('Published lessons are read-only. Unpublish the lesson to make changes.');
  if (isBusy(lesson.status)) throw invalidState('The lesson is being processed. Wait for it to finish before making changes.');
}

const questionCounts = () =>
  db
    .select({ lessonId: questions.lessonId, n: count().as('n') })
    .from(questions)
    .where(ne(questions.status, 'rejected'))
    .groupBy(questions.lessonId)
    .as('qc');

export async function listLessonSummaries(
  where: SQL | undefined,
  page: number,
  pageSize: number,
): Promise<Paginated<LessonSummaryRow>> {
  const qc = questionCounts();
  const [rows, [total]] = await Promise.all([
    db
      .select({
        lesson: lessons,
        sectionName: sections.name,
        teacherName: users.name,
        questionCount: sql<number>`coalesce(${qc.n}, 0)::int`,
      })
      .from(lessons)
      .innerJoin(sections, eq(sections.id, lessons.sectionId))
      .innerJoin(users, eq(users.id, lessons.teacherId))
      .leftJoin(qc, eq(qc.lessonId, lessons.id))
      .where(where)
      .orderBy(desc(lessons.createdAt), desc(lessons.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(lessons).where(where),
  ]);
  return { items: rows, page, pageSize, total: total?.n ?? 0 };
}

export async function lessonNames(lesson: LessonRow, dbx: DbOrTx = db): Promise<{ sectionName: string; teacherName: string }> {
  const [row] = await dbx
    .select({ sectionName: sections.name, teacherName: users.name })
    .from(sections)
    .innerJoin(users, eq(users.id, lesson.teacherId))
    .where(eq(sections.id, lesson.sectionId));
  return row ?? { sectionName: '', teacherName: '' };
}

export const lessonQuestions = (lessonId: string, dbx: DbOrTx = db): Promise<QuestionRow[]> =>
  dbx.select().from(questions).where(eq(questions.lessonId, lessonId)).orderBy(asc(questions.position), asc(questions.createdAt));

/** The lesson's primary (AI-drafted) assignment; extra lesson assignments are managed under /assignments. */
export async function lessonAssignment(lessonId: string, dbx: DbOrTx = db): Promise<AssignmentRow | null> {
  const [row] = await dbx
    .select()
    .from(assignments)
    .where(and(eq(assignments.lessonId, lessonId), eq(assignments.isPrimary, true)));
  return row ?? null;
}

export async function countQuestions(lessonId: string, statuses?: QuestionRow['status'][], dbx: DbOrTx = db): Promise<number> {
  const where = statuses ? and(eq(questions.lessonId, lessonId), inArray(questions.status, statuses)) : eq(questions.lessonId, lessonId);
  const [row] = await dbx.select({ n: count() }).from(questions).where(where);
  return row?.n ?? 0;
}
