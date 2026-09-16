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
  async getSectionPreview(code: string): Promise<SectionPreview> {
    await fakeDelay();
    const normalized = code.trim().toUpperCase();
    const section = MOCK_SECTIONS[normalized];

    if (!section) {
      throw new ApiError("Invalid join code. Section not found.", 404);
    }

    if (section.isExpired) {
      throw new ApiError(
        "This code has expired, ask your teacher for a new one.",
        410,
        "CODE_EXPIRED"
      );
    }

    return { ...section };
  },

  /**
   * GET /api/sections
   * Returns all active sections available for the student to select and join.
   */
  async getAvailableSections(): Promise<SectionPreview[]> {
    await fakeDelay(100);
    return Object.values(MOCK_SECTIONS).filter((s) => !s.isExpired);
  },

  /**
   * POST /api/enrollments/join
   * Body: { code, rollNumber }
   * Enrolls student. If already enrolled, returns alreadyEnrolled: true without error.
   */
  async joinEnrollment(payload: JoinEnrollmentPayload): Promise<JoinEnrollmentResponse> {
    await fakeDelay();
    const normalized = payload.code.trim().toUpperCase();
    const section = MOCK_SECTIONS[normalized];

    if (!section) {
      throw new ApiError("Section not found.", 404);
    }

    const currentEnrollment = getStorage<JoinEnrollmentResponse | null>(LS_ENROLLMENT, null);
    const isAlready =
      normalized === "ENR999" ||
      (currentEnrollment && currentEnrollment.enrollmentId === `enr-${normalized}`);

    const result: JoinEnrollmentResponse = {
      success: true,
      enrollmentId: `enr-${normalized}`,
      sectionCode: normalized,
      courseTitle: section.courseTitle,
      rollNumber: payload.rollNumber.trim(),
      alreadyEnrolled: Boolean(isAlready),
      teacherName: section.teacherName,
      institutionName: section.institutionName,
    };

    setStorage(LS_ENROLLMENT, result);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return result;
  },

  /**
   * POST /api/auth/otp/request
   * Returns a 10-minute expiry time (600s).
   */
  async requestOtp(_identifier?: string): Promise<OtpRequestResponse> {
    void _identifier;
    await fakeDelay();
    const otpState: StoredOtpState = {
      demoOtp: "123456",
      attemptsLeft: 5,
      isLocked: false,
      requestedAt: Date.now(),
      expiresInSeconds: 600, // 10 minutes
    };
    setStorage(LS_OTP_STATE, otpState);

    return {
      success: true,
      expiresInSeconds: 600,
      message: "6-digit OTP sent to your registered contact.",
      demoOtp: "123456",
    };
  },

  /**
   * POST /api/auth/otp/verify
   * Body: { otp }
   * Tracks failed attempts and locks out after 5 failures.
   */
  async verifyOtp(otp: string): Promise<OtpVerifyResponse> {
    await fakeDelay();
    const otpState = getStorage<StoredOtpState>(LS_OTP_STATE, {
      demoOtp: "123456",
      attemptsLeft: 5,
      isLocked: false,
    });

    if (otpState.isLocked || otpState.attemptsLeft <= 0) {
      return {
        success: false,
        attemptsLeft: 0,
        isLocked: true,
        message: "Account locked after 5 failed attempts. Please contact your section administrator.",
      };
    }

    // Default mock valid OTP is 123456
    const cleanOtp = otp.replace(/\s+/g, "");
    if (cleanOtp === "123456" || cleanOtp === otpState.demoOtp) {
      otpState.attemptsLeft = 5;
      setStorage(LS_OTP_STATE, otpState);
      return {
        success: true,
        attemptsLeft: 5,
        isLocked: false,
        token: "mock-jwt-token-" + Date.now(),
      };
    }

    // Decrement attempts
    otpState.attemptsLeft = Math.max(0, otpState.attemptsLeft - 1);
    if (otpState.attemptsLeft === 0) {
      otpState.isLocked = true;
    }
    setStorage(LS_OTP_STATE, otpState);

    if (otpState.isLocked) {
      return {
        success: false,
        attemptsLeft: 0,
        isLocked: true,
        message: "5 failed attempts reached. Verification locked. Ask your faculty to unlock your profile.",
      };
    }

    return {
      success: false,
      attemptsLeft: otpState.attemptsLeft,
      isLocked: false,
      message: `Invalid OTP code. ${otpState.attemptsLeft} attempt(s) remaining.`,
    };
  },

  /**
   * POST /api/auth/login
   * Body: { registerNumber, password }
   */
  async login(registerNumber: string, password: string): Promise<UserProfile> {
    await fakeDelay();
    if (!registerNumber.trim()) {
      throw new ApiError("Please enter your Register Number.", 400);
    }
    if (!password.trim()) {
      throw new ApiError("Please enter your password.", 400);
    }

    const current = getStorage<UserProfile>(LS_PROFILE, {
      name: "Aarav Sharma",
      registerNumber: registerNumber.trim().toUpperCase(),
      email: "aarav.sharma@institution.edu",
      language: "English",
      rollNumber: registerNumber.trim().toUpperCase(),
      institutionName: "National Institute of Technology",
      isLoggedIn: true,
    });

    const user: UserProfile = {
      ...current,
      registerNumber: registerNumber.trim().toUpperCase(),
      rollNumber: registerNumber.trim().toUpperCase(),
      isLoggedIn: true,
    };

    setStorage(LS_PROFILE, user);
    return user;
  },

  /**
   * POST /api/auth/logout
   */
  async logout(): Promise<void> {
    await fakeDelay(100);
    const current = getStorage<UserProfile>(LS_PROFILE, {
      name: "Aarav Sharma",
      registerNumber: "2024-CS-042",
      email: "aarav.sharma@institution.edu",
      language: "English",
      rollNumber: "2024-CS-042",
      institutionName: "National Institute of Technology",
      isLoggedIn: true,
    });
    setStorage(LS_PROFILE, { ...current, isLoggedIn: false });
  },

  /**
   * PATCH /api/me
   * Body: { name?, language?, email?, ... }
   */
  async updateMe(data: Partial<UserProfile>): Promise<UserProfile> {
    await fakeDelay();
    const current = getStorage<UserProfile>(LS_PROFILE, {
      name: "Aarav Sharma",
      registerNumber: "2024-CS-042",
      email: "aarav.sharma@institution.edu",
      language: "English",
      rollNumber: "2024-CS-042",
      institutionName: "National Institute of Technology",
      isLoggedIn: true,
    });

    const updated: UserProfile = {
      ...current,
      ...data,
    };

    setStorage(LS_PROFILE, updated);
    return updated;
  },

  /**
   * GET /api/me
   */
  async getMe(): Promise<UserProfile> {
    await fakeDelay(100);
    return getStorage<UserProfile>(LS_PROFILE, {
      name: "Aarav Sharma",
      registerNumber: "2024-CS-042",
      email: "aarav.sharma@institution.edu",
      language: "English",
      rollNumber: "2024-CS-042",
      institutionName: "National Institute of Technology",
      isLoggedIn: true,
    });
  },

  /**
   * POST /api/me/guardians
   * Body: { phone, name }
   */
  async addGuardian(payload: { phone: string; name: string }): Promise<Guardian> {
    await fakeDelay();
    const list = getStorage<Guardian[]>(LS_GUARDIANS, INITIAL_GUARDIANS);

    const newGuardian: Guardian = {
      id: `g-${Date.now()}`,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      status: "pending",
      createdAt: "Today",
    };

    const updated = [newGuardian, ...list];
    setStorage(LS_GUARDIANS, updated);
    return newGuardian;
  },

  /**
   * GET /api/me/guardians
   * Returns [{ id, name, phone, status, createdAt }]
   */
  async getGuardians(): Promise<Guardian[]> {
    await fakeDelay();
    return getStorage<Guardian[]>(LS_GUARDIANS, INITIAL_GUARDIANS);
  },

  /**
   * DELETE /api/me/guardians/:id
   * Revokes guardian digest access.
   */
  async deleteGuardian(id: string): Promise<{ success: boolean; id: string }> {
    await fakeDelay();
    const list = getStorage<Guardian[]>(LS_GUARDIANS, INITIAL_GUARDIANS);
    const updated = list.map((g) =>
      g.id === id ? { ...g, status: "revoked" as GuardianStatus } : g
    );
    setStorage(LS_GUARDIANS, updated);
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

    const base = MOCK_COURSE_DATA[code] || MOCK_COURSE_DATA["MATH10"];

    // Check for any submitted assignments stored in localStorage
    const storedOverrides = getStorage<
      Record<number, { status: "Pending" | "Submitted"; fileName?: string; comment?: string }>
    >(`cp_assignments_${base.code}`, {});

    const assignments = base.assignments.map((a) => {
      if (storedOverrides[a.id]) {
        return { ...a, ...storedOverrides[a.id] };
      }
      return a;
    });

    const pendingAssignments = assignments.filter((a) => a.status === "Pending").length;
    const upcomingTests = base.tests.filter((t) => t.status === "Upcoming").length;

    return {
      ...base,
      assignments,
      stats: {
        assignmentsTotal: assignments.length,
        assignmentsPending: pendingAssignments,
        testsTotal: base.tests.length,
        testsUpcoming: upcomingTests,
        quizzesTotal: base.quizzes.length,
        quizzesDueSoon: Math.min(1, base.quizzes.length),
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
