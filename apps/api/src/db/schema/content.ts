import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AiGradeSuggestion, QuizRequest, RemedialPlan, RubricItem, RubricMark, TranscriptSegment } from '@classiq/shared';
import {
  assignmentStatus,
  bloomLevel,
  difficulty,
  guardianRelation,
  latePolicy,
  lessonSourceType,
  lessonStatus,
  questionStatus,
  submissionStatus,
} from './enums.js';
import { institutions, sections, timestamps, users } from './org.js';

/** Provider/run metadata recorded by the generation pipeline (debugging & audit). */
export interface PipelineMeta {
  sttProvider?: string;
  sttModel?: string;
  llmProvider?: string;
  llmModel?: string;
  demoFallback?: boolean;
  timingsMs?: Record<string, number>;
  [key: string]: unknown;
}

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 120 }).notNull(),
    language: varchar('language', { length: 10 }).notNull().default('en-IN'),
    status: lessonStatus('status').notNull().default('draft'),
    sourceType: lessonSourceType('source_type'),

    /** Storage key (never a filesystem path) of the normalized lecture audio. */
    audioObjectKey: text('audio_object_key'),
    audioMimeType: varchar('audio_mime_type', { length: 100 }),
    audioSizeBytes: integer('audio_size_bytes'),
    audioExpiresAt: timestamp('audio_expires_at', { withTimezone: true }),
    durationSec: doublePrecision('duration_sec'),

    transcript: text('transcript'),
    transcriptSegments: jsonb('transcript_segments').$type<TranscriptSegment[]>(),
    summary: text('summary'),
    keyTakeaways: jsonb('key_takeaways').$type<string[]>().notNull().default([]),

    generationAttempt: integer('generation_attempt').notNull().default(0),
    progressPct: integer('progress_pct').notNull().default(0),
    progressMessage: varchar('progress_message', { length: 300 }),
    failureReason: varchar('failure_reason', { length: 500 }),
    pipelineMeta: jsonb('pipeline_meta').$type<PipelineMeta>(),
    /** The teacher's quiz request while a generation job runs; null for transcription-only jobs. */
    quizRequest: jsonb('quiz_request').$type<QuizRequest>(),
    remedial: jsonb('remedial').$type<RemedialPlan>(),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('lessons_teacher_idx').on(t.teacherId),
    index('lessons_section_status_idx').on(t.sectionId, t.status),
    index('lessons_institution_status_idx').on(t.institutionId, t.status),
    index('lessons_audio_expiry_idx').on(t.audioExpiresAt).where(sql`${t.audioObjectKey} is not null`),
  ],
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    stem: text('stem').notNull(),
    stemLocal: text('stem_local'),
    options: jsonb('options').$type<string[]>().notNull(),
    optionsLocal: jsonb('options_local').$type<string[]>(),
    correctIndex: integer('correct_index').notNull(),
    explanation: text('explanation'),
    explanationLocal: text('explanation_local'),
    difficulty: difficulty('difficulty').notNull().default('medium'),
    topicTag: varchar('topic_tag', { length: 120 }),
    bloomLevel: bloomLevel('bloom_level'),
    competency: varchar('competency', { length: 160 }),
    citationStartSec: doublePrecision('citation_start_sec'),
    citationEndSec: doublePrecision('citation_end_sec'),
    status: questionStatus('status').notNull().default('draft'),
    editedByTeacher: boolean('edited_by_teacher').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('questions_lesson_status_idx').on(t.lessonId, t.status),
    check('questions_correct_index_range', sql`${t.correctIndex} between 0 and 3`),
  ],
);

/**
 * Homework. Standalone (lesson_id null) or attached to a lesson (several per lesson). Lesson-attached
 * assignments publish/unpublish together with their lesson; standalone ones are published on their own.
 * `is_primary` marks the lesson's AI-drafted assignment (the one regeneration rewrites).
 */
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    title: varchar('title', { length: 200 }).notNull(),
    prompt: text('prompt').notNull(),
    rubric: jsonb('rubric').$type<RubricItem[]>().notNull().default([]),
    estimatedMinutes: integer('estimated_minutes'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    status: assignmentStatus('status').notNull().default('draft'),
    latePolicy: latePolicy('late_policy').notNull().default('allow_late'),
    allowFiles: boolean('allow_files').notNull().default(true),
    maxFiles: integer('max_files').notNull().default(5),
    reminders: boolean('reminders').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('assignments_lesson_idx').on(t.lessonId),
    index('assignments_section_status_idx').on(t.sectionId, t.status),
    index('assignments_teacher_idx').on(t.teacherId),
    // At most one AI-drafted (primary) assignment per lesson.
    uniqueIndex('assignments_primary_per_lesson').on(t.lessonId).where(sql`${t.isPrimary}`),
  ],
);

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Null when the student submitted files only. */
    text: text('text'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    status: submissionStatus('status').notNull().default('submitted'),
    isLate: boolean('is_late').notNull().default(false),
    rubricMarks: jsonb('rubric_marks').$type<RubricMark[]>(),
    totalMarks: doublePrecision('total_marks'),
    feedback: text('feedback'),
    gradedBy: uuid('graded_by').references(() => users.id, { onDelete: 'set null' }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    aiSuggestion: jsonb('ai_suggestion').$type<AiGradeSuggestion>(),
    ...timestamps,
  },
  (t) => [uniqueIndex('assignment_submissions_unique').on(t.assignmentId, t.studentId)],
);

/** Files attached to a submission (stored via lib/storage; only the key is kept here). */
export const submissionFiles = pgTable(
  'submission_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mime: varchar('mime', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('submission_files_submission_idx').on(t.submissionId)],
);

/** One due-date reminder email per (assignment, student). */
export const assignmentReminders = pgTable(
  'assignment_reminders',
  {
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.studentId] })],
);

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    idempotencyKey: uuid('idempotency_key').notNull(),
    correct: integer('correct').notNull(),
    total: integer('total').notNull(),
    scorePct: doublePrecision('score_pct').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('quiz_attempts_idempotency_unique').on(t.studentId, t.idempotencyKey),
    index('quiz_attempts_lesson_submitted_idx').on(t.lessonId, t.submittedAt),
    index('quiz_attempts_student_idx').on(t.studentId),
  ],
);

/** Each answer snapshots the question so attempts stay valid if the lesson is regenerated. */
export const quizAttemptAnswers = pgTable(
  'quiz_attempt_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').references(() => questions.id, { onDelete: 'set null' }),
    position: integer('position').notNull(),
    stemSnapshot: text('stem_snapshot').notNull(),
    optionsSnapshot: jsonb('options_snapshot').$type<string[]>().notNull(),
    correctIndexSnapshot: integer('correct_index_snapshot').notNull(),
    selectedIndex: integer('selected_index'),
    isCorrect: boolean('is_correct').notNull(),
  },
  (t) => [index('quiz_attempt_answers_attempt_idx').on(t.attemptId), index('quiz_attempt_answers_question_idx').on(t.questionId)],
);

export const guardians = pgTable(
  'guardians',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    relation: guardianRelation('relation').notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 254 }),
    receiveUpdates: boolean('receive_updates').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('guardians_student_phone_unique').on(t.studentId, t.phone)],
);

export const modelSettings = pgTable('model_settings', {
  institutionId: uuid('institution_id')
    .primaryKey()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  sttProvider: varchar('stt_provider', { length: 40 }).notNull(),
  sttModel: varchar('stt_model', { length: 80 }).notNull(),
  llmProvider: varchar('llm_provider', { length: 40 }).notNull(),
  llmModel: varchar('llm_model', { length: 80 }).notNull(),
  questionsPerLesson: integer('questions_per_lesson').notNull(),
  bilingual: boolean('bilingual').notNull(),
  ...timestamps,
});
