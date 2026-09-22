import {
  Lesson,
  LessonStatus,
  Question,
  Assignment,
  SourceType,
  SourceFile
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

const STORAGE_KEY_LESSONS = 'clasepulse_lessons_v2';
const STORAGE_KEY_QUESTIONS = 'clasepulse_questions_v2';
const STORAGE_KEY_ASSIGNMENTS = 'clasepulse_assignments_v2';
const STORAGE_KEY_TIMESTAMPS = 'clasepulse_start_times_v2';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function seedInitialData() {
  if (!isBrowser()) return;

  const existingLessons = localStorage.getItem(STORAGE_KEY_LESSONS);
  if (!existingLessons) {
    const initialLessons: Lesson[] = [
      {
        _id: 'les_101',
        teacherId: 'tch_001',
        title: 'Photosynthesis & Cellular Respiration',
        subject: 'Biology',
        className: 'Grade 10 - Section B',
        sourceType: 'audio',
        sourceFile: {
          path: '/uploads/photosynthesis-recording.webm',
          mimeType: 'audio/webm',
          sizeBytes: 18450200,
          durationSec: 1420
        },
        status: 'ready_for_review',
        language: 'en',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        _id: 'les_102',
        teacherId: 'tch_001',
        title: 'Newtonian Dynamics & Momentum',
        subject: 'Physics',
        className: 'Grade 11 - Section A',
        sourceType: 'document',
        sourceFile: {
          path: '/uploads/mechanics-notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4210000
        },
        status: 'published',
        language: 'en',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      },
      {
        _id: 'les_103',
        teacherId: 'tch_001',
        title: 'Causes of the French Revolution',
        subject: 'History',
        className: 'Grade 9 - Section C',
        sourceType: 'document',
        sourceFile: {
          path: '/uploads/french-rev-deck.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          sizeBytes: 8120000
        },
        status: 'draft',
        language: 'en',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
      }
    ];

    const initialQuestions: Record<string, Question[]> = {
      les_101: [
        {
          _id: 'q_101_1',
          lessonId: 'les_101',
          type: 'mcq',
          stem: 'What are the primary products of the light-dependent reactions in the thylakoid membrane?',
          options: [
            'Glucose and Oxygen',
            'ATP, NADPH, and Oxygen',
            'Carbon dioxide and Water',
            'Pyruvate and NADH'
          ],
          correctIndex: 1,
          correctText: 'ATP, NADPH, and Oxygen',
          explanation: 'Light energy splits water molecules producing oxygen as a byproduct, while generating chemical potential energy stored in ATP and NADPH.',
          topicTag: 'Light Reactions',
          difficulty: 'medium',
          status: 'draft',
          sourceCitation: 'Teacher (14:32): "Remember, light strikes chlorophyll in photosystem II, photolysis splits H2O, yielding oxygen, and the electron transport chain charges up both ATP and NADPH for the stroma."',
          editedByTeacher: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        },
        {
          _id: 'q_101_2',
          lessonId: 'les_101',
          type: 'mcq',
          stem: 'In which part of the chloroplast does the Calvin cycle (light-independent reaction) take place?',
          options: [
            'Thylakoid lumen',
            'Outer membrane',
            'Stroma',
            'Cristae'
          ],
          correctIndex: 2,
          correctText: 'Stroma',
          explanation: 'The stroma is the fluid-filled space surrounding the grana where enzymes fix carbon dioxide into sugars.',
          topicTag: 'Calvin Cycle',
          difficulty: 'easy',
          status: 'draft',
          sourceCitation: 'Teacher (21:05): "The Calvin cycle does not need direct photons, but it requires the fluid matrix of the stroma where RuBisCO enzymes are concentrated."',
          editedByTeacher: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        },
        {
          _id: 'q_101_3',
          lessonId: 'les_101',
          type: 'truefalse',
          stem: 'Glycolysis requires oxygen to produce initial net molecules of ATP in eukaryotic cells.',
          options: ['True', 'False'],
          correctIndex: 1,
          correctText: 'False',
          explanation: 'Glycolysis is an anaerobic pathway occurring in the cytoplasm that yields a net of 2 ATP without molecular oxygen.',
          topicTag: 'Cellular Respiration',
          difficulty: 'easy',
          status: 'draft',
          sourceCitation: 'Teacher (31:40): "Do not confuse aerobic respiration with glycolysis. Glycolysis occurs in the cytosol and is strictly anaerobic—no O2 required at this phase."',
          editedByTeacher: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        },
        {
          _id: 'q_101_4',
          lessonId: 'les_101',
          type: 'short',
          stem: 'State the role of the enzyme RuBisCO in photosynthetic carbon fixation.',
          options: [],
          correctText: 'Catalyzes the fixation of CO2 onto ribulose-1,5-bisphosphate (RuBP).',
          explanation: 'RuBisCO initiates the Calvin cycle by adding carbon dioxide to RuBP to form 3-PGA.',
          topicTag: 'Enzyme Kinetics',
          difficulty: 'hard',
          status: 'draft',
          sourceCitation: 'Teacher (26:18): "RuBisCO is possibly the most abundant protein on Earth because it catalyzes the rate-limiting first step of carbon fixation into 3-PGA."',
          editedByTeacher: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        }
      ],
      les_102: [
        {
          _id: 'q_102_1',
          lessonId: 'les_102',
          type: 'mcq',
          stem: "What is the rate of change of linear momentum according to Newton's second law?",
          options: [
            'Total Kinetic Energy',
            'Net Applied Force',
            'Inertial Mass',
            'Displacement per second'
          ],
          correctIndex: 1,
          correctText: 'Net Applied Force',
          explanation: 'F_net = dp/dt. The net external force equals the time rate of change of momentum.',
          topicTag: 'Newtonian Mechanics',
          difficulty: 'medium',
          status: 'approved',
          sourceCitation: 'Document (Page 4): "Newton originally formulated his second law as F = dp/dt, meaning force is directly proportional to momentum rate of change."',
          editedByTeacher: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
        }
      ]
    };

    const initialAssignments: Record<string, Assignment> = {
      les_101: {
        _id: 'asg_101',
        lessonId: 'les_101',
        prompt: 'Construct a comparative concept map and a 300-word essay detailing how ATP generated in the light reactions is consumed in the Calvin cycle, and how environmental factors (light intensity and ambient CO2 levels) limit overall photosynthetic yield.',
        estimatedMinutes: 45,
        rubric: [
          {
            criterion: 'Biochemical Accuracy & Pathway Mapping',
            marks: 10,
            descriptor: 'Accurately outlines ATP/NADPH energy transfer, photolysis stoichiometry, and Calvin cycle synthesis without conceptual errors.'
          },
          {
            criterion: 'Analysis of Environmental Limiting Factors',
            marks: 10,
            descriptor: 'Thoroughly evaluates how varying light intensity and CO2 saturation affect the rate-limiting steps catalyzed by RuBisCO.'
          },
          {
            criterion: 'Clarity, Terminology & Scientific Precision',
            marks: 5,
            descriptor: 'Employs standard biological terminology, proper diagrammatic keys, and cohesive scientific arguments.'
          }
        ],
        status: 'draft'
      },
      les_102: {
        _id: 'asg_102',
        lessonId: 'les_102',
        prompt: 'Solve the two-body inelastic collision problem and calculate kinetic energy dissipation.',
        estimatedMinutes: 30,
        rubric: [
          {
            criterion: 'Conservation Equations',
            marks: 10,
            descriptor: 'Sets up vector momentum conservation equations correctly before and after impact.'
          }
        ],
        status: 'approved'
      }
    };

    localStorage.setItem(STORAGE_KEY_LESSONS, JSON.stringify(initialLessons));
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(initialQuestions));
    localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(initialAssignments));
  }
}

if (isBrowser()) {
  seedInitialData();
}

function getStoredLessons(): Lesson[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_LESSONS) || '[]');
  } catch {
    return [];
  }
}

function saveStoredLessons(lessons: Lesson[]) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_LESSONS, JSON.stringify(lessons));
}

function getStoredQuestions(): Record<string, Question[]> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_QUESTIONS) || '{}');
  } catch {
    return {};
  }
}

function saveStoredQuestions(questionsMap: Record<string, Question[]>) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(questionsMap));
}

function getStoredAssignments(): Record<string, Assignment> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_ASSIGNMENTS) || '{}');
  } catch {
    return {};
  }
}

function saveStoredAssignments(asgMap: Record<string, Assignment>) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(asgMap));
}

function getStoredTimestamps(): Record<string, number> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_TIMESTAMPS) || '{}');
  } catch {
    return {};
  }
}

function saveStoredTimestamps(map: Record<string, number>) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_TIMESTAMPS, JSON.stringify(map));
}

// Stage transition schedule
const STAGE_SCHEDULE: { thresholdMs: number; stage: LessonStatus }[] = [
  { thresholdMs: 0, stage: 'queued' },
  { thresholdMs: 2500, stage: 'transcribing' },
  { thresholdMs: 7000, stage: 'generating' },
  { thresholdMs: 12000, stage: 'validating' },
  { thresholdMs: 16500, stage: 'ready_for_review' }
];

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

export const api = {
  /**
   * POST /api/auth/login
   */
  async login(email?: string, password?: string) {
    if (!USE_MOCK) {
      return request<{ token: string; teacher: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    }

    const teacher = {
      id: 'tch_001',
      name: 'Professor Elena Vance',
      email: email || 'elena.vance@clasepulse.edu',
      institution: 'Science Academy'
    };
    const token = 'mock_jwt_token_header.payload.signature';
    if (isBrowser()) {
      localStorage.setItem('clasepulse_jwt_token', token);
    }
    return { token, teacher };
  },

  /**
   * GET /api/lessons?status=&page=
   */
  async getLessons({ status, page = 1 }: { status?: string; page?: number } = {}) {
    if (!USE_MOCK) {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (page) params.append('page', String(page));
      return request<{ lessons: Lesson[]; page: number; total: number }>(`/lessons?${params.toString()}`);
    }

    let lessons = getStoredLessons();
    if (status) {
      lessons = lessons.filter((l) => l.status === status);
    }
    lessons.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      lessons,
      page,
      total: lessons.length
    };
  },

  /**
   * POST /api/lessons
   */
  async createLesson({ title, subject, className }: { title: string; subject: string; className: string }) {
    if (!USE_MOCK) {
      return request<Lesson>('/lessons', {
        method: 'POST',
        body: JSON.stringify({ title, subject, className })
      });
    }

    const newLesson: Lesson = {
      _id: `les_${Date.now()}`,
      teacherId: 'tch_001',
      title: title.trim(),
      subject: subject.trim(),
      className: className.trim(),
      sourceType: null,
      sourceFile: null,
      status: 'draft',
      language: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const lessons = getStoredLessons();
    lessons.unshift(newLesson);
    saveStoredLessons(lessons);

    return newLesson;
  },

  /**
   * POST /api/lessons/:id/source
   */
  async attachSource(lessonId: string, fileOrBlob: File | Blob, sourceType: SourceType) {
    if (!USE_MOCK) {
      const formData = new FormData();
      formData.append('file', fileOrBlob);
      formData.append('sourceType', sourceType);
      return request<{ success: boolean; sourceFile: SourceFile }>(`/lessons/${lessonId}/source`, {
        method: 'POST',
        body: formData
      });
    }

    const lessons = getStoredLessons();
    const lessonIndex = lessons.findIndex((l) => l._id === lessonId);
    if (lessonIndex === -1) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    const fileName = (fileOrBlob as File).name || (sourceType === 'audio' ? 'recording.webm' : 'source-document.pdf');
    const mimeType = fileOrBlob.type || (sourceType === 'audio' ? 'audio/webm' : 'application/pdf');
    const sizeBytes = fileOrBlob.size || 5200000;

    const sourceFile: SourceFile = {
      path: `/uploads/${lessonId}_${fileName}`,
      mimeType,
      sizeBytes,
      durationSec: sourceType === 'audio' ? 1440 : undefined
    };

    lessons[lessonIndex].sourceType = sourceType;
    lessons[lessonIndex].sourceFile = sourceFile;
    lessons[lessonIndex].updatedAt = new Date().toISOString();
    saveStoredLessons(lessons);

    return { success: true, sourceFile };
  },

  /**
   * POST /api/lessons/:id/generate
   */
  async generate(lessonId: string) {
    if (!USE_MOCK) {
      return request<{ status: number; jobId: string; message: string }>(`/lessons/${lessonId}/generate`, {
        method: 'POST'
      });
    }

    const lessons = getStoredLessons();
    const lesson = lessons.find((l) => l._id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    lesson.status = 'queued';
    lesson.updatedAt = new Date().toISOString();
    saveStoredLessons(lessons);

    const timestamps = getStoredTimestamps();
    timestamps[lessonId] = Date.now();
    saveStoredTimestamps(timestamps);

    const questionsMap = getStoredQuestions();
    const existing = questionsMap[lessonId] || [];
    const approvedExisting = existing.filter((q) => q.status === 'approved');

    const freshDrafts: Question[] = [
      {
        _id: `q_${lessonId}_${Date.now()}_1`,
        lessonId,
        type: 'mcq',
        stem: `Key foundational principle of ${lesson.title}: Which statement accurately expresses the core theorem?`,
        options: [
          'It applies only under reversible thermodynamic equilibrium conditions',
          'It directly relates input energy transformations to conserved output parameters',
          'It is independent of boundary conditions and thermal dissipation',
          'It assumes constant instantaneous potential difference'
        ],
        correctIndex: 1,
        correctText: 'It directly relates input energy transformations to conserved output parameters',
        explanation: 'The fundamental theorem establishes the conservation relationship across defined boundary states as presented in the lecture.',
        topicTag: lesson.subject || 'Core Concepts',
        difficulty: 'medium',
        status: 'draft',
        sourceCitation: `Transcript (08:14): "Notice that in this model, every Joule invested in the input phase is systematically accounted for at the terminal boundaries."`,
        editedByTeacher: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: `q_${lessonId}_${Date.now()}_2`,
        lessonId,
        type: 'mcq',
        stem: `Under what conditions is the operational efficiency maximized according to the lesson material?`,
        options: [
          'When internal impedance is precisely matched to load resistance',
          'When ambient temperature exceeds the critical phase limit',
          'During rapid transient fluctuations without feedback damping',
          'When operating in a purely open-loop cycle'
        ],
        correctIndex: 0,
        correctText: 'When internal impedance is precisely matched to load resistance',
        explanation: 'Maximized transfer occurs at conjugate impedance matching, mitigating destructive reflection losses.',
        topicTag: 'System Dynamics',
        difficulty: 'hard',
        status: 'draft',
        sourceCitation: `Transcript (19:42): "We demonstrated on the chalkboard that impedance matching eliminates back-reflection, delivering maximum usable power."`,
        editedByTeacher: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: `q_${lessonId}_${Date.now()}_3`,
        lessonId,
        type: 'truefalse',
        stem: 'The observed phenomenon requires continuous external intervention once the critical threshold is surpassed.',
        options: ['True', 'False'],
        correctIndex: 1,
        correctText: 'False',
        explanation: 'Once past the activation threshold, the reaction or process becomes self-sustaining as detailed in the lesson.',
        topicTag: 'Kinetics & Thresholds',
        difficulty: 'easy',
        status: 'draft',
        sourceCitation: `Transcript (27:50): "Once that critical threshold is crossed, no external pump is needed—it sustains itself through positive feedback."`,
        editedByTeacher: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: `q_${lessonId}_${Date.now()}_4`,
        lessonId,
        type: 'short',
        stem: 'Define the governing mechanism responsible for the primary transition in this process.',
        options: [],
        correctText: 'Feedback-regulated phase transition governed by conservation laws.',
        explanation: 'The transition mechanism operates through equilibrium shifts dictated by external gradient pressures.',
        topicTag: 'Mechanisms',
        difficulty: 'medium',
        status: 'draft',
        sourceCitation: `Transcript (34:10): "The governing mechanism is simple: pressure gradient shifts cause the molecular configuration to restructure."`,
        editedByTeacher: false,
        createdAt: new Date().toISOString()
      }
    ];

    questionsMap[lessonId] = [...approvedExisting, ...freshDrafts];
    saveStoredQuestions(questionsMap);

    const asgMap = getStoredAssignments();
    asgMap[lessonId] = asgMap[lessonId] || {
      _id: `asg_${lessonId}`,
      lessonId,
      prompt: `Synthesize the main conclusions regarding ${lesson.title}. Prepare a 250-word structured analysis contrasting experimental predictions with observed results from the discussion.`,
      estimatedMinutes: 35,
      rubric: [
        {
          criterion: 'Conceptual Depth & Accuracy',
          marks: 10,
          descriptor: 'Applies all core terms correctly and accurately reconstructs the central theoretical argument.'
        },
        {
          criterion: 'Evidence-based Synthesis',
          marks: 10,
          descriptor: 'Directly references case examples and empirical constraints discussed during class.'
        },
        {
          criterion: 'Structure & Academic Rigor',
          marks: 5,
          descriptor: 'Logically organized with clear thesis, supportive paragraphs, and precise formatting.'
        }
      ],
      status: 'draft'
    };
    saveStoredAssignments(asgMap);

    return {
      status: 202,
      jobId: `job_${Date.now()}`,
      message: 'Generation job enqueued'
    };
  },

  /**
   * GET /api/lessons/:id
   */
  async getLesson(lessonId: string): Promise<Lesson> {
    if (!USE_MOCK) {
      return request<Lesson>(`/lessons/${lessonId}`);
    }

    const lessons = getStoredLessons();
    const lesson = lessons.find((l) => l._id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    const processingStages: LessonStatus[] = ['queued', 'transcribing', 'generating', 'validating'];
    const timestamps = getStoredTimestamps();
    const startTime = timestamps[lessonId];

    if (processingStages.includes(lesson.status) && startTime) {
      const elapsedMs = Date.now() - startTime;

      let currentStage: LessonStatus = 'queued';
      for (const item of STAGE_SCHEDULE) {
        if (elapsedMs >= item.thresholdMs) {
          currentStage = item.stage;
        }
      }

      if (lesson.status !== currentStage) {
        lesson.status = currentStage;
        lesson.updatedAt = new Date().toISOString();
        saveStoredLessons(lessons);
      }
    }

    return {
      ...lesson,
      timings: {
        startedAt: timestamps[lessonId] || lesson.createdAt,
        elapsedSec: timestamps[lessonId] ? Math.floor((Date.now() - timestamps[lessonId]) / 1000) : 0
      }
    };
  },

  /**
   * GET /api/lessons/:id/questions
   */
  async getLessonQuestions(lessonId: string): Promise<{ lessonId: string; questions: Question[]; assignment: Assignment | null }> {
    if (!USE_MOCK) {
      return request<{ lessonId: string; questions: Question[]; assignment: Assignment | null }>(`/lessons/${lessonId}/questions`);
    }

    const questionsMap = getStoredQuestions();
    const questions = questionsMap[lessonId] || [];
    const asgMap = getStoredAssignments();
    const assignment = asgMap[lessonId] || null;

    return {
      lessonId,
      questions,
      assignment
    };
  },

  /**
   * PATCH /api/questions/:id
   */
  async updateQuestion(questionId: string, updates: Partial<Question>): Promise<Question> {
    if (!USE_MOCK) {
      return request<Question>(`/questions/${questionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    }

    const questionsMap = getStoredQuestions();
    let foundQuestion: Question | null = null;

    for (const lId in questionsMap) {
      const qIndex = questionsMap[lId].findIndex((q) => q._id === questionId);
      if (qIndex !== -1) {
        questionsMap[lId][qIndex] = {
          ...questionsMap[lId][qIndex],
          ...updates,
          editedByTeacher: true
        };
        foundQuestion = questionsMap[lId][qIndex];
        break;
      }
    }

    if (!foundQuestion) {
      throw new Error(`Question ${questionId} not found`);
    }

    saveStoredQuestions(questionsMap);
    return foundQuestion;
  },

  /**
   * POST /api/questions/:id/approve
   */
  async approveQuestion(idOrIds: string | string[]): Promise<{ success: boolean; approvedCount: number }> {
    if (!USE_MOCK) {
      return request<{ success: boolean; approvedCount: number }>('/questions/approve', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.isArray(idOrIds) ? idOrIds : [idOrIds] })
      });
    }

    const idsToApprove = new Set(Array.isArray(idOrIds) ? idOrIds : [idOrIds]);
    const questionsMap = getStoredQuestions();
    let updatedCount = 0;

    for (const lId in questionsMap) {
      questionsMap[lId] = questionsMap[lId].map((q) => {
        if (idsToApprove.has(q._id)) {
          updatedCount++;
          return { ...q, status: 'approved' };
        }
        return q;
      });
    }

    saveStoredQuestions(questionsMap);
    return { success: true, approvedCount: updatedCount };
  },

  /**
   * POST /api/questions/:id/reject
   */
  async rejectQuestion(questionId: string): Promise<Question> {
    if (!USE_MOCK) {
      return request<Question>(`/questions/${questionId}/reject`, {
        method: 'POST'
      });
    }

    const questionsMap = getStoredQuestions();
    let foundQuestion: Question | null = null;

    for (const lId in questionsMap) {
      const qIndex = questionsMap[lId].findIndex((q) => q._id === questionId);
      if (qIndex !== -1) {
        questionsMap[lId][qIndex].status = 'rejected';
        foundQuestion = questionsMap[lId][qIndex];
        break;
      }
    }

    if (!foundQuestion) {
      throw new Error(`Question ${questionId} not found`);
    }

    saveStoredQuestions(questionsMap);
    return foundQuestion;
  },

  /**
   * Update assignment
   */
  async updateAssignment(lessonId: string, updates: Partial<Assignment>): Promise<Assignment> {
    if (!USE_MOCK) {
      return request<Assignment>(`/lessons/${lessonId}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    }

    const asgMap = getStoredAssignments();
    if (!asgMap[lessonId]) {
      throw new Error(`Assignment for lesson ${lessonId} not found`);
    }

    asgMap[lessonId] = {
      ...asgMap[lessonId],
      ...updates
    };
    saveStoredAssignments(asgMap);
    return asgMap[lessonId];
  },

  /**
   * POST /api/lessons/:id/regenerate
   */
  async regenerate(lessonId: string) {
    if (!USE_MOCK) {
      return request<{ status: number; jobId: string; message: string }>(`/lessons/${lessonId}/regenerate`, {
        method: 'POST'
      });
    }
    return this.generate(lessonId);
  },

  /**
   * POST /api/lessons/:id/publish
   * Hard 409 gate if zero approved questions!
   */
  async publishLesson(lessonId: string): Promise<{ success: boolean; lessonId: string; publishedAt: string; approvedQuestionsCount: number }> {
    if (!USE_MOCK) {
      return request<{ success: boolean; lessonId: string; publishedAt: string; approvedQuestionsCount: number }>(`/lessons/${lessonId}/publish`, {
        method: 'POST'
      });
    }

    const questionsMap = getStoredQuestions();
    const questions = questionsMap[lessonId] || [];
    const approvedQuestions = questions.filter((q) => q.status === 'approved');

    if (approvedQuestions.length === 0) {
      const error: any = new Error(
        'Cannot publish lesson: At least one question must be approved by the teacher before publishing to students.'
      );
      error.status = 409;
      error.data = {
        statusCode: 409,
        error: 'Conflict',
        message: 'Cannot publish lesson: At least one question must be approved by the teacher before publishing to students.'
      };
      throw error;
    }

    const lessons = getStoredLessons();
    const lesson = lessons.find((l) => l._id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    lesson.status = 'published';
    lesson.updatedAt = new Date().toISOString();
    saveStoredLessons(lessons);

    return {
      success: true,
      lessonId,
      publishedAt: new Date().toISOString(),
      approvedQuestionsCount: approvedQuestions.length
    };
  }
};
