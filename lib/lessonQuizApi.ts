/**
 * Client for pipeline-generated lesson quizzes, served by SIH-backend at
 * /api/student/quizzes. Answers are graded server-side.
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

const QUIZ_SCORES_KEY = "cp_quiz_scores";

function getStoredQuizScores(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUIZ_SCORES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredQuizScore(id: string, scorePct: number): void {
  if (typeof window === "undefined") return;
  try {
    const scores = getStoredQuizScores();
    const prev = scores[id] ?? 0;
    scores[id] = Math.max(prev, scorePct);
    window.localStorage.setItem(QUIZ_SCORES_KEY, JSON.stringify(scores));
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore storage quota/security errors */
  }
}

export function getDemoQuizSummaries(): LessonQuizSummary[] {
  return [];
}

export function getDemoQuizDetail(lessonId: string): LessonQuizDetail | null {
  void lessonId;
  return null;
}

// -------------------------------------------------------------
// API Client Implementation
// -------------------------------------------------------------

export const lessonQuizApi = {
  async list(): Promise<{ quizzes: LessonQuizSummary[] }> {
    const scores = getStoredQuizScores();
    try {
      const res = await request<{ quizzes: LessonQuizSummary[] }>("/student/quizzes");
      if (res && Array.isArray(res.quizzes)) {
        return {
          quizzes: res.quizzes.map((q) => ({
            ...q,
            bestScorePct: scores[q.id] ?? q.bestScorePct,
          })),
        };
      }
    } catch {
      // Backend unavailable or unauthenticated
    }

    return { quizzes: [] };
  },

  async get(lessonId: string): Promise<LessonQuizDetail> {
    try {
      const res = await request<LessonQuizDetail>(`/student/quizzes/${lessonId}`);
      if (res && res.id) return res;
      throw new Error("Empty quiz response from server");
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to load quiz");
    }
  },

  async submit(
    lessonId: string,
    answers: Array<{ questionId: string; selectedOption?: number; text?: string }>
  ): Promise<LessonQuizResult> {
    try {
      const res = await request<LessonQuizResult>(`/student/quizzes/${lessonId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      if (res && res.lessonId) {
        setStoredQuizScore(lessonId, res.scorePct);
        return res;
      }
      throw new Error("Empty submission response");
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to submit quiz");
    }
  },
};
