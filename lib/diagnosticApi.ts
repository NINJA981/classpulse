/**
 * Unified API module for Student Portal:
 * - Join a Section (preview, roll number, OTP, enrollment)
 * - Guardian Link (add, list, revoke)
 * - Baseline Diagnostic (self-check evaluation)
 * - Course Content (real assignments, quizzes, tests, metrics)
 */

import {
  ApiError as BackendApiError,
  clearToken,
  isSignedIn,
  request,
  setToken,
} from "./apiClient";

export type SectionPreview = {
  code: string;
  courseTitle: string;
  teacherName: string;
  institutionName: string;
  isExpired?: boolean;
};

export type JoinEnrollmentPayload = {
  code: string;
  rollNumber: string;
};

export type JoinEnrollmentResponse = {
  success: boolean;
  enrollmentId: string;
  sectionCode?: string;
  courseTitle: string;
  rollNumber: string;
  alreadyEnrolled: boolean;
  teacherName: string;
  institutionName: string;
};

export type CourseAssignment = {
  id: string | number;
  title: string;
  subject: string;
  due: string;
  status: "Pending" | "Submitted";
  prompt?: string;
  rubric?: Array<{ criterion: string; marks: number; descriptor: string }>;
  estimatedMinutes?: number;
  fileName?: string;
  comment?: string;
};

export type CourseTest = {
  id: string | number;
  title: string;
  subject: string;
  date: string;
  time: string;
  duration: string;
  status: "Upcoming" | "Completed";
};

export type CourseQuiz = {
  id: string | number;
  title: string;
  subject: string;
  created_by: string | null;
};

export type CourseUpcomingItem = {
  id: string;
  type: "Assignment" | "Test" | "Live Quiz";
  title: string;
  subject: string;
  date: string;
  statusPill: string;
  statusPillVariant: "yellow" | "sky" | "dark";
  rowVariant: "yellow" | "white" | "mint";
  actionHref: string;
  actionLabel: string;
};

export type CourseContent = {
  code: string;
  courseTitle: string;
  subject: string;
  teacherName: string;
  institutionName: string;
  assignments: CourseAssignment[];
  tests: CourseTest[];
  quizzes: CourseQuiz[];
  upcoming: CourseUpcomingItem[];
  stats: {
    assignmentsTotal: number;
    assignmentsPending: number;
    testsTotal: number;
    testsUpcoming: number;
    quizzesTotal: number;
    quizzesDueSoon: number;
  };
};

export type OtpRequestResponse = {
  success: boolean;
  expiresInSeconds: number;
  message: string;
  demoOtp: string;
};

export type OtpVerifyResponse = {
  success: boolean;
  attemptsLeft: number;
  isLocked: boolean;
  token?: string;
  message?: string;
};

export type UserProfile = {
  name: string;
  registerNumber: string;
  email: string;
  language: string;
  rollNumber?: string;
  activeCourseId?: string;
  activeCourseTitle?: string;
  institutionName?: string;
  isLoggedIn?: boolean;
};

export type GuardianStatus = "pending" | "active" | "revoked";

export type Guardian = {
  id: string;
  name: string;
  phone: string;
  status: GuardianStatus;
  createdAt: string;
};

type BackendSectionPreview = {
  code: string;
  courseTitle: string;
  teacherName: string;
  institutionName: string;
  sectionName: string;
  isExpired: boolean;
};

type BackendStudent = {
  id: string;
  institutionId: string;
  name: string;
  email?: string;
  rollNumber: string;
  createdAt: string;
};

type BackendEnrollment = {
  id: string;
  studentId: string;
  sectionId: string;
  courseId: string;
  courseTitle: string;
  sectionName: string;
  rollNumber: string;
  enrolledAt: string;
};

type BackendGuardian = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email?: string;
  verified: boolean;
  createdAt: string;
};

const EMPTY_PROFILE: UserProfile = {
  name: "",
  registerNumber: "",
  email: "",
  language: "English",
  rollNumber: "",
  institutionName: "",
  isLoggedIn: false,
};

function toSectionPreview(section: BackendSectionPreview): SectionPreview {
  return {
    code: section.code,
    courseTitle: section.courseTitle,
    teacherName: section.teacherName,
    institutionName: section.institutionName,
    isExpired: section.isExpired,
  };
}

function toUserProfile(student: BackendStudent): UserProfile {
  return {
    name: student.name,
    registerNumber: student.rollNumber,
    rollNumber: student.rollNumber,
    email: student.email ?? "",
    language: "English",
    isLoggedIn: true,
  };
}

function toGuardian(guardian: BackendGuardian): Guardian {
  return {
    id: guardian.id,
    name: guardian.name,
    phone: guardian.phone,
    status: guardian.verified ? "active" : "pending",
    createdAt: new Date(guardian.createdAt).toLocaleDateString(),
  };
}

export type DiagnosticQuestion = {
  questionId: string;
  prompt: string;
  options: string[];
  index: number;
  total: number;
};

export type DiagnosticAnswerPayload = {
  questionId: string;
  answer: string;
  confidence: string;
};

export type DiagnosticCompleteResponse = {
  summaryText: string;
  completedAt: string;
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type StoredDiagnostic = {
  answers: Record<string, { answer: string; confidence: string }>;
  currentStep: number;
  completed: boolean;
  summaryText: string;
  skipped: boolean;
};

type StoredOtpState = {
  demoOtp: string;
  attemptsLeft: number;
  isLocked: boolean;
  requestedAt?: number;
  expiresInSeconds?: number;
};

const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    questionId: "dq-1",
    prompt: "What is the limit of (sin x) / x as x approaches 0?",
    options: ["0", "1", "Does not exist", "Infinity"],
    index: 1,
    total: 4,
  },
  {
    questionId: "dq-2",
    prompt: "What is the derivative of f(x) = ln(3x^2 + 1) with respect to x?",
    options: ["6x / (3x^2 + 1)", "1 / (3x^2 + 1)", "6x ln(3x^2 + 1)", "3x / (3x^2 + 1)"],
    index: 2,
    total: 4,
  },
  {
    questionId: "dq-3",
    prompt: "If matrix A is 2x3 and matrix B is 3x4, what are the dimensions of product AB?",
    options: ["3x3", "2x4", "4x2", "Matrix multiplication is undefined"],
    index: 3,
    total: 4,
  },
  {
    questionId: "dq-4",
    prompt: "Which of the following vectors is orthogonal to [1, 2, -1]?",
    options: ["[2, 1, 4]", "[2, -1, 0]", "[1, 1, 1]", "[3, 0, 1]"],
    index: 4,
    total: 4,
  },
];

function fakeDelay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Local Storage Keys
const LS_ENROLLMENT = "cp_student_enrollment";
const LS_PROFILE = "cp_student_profile";
const LS_DIAGNOSTIC = "cp_student_diagnostic";
const LS_OTP_STATE = "cp_student_otp_state";
const LS_COURSE_CONTENT = "cp_student_course_content";

const memoryStore = new Map<string, unknown>();

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window !== "undefined") {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }
  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T;
  }
  return fallback;
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage write error", e);
    }
  }
  memoryStore.set(key, value);
}

// ==========================================
// API Implementation
// ==========================================

export const diagnosticApi = {
  /** Every section this student has joined. */
  async listEnrollments(): Promise<
    Array<JoinEnrollmentResponse & { sectionId: string; courseId: string }>
  > {
    if (!isSignedIn()) return [];
    const { items } = await request<{ items: BackendEnrollment[] }>("/student/enrollments");
    return items.map((e) => ({
      success: true,
      enrollmentId: e.id,
      sectionCode: e.sectionName,
      courseTitle: e.courseTitle,
      rollNumber: e.rollNumber,
      alreadyEnrolled: true,
      teacherName: "",
      institutionName: "",
      sectionId: e.sectionId,
      courseId: e.courseId,
    }));
  },

  async getSectionPreview(code: string): Promise<SectionPreview> {
    const { section } = await request<{ section: BackendSectionPreview }>(
      `/student/sections/${encodeURIComponent(code.trim().toUpperCase())}`
    );
    if (section.isExpired) {
      throw new ApiError(
        "This code has expired, ask your teacher for a new one.",
        410,
        "CODE_EXPIRED"
      );
    }
    return toSectionPreview(section);
  },

  /**
   * GET /api/student/sections
   * Returns all active sections available for the student to select and join.
   */
  async getAvailableSections(): Promise<SectionPreview[]> {
    try {
      const { items } = await request<{ items: BackendSectionPreview[] }>("/student/sections");
      return items.map(toSectionPreview);
    } catch {
      return [];
    }
  },

  /**
   * POST /api/student/enrollments
   * Enrolls student in class.
   */
  async joinEnrollment(payload: JoinEnrollmentPayload): Promise<JoinEnrollmentResponse> {
    const code = payload.code.trim().toUpperCase();
    const roll = payload.rollNumber.trim();
    try {
      const { enrollment } = await request<{ enrollment: BackendEnrollment }>(
        "/student/enrollments",
        {
          method: "POST",
          body: JSON.stringify({
            code,
            rollNumber: roll,
          }),
        }
      );
      const profile = await this.getMe();
      const res: JoinEnrollmentResponse = {
        success: true,
        enrollmentId: enrollment.id,
        sectionCode: code,
        courseTitle: enrollment.courseTitle,
        rollNumber: enrollment.rollNumber,
        alreadyEnrolled: false,
        teacherName: "",
        institutionName: profile.institutionName ?? "",
      };
      setStorage(LS_ENROLLMENT, res);
      void this.fetchCourseContent();
      return res;
    } catch (err) {
      if (err instanceof BackendApiError && err.status === 409) {
        const enrollments = await this.listEnrollments();
        const existing = enrollments.find((e) => e.sectionCode === code) || enrollments[0];
        const res: JoinEnrollmentResponse = {
          success: true,
          enrollmentId: existing?.enrollmentId ?? "",
          sectionCode: code,
          courseTitle: existing?.courseTitle ?? "",
          rollNumber: roll || existing?.rollNumber || "",
          alreadyEnrolled: true,
          teacherName: "",
          institutionName: existing?.institutionName ?? "",
        };
        setStorage(LS_ENROLLMENT, res);
        void this.fetchCourseContent();
        return res;
      }
      throw err;
    }
  },

  /**
   * POST /api/student/auth/request-otp
   */
  async requestOtp(_identifier?: string): Promise<OtpRequestResponse> {
    const identifier = (_identifier ?? "").trim();
    if (!identifier) throw new ApiError("Enter your mobile number.", 400);

    const res = await request<{ sent: boolean; devOtp?: string; expiresInSec: number }>(
      "/student/auth/request-otp",
      { method: "POST", body: JSON.stringify({ phone: identifier }) }
    );

    setStorage(LS_OTP_STATE, {
      demoOtp: res.devOtp ?? "",
      attemptsLeft: 5,
      isLocked: false,
      requestedAt: Date.now(),
      expiresInSeconds: res.expiresInSec,
      phone: identifier,
    });

    return {
      success: res.sent,
      expiresInSeconds: res.expiresInSec,
      message: "6-digit passcode sent to your mobile number.",
      demoOtp: res.devOtp ?? "",
    };
  },

  /**
   * POST /api/student/auth/verify-otp
   */
  async verifyOtp(otp: string, name?: string): Promise<OtpVerifyResponse> {
    const pending = getStorage<StoredOtpState & { phone?: string }>(LS_OTP_STATE, {
      demoOtp: "",
      attemptsLeft: 5,
      isLocked: false,
    });

    if (!pending.phone) {
      return { success: false, attemptsLeft: 5, isLocked: false, message: "Request a passcode first." };
    }

    try {
      const res = await request<{ token: string; student: BackendStudent; enrollments?: BackendEnrollment[] }>(
        "/student/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone: pending.phone, otp: otp.trim(), name }),
        }
      );

      setToken(res.token);
      setStorage(LS_PROFILE, toUserProfile(res.student));
      setStorage(LS_OTP_STATE, { ...pending, attemptsLeft: 5, isLocked: false });

      if (res.enrollments && res.enrollments.length > 0) {
        const enr = res.enrollments[0];
        setStorage(LS_ENROLLMENT, {
          success: true,
          enrollmentId: enr.id,
          sectionCode: enr.sectionName,
          courseTitle: enr.courseTitle,
          rollNumber: enr.rollNumber || res.student.rollNumber,
          alreadyEnrolled: true,
          teacherName: "",
          institutionName: "",
        });
      }

      void this.fetchCourseContent();
      return { success: true, attemptsLeft: 5, isLocked: false, token: res.token };
    } catch (err) {
      const attemptsLeft = Math.max(0, (pending.attemptsLeft ?? 5) - 1);
      const locked = err instanceof BackendApiError && err.status === 429;
      setStorage(LS_OTP_STATE, { ...pending, attemptsLeft, isLocked: locked });
      return {
        success: false,
        attemptsLeft,
        isLocked: locked,
        message:
          err instanceof BackendApiError ? err.message : "That passcode is wrong or has expired.",
      };
    }
  },

  /**
   * POST /api/student/auth/login
   */
  async login(registerNumber: string, password: string): Promise<UserProfile> {
    const cleanReg = (registerNumber || "").trim().toUpperCase();
    if (!cleanReg) {
      throw new ApiError("Please enter your Register or Roll number.", 400);
    }
    if (!password || !password.trim()) {
      throw new ApiError("Please enter your password.", 400);
    }

    const auth = await request<{
      token: string;
      student: { id: string; name: string; phone?: string; rollNumber: string };
      enrollments?: BackendEnrollment[];
    }>("/student/auth/login", {
      method: "POST",
      body: JSON.stringify({ register: cleanReg, password }),
    });

    setToken(auth.token);

    const profile: UserProfile = {
      name: auth.student.name,
      registerNumber: auth.student.rollNumber || cleanReg,
      rollNumber: auth.student.rollNumber || cleanReg,
      email: "",
      language: "English",
      institutionName: "",
      isLoggedIn: true,
    };

    setStorage(LS_PROFILE, profile);

    if (auth.enrollments && auth.enrollments.length > 0) {
      const enr = auth.enrollments[0];
      setStorage(LS_ENROLLMENT, {
        success: true,
        enrollmentId: enr.id,
        sectionCode: enr.sectionName,
        courseTitle: enr.courseTitle,
        rollNumber: enr.rollNumber || cleanReg,
        alreadyEnrolled: true,
        teacherName: "",
        institutionName: "",
      });
    }

    void this.fetchCourseContent();
    return profile;
  },

  async logout(): Promise<void> {
    clearToken();
    setStorage(LS_PROFILE, { ...getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE), isLoggedIn: false });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LS_COURSE_CONTENT);
      window.localStorage.removeItem(LS_ENROLLMENT);
    }
  },

  async updateMe(data: Partial<UserProfile>): Promise<UserProfile> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;

    const current = getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE);
    if (Object.keys(patch).length === 0) {
      const merged = { ...current, ...data };
      setStorage(LS_PROFILE, merged);
      return merged;
    }

    try {
      const { student } = await request<{ student: BackendStudent }>("/student/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const merged = { ...toUserProfile(student), language: data.language ?? current.language };
      setStorage(LS_PROFILE, merged);
      return merged;
    } catch {
      const merged = { ...current, ...data };
      setStorage(LS_PROFILE, merged);
      return merged;
    }
  },

  async getMe(): Promise<UserProfile> {
    if (!isSignedIn()) return { ...EMPTY_PROFILE, isLoggedIn: false };

    try {
      const me = await request<{
        student: BackendStudent;
        enrollments: BackendEnrollment[];
      }>("/student/me");

      const current = getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE);
      const profile: UserProfile = {
        ...toUserProfile(me.student),
        language: current.language,
        activeCourseId: me.enrollments[0]?.courseId,
        activeCourseTitle: me.enrollments[0]?.courseTitle,
      };
      setStorage(LS_PROFILE, profile);

      if (me.enrollments && me.enrollments.length > 0) {
        const enr = me.enrollments[0];
        setStorage(LS_ENROLLMENT, {
          success: true,
          enrollmentId: enr.id,
          sectionCode: enr.sectionName,
          courseTitle: enr.courseTitle,
          rollNumber: enr.rollNumber || me.student.rollNumber,
          alreadyEnrolled: true,
          teacherName: "",
          institutionName: profile.institutionName ?? "",
        });
      }

      return profile;
    } catch {
      return getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE);
    }
  },

  async addGuardian(payload: { phone: string; name: string }): Promise<Guardian> {
    const { guardian } = await request<{ guardian: BackendGuardian }>("/student/guardians", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        relation: "guardian",
      }),
    });
    return toGuardian(guardian);
  },

  async getGuardians(): Promise<Guardian[]> {
    if (!isSignedIn()) return [];
    try {
      const { items } = await request<{ items: BackendGuardian[] }>("/student/guardians");
      return items.map(toGuardian);
    } catch {
      return [];
    }
  },

  async deleteGuardian(id: string): Promise<{ success: boolean; id: string }> {
    await request<void>(`/student/guardians/${id}`, { method: "DELETE" });
    return { success: true, id };
  },

  // Baseline Diagnostic helpers
  async getCourseDiagnostic(_courseId: string): Promise<DiagnosticQuestion | null> {
    void _courseId;
    await fakeDelay(100);
    const diagState = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: 0,
      completed: false,
      summaryText: "",
      skipped: false,
    });

    if (diagState.completed || (diagState.currentStep || 0) >= DIAGNOSTIC_QUESTIONS.length) {
      return null;
    }

    return DIAGNOSTIC_QUESTIONS[diagState.currentStep || 0];
  },

  async submitDiagnosticAnswer(
    _courseId: string,
    payload: DiagnosticAnswerPayload
  ): Promise<{ nextQuestion: DiagnosticQuestion | null; completed: boolean }> {
    void _courseId;
    await fakeDelay(100);
    const diagState = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: 0,
      completed: false,
      summaryText: "",
      skipped: false,
    });

    diagState.answers[payload.questionId] = {
      answer: payload.answer,
      confidence: payload.confidence,
    };
    diagState.currentStep = (diagState.currentStep || 0) + 1;

    const isDone = diagState.currentStep >= DIAGNOSTIC_QUESTIONS.length;
    diagState.completed = isDone;

    if (isDone) {
      diagState.summaryText =
        "Baseline evaluation complete. You are ready to start class lesson reviews.";
    }

    setStorage(LS_DIAGNOSTIC, diagState);

    const nextQ = isDone ? null : DIAGNOSTIC_QUESTIONS[diagState.currentStep];
    return {
      nextQuestion: nextQ,
      completed: isDone,
    };
  },

  async completeDiagnostic(_courseId: string): Promise<DiagnosticCompleteResponse> {
    void _courseId;
    await fakeDelay(100);
    const diagState = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: DIAGNOSTIC_QUESTIONS.length,
      completed: true,
      summaryText:
        "Baseline evaluation complete. You are ready to start class lesson reviews.",
      skipped: false,
    });

    diagState.completed = true;
    setStorage(LS_DIAGNOSTIC, diagState);

    return {
      summaryText: diagState.summaryText,
      completedAt: new Date().toLocaleDateString(),
    };
  },

  getDiagnosticState(): {
    completed: boolean;
    skipped: boolean;
    summaryText: string;
  } {
    return getStorage(LS_DIAGNOSTIC, {
      completed: false,
      skipped: false,
      summaryText: "",
    });
  },

  skipDiagnostic(): void {
    const state = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: 0,
      completed: false,
      summaryText: "",
      skipped: false,
    });
    state.skipped = true;
    setStorage(LS_DIAGNOSTIC, state);
  },

  getCurrentEnrollment(): JoinEnrollmentResponse | null {
    return getStorage<JoinEnrollmentResponse | null>(LS_ENROLLMENT, null);
  },

  /**
   * Real Course Content:
   * Fetches real assignments from /student/assignments and quizzes from /student/quizzes.
   */
  async fetchCourseContent(): Promise<CourseContent> {
    const enrollment = this.getCurrentEnrollment();
    let code = enrollment?.sectionCode || "Class";
    let courseTitle = enrollment?.courseTitle || "Coursework";
    let teacherName = enrollment?.teacherName || "";
    let institutionName = enrollment?.institutionName || "";

    if (isSignedIn()) {
      try {
        const [enrRes, secRes] = await Promise.allSettled([
          request<{ items: BackendEnrollment[] }>("/student/enrollments"),
          request<{ items: BackendSectionPreview[] }>("/student/sections"),
        ]);

        if (enrRes.status === "fulfilled" && enrRes.value?.items?.[0]) {
          const first = enrRes.value.items[0];
          courseTitle = first.courseTitle;
          code = first.sectionName;
        }

        if (secRes.status === "fulfilled" && secRes.value?.items) {
          const match = secRes.value.items.find(
            (s) => s.sectionName === code || s.courseTitle === courseTitle
          );
          if (match) {
            teacherName = match.teacherName;
            institutionName = match.institutionName;
          }
        }
      } catch {
        // ignore
      }
    }

    let assignmentsRaw: Array<{
      id: string;
      lessonId: string;
      title: string;
      prompt: string;
      estimatedMinutes: number;
      rubric: Array<{ criterion: string; marks: number; descriptor: string }>;
      status: string;
      subject: string;
      className: string;
      createdAt: string;
      due: string;
    }> = [];

    let quizzesRaw: Array<{
      id: string;
      title: string;
      subject: string;
      className: string;
      questionCount: number;
      publishedAt: string;
      bestScorePct: number | null;
    }> = [];

    if (isSignedIn()) {
      try {
        const [asgRes, qzRes] = await Promise.allSettled([
          request<{ items: typeof assignmentsRaw }>("/student/assignments"),
          request<{ quizzes: typeof quizzesRaw }>("/student/quizzes"),
        ]);

        if (asgRes.status === "fulfilled" && asgRes.value?.items) {
          assignmentsRaw = asgRes.value.items;
        }
        if (qzRes.status === "fulfilled" && qzRes.value?.quizzes) {
          quizzesRaw = qzRes.value.quizzes;
        }
      } catch {
        // ignore
      }
    }

    const storedOverrides = getStorage<
      Record<string, { status: "Pending" | "Submitted"; fileName?: string; comment?: string }>
    >(`cp_assignments_${code}`, {});

    const assignments: CourseAssignment[] = assignmentsRaw.map((a) => {
      const override = storedOverrides[a.id];
      return {
        id: a.id,
        title: a.title,
        subject: a.subject,
        due: a.due || "Pending Review",
        status: override ? override.status : "Pending",
        prompt: a.prompt,
        rubric: a.rubric,
        estimatedMinutes: a.estimatedMinutes,
        fileName: override?.fileName,
        comment: override?.comment,
      };
    });

    const quizzes: CourseQuiz[] = quizzesRaw.map((q) => ({
      id: q.id,
      title: q.title,
      subject: q.subject,
      created_by: q.className,
    }));

    const tests: CourseTest[] = quizzesRaw.map((q) => ({
      id: q.id,
      title: `${q.title} Evaluation`,
      subject: q.subject,
      date: new Date(q.publishedAt).toLocaleDateString(),
      time: "Self-Paced",
      duration: `${q.questionCount * 3} mins`,
      status: q.bestScorePct != null ? "Completed" : "Upcoming",
    }));

    const upcoming: CourseUpcomingItem[] = [
      ...assignments
        .filter((a) => a.status === "Pending")
        .map((a) => ({
          id: `up-asg-${a.id}`,
          type: "Assignment" as const,
          title: a.title,
          subject: a.subject,
          date: `Due: ${a.due}`,
          statusPill: "Pending",
          statusPillVariant: "yellow" as const,
          rowVariant: "yellow" as const,
          actionHref: "/assignments",
          actionLabel: "Open",
        })),
      ...quizzesRaw
        .filter((q) => q.bestScorePct == null)
        .map((q) => ({
          id: `up-quiz-${q.id}`,
          type: "Live Quiz" as const,
          title: q.title,
          subject: q.subject,
          date: new Date(q.publishedAt).toLocaleDateString(),
          statusPill: "Live Quiz",
          statusPillVariant: "dark" as const,
          rowVariant: "mint" as const,
          actionHref: `/quizzes/lesson/${q.id}`,
          actionLabel: "Attempt",
        })),
    ];

    const content: CourseContent = {
      code,
      courseTitle,
      subject: courseTitle,
      teacherName: teacherName || "Faculty",
      institutionName: institutionName || "ClasePulse",
      assignments,
      tests,
      quizzes,
      upcoming,
      stats: {
        assignmentsTotal: assignments.length,
        assignmentsPending: assignments.filter((a) => a.status === "Pending").length,
        testsTotal: tests.length,
        testsUpcoming: tests.filter((t) => t.status === "Upcoming").length,
        quizzesTotal: quizzes.length,
        quizzesDueSoon: quizzesRaw.filter((q) => q.bestScorePct == null).length,
      },
    };

    setStorage(LS_COURSE_CONTENT, content);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }

    return content;
  },

  /**
   * Get cached or initial course content synchronously
   */
  getCourseContent(sectionCodeOrTitle?: string): CourseContent {
    void sectionCodeOrTitle;
    const cached = getStorage<CourseContent | null>(LS_COURSE_CONTENT, null);
    if (cached) return cached;

    const enrollment = this.getCurrentEnrollment();
    return {
      code: enrollment?.sectionCode || "Section",
      courseTitle: enrollment?.courseTitle || "Active Coursework",
      subject: enrollment?.courseTitle || "Coursework",
      teacherName: enrollment?.teacherName || "Faculty",
      institutionName: enrollment?.institutionName || "ClasePulse",
      assignments: [],
      tests: [],
      quizzes: [],
      upcoming: [],
      stats: {
        assignmentsTotal: 0,
        assignmentsPending: 0,
        testsTotal: 0,
        testsUpcoming: 0,
        quizzesTotal: 0,
        quizzesDueSoon: 0,
      },
    };
  },

  submitAssignment(assignmentId: string | number, fileName: string, comment?: string): void {
    const current = this.getCourseContent();
    const storedOverrides = getStorage<
      Record<string, { status: "Pending" | "Submitted"; fileName?: string; comment?: string }>
    >(`cp_assignments_${current.code}`, {});

    storedOverrides[String(assignmentId)] = {
      status: "Submitted",
      fileName,
      comment,
    };
    setStorage(`cp_assignments_${current.code}`, storedOverrides);

    const updatedAssignments = current.assignments.map((a) =>
      String(a.id) === String(assignmentId)
        ? { ...a, status: "Submitted" as const, fileName, comment }
        : a
    );
    const updatedPending = updatedAssignments.filter((a) => a.status === "Pending").length;
    const updatedContent: CourseContent = {
      ...current,
      assignments: updatedAssignments,
      stats: {
        ...current.stats,
        assignmentsPending: updatedPending,
      },
    };
    setStorage(LS_COURSE_CONTENT, updatedContent);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
  },

  resetMockData(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LS_ENROLLMENT);
    window.localStorage.removeItem(LS_PROFILE);
    window.localStorage.removeItem(LS_DIAGNOSTIC);
    window.localStorage.removeItem(LS_OTP_STATE);
    window.localStorage.removeItem(LS_COURSE_CONTENT);
  },
};

// Named exports matching common utility imports
export const getSectionPreview = diagnosticApi.getSectionPreview.bind(diagnosticApi);
export const getAvailableSections = diagnosticApi.getAvailableSections.bind(diagnosticApi);
export const joinEnrollment = diagnosticApi.joinEnrollment.bind(diagnosticApi);
export const requestOtp = diagnosticApi.requestOtp.bind(diagnosticApi);
export const verifyOtp = diagnosticApi.verifyOtp.bind(diagnosticApi);
export const updateMe = diagnosticApi.updateMe.bind(diagnosticApi);
export const getMe = diagnosticApi.getMe.bind(diagnosticApi);
export const login = diagnosticApi.login.bind(diagnosticApi);
export const logout = diagnosticApi.logout.bind(diagnosticApi);
export const addGuardian = diagnosticApi.addGuardian.bind(diagnosticApi);
export const getGuardians = diagnosticApi.getGuardians.bind(diagnosticApi);
export const deleteGuardian = diagnosticApi.deleteGuardian.bind(diagnosticApi);
export const getCourseDiagnostic = diagnosticApi.getCourseDiagnostic.bind(diagnosticApi);
export const submitDiagnosticAnswer = diagnosticApi.submitDiagnosticAnswer.bind(diagnosticApi);
export const completeDiagnostic = diagnosticApi.completeDiagnostic.bind(diagnosticApi);
export const getCourseContent = diagnosticApi.getCourseContent.bind(diagnosticApi);
export const fetchCourseContent = diagnosticApi.fetchCourseContent.bind(diagnosticApi);
export const submitAssignment = diagnosticApi.submitAssignment.bind(diagnosticApi);
