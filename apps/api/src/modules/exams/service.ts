/**
 * Secure exams, teacher side: drafts, the question pool, publish (snapshot +
 * access code), live monitor, per-attempt interventions and results.
 * Ownership: a teacher only ever sees their own exams (others are 404).
 */
import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import {
  Id,
  type ExamDetail,
  type ExamEventItem,
  type ExamInput,
  type ExamMonitor,
  type ExamMonitorRow,
  type ExamPoolCandidate,
  type ExamPoolQuestion,
  type ExamPoolQuery,
  type ExamResults,
  type ExamSummary,
  type SessionUser,
  type SetExamQuestionsInput,
  type UpdateExamInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import {
  enrollments,
  examAnswers,
  examAttempts,
  examEvents,
  examQuestions,
  exams,
  lessons,
  questions,
  sections,
  sectionTeachers,
  users,
} from '../../db/schema/index.js';
import { generateJoinCode } from '../../lib/crypto.js';
import { AppError, badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import {
  answeredCounts,
  examPool,
  finalizeAttempt,
  finalizeOpenAttempts,
  getOwnedExam,
  iso,
  listTeacherExamSummaries,
  loadExamDetail,
  roundPct,
  type ExamAttemptRow,
  type ExamRow,
} from './repo.js';

const POOL_LIMIT = 1000;

const fieldError = (path: string, message: string) =>
  new AppError('VALIDATION_FAILED', message, [{ path, message }]);

async function assertTeachesSection(user: SessionUser, sectionId: string): Promise<void> {
  const [section] = await db
    .select({ id: sections.id, teacherId: sectionTeachers.teacherId })
    .from(sections)
    .leftJoin(
      sectionTeachers,
      and(eq(sectionTeachers.sectionId, sections.id), eq(sectionTeachers.teacherId, user.id)),
    )
    .where(and(eq(sections.id, sectionId), eq(sections.institutionId, user.institutionId)));
  if (!section) throw notFound('Section');
  if (!section.teacherId) throw forbidden('You can only create exams for sections you teach');
}

function assertDraft(exam: ExamRow): void {
  if (exam.status !== 'draft') throw invalidState('Published exams cannot be changed.');
}

/* ----------------------------------------------------------------------------
 * Drafts
 * ------------------------------------------------------------------------- */

export const listExams = (user: SessionUser): Promise<ExamSummary[]> => listTeacherExamSummaries(user.id);

export async function getExam(user: SessionUser, id: string): Promise<ExamDetail> {
  await getOwnedExam(user.id, id);
  return loadExamDetail(id);
}

export async function createExam(user: SessionUser, input: ExamInput): Promise<ExamDetail> {
  await assertTeachesSection(user, input.sectionId);
  const [exam] = await db
    .insert(exams)
    .values({
      ...input,
      institutionId: user.institutionId,
      teacherId: user.id,
      opensAt: new Date(input.opensAt),
      closesAt: new Date(input.closesAt),
      status: 'draft',
      selectedQuestionIds: [],
    })
    .returning();
  return loadExamDetail(exam!.id);
}

export async function updateExam(user: SessionUser, id: string, input: UpdateExamInput): Promise<ExamDetail> {
  const exam = await getOwnedExam(user.id, id);
  assertDraft(exam);
  const { opensAt, closesAt, ...rest } = input;
  const patch: Partial<typeof exams.$inferInsert> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );
  if (opensAt) patch.opensAt = new Date(opensAt);
  if (closesAt) patch.closesAt = new Date(closesAt);
  if ((patch.closesAt ?? exam.closesAt) <= (patch.opensAt ?? exam.opensAt))
    throw fieldError('closesAt', 'The exam must close after it opens');
  if (patch.sectionId && patch.sectionId !== exam.sectionId) {
    await assertTeachesSection(user, patch.sectionId);
    // The chosen questions belong to the old section's lessons.
    patch.selectedQuestionIds = [];
  }
  if (Object.keys(patch).length) await db.update(exams).set(patch).where(eq(exams.id, id));
  return loadExamDetail(id);
}

export async function deleteExam(user: SessionUser, id: string): Promise<void> {
  const exam = await getOwnedExam(user.id, id);
  if (exam.status !== 'draft') throw invalidState('Only draft exams can be deleted.');
  await db.delete(exams).where(and(eq(exams.id, id), eq(exams.status, 'draft')));
}

/* ----------------------------------------------------------------------------
 * Question pool
 * ------------------------------------------------------------------------- */

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Approved questions from this teacher's lessons in the exam's section. */
async function poolCandidates(
  exam: ExamRow,
  filter: {
    lessonIds?: string[];
    difficulty?: ExamPoolQuery['difficulty'];
    topic?: string;
    questionIds?: string[];
  },
): Promise<ExamPoolCandidate[]> {
  const rows = await db
    .select({ q: questions, lessonTitle: lessons.title })
    .from(questions)
    .innerJoin(lessons, eq(lessons.id, questions.lessonId))
    .where(
      and(
        eq(lessons.teacherId, exam.teacherId),
        eq(lessons.sectionId, exam.sectionId),
        eq(questions.status, 'approved'),
        filter.lessonIds?.length ? inArray(lessons.id, filter.lessonIds) : undefined,
        filter.difficulty ? eq(questions.difficulty, filter.difficulty) : undefined,
        filter.topic ? ilike(questions.topicTag, `%${escapeLike(filter.topic)}%`) : undefined,
        filter.questionIds ? inArray(questions.id, filter.questionIds) : undefined,
      ),
    )
    .orderBy(desc(lessons.createdAt), asc(questions.position))
    .limit(POOL_LIMIT);
  return rows.map(({ q, lessonTitle }) => ({
    questionId: q.id,
    lesson: { id: q.lessonId, title: lessonTitle },
    stem: q.stem,
    options: q.options,
    correctIndex: q.correctIndex,
    difficulty: q.difficulty,
    topicTag: q.topicTag,
  }));
}

function parseLessonIds(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > 100 || ids.some((x) => !Id.safeParse(x).success))
    throw badRequest('lessonIds must be a comma-separated list of lesson ids');
  return ids;
}

export async function questionPool(
  user: SessionUser,
  id: string,
  query: ExamPoolQuery,
): Promise<ExamPoolCandidate[]> {
  const exam = await getOwnedExam(user.id, id);
  return poolCandidates(exam, {
    lessonIds: parseLessonIds(query.lessonIds),
    difficulty: query.difficulty,
    topic: query.topic || undefined,
  });
}

export async function setQuestions(
  user: SessionUser,
  id: string,
  input: SetExamQuestionsInput,
): Promise<ExamDetail> {
  const exam = await getOwnedExam(user.id, id);
  assertDraft(exam);
  const ids = [...new Set(input.questionIds)];
  const found = await poolCandidates(exam, { questionIds: ids });
  if (found.length !== ids.length) {
    throw badRequest('Pick only approved questions from your own lessons in this section.');
  }
  await db.update(exams).set({ selectedQuestionIds: ids }).where(eq(exams.id, id));
  return loadExamDetail(id);
}

/* ----------------------------------------------------------------------------
 * Publish / close / access code
 * ------------------------------------------------------------------------- */

export async function publishExam(user: SessionUser, id: string): Promise<ExamDetail> {
  const exam = await getOwnedExam(user.id, id);
  assertDraft(exam);
  const now = new Date();
  if (exam.closesAt <= exam.opensAt) throw fieldError('closesAt', 'The exam must close after it opens');
  if (exam.closesAt <= now)
    throw fieldError('closesAt', 'The closing time has already passed. Pick a time in the future.');
  const ids = exam.selectedQuestionIds;
  // Drafts created from a question paper already hold their own snapshotted questions (createExamFromQuestions).
  const prefilled = (await examPool(id)).length;
  const poolTotal = prefilled + ids.length;
  if (!poolTotal) throw invalidState('Select at least one question before publishing.');
  if (exam.questionsPerStudent < 1 || exam.questionsPerStudent > poolTotal) {
    throw fieldError(
      'questionsPerStudent',
      `Questions per student must be between 1 and ${poolTotal} (the number of selected questions).`,
    );
  }
  const found = new Map(
    (ids.length ? await poolCandidates(exam, { questionIds: ids }) : []).map((q) => [q.questionId, q]),
  );
  const missing = ids.filter((qid) => !found.has(qid)).length;
  if (missing) {
    throw invalidState(
      `${missing} selected ${missing === 1 ? 'question is' : 'questions are'} no longer approved. Review the question list.`,
    );
  }

  // Snapshot full question content (incl. local language + explanations) so later lesson edits never touch the exam.
  const sources = await db.select().from(questions).where(inArray(questions.id, ids));
  const byId = new Map(sources.map((q) => [q.id, q]));
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(exams)
      .set({
        status: 'published',
        publishedAt: now,
        accessCode: exam.useAccessCode ? generateJoinCode() : null,
      })
      .where(and(eq(exams.id, id), eq(exams.status, 'draft')))
      .returning({ id: exams.id });
    if (!updated) throw invalidState('This exam was already published.');
    if (!ids.length) return;
    await tx.insert(examQuestions).values(
      ids.map((qid, i) => {
        const q = byId.get(qid)!;
        return {
          examId: id,
          sourceQuestionId: q.id,
          position: prefilled + i + 1,
          stem: q.stem,
          stemLocal: q.stemLocal,
          options: q.options,
          optionsLocal: q.optionsLocal,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          explanationLocal: q.explanationLocal,
          difficulty: q.difficulty,
          topicTag: q.topicTag,
        };
      }),
    );
  });
  return loadExamDetail(id);
}

/** One multiple-choice question for an exam built outside the lesson question bank (e.g. a question paper). */
export interface ExamQuestionData {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficulty: ExamPoolQuestion['difficulty'];
  topicTag: string | null;
}

/**
 * Creates a DRAFT exam whose pool is snapshotted directly from the given MCQs (no source lesson questions).
 * The teacher then reviews the window and security settings in the exam editor and publishes as usual;
 * lesson questions picked later are added after these.
 */
export async function createExamFromQuestions(
  user: SessionUser,
  input: {
    title: string;
    sectionId: string;
    instructions?: string;
    opensAt: string;
    closesAt: string;
    durationMin: number;
    questionsPerStudent?: number;
  },
  items: ExamQuestionData[],
): Promise<ExamDetail> {
  await assertTeachesSection(user, input.sectionId);
  if (!items.length) throw invalidState('There are no multiple-choice questions to put in an exam.');
  if (Date.parse(input.closesAt) <= Date.parse(input.opensAt)) throw fieldError('closesAt', 'The exam must close after it opens');
  const perStudent = Math.min(input.questionsPerStudent ?? items.length, items.length);
  const examId = await db.transaction(async (tx) => {
    const [exam] = await tx
      .insert(exams)
      .values({
        institutionId: user.institutionId,
        teacherId: user.id,
        sectionId: input.sectionId,
        title: input.title.slice(0, 200),
        instructions: input.instructions ?? '',
        opensAt: new Date(input.opensAt),
        closesAt: new Date(input.closesAt),
        durationMin: input.durationMin,
        questionsPerStudent: perStudent,
        status: 'draft',
        selectedQuestionIds: [],
      })
      .returning({ id: exams.id });
    await tx.insert(examQuestions).values(
      items.map((q, i) => ({
        examId: exam!.id,
        sourceQuestionId: null,
        position: i + 1,
        stem: q.stem,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicTag: q.topicTag?.slice(0, 120) ?? null,
      })),
    );
    return exam!.id;
  });
  return loadExamDetail(examId);
}

/** Ends the exam now: no new starts, and every attempt still running is submitted and graded. */
export async function closeExam(user: SessionUser, id: string): Promise<ExamDetail> {
  const exam = await getOwnedExam(user.id, id);
  if (exam.status !== 'published') throw invalidState('Only published exams can be closed.');
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(exams)
      .set({ status: 'closed', closedAt: now })
      .where(and(eq(exams.id, id), eq(exams.status, 'published')));
    await finalizeOpenAttempts(tx, id, now);
  });
  return loadExamDetail(id);
}

export async function rotateAccessCode(user: SessionUser, id: string): Promise<ExamDetail> {
  const exam = await getOwnedExam(user.id, id);
  if (exam.status !== 'published')
    throw invalidState('Access codes can only be changed while the exam is published.');
  if (!exam.useAccessCode) throw invalidState('This exam does not use an access code.');
  await db.update(exams).set({ accessCode: generateJoinCode() }).where(eq(exams.id, id));
  return loadExamDetail(id);
}

/* ----------------------------------------------------------------------------
 * Monitor & interventions
 * ------------------------------------------------------------------------- */

type MonitorSource = {
  student: { id: string; name: string; rollNumber: string | null };
  attempt: ExamAttemptRow | null;
};

/** Every enrolled student (even those who never started) plus anyone with an attempt. */
async function monitorSources(exam: ExamRow, attemptId?: string): Promise<MonitorSource[]> {
  const enrolled = db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.sectionId, exam.sectionId));
  return db
    .select({
      student: { id: users.id, name: users.name, rollNumber: users.rollNumber },
      attempt: examAttempts,
    })
    .from(users)
    .leftJoin(examAttempts, and(eq(examAttempts.studentId, users.id), eq(examAttempts.examId, exam.id)))
    .where(
      attemptId
        ? eq(examAttempts.id, attemptId)
        : and(
            eq(users.institutionId, exam.institutionId),
            or(inArray(users.id, enrolled), isNotNull(examAttempts.id)),
          ),
    )
    .orderBy(asc(users.name));
}

function toMonitorRow(exam: ExamRow, src: MonitorSource, answered: Map<string, number>): ExamMonitorRow {
  const a = src.attempt;
  return {
    student: src.student,
    attemptId: a?.id ?? null,
    status: a?.status ?? 'not_started',
    answered: a ? (answered.get(a.id) ?? 0) : 0,
    total: a ? a.paper.length : exam.questionsPerStudent,
    startedAt: iso(a?.startedAt ?? null),
    deadlineAt: iso(a?.deadlineAt ?? null),
    submittedAt: iso(a?.submittedAt ?? null),
    extraMinutes: a?.extraMinutes ?? 0,
    violationCount: a?.violationCount ?? 0,
    lastSeenAt: iso(a?.lastSeenAt ?? null),
    deviceLocked: Boolean(a && a.status === 'in_progress' && exam.singleDevice && a.deviceTokenHash),
    scorePct: a?.scorePct ?? null,
  };
}

async function buildRows(
  exam: ExamRow,
  attemptId?: string,
): Promise<{ sources: MonitorSource[]; rows: ExamMonitorRow[] }> {
  const sources = await monitorSources(exam, attemptId);
  const answered = await answeredCounts(sources.flatMap((s) => (s.attempt ? [s.attempt.id] : [])));
  return { sources, rows: sources.map((s) => toMonitorRow(exam, s, answered)) };
}

export async function monitor(user: SessionUser, id: string): Promise<ExamMonitor> {
  const exam = await getOwnedExam(user.id, id);
  const [detail, { rows }] = await Promise.all([loadExamDetail(id), buildRows(exam)]);
  return { exam: detail, serverTime: Date.now(), rows };
}

async function getOwnedAttempt(user: SessionUser, examId: string, attemptId: string) {
  const exam = await getOwnedExam(user.id, examId);
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.examId, examId)));
  if (!attempt) throw notFound('Attempt');
  return { exam, attempt };
}

async function monitorRow(exam: ExamRow, attemptId: string): Promise<ExamMonitorRow> {
  const { rows } = await buildRows(exam, attemptId);
  if (!rows[0]) throw notFound('Attempt');
  return rows[0];
}

const assertRunning = (a: ExamAttemptRow) => {
  if (a.status !== 'in_progress') throw invalidState('This attempt has already been submitted.');
};

/** Clears the device binding; the next device that opens the exam (with the access code) takes over. */
export async function unlockDevice(
  user: SessionUser,
  examId: string,
  attemptId: string,
): Promise<ExamMonitorRow> {
  const { exam, attempt } = await getOwnedAttempt(user, examId, attemptId);
  assertRunning(attempt);
  await db.update(examAttempts).set({ deviceTokenHash: null }).where(eq(examAttempts.id, attemptId));
  return monitorRow(exam, attemptId);
}

export async function addExtraTime(
  user: SessionUser,
  examId: string,
  attemptId: string,
  minutes: number,
): Promise<ExamMonitorRow> {
  const { exam, attempt } = await getOwnedAttempt(user, examId, attemptId);
  assertRunning(attempt);
  const [updated] = await db
    .update(examAttempts)
    .set({
      deadlineAt: sql`${examAttempts.deadlineAt} + make_interval(mins => ${minutes}::int)`,
      extraMinutes: sql`${examAttempts.extraMinutes} + ${minutes}::int`,
    })
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.status, 'in_progress')))
    .returning({ id: examAttempts.id });
  if (!updated) throw invalidState('This attempt has already been submitted.');
  return monitorRow(exam, attemptId);
}

export async function forceSubmit(
  user: SessionUser,
  examId: string,
  attemptId: string,
): Promise<ExamMonitorRow> {
  const { exam, attempt } = await getOwnedAttempt(user, examId, attemptId);
  assertRunning(attempt);
  const done = await db.transaction((tx) => finalizeAttempt(tx, attemptId, 'auto_submitted'));
  if (!done) throw invalidState('This attempt has already been submitted.');
  return monitorRow(exam, attemptId);
}

/* ----------------------------------------------------------------------------
 * Results
 * ------------------------------------------------------------------------- */

export async function results(user: SessionUser, id: string): Promise<ExamResults> {
  const exam = await getOwnedExam(user.id, id);
  const [detail, { sources, rows }, pool] = await Promise.all([
    loadExamDetail(id),
    buildRows(exam),
    examPool(id),
  ]);
  const attempts = sources.flatMap((s) => (s.attempt ? [s.attempt] : []));
  const finished = attempts.filter((a) => a.status !== 'in_progress');

  const [events, answerRows] = await Promise.all([
    attempts.length
      ? db
          .select({
            attemptId: examEvents.attemptId,
            type: examEvents.type,
            at: examEvents.at,
            detail: examEvents.detail,
          })
          .from(examEvents)
          .where(
            inArray(
              examEvents.attemptId,
              attempts.map((a) => a.id),
            ),
          )
          .orderBy(asc(examEvents.at))
      : [],
    db
      .select({
        examQuestionId: examAnswers.examQuestionId,
        selectedIndex: examAnswers.selectedIndex,
        n: sql<number>`count(*)::int`,
      })
      .from(examAnswers)
      .innerJoin(examAttempts, eq(examAttempts.id, examAnswers.attemptId))
      .where(
        and(
          eq(examAttempts.examId, id),
          ne(examAttempts.status, 'in_progress'),
          isNotNull(examAnswers.selectedIndex),
        ),
      )
      .groupBy(examAnswers.examQuestionId, examAnswers.selectedIndex),
  ]);

  const eventsByAttempt = new Map<string, ExamEventItem[]>();
  for (const e of events) {
    const list = eventsByAttempt.get(e.attemptId) ?? [];
    list.push({ type: e.type, at: e.at.toISOString(), detail: e.detail ?? null });
    eventsByAttempt.set(e.attemptId, list);
  }

  const served = new Map<string, number>();
  for (const a of finished)
    for (const item of a.paper) served.set(item.examQuestionId, (served.get(item.examQuestionId) ?? 0) + 1);

  const questionStats = pool.map((q) => {
    const distribution = q.options.map(() => 0);
    let answered = 0;
    for (const r of answerRows) {
      if (r.examQuestionId !== q.id || r.selectedIndex === null) continue;
      answered += r.n;
      if (r.selectedIndex >= 0 && r.selectedIndex < distribution.length)
        distribution[r.selectedIndex]! += r.n;
    }
    const n = served.get(q.id) ?? 0;
    const correct = distribution[q.correctIndex] ?? 0;
    return {
      examQuestionId: q.id,
      position: q.position,
      stem: q.stem,
      correctIndex: q.correctIndex,
      served: n,
      answered,
      accuracyPct: n ? roundPct((correct / n) * 100) : null,
      optionDistribution: distribution,
    };
  });

  const scores = finished.map((a) => a.scorePct ?? 0);
  return {
    exam: detail,
    averageScorePct: scores.length ? roundPct(scores.reduce((s, x) => s + x, 0) / scores.length) : null,
    students: rows.map((row, i) => {
      const a = sources[i]!.attempt;
      return { ...row, correct: a?.correct ?? null, events: a ? (eventsByAttempt.get(a.id) ?? []) : [] };
    }),
    questions: questionStats,
  };
}

const STATUS_LABEL: Record<ExamMonitorRow['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  auto_submitted: 'Auto-submitted',
};

/** CSV cell: quoted, with spreadsheet formula injection neutralised. */
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function resultsCsv(user: SessionUser, id: string): Promise<{ filename: string; csv: string }> {
  const r = await results(user, id);
  const header = [
    'Name',
    'Roll number',
    'Status',
    'Answered',
    'Questions',
    'Correct',
    'Score %',
    'Violations',
    'Extra minutes',
    'Started at',
    'Submitted at',
  ];
  const lines = [
    header,
    ...r.students.map((s) => [
      s.student.name,
      s.student.rollNumber,
      STATUS_LABEL[s.status],
      s.answered,
      s.total,
      s.correct,
      s.scorePct,
      s.violationCount,
      s.extraMinutes,
      s.startedAt,
      s.submittedAt,
    ]),
  ].map((cols) => cols.map(csvCell).join(','));
  const slug =
    r.exam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'exam';
  return { filename: `${slug}-results.csv`, csv: `${lines.join('\r\n')}\r\n` };
}
