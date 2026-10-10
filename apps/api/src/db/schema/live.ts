import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { liveStatus } from './enums.js';
import { lessons, questions } from './content.js';
import { users } from './org.js';

export const liveSessions = pgTable(
  'live_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    hostTeacherId: uuid('host_teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pin: varchar('pin', { length: 6 }).notNull(),
    status: liveStatus('status').notNull().default('lobby'),
    timeLimitSec: integer('time_limit_sec').notNull().default(20),
    currentQuestionIndex: integer('current_question_index'),
    questionOpenedAt: timestamp('question_opened_at', { withTimezone: true, mode: 'date' }),
    questionClosesAt: timestamp('question_closes_at', { withTimezone: true, mode: 'date' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_sessions_active_pin_unique').on(t.pin).where(sql`${t.status} <> 'ended'`),
    index('live_sessions_lesson_idx').on(t.lessonId),
    index('live_sessions_host_idx').on(t.hostTeacherId),
  ],
);

export const liveParticipants = pgTable(
  'live_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => liveSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('live_participants_session_student_unique').on(t.sessionId, t.studentId)],
);

export const liveAnswers = pgTable(
  'live_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => liveParticipants.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedIndex: integer('selected_index').notNull(),
    revision: integer('revision').notNull().default(1),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when the question closes. */
    isCorrect: boolean('is_correct'),
    pointsAwarded: integer('points_awarded'),
  },
  (t) => [
    uniqueIndex('live_answers_participant_question_unique').on(t.participantId, t.questionId),
    index('live_answers_question_idx').on(t.questionId),
  ],
);
