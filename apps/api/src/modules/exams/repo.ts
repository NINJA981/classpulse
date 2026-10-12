/** Exam queries and rules shared by the teacher routes, the student routes and the sweep. */
import { and, asc, desc, eq, gt, inArray, max, sql } from 'drizzle-orm';
import type { ExamDetail, ExamPoolQuestion, ExamResultsVisibility, ExamSummary } from '@classpulse/shared';
import { db, type DbOrTx, type Tx } from '../../db/client.js';
import {
  enrollments,
  examAnswers,
  examAttempts,
  examQuestions,
  exams,
  sections,
} from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';

export type ExamRow = typeof exams.$inferSelect;
export type ExamAttemptRow = typeof examAttempts.$inferSelect;
export type ExamQuestionRow = typeof examQuestions.$inferSelect;

export const roundPct = (n: number) => Math.round(n * 10) / 10;
export const iso = (d: Date | null) => (d ? d.toISOString() : null);

/* ----------------------------------------------------------------------------
 * Summary / detail
 * ------------------------------------------------------------------------- */

const summaryFields = {
  exam: exams,
  sectionName: sections.name,
  // Draft: the chosen source questions (plus any questions snapshotted from a question paper); published/closed: the frozen pool.
  poolSize: sql<number>`(case when ${exams.status} = 'draft' then jsonb_array_length(${exams.selectedQuestionIds}) else 0 end)
    + (select count(*)::int from ${examQuestions} x where x.exam_id = ${exams.id})`,
  enrolled: sql<number>`(select count(*)::int from ${enrollments} e where e.section_id = ${exams.sectionId})`,
  started: sql<number>`(select count(*)::int from ${examAttempts} a where a.exam_id = ${exams.id})`,
  submitted: sql<number>`(select count(*)::int from ${examAttempts} a where a.exam_id = ${exams.id} and a.status <> 'in_progress')`,
};

type SummaryRow = {
  exam: ExamRow;
  sectionName: string;
  poolSize: number;
  enrolled: number;
  started: number;
  submitted: number;
};

const selectSummaries = (dbx: DbOrTx = db) =>
  dbx.select(summaryFields).from(exams).innerJoin(sections, eq(sections.id, exams.sectionId));

function toExamSummary(r: SummaryRow): ExamSummary {
  return {
    id: r.exam.id,
    title: r.exam.title,
    section: { id: r.exam.sectionId, name: r.sectionName },
    status: r.exam.status,
    opensAt: r.exam.opensAt.toISOString(),
    closesAt: r.exam.closesAt.toISOString(),
    durationMin: r.exam.durationMin,
    questionsPerStudent: r.exam.questionsPerStudent,
    poolSize: r.poolSize,
    enrolled: r.enrolled,
    started: r.started,
    submitted: r.submitted,
    createdAt: r.exam.createdAt.toISOString(),
  };
}

export async function listTeacherExamSummaries(teacherId: string): Promise<ExamSummary[]> {
  const rows = await selectSummaries()
    .where(eq(exams.teacherId, teacherId))
    .orderBy(desc(exams.opensAt), desc(exams.createdAt));
  return rows.map(toExamSummary);
}

const toPoolQuestion = (q: ExamQuestionRow): ExamPoolQuestion => ({
  id: q.id,
  sourceQuestionId: q.sourceQuestionId,
  position: q.position,
  stem: q.stem,
  options: q.options,
  correctIndex: q.correctIndex,
  difficulty: q.difficulty,
  topicTag: q.topicTag,
});

export const examPool = (examId: string, dbx: DbOrTx = db) =>
  dbx
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));

/** Teacher view of one exam (includes the access code and, once published, the frozen pool with answers). */
export async function loadExamDetail(examId: string, dbx: DbOrTx = db): Promise<ExamDetail> {
  const [row] = await selectSummaries(dbx).where(eq(exams.id, examId));
  if (!row) throw notFound('Exam');
  const e = row.exam;
  // Drafts normally have no pool yet; drafts created from a question paper show its snapshotted MCQs.
  const pool = await examPool(e.id, dbx);
  return {
    ...toExamSummary(row),
    instructions: e.instructions,
    shuffleQuestions: e.shuffleQuestions,
    shuffleOptions: e.shuffleOptions,
    requireFullscreen: e.requireFullscreen,
    useAccessCode: e.useAccessCode,
    singleDevice: e.singleDevice,
    maxViolations: e.maxViolations,
    resultsVisibility: e.resultsVisibility,
    accessCode: e.useAccessCode ? e.accessCode : null,
    questionIds: e.selectedQuestionIds,
    pool: pool.map(toPoolQuestion),
    publishedAt: iso(e.publishedAt),
  };
}

/** Exam owned by this teacher, else 404 (other teachers' exams are not revealed). */
export async function getOwnedExam(teacherId: string, examId: string, dbx: DbOrTx = db): Promise<ExamRow> {
  const [exam] = await dbx
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)));
  if (!exam) throw notFound('Exam');
  return exam;
}

/* ----------------------------------------------------------------------------
 * Results visibility
 * ------------------------------------------------------------------------- */

/** When a student may see their score and the answer key; null = never. */
export function resultsAvailableAt(
  exam: Pick<ExamRow, 'resultsVisibility' | 'status' | 'closesAt' | 'closedAt'>,
  attempt: Pick<ExamAttemptRow, 'submittedAt'>,
): Date | null {
  const visibility: ExamResultsVisibility = exam.resultsVisibility;
  if (visibility === 'never') return null;
  if (visibility === 'immediately') return attempt.submittedAt;
  // after_close: whichever comes first, the scheduled close or the teacher closing it early.
  return exam.closedAt && exam.closedAt < exam.closesAt ? exam.closedAt : exam.closesAt;
}

export function resultsVisible(
  exam: Pick<ExamRow, 'resultsVisibility' | 'status' | 'closesAt' | 'closedAt'>,
  attempt: Pick<ExamAttemptRow, 'status' | 'submittedAt'>,
  now = new Date(),
): boolean {
  if (attempt.status === 'in_progress') return false;
  if (exam.resultsVisibility === 'after_close' && exam.status === 'closed') return true;
  const at = resultsAvailableAt(exam, attempt);
  return at !== null && at.getTime() <= now.getTime();
}

/**
 * When students may see the correct answers and explanations, or null once they may. Results can
 * be visible earlier (results "immediately"), but the answer key waits until nobody can still be
 * writing: the exam is closed, or its window has ended and every attempt's deadline (extra time
 * can run past closes_at) has passed.
 */
export async function answerKeyReleaseAt(
  exam: Pick<ExamRow, 'id' | 'status' | 'closesAt'>,
  now = new Date(),
  dbx: DbOrTx = db,
): Promise<Date | null> {
  if (exam.status === 'closed') return null;
  let releaseAt = exam.closesAt;
  const [open] = await dbx
    .select({ last: max(examAttempts.deadlineAt) })
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.status, 'in_progress'), gt(examAttempts.deadlineAt, now)));
  if (open?.last && open.last.getTime() > releaseAt.getTime()) releaseAt = open.last;
  return releaseAt.getTime() <= now.getTime() ? null : releaseAt;
}

/* ----------------------------------------------------------------------------
 * Grading (submit, teacher force-submit, violation auto-submit, sweep)
 * ------------------------------------------------------------------------- */

/**
 * Ends an in-progress attempt and grades it on the server. The status flip is a
 * conditional UPDATE, so concurrent submit/auto-submit/sweep calls grade exactly
 * once; returns null when the attempt was already finished.
 */
export async function finalizeAttempt(
  tx: Tx,
  attemptId: string,
  status: 'submitted' | 'auto_submitted',
  now = new Date(),
): Promise<ExamAttemptRow | null> {
  const [ended] = await tx
    .update(examAttempts)
    .set({ status, submittedAt: now })
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.status, 'in_progress')))
    .returning();
  if (!ended) return null;
  const [row] = await tx
    .select({ correct: sql<number>`count(*)::int` })
    .from(examAnswers)
    .innerJoin(examQuestions, eq(examQuestions.id, examAnswers.examQuestionId))
    .where(
      and(
        eq(examAnswers.attemptId, attemptId),
        sql`${examAnswers.selectedIndex} = ${examQuestions.correctIndex}`,
      ),
    );
  const correct = row?.correct ?? 0;
  const total = ended.paper.length;
  const [graded] = await tx
    .update(examAttempts)
    .set({ correct, total, scorePct: total ? roundPct((correct / total) * 100) : 0 })
    .where(eq(examAttempts.id, attemptId))
    .returning();
  return graded!;
}

/** Auto-submits every in-progress attempt of an exam (teacher closes it early). */
export async function finalizeOpenAttempts(tx: Tx, examId: string, now = new Date()): Promise<number> {
  const open = await tx
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, examId), eq(examAttempts.status, 'in_progress')));
  let n = 0;
  for (const a of open) if (await finalizeAttempt(tx, a.id, 'auto_submitted', now)) n++;
  return n;
}

/** Answered (non-cleared) counts per attempt. */
export async function answeredCounts(attemptIds: string[], dbx: DbOrTx = db): Promise<Map<string, number>> {
  if (!attemptIds.length) return new Map();
  const rows = await dbx
    .select({ attemptId: examAnswers.attemptId, n: sql<number>`count(*)::int` })
    .from(examAnswers)
    .where(and(inArray(examAnswers.attemptId, attemptIds), sql`${examAnswers.selectedIndex} is not null`))
    .groupBy(examAnswers.attemptId);
  return new Map(rows.map((r) => [r.attemptId, r.n]));
}
