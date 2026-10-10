/** Lesson analytics (latest attempt per student), attempt listing and the cached remedial plan. */
import { and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  DEFAULT_MODEL_SETTINGS,
  masteryBand,
  type AttemptSummary,
  type Language,
  type LessonAnalytics,
  type QuestionAnalytics,
  type RemedialPlan,
  type SessionUser,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import { enrollments, lessons, modelSettings, questions, quizAttemptAnswers, quizAttempts, users } from '../../db/schema/index.js';
import { AppError, invalidState } from '../../lib/errors.js';
import { isPipelineError } from '../../pipeline/errors.js';
import { providers } from '../../pipeline/providers.js';
import type { LessonRow } from './mappers.js';
import { getOwnedLesson, getVisibleLesson } from './repo.js';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Latest attempt id per student for a lesson (DISTINCT ON). */
const latestAttempts = (lessonId: string) =>
  db
    .selectDistinctOn([quizAttempts.studentId], {
      id: quizAttempts.id,
      studentId: quizAttempts.studentId,
      scorePct: quizAttempts.scorePct,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.lessonId, lessonId))
    .orderBy(quizAttempts.studentId, desc(quizAttempts.submittedAt), desc(quizAttempts.id))
    .as('latest');

export async function computeLessonAnalytics(lesson: LessonRow): Promise<LessonAnalytics> {
  const latest = latestAttempts(lesson.id);
  const [enrolledRows, studentRows, questionRows, answerRows] = await Promise.all([
    db.select({ n: count() }).from(enrollments).where(eq(enrollments.sectionId, lesson.sectionId)),
    db
      .select({
        studentId: latest.studentId,
        name: users.name,
        rollNumber: users.rollNumber,
        scorePct: latest.scorePct,
        submittedAt: latest.submittedAt,
      })
      .from(latest)
      .innerJoin(users, eq(users.id, latest.studentId))
      .orderBy(asc(users.name)),
    db
      .select({ id: questions.id, position: questions.position, stem: questions.stem, topicTag: questions.topicTag })
      .from(questions)
      .where(and(eq(questions.lessonId, lesson.id), eq(questions.status, 'approved')))
      .orderBy(asc(questions.position)),
    db
      .select({
        questionId: quizAttemptAnswers.questionId,
        selectedIndex: quizAttemptAnswers.selectedIndex,
        n: count(),
        correct: sql<number>`count(*) filter (where ${quizAttemptAnswers.isCorrect})::int`,
      })
      .from(quizAttemptAnswers)
      .innerJoin(latest, eq(latest.id, quizAttemptAnswers.attemptId))
      .where(isNotNull(quizAttemptAnswers.questionId))
      .groupBy(quizAttemptAnswers.questionId, quizAttemptAnswers.selectedIndex),
  ]);

  const byQuestion = new Map<string, { attempts: number; correct: number; distribution: number[] }>();
  for (const row of answerRows) {
    const agg = byQuestion.get(row.questionId!) ?? { attempts: 0, correct: 0, distribution: [0, 0, 0, 0] };
    agg.attempts += row.n;
    agg.correct += row.correct;
    if (row.selectedIndex !== null && row.selectedIndex >= 0 && row.selectedIndex < 4) agg.distribution[row.selectedIndex]! += row.n;
    byQuestion.set(row.questionId!, agg);
  }

  const questionStats: QuestionAnalytics[] = questionRows.map((q) => {
    const agg = byQuestion.get(q.id) ?? { attempts: 0, correct: 0, distribution: [0, 0, 0, 0] };
    const accuracyPct = agg.attempts ? round1((agg.correct / agg.attempts) * 100) : 0;
    return {
      questionId: q.id,
      position: q.position,
      stem: q.stem,
      topicTag: q.topicTag,
      attempts: agg.attempts,
      correct: agg.correct,
      accuracyPct,
      band: masteryBand(accuracyPct),
      optionDistribution: agg.distribution,
    };
  });

  const scores = studentRows.map((s) => s.scorePct);
  return {
    lessonId: lesson.id,
    enrolledStudents: enrolledRows[0]?.n ?? 0,
    studentsAttempted: studentRows.length,
    averageScorePct: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    questions: questionStats,
    students: studentRows.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      rollNumber: s.rollNumber ?? '',
      scorePct: s.scorePct,
      submittedAt: s.submittedAt.toISOString(),
    })),
    remedial: lesson.remedial ?? null,
  };
}

export async function getLessonAnalytics(user: SessionUser, lessonId: string): Promise<LessonAnalytics> {
  return computeLessonAnalytics(await getVisibleLesson(user, lessonId));
}

export async function listLessonAttempts(user: SessionUser, lessonId: string): Promise<AttemptSummary[]> {
  const lesson = await getVisibleLesson(user, lessonId);
  const rows = await db
    .select({ attempt: quizAttempts, name: users.name, rollNumber: users.rollNumber })
    .from(quizAttempts)
    .innerJoin(users, eq(users.id, quizAttempts.studentId))
    .where(eq(quizAttempts.lessonId, lesson.id))
    .orderBy(desc(quizAttempts.submittedAt));
  return rows.map(({ attempt: a, name, rollNumber }) => ({
    id: a.id,
    studentId: a.studentId,
    studentName: name,
    rollNumber: rollNumber ?? '',
    correct: a.correct,
    total: a.total,
    scorePct: a.scorePct,
    submittedAt: a.submittedAt.toISOString(),
  }));
}

/** Teacher-triggered LLM remedial plan, cached on the lesson. */
export async function generateRemedial(user: SessionUser, lessonId: string): Promise<RemedialPlan> {
  const lesson = await getOwnedLesson(user, lessonId);
  const analytics = await computeLessonAnalytics(lesson);
  if (analytics.studentsAttempted === 0) throw invalidState('No students have attempted this quiz yet.');

  const settings = await db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, lesson.institutionId) });
  let plan: RemedialPlan;
  try {
    plan = await providers.remedial({
      title: lesson.title,
      subject: lesson.subject,
      language: lesson.language as Language,
      analytics,
      model: settings?.llmModel ?? DEFAULT_MODEL_SETTINGS.llmModel,
    });
  } catch (err) {
    if (isPipelineError(err)) throw new AppError('UPSTREAM_FAILED', err.userMessage);
    throw err;
  }
  await db.update(lessons).set({ remedial: plan }).where(eq(lessons.id, lesson.id));
  return plan;
}
