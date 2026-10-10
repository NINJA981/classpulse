import { z } from 'zod';
import { Id, text, type IsoDate } from './common.js';
import type { Difficulty, StudentQuestion } from './lessons.js';
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

export interface StudentAssignment {
  id: Id;
  lessonId: Id;
  lessonTitle: string;
  sectionName: string;
  title: string;
  prompt: string;
  rubric: { criterion: string; marks: number; descriptor: string }[];
  estimatedMinutes: number | null;
  dueAt: IsoDate | null;
  submission: { id: Id; submittedAt: IsoDate; text: string } | null;
}

export const SubmitAssignmentInput = z.object({
  text: z.string().trim().min(1).max(20000),
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
