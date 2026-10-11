import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { difficulty, examAttemptStatus, examEventType, examResultsVisibility, examStatus } from './enums.js';
import { institutions, sections, timestamps, users } from './org.js';
import { questions } from './content.js';

/** One entry of a student's paper: which pool question, and the order its options are shown in. */
export interface ExamPaperItem {
  examQuestionId: string;
  /** optionOrder[shownIndex] = canonical option index. */
  optionOrder: number[];
}

export const exams = pgTable(
  'exams',
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
    instructions: text('instructions').notNull().default(''),
    status: examStatus('status').notNull().default('draft'),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    durationMin: integer('duration_min').notNull(),
    questionsPerStudent: integer('questions_per_student').notNull(),
    shuffleQuestions: boolean('shuffle_questions').notNull().default(true),
    shuffleOptions: boolean('shuffle_options').notNull().default(true),
    requireFullscreen: boolean('require_fullscreen').notNull().default(true),
    useAccessCode: boolean('use_access_code').notNull().default(true),
    accessCode: varchar('access_code', { length: 12 }),
    singleDevice: boolean('single_device').notNull().default(true),
    maxViolations: integer('max_violations'),
    resultsVisibility: examResultsVisibility('results_visibility').notNull().default('after_close'),
    /** Draft only: the chosen source question ids (frozen into exam_questions on publish). */
    selectedQuestionIds: jsonb('selected_question_ids').$type<string[]>().notNull().default([]),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('exams_teacher_idx').on(t.teacherId),
    index('exams_section_status_idx').on(t.sectionId, t.status),
    index('exams_status_closes_idx').on(t.status, t.closesAt),
  ],
);

/** The exam's frozen question pool, snapshotted from lesson questions at publish. */
export const examQuestions = pgTable(
  'exam_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    sourceQuestionId: uuid('source_question_id').references(() => questions.id, { onDelete: 'set null' }),
    position: integer('position').notNull(),
    stem: text('stem').notNull(),
    stemLocal: text('stem_local'),
    options: jsonb('options').$type<string[]>().notNull(),
    optionsLocal: jsonb('options_local').$type<string[]>(),
    correctIndex: smallint('correct_index').notNull(),
    explanation: text('explanation'),
    explanationLocal: text('explanation_local'),
    difficulty: difficulty('difficulty').notNull().default('medium'),
    topicTag: varchar('topic_tag', { length: 120 }),
  },
  (t) => [index('exam_questions_exam_idx').on(t.examId, t.position)],
);

export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: examAttemptStatus('status').notNull().default('in_progress'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** min(start + duration, closes_at) + extra time. */
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    extraMinutes: integer('extra_minutes').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    paper: jsonb('paper').$type<ExamPaperItem[]>().notNull(),
    /** sha256 of the device token; null = unlocked (next device to resume binds). */
    deviceTokenHash: varchar('device_token_hash', { length: 64 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    violationCount: integer('violation_count').notNull().default(0),
    correct: integer('correct'),
    total: integer('total'),
    scorePct: doublePrecision('score_pct'),
  },
  (t) => [
    uniqueIndex('exam_attempts_one_per_student').on(t.examId, t.studentId),
    index('exam_attempts_open_deadline_idx').on(t.deadlineAt).where(sql`${t.status} = 'in_progress'`),
  ],
);

export const examAnswers = pgTable(
  'exam_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => examAttempts.id, { onDelete: 'cascade' }),
    examQuestionId: uuid('exam_question_id')
      .notNull()
      .references(() => examQuestions.id, { onDelete: 'cascade' }),
    /** Canonical option index (not the shuffled one); null = cleared. */
    selectedIndex: smallint('selected_index'),
    revision: integer('revision').notNull().default(1),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('exam_answers_attempt_question').on(t.attemptId, t.examQuestionId)],
);

/** Integrity log (tab switches, leaving fullscreen, copy/paste, second device…). */
export const examEvents = pgTable(
  'exam_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => examAttempts.id, { onDelete: 'cascade' }),
    type: examEventType('type').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    detail: jsonb('detail').$type<Record<string, string | number | boolean>>(),
  },
  (t) => [index('exam_events_attempt_idx').on(t.attemptId, t.at)],
);
