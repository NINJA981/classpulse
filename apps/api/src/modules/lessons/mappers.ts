/** DTO mappers for lessons, questions and assignments. Never send raw rows. */
import {
  LESSON_PROCESSING_STATUSES,
  type Assignment,
  type Language,
  type LessonDetail,
  type LessonProgress,
  type LessonSummary,
  type Question,
} from '@classpulse/shared';
import type { assignments, lessons, questions } from '../../db/schema/index.js';
import { iso } from '../../lib/time.js';

export type LessonRow = typeof lessons.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type AssignmentRow = typeof assignments.$inferSelect;

export interface LessonSummaryRow {
  lesson: LessonRow;
  sectionName: string;
  teacherName: string;
  questionCount: number;
}

export function hasLiveAudio(lesson: Pick<LessonRow, 'audioObjectKey' | 'audioExpiresAt'>, now = new Date()): boolean {
  return !!lesson.audioObjectKey && (!lesson.audioExpiresAt || lesson.audioExpiresAt > now);
}

export function toLessonProgress(lesson: LessonRow): LessonProgress {
  return {
    lessonId: lesson.id,
    status: lesson.status,
    progressPct: lesson.progressPct,
    message: lesson.progressMessage ?? '',
    attempt: lesson.generationAttempt,
  };
}

export function toLessonSummary(row: LessonSummaryRow): LessonSummary {
  const l = row.lesson;
  return {
    id: l.id,
    title: l.title,
    subject: l.subject,
    language: l.language as Language,
    status: l.status,
    sourceType: l.sourceType,
    section: { id: l.sectionId, name: row.sectionName },
    teacher: { id: l.teacherId, name: row.teacherName },
    questionCount: row.questionCount,
    durationSec: l.durationSec,
    hasAudio: hasLiveAudio(l),
    createdAt: l.createdAt.toISOString(),
    publishedAt: iso(l.publishedAt),
  };
}

export function toQuestion(q: QuestionRow): Question {
  return {
    id: q.id,
    lessonId: q.lessonId,
    position: q.position,
    stem: q.stem,
    stemLocal: q.stemLocal,
    options: q.options,
    optionsLocal: q.optionsLocal,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    explanationLocal: q.explanationLocal,
    difficulty: q.difficulty,
    topicTag: q.topicTag,
    citationStartSec: q.citationStartSec,
    citationEndSec: q.citationEndSec,
    status: q.status,
    editedByTeacher: q.editedByTeacher,
  };
}

export function toAssignment(a: AssignmentRow): Assignment {
  return {
    id: a.id,
    lessonId: a.lessonId,
    title: a.title,
    prompt: a.prompt,
    rubric: a.rubric,
    estimatedMinutes: a.estimatedMinutes,
    dueAt: iso(a.dueAt),
    status: a.status,
  };
}

export function toLessonDetail(
  row: Omit<LessonSummaryRow, 'questionCount'>,
  questionRows: QuestionRow[],
  assignment: AssignmentRow | null,
  defaultQuestionCount: number,
): LessonDetail {
  const l = row.lesson;
  const summary = toLessonSummary({ ...row, questionCount: questionRows.filter((q) => q.status !== 'rejected').length });
  return {
    ...summary,
    defaultQuestionCount,
    hasTranscript: !!l.transcriptSegments?.length,
    pendingQuiz: LESSON_PROCESSING_STATUSES.includes(l.status) ? (l.quizRequest ?? null) : null,
    summary: l.summary,
    keyTakeaways: l.keyTakeaways,
    failureReason: l.failureReason,
    audioExpiresAt: summary.hasAudio ? iso(l.audioExpiresAt) : null,
    progress: LESSON_PROCESSING_STATUSES.includes(l.status) ? toLessonProgress(l) : null,
    questions: questionRows.map(toQuestion),
    assignment: assignment ? toAssignment(assignment) : null,
  };
}
