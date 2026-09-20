/**
 * Client for pipeline-generated lesson quizzes (served by SIH-backend at
 * /api/student/quizzes). Answers are graded server-side; this module never
 * receives correct answers until after submission.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export interface LessonQuizSummary {
  id: string;
  title: string;
  subject: string;
  className: string;
  questionCount: number;
  summary: string | null;
  keyTakeaways: string[];
  publishedAt: string;
}

export interface LessonQuizDetail {
  id: string;
  title: string;
  subject: string;
  className: string;
  summary: string | null;
  keyTakeaways: string[];
  questions: Array<{
    index: number;
    id: string;
    type: "mcq" | "truefalse" | "short";
    stem: string;
    options: string[];
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
  }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      detail = (JSON.parse(body) as { error?: string }).error || body;
    } catch {
      /* keep raw */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
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
      body: JSON.stringify({ answers })
    });
  }
};
