import { z } from 'zod';
import { Id, Language, text, type IsoDate } from './common.js';

/* ----------------------------------------------------------------------------
 * Lessons
 * ------------------------------------------------------------------------- */

export const LESSON_STATUSES = [
  'draft', // created; no audio yet
  'recording', // a classroom device is recording it
  'queued', // audio ready, generation job queued
  'transcribing',
  'generating',
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

export const GenerateLessonInput = z.object({
  /** Must be true to regenerate a lesson that already has questions or is published. */
  confirmRegenerate: z.boolean().optional(),
});
export type GenerateLessonInput = z.infer<typeof GenerateLessonInput>;

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
  citationStartSec: z.number().min(0).nullable().optional(),
  citationEndSec: z.number().min(0).nullable().optional(),
});
export type QuestionInput = z.infer<typeof QuestionInput>;

export const UpdateQuestionInput = QuestionInput.partial();
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

export const AssignmentStatus = z.enum(['draft', 'published']);
export type AssignmentStatus = z.infer<typeof AssignmentStatus>;

export const AssignmentInput = z.object({
  title: text(200),
  prompt: z.string().trim().min(1).max(5000),
  rubric: z.array(RubricItem).max(20).default([]),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
});
export type AssignmentInput = z.infer<typeof AssignmentInput>;

export interface Assignment {
  id: Id;
  lessonId: Id;
  title: string;
  prompt: string;
  rubric: RubricItem[];
  estimatedMinutes: number | null;
  dueAt: IsoDate | null;
  status: AssignmentStatus;
}
