import { z } from 'zod';
import { Id, Language, text, type IsoDate } from './common.js';
// Type-only: teacher-tools.ts imports Difficulty from this module at runtime.
import type { BloomLevel } from './teacher-tools.js';

/* ----------------------------------------------------------------------------
 * Lessons
 * ------------------------------------------------------------------------- */

export const LESSON_STATUSES = [
  'draft', // created; no audio yet
  'recording', // a classroom device is recording it
  'queued', // audio ready, generation job queued
  'transcribing',
  'generating',
  'transcribed', // transcript ready; waiting for the teacher to generate the quiz
  'ready_for_review', // teacher must review/approve questions
  'published', // visible to enrolled students
  'failed',
] as const;
export const LessonStatus = z.enum(LESSON_STATUSES);
export type LessonStatus = z.infer<typeof LessonStatus>;

/** Statuses during which a generation job is in flight. */
export const LESSON_PROCESSING_STATUSES: readonly LessonStatus[] = ['queued', 'transcribing', 'generating'];

export const LessonSourceType = z.enum(['device', 'upload']);
export type LessonSourceType = z.infer<typeof LessonSourceType>;

export const CreateLessonInput = z.object({
  title: text(200),
  sectionId: Id,
  subject: text(120),
  language: Language.default('en-IN'),
});
export type CreateLessonInput = z.infer<typeof CreateLessonInput>;

export const UpdateLessonInput = z.object({
  title: text(200).optional(),
  subject: text(120).optional(),
  language: Language.optional(),
  summary: z.string().trim().max(5000).optional(),
  keyTakeaways: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
});
export type UpdateLessonInput = z.infer<typeof UpdateLessonInput>;

export const ListLessonsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: LessonStatus.optional(),
  sectionId: Id.optional(),
});
export type ListLessonsQuery = z.infer<typeof ListLessonsQuery>;

/** Difficulty the teacher asks for; `mixed` spreads questions across easy, medium and hard. */
export const QuizDifficulty = z.enum(['easy', 'medium', 'hard', 'mixed']);
export type QuizDifficulty = z.infer<typeof QuizDifficulty>;

/**
 * - `append`: add new questions on points the quiz does not test yet; existing questions stay.
 * - `replace_unapproved`: keep approved and teacher-edited questions, replace the rest.
 * - `replace_all`: start over (questions, summary and assignment).
 * With no questions yet, every mode generates a fresh quiz.
 */
export const QuizGenerationMode = z.enum(['append', 'replace_unapproved', 'replace_all']);
export type QuizGenerationMode = z.infer<typeof QuizGenerationMode>;

export const MAX_QUESTIONS_PER_REQUEST = 30;

export const GenerateLessonInput = z.object({
  /** Defaults to the school's "questions per lesson" setting. */
  questionCount: z.number().int().min(1).max(MAX_QUESTIONS_PER_REQUEST).optional(),
  difficulty: QuizDifficulty.default('mixed'),
  mode: QuizGenerationMode.default('replace_all'),
  /** Must be true to replace existing questions or change a published lesson (it is unpublished first). */
  confirmRegenerate: z.boolean().optional(),
});
export type GenerateLessonInput = z.infer<typeof GenerateLessonInput>;

/** What the teacher asked the generator for (stored on the lesson while the job runs). */
export interface QuizRequest {
  questionCount: number;
  difficulty: QuizDifficulty;
  mode: QuizGenerationMode;
}

export interface LessonSummary {
  id: Id;
  title: string;
  subject: string;
  language: Language;
  status: LessonStatus;
  sourceType: LessonSourceType | null;
  section: { id: Id; name: string };
  teacher: { id: Id; name: string };
  questionCount: number;
  durationSec: number | null;
  hasAudio: boolean;
  createdAt: IsoDate;
  publishedAt: IsoDate | null;
}

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface LessonDetail extends LessonSummary {
  /** The school's default for the "number of questions" field. */
  defaultQuestionCount: number;
  /** Whether a transcript exists, so a quiz can be generated without transcribing again. */
  hasTranscript: boolean;
  /** While processing: the quiz being generated, or null for a transcription-only run. */
  pendingQuiz: QuizRequest | null;
  summary: string | null;
  keyTakeaways: string[];
  failureReason: string | null;
  audioExpiresAt: IsoDate | null;
  progress: LessonProgress | null;
  questions: Question[];
  assignment: Assignment | null;
}

export interface LessonTranscript {
  transcript: string | null;
  segments: TranscriptSegment[];
}

/** Pushed to the owning teacher over Socket.IO (`lesson:progress`) and returned on lesson detail. */
export interface LessonProgress {
  lessonId: Id;
  status: LessonStatus;
  progressPct: number;
  message: string;
  attempt: number;
}

/* ----------------------------------------------------------------------------
 * Questions
 * ------------------------------------------------------------------------- */

export const QuestionStatus = z.enum(['draft', 'approved', 'rejected']);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const Difficulty = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof Difficulty>;

export const QUESTION_OPTION_COUNT = 4;

const OptionList = z.array(z.string().trim().min(1).max(300)).length(QUESTION_OPTION_COUNT);
const LocalOptionList = z.array(z.string().trim().max(300)).length(QUESTION_OPTION_COUNT);

export const QuestionInput = z.object({
  stem: text(1000),
  stemLocal: z.string().trim().max(1000).nullable().optional(),
  options: OptionList,
  optionsLocal: LocalOptionList.nullable().optional(),
  correctIndex: z.number().int().min(0).max(QUESTION_OPTION_COUNT - 1),
  explanation: z.string().trim().max(2000).nullable().optional(),
  explanationLocal: z.string().trim().max(2000).nullable().optional(),
  difficulty: Difficulty.default('medium'),
  topicTag: z.string().trim().max(120).nullable().optional(),
  /** Bloom's taxonomy level (same values as teacher-tools BLOOM_LEVELS). */
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).nullable().optional(),
  /** Short competency phrase, e.g. "Interpreting distance-time graphs". */
  competency: z.string().trim().max(160).nullable().optional(),
  citationStartSec: z.number().min(0).nullable().optional(),
  citationEndSec: z.number().min(0).nullable().optional(),
});
export type QuestionInput = z.infer<typeof QuestionInput>;

// Explicit optional difficulty: a .partial() of a defaulted field would still apply the default on PATCH.
export const UpdateQuestionInput = QuestionInput.extend({ difficulty: Difficulty.optional() }).partial();
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionInput>;

/** Full question — teachers/admins only. Never sent to students before grading. */
export interface Question {
  id: Id;
  lessonId: Id;
  position: number;
  stem: string;
  stemLocal: string | null;
  options: string[];
  optionsLocal: string[] | null;
  correctIndex: number;
  explanation: string | null;
  explanationLocal: string | null;
  difficulty: Difficulty;
  topicTag: string | null;
  bloomLevel: BloomLevel | null;
  competency: string | null;
  citationStartSec: number | null;
  citationEndSec: number | null;
  status: QuestionStatus;
  editedByTeacher: boolean;
}

/** Student-safe projection: no answer key, no explanation. */
export interface StudentQuestion {
  id: Id;
  position: number;
  stem: string;
  stemLocal: string | null;
  options: string[];
  optionsLocal: string[] | null;
  difficulty: Difficulty;
}

/* ----------------------------------------------------------------------------
 * Assignments
 * ------------------------------------------------------------------------- */

export const RubricItem = z.object({
  criterion: text(200),
  marks: z.number().int().min(0).max(100),
  descriptor: z.string().trim().max(1000).default(''),
});
export type RubricItem = z.infer<typeof RubricItem>;

export const AssignmentStatus = z.enum(['draft', 'published', 'closed']);
export type AssignmentStatus = z.infer<typeof AssignmentStatus>;

/** `allow_late`: accepted after the due date and flagged late. `closed`: refused after the due date. */
export const LatePolicy = z.enum(['allow_late', 'closed']);
export type LatePolicy = z.infer<typeof LatePolicy>;

export const MAX_SUBMISSION_FILES = 10;

export const AssignmentInput = z.object({
  title: text(200),
  prompt: z.string().trim().min(1).max(5000),
  rubric: z.array(RubricItem).max(20).default([]),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  latePolicy: LatePolicy.optional(),
  allowFiles: z.boolean().optional(),
  maxFiles: z.number().int().min(1).max(MAX_SUBMISSION_FILES).optional(),
  /** Email students who have not submitted, 24 hours before the due date. */
  reminders: z.boolean().optional(),
});
export type AssignmentInput = z.infer<typeof AssignmentInput>;

export interface Assignment {
  id: Id;
  /** Null for a standalone assignment. */
  lessonId: Id | null;
  sectionId: Id;
  title: string;
  prompt: string;
  rubric: RubricItem[];
  estimatedMinutes: number | null;
  dueAt: IsoDate | null;
  status: AssignmentStatus;
  latePolicy: LatePolicy;
  allowFiles: boolean;
  maxFiles: number;
  reminders: boolean;
  publishedAt: IsoDate | null;
}
