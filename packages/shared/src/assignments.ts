import { z } from 'zod';
import { Id, text, type IsoDate } from './common.js';
import { AssignmentInput, AssignmentStatus, RubricItem, type LatePolicy } from './lessons.js';

/* ----------------------------------------------------------------------------
 * Assignments: teacher side (standalone or attached to a lesson, several per lesson)
 * ------------------------------------------------------------------------- */

export const SubmissionStatus = z.enum(['submitted', 'returned']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

/** Accepted upload types for submissions (photos of handwritten work, PDFs, Word documents). */
export const SUBMISSION_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
} as const;
export const SUBMISSION_FILE_MAX_MB = 10;

export const CreateAssignmentInput = AssignmentInput.extend({
  sectionId: Id,
  /** Attach to a lesson (one of several); omit for a standalone assignment. */
  lessonId: Id.optional(),
});
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentInput>;

// Explicit optional rubric: a .partial() of a defaulted field would still apply the default on PATCH.
export const UpdateAssignmentInput = AssignmentInput.extend({ rubric: z.array(RubricItem).max(20).optional() }).partial();
export type UpdateAssignmentInput = z.infer<typeof UpdateAssignmentInput>;

export const ListAssignmentsQuery = z.object({
  sectionId: Id.optional(),
  lessonId: Id.optional(),
  status: AssignmentStatus.optional(),
});
export type ListAssignmentsQuery = z.infer<typeof ListAssignmentsQuery>;

export interface AssignmentSummary {
  id: Id;
  title: string;
  section: { id: Id; name: string };
  lesson: { id: Id; title: string } | null;
  status: AssignmentStatus;
  dueAt: IsoDate | null;
  latePolicy: LatePolicy;
  enrolled: number;
  submitted: number;
  late: number;
  returned: number;
  createdAt: IsoDate;
}

export interface SubmissionFile {
  id: Id;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Authenticated download URL (same origin). */
  url: string;
}

export const RubricMarkInput = z.object({
  criterion: text(200),
  marks: z.number().min(0).max(100),
});
export type RubricMark = z.infer<typeof RubricMarkInput>;

export interface AiGradeSuggestion {
  rubricMarks: RubricMark[];
  feedback: string;
  /** What the AI could not assess (e.g. an unreadable photo or a PDF it could not read). */
  note: string;
  model: string;
  createdAt: IsoDate;
}

export type TrackerStatus = 'missing' | 'submitted' | 'late' | 'returned';

export interface SubmissionTrackerRow {
  student: { id: Id; name: string; rollNumber: string | null };
  submissionId: Id | null;
  status: TrackerStatus;
  isLate: boolean;
  submittedAt: IsoDate | null;
  fileCount: number;
  totalMarks: number | null;
  maxMarks: number;
  gradedAt: IsoDate | null;
  returnedAt: IsoDate | null;
}

export interface SubmissionDetail {
  id: Id;
  assignmentId: Id;
  student: { id: Id; name: string; rollNumber: string | null };
  text: string | null;
  files: SubmissionFile[];
  submittedAt: IsoDate;
  updatedAt: IsoDate;
  isLate: boolean;
  status: SubmissionStatus;
  rubricMarks: RubricMark[] | null;
  totalMarks: number | null;
  maxMarks: number;
  feedback: string | null;
  gradedAt: IsoDate | null;
  returnedAt: IsoDate | null;
  aiSuggestion: AiGradeSuggestion | null;
}

export const GradeSubmissionInput = z.object({
  rubricMarks: z.array(RubricMarkInput).max(20),
  feedback: z.string().trim().max(5000).default(''),
});
export type GradeSubmissionInput = z.infer<typeof GradeSubmissionInput>;

export const ReturnSubmissionsResult = z.object({ returned: z.number().int() });
export type ReturnSubmissionsResult = z.infer<typeof ReturnSubmissionsResult>;
