import { z } from 'zod';
import { Id, text, type IsoDate } from './common.js';
import { Difficulty } from './lessons.js';

/* ----------------------------------------------------------------------------
 * Secure exams
 *
 * A teacher builds a pool from approved lesson questions; on publish the pool is
 * snapshotted (later lesson edits cannot change a running exam). Each student
 * gets one attempt with their own sample of `questionsPerStudent` questions in a
 * shuffled order with shuffled options. The server owns the clock, autosaves
 * answers, records integrity events and grades. Attempt calls carry the
 * per-attempt device token in the `X-Exam-Token` header (one device at a time).
 * ------------------------------------------------------------------------- */

export const ExamStatus = z.enum(['draft', 'published', 'closed']);
export type ExamStatus = z.infer<typeof ExamStatus>;

export const ExamResultsVisibility = z.enum(['after_close', 'immediately', 'never']);
export type ExamResultsVisibility = z.infer<typeof ExamResultsVisibility>;

export const ExamAttemptStatus = z.enum(['in_progress', 'submitted', 'auto_submitted']);
export type ExamAttemptStatus = z.infer<typeof ExamAttemptStatus>;

export const EXAM_EVENT_TYPES = [
  'fullscreen_exit',
  'tab_hidden',
  'window_blur',
  'copy',
  'paste',
  'context_menu',
  'print',
  'second_device',
  'resume',
] as const;
export const ExamEventType = z.enum(EXAM_EVENT_TYPES);
export type ExamEventType = z.infer<typeof ExamEventType>;

/** Events that count towards `maxViolations` (the rest are informational). */
export const EXAM_VIOLATION_TYPES: readonly ExamEventType[] = ['fullscreen_exit', 'tab_hidden', 'window_blur', 'copy', 'paste', 'print', 'second_device'];

export const EXAM_TOKEN_HEADER = 'x-exam-token';
/** Answers saved up to this many seconds after the deadline are still accepted (network delay). */
export const EXAM_SAVE_GRACE_SEC = 30;
export const EXAM_MAX_EVENTS_PER_ATTEMPT = 500;

const examFields = {
  title: text(200),
  sectionId: Id,
  instructions: z.string().trim().max(5000).default(''),
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  durationMin: z.number().int().min(1).max(600),
  questionsPerStudent: z.number().int().min(1).max(200),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  requireFullscreen: z.boolean().default(true),
  useAccessCode: z.boolean().default(true),
  singleDevice: z.boolean().default(true),
  /** Auto-submit when this many violations are recorded; null = log and warn only. */
  maxViolations: z.number().int().min(1).max(100).nullable().default(null),
  resultsVisibility: ExamResultsVisibility.default('after_close'),
};

const ExamBase = z.object(examFields);

export const ExamInput = ExamBase.refine((v) => Date.parse(v.closesAt) > Date.parse(v.opensAt), {
  path: ['closesAt'],
  message: 'The exam must close after it opens',
});
export type ExamInput = z.infer<typeof ExamInput>;

/** Draft edits; the open/close order is re-checked by the service. */
export const UpdateExamInput = z.object({
  title: examFields.title.optional(),
  sectionId: Id.optional(),
  instructions: z.string().trim().max(5000).optional(),
  opensAt: z.iso.datetime().optional(),
  closesAt: z.iso.datetime().optional(),
  durationMin: examFields.durationMin.optional(),
  questionsPerStudent: examFields.questionsPerStudent.optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  requireFullscreen: z.boolean().optional(),
  useAccessCode: z.boolean().optional(),
  singleDevice: z.boolean().optional(),
  maxViolations: z.number().int().min(1).max(100).nullable().optional(),
  resultsVisibility: ExamResultsVisibility.optional(),
});
export type UpdateExamInput = z.infer<typeof UpdateExamInput>;

export const SetExamQuestionsInput = z.object({ questionIds: z.array(Id).min(1).max(500) });
export type SetExamQuestionsInput = z.infer<typeof SetExamQuestionsInput>;

/** GET /exams/:id/question-pool — approved questions from the teacher's lessons in the exam's section. */
export const ExamPoolQuery = z.object({
  /** Comma-separated lesson ids; omit for every lesson of the section. */
  lessonIds: z.string().trim().max(4000).optional(),
  difficulty: Difficulty.optional(),
  topic: z.string().trim().max(120).optional(),
});
export type ExamPoolQuery = z.infer<typeof ExamPoolQuery>;

export interface ExamPoolCandidate {
  questionId: Id;
  lesson: { id: Id; title: string };
  stem: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty;
  topicTag: string | null;
}

export interface ExamSummary {
  id: Id;
  title: string;
  section: { id: Id; name: string };
  status: ExamStatus;
  opensAt: IsoDate;
  closesAt: IsoDate;
  durationMin: number;
  questionsPerStudent: number;
  /** Selected questions (draft) or snapshotted pool size (published). */
  poolSize: number;
  enrolled: number;
  started: number;
  submitted: number;
  createdAt: IsoDate;
}

/** A question in the exam's frozen pool (teacher view, with the answer). */
export interface ExamPoolQuestion {
  id: Id;
  sourceQuestionId: Id | null;
  position: number;
  stem: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty;
  topicTag: string | null;
}

export interface ExamDetail extends ExamSummary {
  instructions: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  requireFullscreen: boolean;
  useAccessCode: boolean;
  singleDevice: boolean;
  maxViolations: number | null;
  resultsVisibility: ExamResultsVisibility;
  /** Teacher only; null until published (or when access codes are off). */
  accessCode: string | null;
  /** Draft: the chosen source question ids. */
  questionIds: Id[];
  /** Published/closed: the frozen pool. */
  pool: ExamPoolQuestion[];
  publishedAt: IsoDate | null;
}

export type ExamMonitorStatus = 'not_started' | ExamAttemptStatus;

export interface ExamMonitorRow {
  student: { id: Id; name: string; rollNumber: string | null };
  attemptId: Id | null;
  status: ExamMonitorStatus;
  answered: number;
  total: number;
  startedAt: IsoDate | null;
  deadlineAt: IsoDate | null;
  submittedAt: IsoDate | null;
  extraMinutes: number;
  violationCount: number;
  lastSeenAt: IsoDate | null;
  deviceLocked: boolean;
  scorePct: number | null;
}

export interface ExamMonitor {
  exam: ExamDetail;
  serverTime: number;
  rows: ExamMonitorRow[];
}

export interface ExamEventItem {
  type: ExamEventType;
  at: IsoDate;
  detail: Record<string, string | number | boolean> | null;
}

export interface ExamResults {
  exam: ExamDetail;
  averageScorePct: number | null;
  students: (ExamMonitorRow & { correct: number | null; events: ExamEventItem[] })[];
  questions: {
    examQuestionId: Id;
    position: number;
    stem: string;
    correctIndex: number;
    /** Students who were given this question. */
    served: number;
    answered: number;
    accuracyPct: number | null;
    optionDistribution: number[];
  }[];
}

export const ExtraTimeInput = z.object({ minutes: z.number().int().min(1).max(240) });
export type ExtraTimeInput = z.infer<typeof ExtraTimeInput>;

/* ----------------------------------------------------------------------------
 * Student side
 * ------------------------------------------------------------------------- */

export type StudentExamState = 'upcoming' | 'open' | 'in_progress' | 'submitted' | 'missed';

export interface StudentExamListItem {
  id: Id;
  title: string;
  section: { id: Id; name: string };
  teacherName: string;
  opensAt: IsoDate;
  closesAt: IsoDate;
  durationMin: number;
  questionCount: number;
  requiresAccessCode: boolean;
  requireFullscreen: boolean;
  state: StudentExamState;
  /** Present when the teacher's results setting allows it. */
  result: { correct: number; total: number; scorePct: number } | null;
}

export const StartExamInput = z.object({
  accessCode: z.string().trim().toUpperCase().max(12).optional(),
});
export type StartExamInput = z.infer<typeof StartExamInput>;

/** A student's paper: their questions in their order, options in their order, never the answer key. */
export interface StudentExamPaper {
  examId: Id;
  attemptId: Id;
  title: string;
  instructions: string;
  requireFullscreen: boolean;
  maxViolations: number | null;
  status: ExamAttemptStatus;
  startedAt: IsoDate;
  deadlineAt: IsoDate;
  serverTime: number;
  violationCount: number;
  questions: {
    examQuestionId: Id;
    number: number;
    stem: string;
    stemLocal: string | null;
    /** Already in this student's option order. */
    options: string[];
    optionsLocal: string[] | null;
  }[];
  /** Saved answers as indexes into the student's option order. */
  answers: Record<Id, number | null>;
}

export interface StartExamResponse {
  /** Send back as the X-Exam-Token header on every attempt call. Returned only when a device binds. */
  attemptToken: string;
  paper: StudentExamPaper;
}

export const SaveExamAnswerInput = z.object({
  /** Index into the student's (shuffled) option order; null clears the answer. */
  selectedIndex: z.number().int().min(0).max(3).nullable(),
});
export type SaveExamAnswerInput = z.infer<typeof SaveExamAnswerInput>;

export const ExamEventInput = z.object({
  type: ExamEventType,
  detail: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});
export type ExamEventInput = z.infer<typeof ExamEventInput>;

export interface ExamEventResponse {
  violationCount: number;
  autoSubmitted: boolean;
}

export interface StudentExamResult {
  examId: Id;
  status: ExamAttemptStatus;
  submittedAt: IsoDate | null;
  /** Null when the teacher hides results (or until the exam closes). */
  score: { correct: number; total: number; scorePct: number } | null;
  answers:
    | {
        number: number;
        stem: string;
        options: string[];
        selectedIndex: number | null;
        correctIndex: number;
        isCorrect: boolean;
        explanation: string | null;
      }[]
    | null;
  resultsAvailableAt: IsoDate | null;
}
