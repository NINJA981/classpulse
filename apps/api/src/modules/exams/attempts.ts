/**
 * Secure exams, student side. The server owns everything that matters: the
 * window, each student's random paper, the deadline, saved answers, integrity
 * events and the grade. The answer key never leaves the server before results
 * are visible.
 *
 * Device binding: starting (or resuming on a new device) issues a token whose
 * sha256 is stored on the attempt; every attempt call must present it in the
 * X-Exam-Token header. With "one device at a time" a second device is refused
 * until the teacher unlocks the attempt. Without it the token is derived from
 * the attempt id, so any of the student's devices gets the same one.
 */
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  EXAM_MAX_EVENTS_PER_ATTEMPT,
  EXAM_SAVE_GRACE_SEC,
  EXAM_VIOLATION_TYPES,
  type ExamEventInput,
  type ExamEventResponse,
  type ExamEventType,
  type StartExamInput,
  type StartExamResponse,
  type StudentExamListItem,
  type StudentExamPaper,
  type StudentExamResult,
  type StudentExamState,
} from '@classpulse/shared';
import { db, type DbOrTx, type Tx } from '../../db/client.js';
import type { ExamPaperItem } from '../../db/schema/exams.js';
import {
  enrollments,
  examAnswers,
  examAttempts,
  examEvents,
  examQuestions,
  exams,
  sections,
  users,
} from '../../db/schema/index.js';
import { randomToken, safeEqualHex, sha256Hex } from '../../lib/crypto.js';
import { keyFor } from '../../lib/keys.js';
import { badRequest, conflict, forbidden, invalidState, notFound } from '../../lib/errors.js';
import {
  answerKeyReleaseAt,
  examPool,
  finalizeAttempt,
  iso,
  resultsAvailableAt,
  resultsVisible,
  type ExamAttemptRow,
  type ExamRow,
} from './repo.js';

export const ANOTHER_DEVICE_MESSAGE = 'This exam is open on another device. Ask your teacher to unlock it.';
const REOPEN_MESSAGE = 'This exam is no longer active on this device. Open it again to continue.';
const SUBMITTED_MESSAGE = 'You have already submitted this exam.';
const TIME_UP_MESSAGE = 'Time is up. Your exam has been submitted.';

/** Events only the server records (a client cannot fake or suppress them). */
const SERVER_ONLY_EVENTS: ReadonlySet<ExamEventType> = new Set(['second_device', 'resume']);
const MAX_DETAIL_KEYS = 10;

const isViolation = (type: ExamEventType) => EXAM_VIOLATION_TYPES.includes(type);
const isExpired = (a: ExamAttemptRow, now: Date) =>
  now.getTime() > a.deadlineAt.getTime() + EXAM_SAVE_GRACE_SEC * 1000;

/* ----------------------------------------------------------------------------
 * Lookups
 * ------------------------------------------------------------------------- */

const enrolledSectionIds = (studentId: string) =>
  db.select({ id: enrollments.sectionId }).from(enrollments).where(eq(enrollments.studentId, studentId));

/** Published/closed exam of a section the student is enrolled in, else 404. */
async function getVisibleExam(studentId: string, examId: string): Promise<ExamRow> {
  const [exam] = await db
    .select()
    .from(exams)
    .where(
      and(
        eq(exams.id, examId),
        inArray(exams.status, ['published', 'closed']),
        inArray(exams.sectionId, enrolledSectionIds(studentId)),
      ),
    );
  if (!exam) throw notFound('Exam');
  return exam;
}

async function findAttempt(
  examId: string,
  studentId: string,
  dbx: DbOrTx = db,
): Promise<ExamAttemptRow | undefined> {
  const [attempt] = await dbx
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, studentId)));
  return attempt;
}

/** Row-locks the student's attempt so saves, events and submit serialize. */
async function lockAttempt(tx: Tx, examId: string, studentId: string): Promise<ExamAttemptRow> {
  const [attempt] = await tx
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, studentId)))
    .for('update');
  if (!attempt) throw notFound('Attempt');
  return attempt;
}

/* ----------------------------------------------------------------------------
 * Device token
 * ------------------------------------------------------------------------- */

function issueToken(exam: ExamRow, attemptId: string): string {
  return exam.singleDevice
    ? randomToken()
    : createHmac('sha256', keyFor('exam-device')).update(`exam-device:${attemptId}`).digest('base64url');
}

const tokenMatches = (token: string | undefined, hash: string | null) =>
  Boolean(token && hash && safeEqualHex(sha256Hex(token), hash));

function assertToken(attempt: ExamAttemptRow, token: string | undefined): void {
  if (tokenMatches(token, attempt.deviceTokenHash)) return;
  throw conflict(attempt.deviceTokenHash ? ANOTHER_DEVICE_MESSAGE : REOPEN_MESSAGE);
}

function assertAccessCode(exam: ExamRow, code: string | undefined): void {
  if (!exam.useAccessCode) return;
  const ok = Boolean(
    code &&
    exam.accessCode &&
    safeEqualHex(sha256Hex(code.toUpperCase()), sha256Hex(exam.accessCode.toUpperCase())),
  );
  if (!ok)
    throw forbidden(
      code
        ? 'That access code is not right. Check it with your teacher.'
        : 'Enter the access code your teacher gave you.',
    );
}

/* ----------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------- */

/** Logs an integrity event (up to the per-attempt cap) and bumps the violation counter. Returns the new count. */
async function recordEvent(
  tx: Tx,
  attempt: ExamAttemptRow,
  type: ExamEventType,
  detail: Record<string, string | number | boolean> | null,
  now: Date,
): Promise<number> {
  const [logged] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(examEvents)
    .where(eq(examEvents.attemptId, attempt.id));
  if ((logged?.n ?? 0) < EXAM_MAX_EVENTS_PER_ATTEMPT)
    await tx.insert(examEvents).values({ attemptId: attempt.id, type, at: now, detail });
  if (!isViolation(type)) return attempt.violationCount;
  const [updated] = await tx
    .update(examAttempts)
    .set({ violationCount: sql`${examAttempts.violationCount} + 1` })
    .where(eq(examAttempts.id, attempt.id))
    .returning({ violationCount: examAttempts.violationCount });
  return updated!.violationCount;
}

function trimDetail(detail: ExamEventInput['detail']): Record<string, string | number | boolean> | null {
  if (!detail) return null;
  const entries = Object.entries(detail).slice(0, MAX_DETAIL_KEYS);
  return entries.length ? Object.fromEntries(entries) : null;
}

/* ----------------------------------------------------------------------------
 * Paper
 * ------------------------------------------------------------------------- */

function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Student-safe projection: their questions in their order, options in their order, saved answers as shown indexes. */
async function buildPaper(exam: ExamRow, attempt: ExamAttemptRow): Promise<StudentExamPaper> {
  const ids = attempt.paper.map((p) => p.examQuestionId);
  const [qs, saved] = await Promise.all([
    db
      .select({
        id: examQuestions.id,
        stem: examQuestions.stem,
        stemLocal: examQuestions.stemLocal,
        options: examQuestions.options,
        optionsLocal: examQuestions.optionsLocal,
      })
      .from(examQuestions)
      .where(inArray(examQuestions.id, ids)),
    db
      .select({ examQuestionId: examAnswers.examQuestionId, selectedIndex: examAnswers.selectedIndex })
      .from(examAnswers)
      .where(eq(examAnswers.attemptId, attempt.id)),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const orderOf = new Map(attempt.paper.map((p) => [p.examQuestionId, p.optionOrder]));
  const answers: Record<string, number | null> = {};
  for (const a of saved) {
    const shown =
      a.selectedIndex === null ? -1 : (orderOf.get(a.examQuestionId)?.indexOf(a.selectedIndex) ?? -1);
    answers[a.examQuestionId] = shown >= 0 ? shown : null;
  }
  return {
    examId: exam.id,
    attemptId: attempt.id,
    title: exam.title,
    instructions: exam.instructions,
    requireFullscreen: exam.requireFullscreen,
    maxViolations: exam.maxViolations,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    serverTime: Date.now(),
    violationCount: attempt.violationCount,
    questions: attempt.paper.map((p, i) => {
      const q = byId.get(p.examQuestionId)!;
      const local = q.optionsLocal && q.optionsLocal.length === q.options.length ? q.optionsLocal : null;
      return {
        examQuestionId: p.examQuestionId,
        number: i + 1,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: p.optionOrder.map((c) => q.options[c]!),
        optionsLocal: local ? p.optionOrder.map((c) => local[c]!) : null,
      };
    }),
    answers,
  };
}

/** Ends an attempt whose deadline (plus grace) has passed, in case the sweep has not got to it yet. */
async function settleIfExpired(attempt: ExamAttemptRow, now: Date): Promise<ExamAttemptRow> {
  if (attempt.status !== 'in_progress' || !isExpired(attempt, now)) return attempt;
  const graded = await db.transaction((tx) => finalizeAttempt(tx, attempt.id, 'auto_submitted', now));
  return graded ?? (await findAttempt(attempt.examId, attempt.studentId))!;
}

/* ----------------------------------------------------------------------------
 * List
 * ------------------------------------------------------------------------- */

function scoreOf(a: ExamAttemptRow): { correct: number; total: number; scorePct: number } | null {
  return a.correct === null || a.total === null || a.scorePct === null
    ? null
    : { correct: a.correct, total: a.total, scorePct: a.scorePct };
}

export async function listExams(studentId: string): Promise<StudentExamListItem[]> {
  const now = new Date();
  const rows = await db
    .select({ exam: exams, sectionName: sections.name, teacherName: users.name, attempt: examAttempts })
    .from(exams)
    .innerJoin(sections, eq(sections.id, exams.sectionId))
    .innerJoin(users, eq(users.id, exams.teacherId))
    .leftJoin(examAttempts, and(eq(examAttempts.examId, exams.id), eq(examAttempts.studentId, studentId)))
    .where(
      and(
        inArray(exams.status, ['published', 'closed']),
        inArray(exams.sectionId, enrolledSectionIds(studentId)),
      ),
    )
    .orderBy(desc(exams.opensAt));

  const items: StudentExamListItem[] = [];
  for (const r of rows) {
    const e = r.exam;
    const attempt = r.attempt ? await settleIfExpired(r.attempt, now) : null;
    let state: StudentExamState;
    if (attempt) state = attempt.status === 'in_progress' ? 'in_progress' : 'submitted';
    else if (now < e.opensAt) state = 'upcoming';
    else if (e.status === 'published' && now < e.closesAt) state = 'open';
    else state = 'missed';
    items.push({
      id: e.id,
      title: e.title,
      section: { id: e.sectionId, name: r.sectionName },
      teacherName: r.teacherName,
      opensAt: e.opensAt.toISOString(),
      closesAt: e.closesAt.toISOString(),
      durationMin: e.durationMin,
      questionCount: e.questionsPerStudent,
      requiresAccessCode: e.useAccessCode,
      requireFullscreen: e.requireFullscreen,
      state,
      result: attempt && resultsVisible(e, attempt, now) ? scoreOf(attempt) : null,
    });
  }
  return items;
}

/* ----------------------------------------------------------------------------
 * Start / resume
 * ------------------------------------------------------------------------- */

async function resume(
  exam: ExamRow,
  attempt: ExamAttemptRow,
  input: StartExamInput,
  token: string | undefined,
  now: Date,
): Promise<StartExamResponse> {
  const current = await settleIfExpired(attempt, now);
  if (current.status !== 'in_progress')
    throw invalidState(attempt.status === 'in_progress' ? TIME_UP_MESSAGE : SUBMITTED_MESSAGE);

  // Same device (e.g. a page reload): keep its token.
  if (token && tokenMatches(token, current.deviceTokenHash)) {
    const [touched] = await db.transaction(async (tx) => {
      await recordEvent(tx, current, 'resume', { device: 'same' }, now);
      return tx
        .update(examAttempts)
        .set({ lastSeenAt: now })
        .where(eq(examAttempts.id, current.id))
        .returning();
    });
    return { attemptToken: token, paper: await buildPaper(exam, touched!) };
  }

  if (exam.singleDevice && current.deviceTokenHash) {
    await db.transaction((tx) => recordEvent(tx, current, 'second_device', null, now));
    throw conflict(ANOTHER_DEVICE_MESSAGE);
  }

  // Unbound (teacher unlocked it) or multi-device exam: this device takes over.
  assertAccessCode(exam, input.accessCode);
  const raw = issueToken(exam, current.id);
  const bound = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(examAttempts)
      .set({ deviceTokenHash: sha256Hex(raw), lastSeenAt: now })
      .where(
        and(
          eq(examAttempts.id, current.id),
          eq(examAttempts.status, 'in_progress'),
          exam.singleDevice ? isNull(examAttempts.deviceTokenHash) : undefined,
        ),
      )
      .returning();
    if (row) await recordEvent(tx, row, 'resume', { device: 'new' }, now);
    return row;
  });
  if (!bound) throw conflict(ANOTHER_DEVICE_MESSAGE); // another device bound first
  return { attemptToken: raw, paper: await buildPaper(exam, bound) };
}

export async function startExam(
  studentId: string,
  examId: string,
  input: StartExamInput,
  token: string | undefined,
): Promise<{ response: StartExamResponse; created: boolean }> {
  const exam = await getVisibleExam(studentId, examId);
  const now = new Date();
  const existing = await findAttempt(exam.id, studentId);
  if (existing) return { response: await resume(exam, existing, input, token, now), created: false };

  if (now < exam.opensAt) throw invalidState('This exam has not opened yet.');
  if (exam.status !== 'published' || now >= exam.closesAt) throw invalidState('This exam has closed.');
  assertAccessCode(exam, input.accessCode);

  const pool = await examPool(exam.id);
  if (!pool.length) throw invalidState('This exam has no questions.');
  const sample = shuffled(pool).slice(0, Math.min(exam.questionsPerStudent, pool.length));
  if (!exam.shuffleQuestions) sample.sort((a, b) => a.position - b.position);
  const paper: ExamPaperItem[] = sample.map((q) => {
    const identity = q.options.map((_, i) => i);
    return { examQuestionId: q.id, optionOrder: exam.shuffleOptions ? shuffled(identity) : identity };
  });

  const attemptId = randomUUID();
  const raw = issueToken(exam, attemptId);
  const deadline = Math.min(now.getTime() + exam.durationMin * 60_000, exam.closesAt.getTime());
  const [created] = await db
    .insert(examAttempts)
    .values({
      id: attemptId,
      examId: exam.id,
      studentId,
      status: 'in_progress',
      startedAt: now,
      deadlineAt: new Date(deadline),
      paper,
      deviceTokenHash: sha256Hex(raw),
      lastSeenAt: now,
    })
    .onConflictDoNothing({ target: [examAttempts.examId, examAttempts.studentId] })
    .returning();
  if (!created) {
    // A concurrent start (double tap / second tab) won the race.
    const winner = await findAttempt(exam.id, studentId);
    if (!winner) throw invalidState('Could not start the exam. Please try again.');
    return { response: await resume(exam, winner, input, token, now), created: false };
  }
  return { response: { attemptToken: raw, paper: await buildPaper(exam, created) }, created: true };
}

/* ----------------------------------------------------------------------------
 * Attempt calls (token required)
 * ------------------------------------------------------------------------- */

export async function getAttempt(
  studentId: string,
  examId: string,
  token: string | undefined,
): Promise<StudentExamPaper> {
  const exam = await getVisibleExam(studentId, examId);
  const attempt = await findAttempt(exam.id, studentId);
  if (!attempt) throw notFound('Attempt');
  assertToken(attempt, token);
  const now = new Date();
  const current = await settleIfExpired(attempt, now);
  if (current.status !== 'in_progress') return buildPaper(exam, current);
  const [touched] = await db
    .update(examAttempts)
    .set({ lastSeenAt: now })
    .where(eq(examAttempts.id, current.id))
    .returning();
  return buildPaper(exam, touched!);
}

export async function saveAnswer(
  studentId: string,
  examId: string,
  examQuestionId: string,
  selectedIndex: number | null,
  token: string | undefined,
): Promise<void> {
  const exam = await getVisibleExam(studentId, examId);
  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const attempt = await lockAttempt(tx, exam.id, studentId);
    assertToken(attempt, token);
    if (attempt.status !== 'in_progress') return 'submitted' as const;
    if (isExpired(attempt, now)) {
      await finalizeAttempt(tx, attempt.id, 'auto_submitted', now);
      return 'expired' as const;
    }
    const item = attempt.paper.find((p) => p.examQuestionId === examQuestionId);
    if (!item) throw notFound('Question');
    const canonical = selectedIndex === null ? null : item.optionOrder[selectedIndex];
    if (canonical === undefined) throw badRequest('That option does not exist.');
    await tx
      .insert(examAnswers)
      .values({ attemptId: attempt.id, examQuestionId, selectedIndex: canonical, answeredAt: now })
      .onConflictDoUpdate({
        target: [examAnswers.attemptId, examAnswers.examQuestionId],
        set: { selectedIndex: canonical, answeredAt: now, revision: sql`${examAnswers.revision} + 1` },
      });
    await tx.update(examAttempts).set({ lastSeenAt: now }).where(eq(examAttempts.id, attempt.id));
    return 'saved' as const;
  });
  if (outcome === 'submitted') throw invalidState(SUBMITTED_MESSAGE);
  if (outcome === 'expired') throw invalidState(TIME_UP_MESSAGE);
}

export async function recordClientEvent(
  studentId: string,
  examId: string,
  input: ExamEventInput,
  token: string | undefined,
): Promise<ExamEventResponse> {
  if (SERVER_ONLY_EVENTS.has(input.type)) throw badRequest('This event type is recorded by the server.');
  const exam = await getVisibleExam(studentId, examId);
  const now = new Date();
  return db.transaction(async (tx) => {
    const attempt = await lockAttempt(tx, exam.id, studentId);
    assertToken(attempt, token);
    if (attempt.status !== 'in_progress') {
      return { violationCount: attempt.violationCount, autoSubmitted: attempt.status === 'auto_submitted' };
    }
    if (isExpired(attempt, now)) {
      await finalizeAttempt(tx, attempt.id, 'auto_submitted', now);
      return { violationCount: attempt.violationCount, autoSubmitted: true };
    }
    const violationCount = await recordEvent(tx, attempt, input.type, trimDetail(input.detail), now);
    await tx.update(examAttempts).set({ lastSeenAt: now }).where(eq(examAttempts.id, attempt.id));
    if (exam.maxViolations !== null && violationCount >= exam.maxViolations) {
      await finalizeAttempt(tx, attempt.id, 'auto_submitted', now);
      return { violationCount, autoSubmitted: true };
    }
    return { violationCount, autoSubmitted: false };
  });
}

export async function submitAttempt(
  studentId: string,
  examId: string,
  token: string | undefined,
): Promise<StudentExamResult> {
  const exam = await getVisibleExam(studentId, examId);
  const now = new Date();
  await db.transaction(async (tx) => {
    const attempt = await lockAttempt(tx, exam.id, studentId);
    assertToken(attempt, token);
    // Idempotent: an already-finished attempt just returns its result.
    if (attempt.status === 'in_progress')
      await finalizeAttempt(tx, attempt.id, isExpired(attempt, now) ? 'auto_submitted' : 'submitted', now);
  });
  return getResult(studentId, examId);
}

/* ----------------------------------------------------------------------------
 * Result
 * ------------------------------------------------------------------------- */

export async function getResult(studentId: string, examId: string): Promise<StudentExamResult> {
  const exam = await getVisibleExam(studentId, examId);
  const found = await findAttempt(exam.id, studentId);
  if (!found) throw notFound('Result');
  const now = new Date();
  const attempt = await settleIfExpired(found, now);
  const base = {
    examId: exam.id,
    status: attempt.status,
    submittedAt: iso(attempt.submittedAt),
    resultsAvailableAt: attempt.status === 'in_progress' ? null : iso(resultsAvailableAt(exam, attempt)),
  };
  if (!resultsVisible(exam, attempt, now)) return { ...base, score: null, answers: null, answerKeyAvailableAt: null };
  // Score and per-question correctness now; the answer key only once nobody can still be writing.
  const keyAt = await answerKeyReleaseAt(exam, now);

  const ids = attempt.paper.map((p) => p.examQuestionId);
  const [qs, saved] = await Promise.all([
    db
      .select()
      .from(examQuestions)
      .where(inArray(examQuestions.id, ids))
      .orderBy(asc(examQuestions.position)),
    db
      .select({ examQuestionId: examAnswers.examQuestionId, selectedIndex: examAnswers.selectedIndex })
      .from(examAnswers)
      .where(eq(examAnswers.attemptId, attempt.id)),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const selected = new Map(saved.map((s) => [s.examQuestionId, s.selectedIndex]));
  return {
    ...base,
    answerKeyAvailableAt: iso(keyAt),
    score: scoreOf(attempt),
    answers: attempt.paper.map((p, i) => {
      const q = byId.get(p.examQuestionId)!;
      const canonical = selected.get(p.examQuestionId) ?? null;
      const shownSelected = canonical === null ? -1 : p.optionOrder.indexOf(canonical);
      return {
        number: i + 1,
        stem: q.stem,
        options: p.optionOrder.map((c) => q.options[c]!),
        selectedIndex: shownSelected >= 0 ? shownSelected : null,
        correctIndex: keyAt ? null : p.optionOrder.indexOf(q.correctIndex),
        isCorrect: canonical !== null && canonical === q.correctIndex,
        explanation: keyAt ? null : q.explanation,
      };
    }),
  };
}
