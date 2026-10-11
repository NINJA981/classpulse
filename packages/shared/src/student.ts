import { z } from 'zod';
import { Id, text, type IsoDate } from './common.js';
import type { Difficulty, LatePolicy, StudentQuestion } from './lessons.js';
import type { RubricMark, SubmissionFile, SubmissionStatus } from './assignments.js';
import { JoinCode } from './org.js';

/* ----------------------------------------------------------------------------
 * Enrollment
 * ------------------------------------------------------------------------- */

export const JoinSectionInput = z.object({ joinCode: JoinCode });
export type JoinSectionInput = z.infer<typeof JoinSectionInput>;

export interface SectionPreview {
  id: Id;
  name: string;
  subject: string | null;
  grade: string | null;
  teachers: string[];
  alreadyEnrolled: boolean;
}

export interface StudentSection {
  id: Id;
  name: string;
  subject: string | null;
  grade: string | null;
  teachers: string[];
  joinedAt: IsoDate;
}

/* ----------------------------------------------------------------------------
 * Self-paced quizzes
 * ------------------------------------------------------------------------- */

export interface StudentQuizListItem {
  lessonId: Id;
  title: string;
  subject: string;
  section: { id: Id; name: string };
  teacherName: string;
  questionCount: number;
  publishedAt: IsoDate;
  latestAttempt: { id: Id; scorePct: number; submittedAt: IsoDate } | null;
}

export interface StudentQuiz {
  lessonId: Id;
  title: string;
  subject: string;
  summary: string | null;
  keyTakeaways: string[];
  questions: StudentQuestion[];
}

export const SubmitQuizAttemptInput = z.object({
  /** Client-generated UUID; resubmitting the same key returns the original result. */
  idempotencyKey: Id,
  answers: z
    .array(
      z.object({
        questionId: Id,
        selectedIndex: z.number().int().min(0).max(3).nullable(),
      }),
    )
    .min(1)
    .max(200),
});
export type SubmitQuizAttemptInput = z.infer<typeof SubmitQuizAttemptInput>;

export interface GradedAnswer {
  questionId: Id;
  stem: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string | null;
  explanationLocal: string | null;
  citationStartSec: number | null;
  citationEndSec: number | null;
  difficulty: Difficulty;
}

export interface QuizAttemptResult {
  id: Id;
  lessonId: Id;
  correct: number;
  total: number;
  scorePct: number;
  submittedAt: IsoDate;
  answers: GradedAnswer[];
}

/* ----------------------------------------------------------------------------
 * Assignments (student side)
 * ------------------------------------------------------------------------- */

/** Student-facing state of one assignment. */
export type StudentAssignmentState = 'todo' | 'submitted' | 'late' | 'returned' | 'closed';

export interface StudentAssignment {
  id: Id;
  lessonId: Id | null;
  lessonTitle: string | null;
  sectionName: string;
  title: string;
  prompt: string;
  rubric: { criterion: string; marks: number; descriptor: string }[];
  estimatedMinutes: number | null;
  dueAt: IsoDate | null;
  latePolicy: LatePolicy;
  allowFiles: boolean;
  maxFiles: number;
  state: StudentAssignmentState;
  submission: {
    id: Id;
    submittedAt: IsoDate;
    updatedAt: IsoDate;
    text: string | null;
    files: SubmissionFile[];
    isLate: boolean;
    status: SubmissionStatus;
    /** Present once the teacher has returned the work. */
    rubricMarks: RubricMark[] | null;
    totalMarks: number | null;
    maxMarks: number;
    feedback: string | null;
    returnedAt: IsoDate | null;
  } | null;
}

/**
 * Multipart form fields of POST /student/assignments/:id/submission (files go in `files`).
 * The submission needs text or at least one file overall.
 */
export const SubmitAssignmentInput = z.object({
  text: z.string().trim().max(20000).optional(),
});
export type SubmitAssignmentInput = z.infer<typeof SubmitAssignmentInput>;

/* ----------------------------------------------------------------------------
 * Guardians
 * ------------------------------------------------------------------------- */

export const GuardianInput = z.object({
  name: text(120),
  relation: z.enum(['mother', 'father', 'guardian', 'other']),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{7,20}$/, 'Enter a valid phone number'),
  email: z.email().trim().toLowerCase().nullable().optional(),
  receiveUpdates: z.boolean().default(true),
});
export type GuardianInput = z.infer<typeof GuardianInput>;

export interface Guardian {
  id: Id;
  name: string;
  relation: 'mother' | 'father' | 'guardian' | 'other';
  phone: string;
  email: string | null;
  receiveUpdates: boolean;
}

/* ----------------------------------------------------------------------------
 * Profile & dashboard
 * ------------------------------------------------------------------------- */

export const UpdateStudentProfileInput = z.object({
  email: z.email().trim().toLowerCase().nullable().optional(),
});
export type UpdateStudentProfileInput = z.infer<typeof UpdateStudentProfileInput>;

export interface StudentDashboard {
  sections: StudentSection[];
  pendingQuizzes: StudentQuizListItem[];
  recentAttempts: { lessonId: Id; title: string; scorePct: number; submittedAt: IsoDate }[];
  upcomingAssignments: { id: Id; title: string; dueAt: IsoDate | null; submitted: boolean }[];
  averageScorePct: number | null;
}
