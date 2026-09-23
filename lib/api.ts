import {
  Lesson,
  LessonStatus,
  Question,
  Assignment,
  SourceType,
  SourceFile,
  Transcript,
  TranscriptSource
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = isBrowser() ? localStorage.getItem('clasepulse_jwt_token') : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (typeof body === 'object') {
      body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error: any = new Error(
      (data && data.message) || (data && data.error) || `HTTP ${response.status}: ${response.statusText}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

/**
 * The API speaks `id`; this app's types were written around Mongo's `_id`, and the review
 * screen keys off it everywhere. Rather than touch every component, responses are
 * normalised here on the way in — one place that knows about both spellings.
 */
function normalizeLesson(raw: any): Lesson {
  return { ...raw, _id: raw?._id ?? raw?.id };
}

/** Same idea, plus the citation the API calls `sourceLine` and this app calls `sourceCitation`. */
function normalizeQuestion(raw: any): Question {
  return {
    ...raw,
    _id: raw?._id ?? raw?.id,
    sourceCitation: raw?.sourceCitation ?? raw?.sourceLine
  };
}

function normalizeAssignment(raw: any): Assignment | null {
  return raw ? ({ ...raw, _id: raw._id ?? raw.id } as Assignment) : null;
}

/** PATCH /questions/:id only accepts these. Sending `_id` back would be rejected. */
const EDITABLE_QUESTION_FIELDS = [
  'stem',
  'options',
  'correctIndex',
  'correctText',
  'explanation',
  'topicTag',
  'difficulty',
  'status'
] as const;

function questionPatch(updates: Partial<Question>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_QUESTION_FIELDS) {
    if (updates[field] !== undefined) out[field] = updates[field];
  }
  return out;
}

/**
 * WebSocket URL for live captions while recording. The backend relays to Sarvam so the
 * transcription key never reaches the browser. Returns null when nobody is signed in —
 * live captions need a real backend session, not the mock one.
 */

const LIVE_SESSION_KEY = 'clasepulse_live_session';

/**
 * The recorder runs on /lessons/new, before the lesson exists, so the captions are saved
 * server-side as a session first. The id is parked here and handed to createLesson, which
 * turns it into the lesson's live transcript.
 */
export function rememberLiveSession(sessionId: string): void {
  if (isBrowser()) sessionStorage.setItem(LIVE_SESSION_KEY, sessionId);
}

export function takeLiveSession(): string | undefined {
  if (!isBrowser()) return undefined;
  const id = sessionStorage.getItem(LIVE_SESSION_KEY) ?? undefined;
  sessionStorage.removeItem(LIVE_SESSION_KEY);
  return id;
}

export function liveTranscriptUrl(options: { language?: string; lessonId?: string } = {}): string | null {
  if (!isBrowser()) return null;
  const token = localStorage.getItem('clasepulse_jwt_token');
  if (!token) return null;

  const base = API_BASE_URL.startsWith('http')
    ? API_BASE_URL
    : `${window.location.origin}${API_BASE_URL}`;
  const url = new URL(`${base.replace(/\/$/, '')}/live`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  if (options.language) url.searchParams.set('language', options.language);
  if (options.lessonId) url.searchParams.set('lessonId', options.lessonId);
  return url.toString();
}

export const api = {
  /**
   * POST /api/auth/login
   */
  /**
   * GET /api/lessons/:id/transcript — what the class actually said, once ASR has run.
   * Null while the lesson is still a draft or still transcribing.
   */
  /**
   * GET /api/lessons/:id/transcript — a lesson can hold two: one captured live while the
   * teacher spoke, one from the uploaded file. `selected` is the one the questions come from.
   */
  async getTranscript(lessonId: string): Promise<{ transcripts: Transcript[]; selected: TranscriptSource | null }> {
    return request<{ transcripts: Transcript[]; selected: TranscriptSource | null }>(
      `/lessons/${lessonId}/transcript`,
    );
  },

  /** POST /api/lessons/:id/transcript/select — takes effect on the next regenerate. */
  async selectTranscript(lessonId: string, source: TranscriptSource): Promise<Lesson> {
    const { lesson } = await request<{ lesson: Lesson }>(
      `/lessons/${lessonId}/transcript/select`,
      { method: 'POST', body: JSON.stringify({ source }) },
    );
    return normalizeLesson(lesson);
  },

  async login(email?: string, password?: string) {
    const result = await request<{ token: string; teacher: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    // Every other call reads the token back out of here.
    if (isBrowser()) localStorage.setItem('clasepulse_jwt_token', result.token);
    return result;
  },

  /**
   * GET /api/lessons?status=&page=
   */
  async getLessons({ status, page = 1 }: { status?: string; page?: number } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    const data = await request<{ items: any[]; page: number; pageSize: number; total: number }>(
      `/lessons?${params.toString()}`
    );
    return { lessons: data.items.map(normalizeLesson), page: data.page, total: data.total };
  },

  /**
   * POST /api/lessons
   */
  async createLesson({ title, subject, className, liveSessionId }: { title: string; subject: string; className: string; liveSessionId?: string }) {
    // Claim whatever the recorder captured live, unless the caller passed one explicitly.
    const claimedSession = liveSessionId ?? takeLiveSession();
    const { lesson } = await request<{ lesson: Lesson }>('/lessons', {
      method: 'POST',
      body: JSON.stringify({ title, subject, className, liveSessionId: claimedSession })
    });
    return normalizeLesson(lesson);
  },

  /**
   * POST /api/lessons/:id/source
   */
  async attachSource(lessonId: string, fileOrBlob: File | Blob, sourceType: SourceType) {
    const formData = new FormData();
    formData.append('file', fileOrBlob);
    formData.append('sourceType', sourceType);
    const { lesson } = await request<{ lesson: Lesson }>(`/lessons/${lessonId}/source`, {
      method: 'POST',
      body: formData
    });
    return { success: true, sourceFile: lesson.sourceFile as SourceFile };
  },

  /**
   * POST /api/lessons/:id/generate
   */
  async generate(lessonId: string) {
    const job = await request<{ lessonId: string; jobId: string; status: string }>(
      `/lessons/${lessonId}/generate`,
      { method: 'POST' }
    );
    return { status: 202, jobId: job.jobId, message: `Lesson ${job.status}` };
  },

  /**
   * GET /api/lessons/:id
   */
  async getLesson(lessonId: string): Promise<Lesson> {
    const { lesson } = await request<{ lesson: Lesson; job: any }>(`/lessons/${lessonId}`);
    return normalizeLesson(lesson);
  },

  /**
   * GET /api/lessons/:id/questions
   */
  async getLessonQuestions(lessonId: string): Promise<{ lessonId: string; questions: Question[]; assignment: Assignment | null }> {
    const data = await request<{ questions: any[]; assignment: any }>(
      `/lessons/${lessonId}/questions`
    );
    return {
      lessonId,
      questions: data.questions.map(normalizeQuestion),
      assignment: normalizeAssignment(data.assignment)
    };
  },

  /**
   * PATCH /api/questions/:id
   */
  async updateQuestion(questionId: string, updates: Partial<Question>): Promise<Question> {
    const { question } = await request<{ question: Question }>(`/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(questionPatch(updates))
    });
    return normalizeQuestion(question);
  },

  /**
   * POST /api/questions/:id/approve
   */
  async approveQuestion(idOrIds: string | string[]): Promise<{ success: boolean; approvedCount: number }> {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const { approvedCount } = await request<{ questions: Question[]; approvedCount: number }>(
      `/questions/${ids[0]}/approve`,
      { method: 'POST', body: JSON.stringify({ ids }) }
    );
    return { success: true, approvedCount };
  },

  /**
   * POST /api/questions/:id/reject
   */
  async rejectQuestion(questionId: string): Promise<Question> {
    const { question } = await request<{ question: Question }>(`/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' })
    });
    return normalizeQuestion(question);
  },

  /**
   * Update assignment
   */
  async updateAssignment(lessonId: string, updates: Partial<Assignment>): Promise<Assignment> {
    const { prompt, estimatedMinutes, rubric, status } = updates;
    const { assignment } = await request<{ assignment: Assignment }>(
      `/lessons/${lessonId}/assignment`,
      {
        method: 'PATCH',
        body: JSON.stringify({ prompt, estimatedMinutes, rubric, status })
      }
    );
    return normalizeAssignment(assignment) as Assignment;
  },

  /**
   * POST /api/lessons/:id/regenerate
   */
  async regenerate(lessonId: string) {
    const job = await request<{ lessonId: string; jobId: string; status: string }>(
      `/lessons/${lessonId}/regenerate`,
      { method: 'POST' }
    );
    return { status: 202, jobId: job.jobId, message: `Lesson ${job.status}` };
  },

  /**
   * POST /api/lessons/:id/publish
   * Hard 409 gate if zero approved questions!
   */
  async publishLesson(lessonId: string): Promise<{ success: boolean; lessonId: string; publishedAt: string; approvedQuestionsCount: number }> {
    const { lesson } = await request<{ lesson: Lesson }>(`/lessons/${lessonId}/publish`, {
      method: 'POST'
    });
    // The publish route answers with the lesson; the banner also wants the count, and
    // the questions are already cached server-side by this point.
    const { questions } = await request<{ questions: Question[] }>(
      `/lessons/${lessonId}/questions`
    );
    return {
      success: true,
      lessonId: normalizeLesson(lesson)._id,
      publishedAt: lesson.updatedAt,
      approvedQuestionsCount: questions.filter((q) => q.status === 'approved').length
    };
  },
};
