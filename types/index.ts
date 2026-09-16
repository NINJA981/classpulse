export type SourceType = 'audio' | 'document';

export type LessonStatus =
  | 'draft'
  | 'queued'
  | 'transcribing'
  | 'generating'
  | 'validating'
  | 'ready_for_review'
  | 'published'
  | 'failed';

export interface SourceFile {
  path: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
}

export interface Lesson {
  _id: string;
  teacherId: string;
  title: string;
  subject: string;
  className: string;
  sourceType?: SourceType | null;
  sourceFile?: SourceFile | null;
  status: LessonStatus;
  failureReason?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  timings?: {
    startedAt: string | number;
    elapsedSec: number;
  };
}

export type QuestionType = 'mcq' | 'short' | 'truefalse';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'approved' | 'rejected';

export interface Question {
  _id: string;
  lessonId: string;
  type: QuestionType;
  stem: string;
  options: string[];
  correctIndex?: number;
  correctText?: string;
  explanation: string;
  topicTag: string;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  editedByTeacher: boolean;
  createdAt: string;
  sourceCitation?: string;
}

export interface RubricCriterion {
  criterion: string;
  marks: number;
  descriptor: string;
}

export interface Assignment {
  _id: string;
  lessonId: string;
  prompt: string;
  estimatedMinutes: number;
  rubric: RubricCriterion[];
  status: 'draft' | 'approved' | 'rejected';
}
