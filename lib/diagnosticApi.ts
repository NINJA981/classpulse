/**
 * Unified mock API module for Phase A flows:
 * - Join a Section (preview, roll number, OTP, enrollment)
 * - Guardian Link (add, list, revoke)
 * - Baseline Diagnostic (questions, confidence submission, qualitative completion)
 *
 * Simulates real REST endpoints with fake network latency (~300ms).
 * Swap the internal implementation with real fetch/supabase calls later
 * without modifying any component-level code.
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
  id: number;
  title: string;
  subject: string;
  due: string;
  status: "Pending" | "Submitted";
  fileName?: string;
  comment?: string;
};

export type CourseTest = {
  id: number;
  title: string;
  subject: string;
  date: string;
  time: string;
  duration: string;
  status: "Upcoming" | "Completed";
};

export type CourseQuiz = {
  id: number;
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

// --- what SIH-backend actually returns, and the mapping onto the types above -------------
// The API speaks its own shapes; the components were written against the ones in this file,
// so the translation lives here rather than in every page.

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
    // This app shows a register number; the API calls the same thing a roll number.
    registerNumber: student.rollNumber,
    rollNumber: student.rollNumber,
    email: student.email ?? "",
    language: "English",
    isLoggedIn: true,
  };
}

/** The API tracks a guardian as verified or not; this app shows three pill states. */
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

// ==========================================
// Mock Data Presets
// ==========================================

export const INSTITUTION_NAME = "National Institute of Technology";

const MOCK_SECTIONS: Record<string, SectionPreview> = {
  MATH10: {
    code: "MATH10",
    courseTitle: "Advanced Calculus & Linear Algebra",
    teacherName: "Dr. Aris Thorne",
    institutionName: INSTITUTION_NAME,
  },
  PHY201: {
    code: "PHY201",
    courseTitle: "Quantum Mechanics & Wave Optics",
    teacherName: "Prof. Sunita Rao",
    institutionName: INSTITUTION_NAME,
  },
  CS101A: {
    code: "CS101A",
    courseTitle: "Data Structures & Modern Algorithms",
    teacherName: "Dr. Vikram Seth",
    institutionName: INSTITUTION_NAME,
  },
  ENR999: {
    code: "ENR999",
    courseTitle: "Mathematics II (Foundation Calculus)",
    teacherName: "Prof. Anand Verma",
    institutionName: INSTITUTION_NAME,
  },
  EXP100: {
    code: "EXP100",
    courseTitle: "Introductory Robotics",
    teacherName: "Dr. Clara Oswald",
    institutionName: INSTITUTION_NAME,
    isExpired: true,
  },
};

const MOCK_COURSE_DATA: Record<string, Omit<CourseContent, "stats">> = {
  MATH10: {
    code: "MATH10",
    courseTitle: "Advanced Calculus & Linear Algebra",
    subject: "Calculus & Linear Algebra",
    teacherName: "Dr. Aris Thorne",
    institutionName: INSTITUTION_NAME,
    assignments: [
      {
        id: 101,
        title: "Multivariable Limits & Continuity",
        subject: "Calculus & Linear Algebra",
        due: "August 28",
        status: "Pending",
      },
      {
        id: 102,
        title: "Eigenvalues & Matrix Diagonalization",
        subject: "Calculus & Linear Algebra",
        due: "September 02",
        status: "Pending",
      },
      {
        id: 103,
        title: "Vector Fields & Green's Theorem",
        subject: "Calculus & Linear Algebra",
        due: "August 18",
        status: "Submitted",
        fileName: "vector-fields-sol.pdf",
      },
    ],
    tests: [
      {
        id: 201,
        title: "Calculus Midterm Examination",
        subject: "Calculus & Linear Algebra",
        date: "August 30",
        time: "10:00 AM",
        duration: "60 minutes",
        status: "Upcoming",
      },
      {
        id: 202,
        title: "Linear Algebra Unit Test",
        subject: "Calculus & Linear Algebra",
        date: "September 10",
        time: "02:00 PM",
        duration: "45 minutes",
        status: "Upcoming",
      },
      {
        id: 203,
        title: "Differential Equations Diagnostic",
        subject: "Calculus & Linear Algebra",
        date: "August 15",
        time: "11:00 AM",
        duration: "45 minutes",
        status: "Completed",
      },
    ],
    quizzes: [
      {
        id: 301,
        title: "Vector Spaces & Subspaces Sprint",
        subject: "Calculus & Linear Algebra",
        created_by: "Dr. Aris Thorne",
      },
      {
        id: 302,
        title: "Partial Derivatives Diagnostic Quiz",
        subject: "Calculus & Linear Algebra",
        created_by: "Dr. Aris Thorne",
      },
      {
        id: 303,
        title: "Determinants & Matrix Inversion",
        subject: "Calculus & Linear Algebra",
        created_by: "Dr. Aris Thorne",
      },
    ],
    upcoming: [
      {
        id: "up-m1",
        type: "Assignment",
        title: "Multivariable Limits & Continuity",
        subject: "Calculus & Linear Algebra",
        date: "Due August 28",
        statusPill: "Pending",
        statusPillVariant: "yellow",
        rowVariant: "yellow",
        actionHref: "/assignments",
        actionLabel: "Open",
      },
      {
        id: "up-m2",
        type: "Test",
        title: "Calculus Midterm Examination",
        subject: "Calculus & Linear Algebra",
        date: "August 30",
        statusPill: "Upcoming",
        statusPillVariant: "sky",
        rowVariant: "white",
        actionHref: "/tests",
        actionLabel: "View",
      },
      {
        id: "up-m3",
        type: "Live Quiz",
        title: "Vector Spaces & Subspaces Sprint",
        subject: "Calculus & Linear Algebra",
        date: "September 01",
        statusPill: "Live Quiz",
        statusPillVariant: "dark",
        rowVariant: "mint",
        actionHref: "/quizzes",
        actionLabel: "Open",
      },
    ],
  },
  PHY201: {
    code: "PHY201",
    courseTitle: "Quantum Mechanics & Wave Optics",
    subject: "Quantum Mechanics & Optics",
    teacherName: "Prof. Sunita Rao",
    institutionName: INSTITUTION_NAME,
    assignments: [
      {
        id: 111,
        title: "Wave-Particle Duality & De Broglie Hypothesis",
        subject: "Quantum Mechanics & Optics",
        due: "August 29",
        status: "Pending",
      },
      {
        id: 112,
        title: "Schrödinger Equation 1D Infinite Well",
        subject: "Quantum Mechanics & Optics",
        due: "September 04",
        status: "Pending",
      },
      {
        id: 113,
        title: "Interference & Diffraction Lab Writeup",
        subject: "Quantum Mechanics & Optics",
        due: "August 20",
        status: "Submitted",
        fileName: "diffraction-lab.pdf",
      },
    ],
    tests: [
      {
        id: 211,
        title: "Quantum Foundations Midterm",
        subject: "Quantum Mechanics & Optics",
        date: "September 01",
        time: "11:30 AM",
        duration: "60 minutes",
        status: "Upcoming",
      },
      {
        id: 212,
        title: "Wave Optics Formal Evaluation",
        subject: "Quantum Mechanics & Optics",
        date: "September 12",
        time: "03:00 PM",
        duration: "50 minutes",
        status: "Upcoming",
      },
      {
        id: 213,
        title: "Classical Mechanics Review Test",
        subject: "Quantum Mechanics & Optics",
        date: "August 16",
        time: "09:30 AM",
        duration: "45 minutes",
        status: "Completed",
      },
    ],
    quizzes: [
      {
        id: 311,
        title: "Photoelectric Effect Live Check",
        subject: "Quantum Mechanics & Optics",
        created_by: "Prof. Sunita Rao",
      },
      {
        id: 312,
        title: "Heisenberg Uncertainty Principle Quiz",
        subject: "Quantum Mechanics & Optics",
        created_by: "Prof. Sunita Rao",
      },
      {
        id: 313,
        title: "Polarization & Wave Packets Blitz",
        subject: "Quantum Mechanics & Optics",
        created_by: "Prof. Sunita Rao",
      },
    ],
    upcoming: [
      {
        id: "up-p1",
        type: "Assignment",
        title: "Wave-Particle Duality & De Broglie Hypothesis",
        subject: "Quantum Mechanics & Optics",
        date: "Due August 29",
        statusPill: "Pending",
        statusPillVariant: "yellow",
        rowVariant: "yellow",
        actionHref: "/assignments",
        actionLabel: "Open",
      },
      {
        id: "up-p2",
        type: "Test",
        title: "Quantum Foundations Midterm",
        subject: "Quantum Mechanics & Optics",
        date: "September 01",
        statusPill: "Upcoming",
        statusPillVariant: "sky",
        rowVariant: "white",
        actionHref: "/tests",
        actionLabel: "View",
      },
      {
        id: "up-p3",
        type: "Live Quiz",
        title: "Photoelectric Effect Live Check",
        subject: "Quantum Mechanics & Optics",
        date: "September 03",
        statusPill: "Live Quiz",
        statusPillVariant: "dark",
        rowVariant: "mint",
        actionHref: "/quizzes",
        actionLabel: "Open",
      },
    ],
  },
  CS101A: {
    code: "CS101A",
    courseTitle: "Data Structures & Modern Algorithms",
    subject: "Data Structures & Algorithms",
    teacherName: "Dr. Vikram Seth",
    institutionName: INSTITUTION_NAME,
    assignments: [
      {
        id: 121,
        title: "Balanced AVL Trees & Red-Black Rotations",
        subject: "Data Structures & Algorithms",
        due: "August 28",
        status: "Pending",
      },
      {
        id: 122,
        title: "Dynamic Programming Knapsack & Memoization",
        subject: "Data Structures & Algorithms",
        due: "September 03",
        status: "Pending",
      },
      {
        id: 123,
        title: "Graph Traversal BFS/DFS Implementation",
        subject: "Data Structures & Algorithms",
        due: "August 19",
        status: "Submitted",
        fileName: "graph-traversal.cpp",
      },
    ],
    tests: [
      {
        id: 221,
        title: "Data Structures Mid-Semester Exam",
        subject: "Data Structures & Algorithms",
        date: "August 31",
        time: "09:00 AM",
        duration: "90 minutes",
        status: "Upcoming",
      },
      {
        id: 222,
        title: "Algorithm Complexity & Sorting Test",
        subject: "Data Structures & Algorithms",
        date: "September 08",
        time: "01:30 PM",
        duration: "45 minutes",
        status: "Upcoming",
      },
      {
        id: 223,
        title: "Pointers & Memory Allocation Test",
        subject: "Data Structures & Algorithms",
        date: "August 14",
        time: "10:00 AM",
        duration: "60 minutes",
        status: "Completed",
      },
    ],
    quizzes: [
      {
        id: 321,
        title: "Big-O Asymptotic Notation Rapid Fire",
        subject: "Data Structures & Algorithms",
        created_by: "Dr. Vikram Seth",
      },
      {
        id: 322,
        title: "Heap & Priority Queues Live Quiz",
        subject: "Data Structures & Algorithms",
        created_by: "Dr. Vikram Seth",
      },
      {
        id: 323,
        title: "Hash Tables & Collision Handling",
        subject: "Data Structures & Algorithms",
        created_by: "Dr. Vikram Seth",
      },
    ],
    upcoming: [
      {
        id: "up-c1",
        type: "Assignment",
        title: "Balanced AVL Trees & Red-Black Rotations",
        subject: "Data Structures & Algorithms",
        date: "Due August 28",
        statusPill: "Pending",
        statusPillVariant: "yellow",
        rowVariant: "yellow",
        actionHref: "/assignments",
        actionLabel: "Open",
      },
      {
        id: "up-c2",
        type: "Test",
        title: "Data Structures Mid-Semester Exam",
        subject: "Data Structures & Algorithms",
        date: "August 31",
        statusPill: "Upcoming",
        statusPillVariant: "sky",
        rowVariant: "white",
        actionHref: "/tests",
        actionLabel: "View",
      },
      {
        id: "up-c3",
        type: "Live Quiz",
        title: "Big-O Asymptotic Notation Rapid Fire",
        subject: "Data Structures & Algorithms",
        date: "September 02",
        statusPill: "Live Quiz",
        statusPillVariant: "dark",
        rowVariant: "mint",
        actionHref: "/quizzes",
        actionLabel: "Open",
      },
    ],
  },
  ENR999: {
    code: "ENR999",
    courseTitle: "Mathematics II (Foundation Calculus)",
    subject: "Foundation Calculus",
    teacherName: "Prof. Anand Verma",
    institutionName: INSTITUTION_NAME,
    assignments: [
      {
        id: 131,
        title: "Integration by Parts & Trig Substitution",
        subject: "Foundation Calculus",
        due: "August 30",
        status: "Pending",
      },
      {
        id: 132,
        title: "Sequences, Series & Convergence Tests",
        subject: "Foundation Calculus",
        due: "September 05",
        status: "Pending",
      },
      {
        id: 133,
        title: "Riemann Sums Numerical Approximation",
        subject: "Foundation Calculus",
        due: "August 21",
        status: "Submitted",
        fileName: "riemann-sums.pdf",
      },
    ],
    tests: [
      {
        id: 231,
        title: "Calculus II Baseline Assessment",
        subject: "Foundation Calculus",
        date: "September 02",
        time: "10:00 AM",
        duration: "60 minutes",
        status: "Upcoming",
      },
      {
        id: 232,
        title: "Integral Applications Assessment",
        subject: "Foundation Calculus",
        date: "September 15",
        time: "02:00 PM",
        duration: "60 minutes",
        status: "Upcoming",
      },
      {
        id: 233,
        title: "Pre-Calculus Review Test",
        subject: "Foundation Calculus",
        date: "August 17",
        time: "11:00 AM",
        duration: "40 minutes",
        status: "Completed",
      },
    ],
    quizzes: [
      {
        id: 331,
        title: "Indefinite Integrals Speed Drill",
        subject: "Foundation Calculus",
        created_by: "Prof. Anand Verma",
      },
      {
        id: 332,
        title: "Taylor & Maclaurin Series Concept Quiz",
        subject: "Foundation Calculus",
        created_by: "Prof. Anand Verma",
      },
      {
        id: 333,
        title: "Improper Integrals Live Session",
        subject: "Foundation Calculus",
        created_by: "Prof. Anand Verma",
      },
    ],
    upcoming: [
      {
        id: "up-e1",
        type: "Assignment",
        title: "Integration by Parts & Trig Substitution",
        subject: "Foundation Calculus",
        date: "Due August 30",
        statusPill: "Pending",
        statusPillVariant: "yellow",
        rowVariant: "yellow",
        actionHref: "/assignments",
        actionLabel: "Open",
      },
      {
        id: "up-e2",
        type: "Test",
        title: "Calculus II Baseline Assessment",
        subject: "Foundation Calculus",
        date: "September 02",
        statusPill: "Upcoming",
        statusPillVariant: "sky",
        rowVariant: "white",
        actionHref: "/tests",
        actionLabel: "View",
      },
      {
        id: "up-e3",
        type: "Live Quiz",
        title: "Indefinite Integrals Speed Drill",
        subject: "Foundation Calculus",
        date: "September 04",
        statusPill: "Live Quiz",
        statusPillVariant: "dark",
        rowVariant: "mint",
        actionHref: "/quizzes",
        actionLabel: "Open",
      },
    ],
  },
};

const INITIAL_GUARDIANS: Guardian[] = [
  {
    id: "g-1",
    name: "Dr. Meenakshi Sharma",
    phone: "+91 98765 43210",
    status: "active",
    createdAt: "Aug 12, 2026",
  },
  {
    id: "g-2",
    name: "Rajesh Sharma",
    phone: "+91 91234 56789",
    status: "pending",
    createdAt: "Aug 20, 2026",
  },
];

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

// Helper delay to mimic real network latency
function fakeDelay(ms = 280): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Local Storage Keys
const LS_ENROLLMENT = "cp_student_enrollment";
const LS_GUARDIANS = "cp_student_guardians";
const LS_PROFILE = "cp_student_profile";
const LS_DIAGNOSTIC = "cp_student_diagnostic";
const LS_OTP_STATE = "cp_student_otp_state";

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
  /**
   * GET /api/sections/preview?code=
   * Returns courseTitle, teacherName, institutionName or throws 404/expired error.
   */
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
   * GET /api/sections
   * Returns all active sections available for the student to select and join.
   */
  async getAvailableSections(): Promise<SectionPreview[]> {
    try {
      const { items } = await request<{ items: BackendSectionPreview[] }>("/student/sections");
      return items.map(toSectionPreview);
    } catch {
      return Object.values(MOCK_SECTIONS).filter((s) => !s.isExpired);
    }
  },

  /**
   * POST /api/enrollments/join
   * Body: { code, rollNumber }
   * Enrolls student. If already enrolled, returns alreadyEnrolled: true without error.
   */
  async joinEnrollment(payload: JoinEnrollmentPayload): Promise<JoinEnrollmentResponse> {
    const code = payload.code.trim().toUpperCase();
    const roll = payload.rollNumber.trim() || "2024-CS-042";
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
      return res;
    } catch (err) {
      if (err instanceof BackendApiError && err.status === 409) {
        const existing = (await this.listEnrollments()).find(
          (e) => e.sectionCode === code
        );
        const res: JoinEnrollmentResponse = {
          success: true,
          enrollmentId: existing?.enrollmentId ?? "",
          sectionCode: code,
          courseTitle: existing?.courseTitle ?? "",
          rollNumber: roll,
          alreadyEnrolled: true,
          teacherName: "",
          institutionName: existing?.institutionName ?? "",
        };
        setStorage(LS_ENROLLMENT, res);
        return res;
      }
      const section = MOCK_SECTIONS[code] || {
        code,
        courseTitle: "Advanced Calculus & Linear Algebra",
        teacherName: "Dr. Aris Thorne",
        institutionName: INSTITUTION_NAME,
      };
      const res: JoinEnrollmentResponse = {
        success: true,
        enrollmentId: `enr-${section.code.toLowerCase()}`,
        sectionCode: section.code,
        courseTitle: section.courseTitle,
        rollNumber: roll,
        alreadyEnrolled: false,
        teacherName: section.teacherName,
        institutionName: section.institutionName,
      };
      setStorage(LS_ENROLLMENT, res);
      return res;
    }
  },

  /**
   * POST /api/auth/otp/request
   * Returns a 10-minute expiry time (600s).
   */
  async requestOtp(_identifier?: string): Promise<OtpRequestResponse> {
    const identifier = (_identifier ?? "").trim();
    if (!identifier) throw new ApiError("Enter your mobile number.", 400);

    const res = await request<{ sent: boolean; devOtp?: string; expiresInSec: number }>(
      "/student/auth/request-otp",
      { method: "POST", body: JSON.stringify({ phone: identifier }) }
    );

    // verifyOtp needs the number back; the passcode alone does not identify the account.
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
      // Populated only outside production, where the server has no SMS gateway wired up.
      demoOtp: res.devOtp ?? "",
    };
  },

  /**
   * POST /api/auth/otp/verify
   * Body: { otp }
   * Tracks failed attempts and locks out after 5 failures.
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
      const res = await request<{ token: string; student: BackendStudent }>(
        "/student/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone: pending.phone, otp: otp.trim(), name }),
        }
      );

      setToken(res.token);
      setStorage(LS_PROFILE, toUserProfile(res.student));
      setStorage(LS_OTP_STATE, { ...pending, attemptsLeft: 5, isLocked: false });

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
   * POST /api/auth/login
   * Body: { registerNumber, password }
   */
  async login(registerNumber: string, password: string): Promise<UserProfile> {
    const cleanReg = (registerNumber || "").trim().toUpperCase();
    if (!cleanReg) {
      throw new ApiError("Please enter your Register or Roll number.", 400);
    }
    if (!password || !password.trim()) {
      throw new ApiError("Please enter your password.", 400);
    }

    // Real sign-in: the backend checks the register number and password and returns the
    // JWT every other call runs on. Wrong credentials surface the server's message.
    const auth = await request<{
      token: string;
      student: { id: string; name: string; phone?: string; rollNumber: string };
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
      institutionName: INSTITUTION_NAME,
      isLoggedIn: true,
    };

    setStorage(LS_PROFILE, profile);
    return profile;
  },

  /**
   * POST /api/auth/logout
   */
  async logout(): Promise<void> {
    clearToken();
    setStorage(LS_PROFILE, { ...getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE), isLoggedIn: false });
  },

  /**
   * PATCH /api/me
   * Body: { name?, language?, email?, ... }
   */
  async updateMe(data: Partial<UserProfile>): Promise<UserProfile> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;

    // `language` is a local display preference; the server has no column for it.
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

  /**
   * GET /api/me
   */
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
      return profile;
    } catch {
      const current = getStorage<UserProfile>(LS_PROFILE, EMPTY_PROFILE);
      return {
        ...current,
        isLoggedIn: true,
        registerNumber: current.registerNumber || "2024-CS-042",
        rollNumber: current.rollNumber || current.registerNumber || "2024-CS-042",
        name: current.name || "Aarav Sharma",
        email: current.email || "aarav.sharma@institution.edu",
        institutionName: current.institutionName || INSTITUTION_NAME,
      };
    }
  },

  /**
   * POST /api/me/guardians
   * Body: { phone, name }
   */
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

  /**
   * GET /api/me/guardians
   * Returns [{ id, name, phone, status, createdAt }]
   */
  async getGuardians(): Promise<Guardian[]> {
    if (!isSignedIn()) return [];
    const { items } = await request<{ items: BackendGuardian[] }>("/student/guardians");
    return items.map(toGuardian);
  },

  /**
   * DELETE /api/me/guardians/:id
   * Revokes guardian digest access.
   */
  async deleteGuardian(id: string): Promise<{ success: boolean; id: string }> {
    await request<void>(`/student/guardians/${id}`, { method: "DELETE" });
    return { success: true, id };
  },

  /**
   * GET /api/courses/:id/diagnostic
   * Returns current question or null if diagnostic is finished.
   */
  async getCourseDiagnostic(_courseId: string): Promise<DiagnosticQuestion | null> {
    void _courseId;
    await fakeDelay();
    const diagState = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: 0,
      completed: false,
      summaryText: "",
      skipped: false,
    });

    if (diagState.completed) {
      return null;
    }

    const step = diagState.currentStep || 0;
    if (step >= DIAGNOSTIC_QUESTIONS.length) {
      return null;
    }

    return DIAGNOSTIC_QUESTIONS[step];
  },

  /**
   * POST /api/courses/:id/diagnostic/answer
   * Body: { questionId, answer, confidence }
   */
  async submitDiagnosticAnswer(
    _courseId: string,
    payload: DiagnosticAnswerPayload
  ): Promise<{ nextQuestion: DiagnosticQuestion | null; completed: boolean }> {
    void _courseId;
    await fakeDelay();
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
        "You're solid on limits and vectors, a bit rusty on matrix multiplication and chain rule differentiation.";
    }

    setStorage(LS_DIAGNOSTIC, diagState);

    const nextQ = isDone ? null : DIAGNOSTIC_QUESTIONS[diagState.currentStep];
    return {
      nextQuestion: nextQ,
      completed: isDone,
    };
  },

  /**
   * POST /api/courses/:id/diagnostic/complete
   * Returns a qualitative summary sentence only (NEVER numeric score or rank).
   */
  async completeDiagnostic(_courseId: string): Promise<DiagnosticCompleteResponse> {
    void _courseId;
    await fakeDelay();
    const diagState = getStorage<StoredDiagnostic>(LS_DIAGNOSTIC, {
      answers: {},
      currentStep: DIAGNOSTIC_QUESTIONS.length,
      completed: true,
      summaryText:
        "You're solid on limits, a bit rusty on differentiation and multivariable matrix transforms.",
      skipped: false,
    });

    diagState.completed = true;
    if (!diagState.summaryText) {
      diagState.summaryText =
        "You're solid on limits, a bit rusty on differentiation and multivariable matrix transforms.";
    }
    setStorage(LS_DIAGNOSTIC, diagState);

    return {
      summaryText: diagState.summaryText,
      completedAt: new Date().toLocaleDateString(),
    };
  },

  /**
   * Helper: Get current diagnostic progress state for banners
   */
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

  /**
   * Helper: Record skipped state (skip for now allowed once)
   */
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

  /**
   * Helper: Get active enrollment info
   */
  getCurrentEnrollment(): JoinEnrollmentResponse | null {
    return getStorage<JoinEnrollmentResponse | null>(LS_ENROLLMENT, null);
  },

  /**
   * Helper: Get subject-specific course content (assignments, tests, quizzes, upcoming items)
   * for the currently enrolled section or a specified section code.
   */
  getCourseContent(sectionCodeOrTitle?: string): CourseContent {
    const enrollment = this.getCurrentEnrollment();
    let code = "MATH10";
    if (sectionCodeOrTitle) {
      code = sectionCodeOrTitle.trim().toUpperCase();
    } else if (enrollment) {
      if (enrollment.sectionCode) {
        code = enrollment.sectionCode.trim().toUpperCase();
      } else if (enrollment.enrollmentId) {
        code = enrollment.enrollmentId.replace("enr-", "").trim().toUpperCase();
      }
    }

    // Retrieve matching mock course data, or fall back by title or MATH10
    const matched =
      MOCK_COURSE_DATA[code] ||
      Object.values(MOCK_COURSE_DATA).find(
        (c) =>
          c.code.toUpperCase() === code ||
          (enrollment?.courseTitle &&
            c.courseTitle.toLowerCase().includes(enrollment.courseTitle.toLowerCase()))
      );

    const base = matched || {
      code,
      courseTitle: enrollment?.courseTitle || `${code} Coursework`,
      subject: enrollment?.courseTitle || code,
      teacherName: enrollment?.teacherName || "Course Faculty",
      institutionName: enrollment?.institutionName || INSTITUTION_NAME,
      assignments: [
        {
          id: 901,
          title: `${enrollment?.courseTitle || code} Problem Set 1`,
          subject: enrollment?.courseTitle || code,
          due: "August 28",
          status: "Pending" as const,
        },
        {
          id: 902,
          title: `${enrollment?.courseTitle || code} Case Study Analysis`,
          subject: enrollment?.courseTitle || code,
          due: "September 04",
          status: "Pending" as const,
        },
        {
          id: 903,
          title: `${enrollment?.courseTitle || code} Lab Report 1`,
          subject: enrollment?.courseTitle || code,
          due: "August 18",
          status: "Submitted" as const,
          fileName: "lab-report-1.pdf",
        },
      ],
      tests: [
        {
          id: 911,
          title: `${enrollment?.courseTitle || code} Midterm Exam`,
          subject: enrollment?.courseTitle || code,
          date: "August 30",
          time: "10:00 AM",
          duration: "60 minutes",
          status: "Upcoming" as const,
        },
        {
          id: 912,
          title: `${enrollment?.courseTitle || code} Unit Assessment`,
          subject: enrollment?.courseTitle || code,
          date: "September 10",
          time: "02:00 PM",
          duration: "45 minutes",
          status: "Upcoming" as const,
        },
        {
          id: 913,
          title: `${enrollment?.courseTitle || code} Baseline Diagnostic`,
          subject: enrollment?.courseTitle || code,
          date: "August 15",
          time: "11:00 AM",
          duration: "45 minutes",
          status: "Completed" as const,
        },
      ],
      quizzes: [
        {
          id: 921,
          title: `${enrollment?.courseTitle || code} Diagnostic Quiz`,
          subject: enrollment?.courseTitle || code,
          created_by: enrollment?.teacherName || "Course Faculty",
        },
        {
          id: 922,
          title: `${enrollment?.courseTitle || code} Concept Check`,
          subject: enrollment?.courseTitle || code,
          created_by: enrollment?.teacherName || "Course Faculty",
        },
      ],
      upcoming: [
        {
          id: `up-${code.toLowerCase()}-1`,
          type: "Assignment",
          title: `${enrollment?.courseTitle || code} Problem Set 1`,
          subject: enrollment?.courseTitle || code,
          date: "Due August 28",
          statusPill: "Pending",
          statusPillVariant: "yellow" as const,
          rowVariant: "yellow" as const,
          actionHref: "/assignments",
          actionLabel: "Open",
        },
        {
          id: `up-${code.toLowerCase()}-2`,
          type: "Test",
          title: `${enrollment?.courseTitle || code} Midterm Exam`,
          subject: enrollment?.courseTitle || code,
          date: "August 30",
          statusPill: "Upcoming",
          statusPillVariant: "sky" as const,
          rowVariant: "white" as const,
          actionHref: "/tests",
          actionLabel: "View",
        },
        {
          id: `up-${code.toLowerCase()}-3`,
          type: "Live Quiz",
          title: `${enrollment?.courseTitle || code} Diagnostic Quiz`,
          subject: enrollment?.courseTitle || code,
          date: "September 02",
          statusPill: "Live Quiz",
          statusPillVariant: "dark" as const,
          rowVariant: "mint" as const,
          actionHref: "/quizzes",
          actionLabel: "Open",
        },
      ],
    };

    // Stored assignment overrides (e.g. when student uploads a submission)
    const storedAssignments = getStorage<
      Record<number, { status: "Pending" | "Submitted"; fileName?: string; comment?: string }>
    >(`cp_assignments_${base.code}`, {});

    const assignments = base.assignments.map((a) => {
      const override = storedAssignments[a.id];
      if (override) {
        return {
          ...a,
          status: override.status,
          fileName: override.fileName || a.fileName,
          comment: override.comment || a.comment,
        };
      }
      return a;
    });

    const pendingAssignments = assignments.filter((a) => a.status === "Pending").length;
    const upcomingTests = base.tests.filter((t) => t.status === "Upcoming").length;

    const upcoming = base.upcoming.map((u) => {
      if (u.type === "Assignment") {
        const matchingA = assignments.find((a) => a.title === u.title);
        if (matchingA && matchingA.status === "Submitted") {
          return {
            ...u,
            statusPill: "Submitted",
            statusPillVariant: "dark" as const,
            rowVariant: "white" as const,
          };
        }
      }
      return u;
    });

    return {
      code: base.code,
      courseTitle: enrollment?.courseTitle || base.courseTitle,
      subject: base.subject,
      teacherName: enrollment?.teacherName || base.teacherName,
      institutionName: enrollment?.institutionName || base.institutionName,
      assignments,
      tests: base.tests,
      quizzes: base.quizzes,
      upcoming,
      stats: {
        assignmentsTotal: assignments.length,
        assignmentsPending: pendingAssignments,
        testsTotal: base.tests.length,
        testsUpcoming: upcomingTests,
        quizzesTotal: base.quizzes.length,
        quizzesDueSoon: base.quizzes.length,
      },
    };
  },

  /**
   * Submit an assignment for the currently enrolled course
   */
  submitAssignment(assignmentId: number, fileName: string, comment?: string): void {
    const current = this.getCourseContent();
    const storedOverrides = getStorage<
      Record<number, { status: "Pending" | "Submitted"; fileName?: string; comment?: string }>
    >(`cp_assignments_${current.code}`, {});

    storedOverrides[assignmentId] = {
      status: "Submitted",
      fileName,
      comment,
    };
    setStorage(`cp_assignments_${current.code}`, storedOverrides);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
  },

  /**
   * Helper for testing/dev: reset mock data to fresh state
   */
  resetMockData(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LS_ENROLLMENT);
    window.localStorage.removeItem(LS_GUARDIANS);
    window.localStorage.removeItem(LS_PROFILE);
    window.localStorage.removeItem(LS_DIAGNOSTIC);
    window.localStorage.removeItem(LS_OTP_STATE);
  },
};

// Named exports matching common utility imports
export const getSectionPreview = diagnosticApi.getSectionPreview;
export const getAvailableSections = diagnosticApi.getAvailableSections;
export const joinEnrollment = diagnosticApi.joinEnrollment;
export const requestOtp = diagnosticApi.requestOtp;
export const verifyOtp = diagnosticApi.verifyOtp;
export const updateMe = diagnosticApi.updateMe;
export const getMe = diagnosticApi.getMe;
export const login = diagnosticApi.login;
export const logout = diagnosticApi.logout;
export const addGuardian = diagnosticApi.addGuardian;
export const getGuardians = diagnosticApi.getGuardians;
export const deleteGuardian = diagnosticApi.deleteGuardian;
export const getCourseDiagnostic = diagnosticApi.getCourseDiagnostic;
export const submitDiagnosticAnswer = diagnosticApi.submitDiagnosticAnswer;
export const completeDiagnostic = diagnosticApi.completeDiagnostic;
export const getCourseContent = diagnosticApi.getCourseContent;
export const submitAssignment = diagnosticApi.submitAssignment;
