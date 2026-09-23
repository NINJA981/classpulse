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

/**
 * The API host is resolved in the browser, not baked in.
 *
 * NEXT_PUBLIC_API_BASE_URL is fixed when the dev server starts, so it pins whatever LAN IP
 * the machine had at that moment. Change Wi-Fi, renew a DHCP lease, or open the app from a
 * different host and every request goes to an address that no longer answers — and a
 * hanging fetch looks like a frozen page, not an error. The page's own hostname is always
 * reachable from the browser that loaded it, so only the port and path are taken from the
 * configured value.
 */
function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  if (typeof window === 'undefined') return configured;
  try {
    const url = new URL(configured, window.location.origin);
    url.hostname = window.location.hostname;
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}

const API_BASE_URL = resolveApiBase();

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
   * GET /api/admin/sections
   *
   * The real section directory. Lessons published without a sectionId never reach a
   * student's quiz list, so the class picker must offer these instead of invented labels.
   */
  async listSections() {
    const { items } = await request<{
      items: Array<{
        id: string;
        name: string;
        joinCode: string;
        teacherIds: string[];
        teacherNames: string[];
        enrolledCount: number;
      }>;
    }>('/admin/sections');
    return items;
  },

  /**
   * POST /api/lessons
   */
  async createLesson({
    title,
    subject,
    className,
    sectionId,
    language,
    liveSessionId
  }: {
    title: string;
    subject: string;
    className: string;
    sectionId?: string;
    language?: string;
    liveSessionId?: string;
  }) {
    // Claim whatever the recorder captured live, unless the caller passed one explicitly.
    const claimedSession = liveSessionId ?? takeLiveSession();
    const { lesson } = await request<{ lesson: Lesson }>('/lessons', {
      method: 'POST',
      body: JSON.stringify({
        title,
        subject,
        className,
        sectionId,
        language: language || 'en',
        liveSessionId: claimedSession
      })
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


  /**
   * GET /api/lessons/:id/submissions
   */
  async getLessonSubmissions(lessonId: string): Promise<{ submissions: any[] }> {
    return request<{ submissions: any[] }>(`/lessons/${lessonId}/submissions`);
  },

  /**
   * POST /api/live-quiz/create
   */
  async createLiveQuizSession(lessonId: string): Promise<{ success: boolean; pin: string; lessonId: string; title: string; questionCount: number }> {
    return request<{ success: boolean; pin: string; lessonId: string; title: string; questionCount: number }>('/live-quiz/create', {
      method: 'POST',
      body: JSON.stringify({ lessonId })
    });
  },

  /**
   * GET /api/lessons/:id/analytics
   */
  async getLessonAnalytics(lessonId: string): Promise<{
    lessonId: string;
    lessonTitle: string;
    subject: string;
    className: string;
    totalSubmissions: number;
    classAveragePct: number;
    criticalGapsCount: number;
    moderateGapsCount: number;
    masteredCount: number;
    questions: Array<{
      questionId: string;
      stem: string;
      stemLocal?: string;
      topicTag: string;
      difficulty: string;
      totalAttempts: number;
      correctAttempts: number;
      accuracyPct: number;
      status: 'critical' | 'moderate' | 'mastered';
      sourceCitation?: string;
      explanation: string;
      explanationLocal?: string;
    }>;
    remedialNotes: Array<{
      questionId: string;
      topic: string;
      accuracyPct: number;
      misconception: string;
      remedialNote: string;
      suggestedAction: string;
      sourceTimestamp?: string;
    }>;
  }> {
        return request(`/lessons/${lessonId}/analytics`);
  }

};
