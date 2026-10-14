/**
 * Live quiz persistence and REST operations. The realtime engine
 * (sockets/liveQuiz.ts) keeps a rebuildable in-memory cache; every transition
 * and answer is written here first so a restart can reload from Postgres.
 */
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import {
  LIVE_SCORING,
  type CreateLiveSessionInput,
  type LeaderboardEntry,
  type LivePinLookup,
  type LiveSessionInfo,
  type LiveSessionResults,
  type LiveStatus,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import { enrollments, lessons, liveAnswers, liveParticipants, liveSessions, questions, users } from '../../db/schema/index.js';
import { generatePin } from '../../lib/crypto.js';
import { AppError, invalidState, isUniqueViolation, notFound } from '../../lib/errors.js';
import { iso } from '../../lib/time.js';

export type LiveSessionRow = typeof liveSessions.$inferSelect;

export interface LiveQuestion {
  id: string;
  position: number;
  stem: string;
  stemLocal: string | null;
  options: string[];
  optionsLocal: string[] | null;
  correctIndex: number;
  explanation: string | null;
  explanationLocal: string | null;
}

export interface LiveParticipantRow {
  id: string;
  studentId: string;
  name: string;
  score: number;
  correct: number;
}

export interface LoadedLiveSession {
  session: LiveSessionRow;
  lesson: { id: string; title: string; sectionId: string; teacherId: string };
  questions: LiveQuestion[];
  participants: LiveParticipantRow[];
  /** Answers to the current question (only when a question is open). */
  currentAnswers: { participantId: string; selectedIndex: number }[];
  /** Scored answers to the current question (only when it is closed) — lets a rebuilt room replay its results. */
  closedAnswers: CloseOutcome['answers'];
}

/* ----------------------------------------------------------------------------
 * Shared queries
 * ------------------------------------------------------------------------- */

export async function approvedQuestions(lessonId: string): Promise<LiveQuestion[]> {
  return db
    .select({
      id: questions.id,
      position: questions.position,
      stem: questions.stem,
      stemLocal: questions.stemLocal,
      options: questions.options,
      optionsLocal: questions.optionsLocal,
      correctIndex: questions.correctIndex,
      explanation: questions.explanation,
      explanationLocal: questions.explanationLocal,
    })
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), eq(questions.status, 'approved')))
    .orderBy(asc(questions.position), asc(questions.id));
}

async function participantsOf(sessionId: string): Promise<LiveParticipantRow[]> {
  return db
    .select({
      id: liveParticipants.id,
      studentId: liveParticipants.studentId,
      name: users.name,
      score: liveParticipants.score,
      correct: liveParticipants.correct,
    })
    .from(liveParticipants)
    .innerJoin(users, eq(users.id, liveParticipants.studentId))
    .where(eq(liveParticipants.sessionId, sessionId))
    .orderBy(asc(liveParticipants.joinedAt));
}

/** Competition ranking (1, 2, 2, 4) by score; ties ordered by correct answers then name. */
export function rankLeaderboard(rows: LiveParticipantRow[]): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.score !== sorted[i - 1]!.score) rank = i + 1;
    return { participantId: p.id, studentId: p.studentId, name: p.name, score: p.score, correct: p.correct, rank };
  });
}

export async function loadLiveSession(sessionId: string): Promise<LoadedLiveSession | null> {
  const [row] = await db
    .select({ session: liveSessions, title: lessons.title, sectionId: lessons.sectionId, teacherId: lessons.teacherId })
    .from(liveSessions)
    .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
    .where(eq(liveSessions.id, sessionId));
  if (!row) return null;
  const qs = await approvedQuestions(row.session.lessonId);
  const participants = await participantsOf(sessionId);
  let currentAnswers: LoadedLiveSession['currentAnswers'] = [];
  let closedAnswers: LoadedLiveSession['closedAnswers'] = [];
  const idx = row.session.currentQuestionIndex;
  const status = row.session.status;
  if ((status === 'question_open' || status === 'question_closed') && idx !== null && qs[idx]) {
    const answers = await db
      .select({
        participantId: liveAnswers.participantId,
        selectedIndex: liveAnswers.selectedIndex,
        isCorrect: liveAnswers.isCorrect,
        pointsAwarded: liveAnswers.pointsAwarded,
      })
      .from(liveAnswers)
      .innerJoin(liveParticipants, eq(liveParticipants.id, liveAnswers.participantId))
      .where(and(eq(liveParticipants.sessionId, sessionId), eq(liveAnswers.questionId, qs[idx].id)));
    if (status === 'question_open') currentAnswers = answers.map((a) => ({ participantId: a.participantId, selectedIndex: a.selectedIndex }));
    else {
      closedAnswers = answers.map((a) => ({
        participantId: a.participantId,
        selectedIndex: a.selectedIndex,
        isCorrect: Boolean(a.isCorrect),
        pointsAwarded: a.pointsAwarded ?? 0,
      }));
    }
  }
  return {
    session: row.session,
    lesson: { id: row.session.lessonId, title: row.title, sectionId: row.sectionId, teacherId: row.teacherId },
    questions: qs,
    participants,
    currentAnswers,
    closedAnswers,
  };
}

export async function findActiveSessionIdByPin(pin: string): Promise<string | null> {
  const [row] = await db
    .select({ id: liveSessions.id })
    .from(liveSessions)
    .where(and(eq(liveSessions.pin, pin), ne(liveSessions.status, 'ended')));
  return row?.id ?? null;
}

export async function isEnrolled(studentId: string, sectionId: string): Promise<boolean> {
  const [row] = await db
    .select({ s: enrollments.sectionId })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.sectionId, sectionId)));
  return Boolean(row);
}

/** Same student â†’ same participant (unique (session, student)). */
export async function ensureParticipant(sessionId: string, studentId: string): Promise<LiveParticipantRow> {
  await db.insert(liveParticipants).values({ sessionId, studentId }).onConflictDoNothing();
  const [row] = await db
    .select({
      id: liveParticipants.id,
      studentId: liveParticipants.studentId,
      name: users.name,
      score: liveParticipants.score,
      correct: liveParticipants.correct,
    })
    .from(liveParticipants)
    .innerJoin(users, eq(users.id, liveParticipants.studentId))
    .where(and(eq(liveParticipants.sessionId, sessionId), eq(liveParticipants.studentId, studentId)));
  return row!;
}

/* ----------------------------------------------------------------------------
 * Transitions (guarded by the expected current status so they are idempotent)
 * ------------------------------------------------------------------------- */

export async function persistOpenQuestion(
  sessionId: string,
  from: LiveStatus,
  index: number,
  openedAt: Date,
  closesAt: Date,
): Promise<boolean> {
  const rows = await db
    .update(liveSessions)
    .set({
      status: 'question_open',
      currentQuestionIndex: index,
      questionOpenedAt: openedAt,
      questionClosesAt: closesAt,
      startedAt: sql`coalesce(${liveSessions.startedAt}, now())`,
    })
    .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.status, from)))
    .returning({ id: liveSessions.id });
  return rows.length > 0;
}

/** Upsert the participant's answer; returns the new revision (1 for the first answer). */
export async function persistAnswer(participantId: string, questionId: string, selectedIndex: number, answeredAt: Date) {
  const [row] = await db
    .insert(liveAnswers)
    .values({ participantId, questionId, selectedIndex, answeredAt, revision: 1 })
    .onConflictDoUpdate({
      target: [liveAnswers.participantId, liveAnswers.questionId],
      set: { selectedIndex, answeredAt, revision: sql`${liveAnswers.revision} + 1` },
    })
    .returning({ revision: liveAnswers.revision });
  return row!.revision;
}

export interface CloseOutcome {
  participants: { id: string; score: number; correct: number }[];
  answers: { participantId: string; selectedIndex: number; isCorrect: boolean; pointsAwarded: number }[];
}

/**
 * Close the open question and score every answer in one transaction.
 * Points = base + round(speedBonus * remainingFraction), where the remaining
 * fraction comes from the server time of the participant's final revision.
 * Returns null if the question was not open (already closed).
 */
export async function persistCloseQuestion(
  sessionId: string,
  index: number,
  question: LiveQuestion,
  openedAt: Date,
  closesAt: Date,
): Promise<CloseOutcome | null> {
  const durationMs = Math.max(1, closesAt.getTime() - openedAt.getTime());
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(liveSessions)
      .set({ status: 'question_closed' })
      .where(
        and(
          eq(liveSessions.id, sessionId),
          eq(liveSessions.status, 'question_open'),
          eq(liveSessions.currentQuestionIndex, index),
        ),
      )
      .returning({ id: liveSessions.id });
    if (!row) return null;

    await tx.execute(sql`
      update ${liveAnswers} a
         set is_correct = (a.selected_index = ${question.correctIndex}::int),
             points_awarded = case
               when a.selected_index = ${question.correctIndex}::int then
                 ${LIVE_SCORING.base}::int + round(${LIVE_SCORING.speedBonus}::numeric * greatest(0, least(1,
                   (extract(epoch from (${closesAt.toISOString()}::timestamptz - a.answered_at)) * 1000) / ${durationMs}::numeric)))::int
               else 0 end
        from ${liveParticipants} p
       where p.id = a.participant_id and p.session_id = ${sessionId} and a.question_id = ${question.id}`);

    await tx.execute(sql`
      update ${liveParticipants} p
         set score = p.score + coalesce(a.points_awarded, 0),
             correct = p.correct + case when a.is_correct then 1 else 0 end
        from ${liveAnswers} a
       where a.participant_id = p.id and a.question_id = ${question.id} and p.session_id = ${sessionId}`);

    const participants = await tx
      .select({ id: liveParticipants.id, score: liveParticipants.score, correct: liveParticipants.correct })
      .from(liveParticipants)
      .where(eq(liveParticipants.sessionId, sessionId));
    const answers = await tx
      .select({
        participantId: liveAnswers.participantId,
        selectedIndex: liveAnswers.selectedIndex,
        isCorrect: liveAnswers.isCorrect,
        pointsAwarded: liveAnswers.pointsAwarded,
      })
      .from(liveAnswers)
      .innerJoin(liveParticipants, eq(liveParticipants.id, liveAnswers.participantId))
      .where(and(eq(liveParticipants.sessionId, sessionId), eq(liveAnswers.questionId, question.id)));
    return {
      participants,
      answers: answers.map((a) => ({
        participantId: a.participantId,
        selectedIndex: a.selectedIndex,
        isCorrect: Boolean(a.isCorrect),
        pointsAwarded: a.pointsAwarded ?? 0,
      })),
    };
  });
}

export async function persistEnd(sessionId: string): Promise<boolean> {
  const rows = await db
    .update(liveSessions)
    .set({ status: 'ended', endedAt: new Date(), questionClosesAt: null })
    .where(and(eq(liveSessions.id, sessionId), ne(liveSessions.status, 'ended')))
    .returning({ id: liveSessions.id });
  return rows.length > 0;
}

/* ----------------------------------------------------------------------------
 * REST
 * ------------------------------------------------------------------------- */

async function sessionInfo(sessionId: string): Promise<{ info: LiveSessionInfo; session: LiveSessionRow } | null> {
  const [row] = await db
    .select({
      session: liveSessions,
      title: lessons.title,
      questionCount: sql<number>`(select count(*)::int from ${questions} where ${questions.lessonId} = ${liveSessions.lessonId} and ${questions.status} = 'approved')`,
      participantCount: sql<number>`(select count(*)::int from ${liveParticipants} where ${liveParticipants.sessionId} = ${liveSessions.id})`,
    })
    .from(liveSessions)
    .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
    .where(eq(liveSessions.id, sessionId));
  if (!row) return null;
  const s = row.session;
  return {
    session: s,
    info: {
      id: s.id,
      pin: s.pin,
      lessonId: s.lessonId,
      title: row.title,
      status: s.status,
      questionCount: Number(row.questionCount),
      currentQuestionIndex: s.currentQuestionIndex,
      timeLimitSec: s.timeLimitSec,
      participantCount: Number(row.participantCount),
      createdAt: s.createdAt.toISOString(),
      endedAt: iso(s.endedAt),
    },
  };
}

const PIN_ATTEMPTS = 10;

export async function createLiveSession(teacherId: string, input: CreateLiveSessionInput): Promise<LiveSessionInfo> {
  const [lesson] = await db
    .select({ id: lessons.id, status: lessons.status })
    .from(lessons)
    .where(and(eq(lessons.id, input.lessonId), eq(lessons.teacherId, teacherId)));
  if (!lesson) throw notFound('Lesson');
  if (lesson.status !== 'published') throw invalidState('Publish the lesson before starting a live quiz');
  const [approved] = await db
    .select({ n: count() })
    .from(questions)
    .where(and(eq(questions.lessonId, lesson.id), eq(questions.status, 'approved')));
  if (!approved || approved.n < 1) throw invalidState('The lesson needs at least one approved question');

  for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt++) {
    try {
      const [row] = await db
        .insert(liveSessions)
        .values({ lessonId: lesson.id, hostTeacherId: teacherId, pin: generatePin(), timeLimitSec: input.timeLimitSec })
        .returning({ id: liveSessions.id });
      return (await sessionInfo(row!.id))!.info;
    } catch (err) {
      if (!isUniqueViolation(err, 'live_sessions_active_pin_unique')) throw err;
    }
  }
  throw new AppError('INTERNAL', 'Could not allocate a quiz PIN. Please try again.');
}

export async function getLiveSession(teacherId: string, sessionId: string): Promise<LiveSessionInfo> {
  const found = await sessionInfo(sessionId);
  if (!found || found.session.hostTeacherId !== teacherId) throw notFound('Live session');
  return found.info;
}

export async function getLiveResults(teacherId: string, sessionId: string): Promise<LiveSessionResults> {
  const found = await sessionInfo(sessionId);
  if (!found || found.session.hostTeacherId !== teacherId) throw notFound('Live session');
  const leaderboard = rankLeaderboard(await participantsOf(sessionId));
  const qs = await approvedQuestions(found.session.lessonId);
  const dist = await db
    .select({ questionId: liveAnswers.questionId, selectedIndex: liveAnswers.selectedIndex, n: count() })
    .from(liveAnswers)
    .innerJoin(liveParticipants, eq(liveParticipants.id, liveAnswers.participantId))
    .where(eq(liveParticipants.sessionId, sessionId))
    .groupBy(liveAnswers.questionId, liveAnswers.selectedIndex);
  return {
    session: found.info,
    leaderboard,
    questions: qs.map((q) => {
      const distribution = q.options.map(() => 0);
      for (const d of dist) {
        if (d.questionId === q.id && d.selectedIndex >= 0 && d.selectedIndex < distribution.length) {
          distribution[d.selectedIndex] = Number(d.n);
        }
      }
      return { questionId: q.id, position: q.position, stem: q.stem, correctIndex: q.correctIndex, distribution };
    }),
  };
}

export async function lookupPin(studentId: string, pin: string): Promise<LivePinLookup> {
  const [row] = await db
    .select({ id: liveSessions.id, status: liveSessions.status, title: lessons.title, sectionId: lessons.sectionId })
    .from(liveSessions)
    .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
    .where(and(eq(liveSessions.pin, pin), ne(liveSessions.status, 'ended')));
  if (!row || !(await isEnrolled(studentId, row.sectionId))) throw notFound('Live quiz');
  return { sessionId: row.id, title: row.title, status: row.status };
}
