/**
 * Client for pipeline-generated lesson quizzes, served by SIH-backend at
 * /api/student/quizzes. Answers are graded server-side; this module never receives the
 * correct answers until after the submission comes back.
 */

import { request } from "./apiClient";

export interface LessonQuizSummary {
  id: string;
  title: string;
  subject: string;
  className: string;
  language?: string;
  questionCount: number;
  summary: string | null;
  keyTakeaways: string[];
  publishedAt: string;
  /** Null until this student has submitted at least once. */
  bestScorePct: number | null;
}

export interface LessonQuizDetail {
  id: string;
  title: string;
  subject: string;
  className: string;
  language?: string;
  summary: string | null;
  keyTakeaways: string[];
  questions: Array<{
    index: number;
    id: string;
    type: "mcq" | "truefalse" | "short";
    stem: string;
    stemLocal?: string | null;
    options: string[];
    optionsLocal?: string[] | null;
    difficulty: string;
    sourceCitation: string | null;
  }>;
}

export interface LessonQuizResult {
  lessonId: string;
  lessonTitle: string;
  correct: number;
  total: number;
  scorePct: number;
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    correctIndex?: number;
    correctText?: string;
    explanation: string;
    explanationLocal?: string | null;
  }>;
}

export const lessonQuizApi = {
  list(): Promise<{ quizzes: LessonQuizSummary[] }> {
    return request("/student/quizzes");
  },

  get(lessonId: string): Promise<LessonQuizDetail> {
    return request(`/student/quizzes/${lessonId}`);
  },

  submit(
    lessonId: string,
    answers: Array<{ questionId: string; selectedOption?: number; text?: string }>
  ): Promise<LessonQuizResult> {
    return request(`/student/quizzes/${lessonId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },
};
