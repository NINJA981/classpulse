import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { RemedialPlan, RubricItem, TranscriptSegment } from '@classpulse/shared';
import {
  assignmentStatus,
  difficulty,
  guardianRelation,
  lessonSourceType,
  lessonStatus,
  questionStatus,
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

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .unique()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    prompt: text('prompt').notNull(),
    rubric: jsonb('rubric').$type<RubricItem[]>().notNull().default([]),
    estimatedMinutes: integer('estimated_minutes'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    status: assignmentStatus('status').notNull().default('draft'),
    ...timestamps,
  },
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
    text: text('text').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('assignment_submissions_unique').on(t.assignmentId, t.studentId)],
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
