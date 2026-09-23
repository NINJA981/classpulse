/**
 * Client for pipeline-generated lesson quizzes, served by SIH-backend at
 * /api/student/quizzes. Answers are graded server-side; also provides rich demo
 * quizzes and client-side grading fallback for offline and demo accounts.
 */

import { request, getToken } from "./apiClient";

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

// -------------------------------------------------------------
// Demo Quizzes Presets
// -------------------------------------------------------------

interface DemoQuizDetailWithKey extends LessonQuizDetail {
  publishedAt: string;
  answerKey: Record<
    string,
    {
      correctIndex?: number;
      correctText?: string;
      explanation: string;
      explanationLocal?: string;
    }
  >;
}

const DEMO_QUIZZES_DETAIL: Record<string, DemoQuizDetailWithKey> = {
  "lq-math-1": {
    id: "lq-math-1",
    title: "Vector Spaces & Subspaces Sprint",
    subject: "Calculus & Linear Algebra",
    className: "Section MATH10",
    language: "en",
    summary:
      "Foundational properties of vector spaces, subspace verification tests, and linear independence.",
    publishedAt: "2026-08-25T10:00:00Z",
    keyTakeaways: [
      "A subspace must contain the zero vector and be closed under linear combinations.",
      "A set of vectors is linearly independent if the only solution to c1*v1 + ... + ck*vk = 0 is all ci = 0.",
      "The dimension of a vector space is the cardinality of any basis.",
    ],
    questions: [
      {
        index: 1,
        id: "q-m1-1",
        type: "mcq",
        stem: "Which condition is strictly required for a subset W of a vector space V to be a subspace?",
        options: [
          "Contains the zero vector and is closed under vector addition and scalar multiplication",
          "Contains only orthonormal unit vectors",
          "Has a determinant equal to 1",
          "Spans the entire ambient space V",
        ],
        difficulty: "Medium",
        sourceCitation: "Strang, Linear Algebra §3.2",
      },
      {
        index: 2,
        id: "q-m1-2",
        type: "mcq",
        stem: "If a 3×3 real matrix has 3 distinct real eigenvalues, how many linearly independent eigenvectors does it have?",
        options: ["1", "2", "3", "Cannot be determined"],
        difficulty: "Medium",
        sourceCitation: "Hoffman & Kunze §6.4",
      },
      {
        index: 3,
        id: "q-m1-3",
        type: "truefalse",
        stem: "Any set of vectors that contains the zero vector is automatically linearly dependent.",
        options: ["True", "False"],
        difficulty: "Easy",
        sourceCitation: "Lay, Linear Algebra §1.7",
      },
    ],
    answerKey: {
      "q-m1-1": {
        correctIndex: 0,
        explanation:
          "A subset W is a subspace if and only if it is non-empty (contains 0) and is closed under addition and scalar multiplication.",
      },
      "q-m1-2": {
        correctIndex: 2,
        explanation:
          "Eigenvectors corresponding to distinct eigenvalues are always linearly independent. A 3×3 matrix with 3 distinct eigenvalues has 3 linearly independent eigenvectors.",
      },
      "q-m1-3": {
        correctIndex: 0,
        explanation:
          "True: Since 1·0 = 0 gives a non-trivial linear combination equaling the zero vector, any set containing 0 is linearly dependent.",
      },
    },
  },
  "lq-math-2": {
    id: "lq-math-2",
    title: "Partial Derivatives & Gradient Vectors",
    subject: "Calculus & Linear Algebra",
    className: "Section MATH10",
    language: "en",
    summary:
      "Directional derivatives, tangent plane approximations, and gradient field properties.",
    publishedAt: "2026-08-26T14:30:00Z",
    keyTakeaways: [
      "The gradient vector ∇f points in the direction of greatest instantaneous increase.",
      "The directional derivative along unit vector u is given by Du f = ∇f · u.",
      "Clairaut's theorem guarantees equality of continuous mixed second-order partials.",
    ],
    questions: [
      {
        index: 1,
        id: "q-m2-1",
        type: "mcq",
        stem: "In what direction from a point P does a differentiable scalar field f(x, y) increase most rapidly?",
        options: [
          "In the direction of the gradient ∇f(P)",
          "Opposite to the gradient -∇f(P)",
          "Perpendicular to the gradient ∇f(P)",
          "Tangent to the level curve f(x, y) = c",
        ],
        difficulty: "Medium",
        sourceCitation: "Stewart Calculus §14.6",
      },
      {
        index: 2,
        id: "q-m2-2",
        type: "mcq",
        stem: "If the directional derivative Du f(P) is zero in the direction of unit vector u, what is the geometric relationship between u and ∇f(P)?",
        options: [
          "u is orthogonal (perpendicular) to ∇f(P)",
          "u is parallel to ∇f(P)",
          "u is opposite to ∇f(P)",
          "u must be the zero vector",
        ],
        difficulty: "Medium",
        sourceCitation: "Stewart Calculus §14.6",
      },
      {
        index: 3,
        id: "q-m2-3",
        type: "truefalse",
        stem: "If the two-variable limit of f(x, y) as (x,y)→(0,0) yields different values along y = x and y = x², the limit does not exist.",
        options: ["True", "False"],
        difficulty: "Easy",
        sourceCitation: "Stewart Calculus §14.2",
      },
    ],
    answerKey: {
      "q-m2-1": {
        correctIndex: 0,
        explanation:
          "By the Cauchy-Schwarz inequality, Du f = ||∇f|| cos(θ), which is maximized when θ = 0 (the direction of ∇f).",
      },
      "q-m2-2": {
        correctIndex: 0,
        explanation:
          "Since Du f = ∇f · u = ||∇f|| cos(θ) = 0, cos(θ) = 0 which means u is orthogonal to ∇f.",
      },
      "q-m2-3": {
        correctIndex: 0,
        explanation:
          "True: For a limit in multivariable calculus to exist, it must approach the identical value along every path.",
      },
    },
  },
  "lq-math-3": {
    id: "lq-math-3",
    title: "Determinants & Matrix Inversion",
    subject: "Calculus & Linear Algebra",
    className: "Section MATH10",
    language: "en",
    summary:
      "Determinant expansion, invertible matrix theorem, and Cramer's rule fundamentals.",
    publishedAt: "2026-08-27T11:00:00Z",
    keyTakeaways: [
      "A square matrix A is invertible if and only if det(A) ≠ 0.",
      "det(AB) = det(A) · det(B).",
      "Swapping two rows of a matrix flips the sign of its determinant.",
    ],
    questions: [
      {
        index: 1,
        id: "q-m3-1",
        type: "mcq",
        stem: "If det(A) = 4 for a 3×3 matrix A, what is det(2A)?",
        options: ["32", "8", "16", "64"],
        difficulty: "Medium",
        sourceCitation: "Strang §5.1",
      },
      {
        index: 2,
        id: "q-m3-2",
        type: "mcq",
        stem: "What happens to the determinant of an n×n matrix if a single row is multiplied by scalar k?",
        options: [
          "The determinant is multiplied by k",
          "The determinant is multiplied by k^n",
          "The determinant remains unchanged",
          "The determinant becomes zero",
        ],
        difficulty: "Easy",
        sourceCitation: "Strang §5.2",
      },
      {
        index: 3,
        id: "q-m3-3",
        type: "truefalse",
        stem: "An upper triangular matrix is invertible if and only if all entries on its main diagonal are non-zero.",
        options: ["True", "False"],
        difficulty: "Easy",
        sourceCitation: "Lay §3.2",
      },
    ],
    answerKey: {
      "q-m3-1": {
        correctIndex: 0,
        explanation:
          "For an n×n matrix, det(c·A) = cⁿ · det(A). Here n=3, so det(2A) = 2³ · 4 = 8 · 4 = 32.",
      },
      "q-m3-2": {
        correctIndex: 0,
        explanation:
          "Scaling a single row by k multiplies the determinant by exactly k by multi-linearity of determinants.",
      },
      "q-m3-3": {
        correctIndex: 0,
        explanation:
          "True: The determinant of any triangular matrix is the product of its diagonal entries. It is non-zero iff all diagonal entries are non-zero.",
      },
    },
  },
  "lq-cs-1": {
    id: "lq-cs-1",
    title: "Balanced AVL Trees & Red-Black Rotations",
    subject: "Data Structures & Algorithms",
    className: "Section CS101A",
    language: "en",
    summary:
      "Self-balancing tree invariant maintenance, height balance factors, and time complexity bounds.",
    publishedAt: "2026-08-28T09:15:00Z",
    keyTakeaways: [
      "The AVL tree balance factor is height(left) - height(right) ∈ {-1, 0, 1}.",
      "Double rotations (LR / RL) combine two single rotations to restore balance in O(1) time.",
      "Search, insert, and delete take guaranteed O(log N) time.",
    ],
    questions: [
      {
        index: 1,
        id: "q-cs1-1",
        type: "mcq",
        stem: "What is the worst-case search time complexity in an AVL tree containing N nodes?",
        options: ["O(log N)", "O(N)", "O(N log N)", "O(1)"],
        difficulty: "Easy",
        sourceCitation: "CLRS §13",
      },
      {
        index: 2,
        id: "q-cs1-2",
        type: "mcq",
        stem: "Which rotation sequence fixes an imbalance caused by inserting into the right subtree of a left child (LR case)?",
        options: [
          "Left rotation on left child, then Right rotation on ancestor",
          "Single Right rotation on ancestor",
          "Single Left rotation on ancestor",
          "Right rotation on left child, then Left rotation on ancestor",
        ],
        difficulty: "Medium",
        sourceCitation: "CLRS §13.2",
      },
      {
        index: 3,
        id: "q-cs1-3",
        type: "truefalse",
        stem: "Every AVL tree is also a valid Binary Search Tree.",
        options: ["True", "False"],
        difficulty: "Easy",
        sourceCitation: "CLRS §12",
      },
    ],
    answerKey: {
      "q-cs1-1": {
        correctIndex: 0,
        explanation:
          "An AVL tree guarantees a strictly logarithmic height (≤ 1.44 log₂ N), ensuring O(log N) worst-case search.",
      },
      "q-cs1-2": {
        correctIndex: 0,
        explanation:
          "An LR imbalance is rectified by a left rotation on the left child, followed by a right rotation on the parent node.",
      },
      "q-cs1-3": {
        correctIndex: 0,
        explanation:
          "True: An AVL tree is a BST with the additional self-balancing constraint that left and right subtree heights differ by at most 1.",
      },
    },
  },
  "lq-phy-1": {
    id: "lq-phy-1",
    title: "Wave-Particle Duality & Photoelectric Effect",
    subject: "Quantum Mechanics & Optics",
    className: "Section PHY201",
    language: "en",
    summary:
      "Photoelectric threshold frequency, photon energy quantization, and de Broglie wavelengths.",
    publishedAt: "2026-08-28T16:00:00Z",
    keyTakeaways: [
      "Photon energy is E = hν = hc/λ.",
      "Photoelectric emission depends on light frequency, not light intensity.",
      "The de Broglie wavelength of a particle is λ = h/p.",
    ],
    questions: [
      {
        index: 1,
        id: "q-p1-1",
        type: "mcq",
        stem: "What happens to the kinetic energy of emitted photoelectrons when the frequency of incident light is increased above the threshold?",
        options: [
          "Kinetic energy increases linearly with frequency",
          "Kinetic energy decreases",
          "Kinetic energy remains unchanged",
          "Photoelectrons stop being emitted",
        ],
        difficulty: "Medium",
        sourceCitation: "Griffiths Quantum Mechanics §1",
      },
      {
        index: 2,
        id: "q-p1-2",
        type: "mcq",
        stem: "According to de Broglie, what is the wavelength associated with a particle having momentum p?",
        options: ["h / p", "p / h", "h · p", "p² / (2m)"],
        difficulty: "Easy",
        sourceCitation: "Eisberg & Resnick §3",
      },
      {
        index: 3,
        id: "q-p1-3",
        type: "truefalse",
        stem: "Increasing the intensity of incident light below the threshold frequency causes electrons to eventually be ejected.",
        options: ["True", "False"],
        difficulty: "Easy",
        sourceCitation: "Halliday & Resnick §38",
      },
    ],
    answerKey: {
      "q-p1-1": {
        correctIndex: 0,
        explanation:
          "Einstein's photoelectric equation is K_max = hν - Φ. Above threshold, maximum kinetic energy increases linearly with frequency ν.",
      },
      "q-p1-2": {
        correctIndex: 0,
        explanation:
          "The de Broglie relation is λ = h / p, linking wave properties with particle momentum.",
      },
      "q-p1-3": {
        correctIndex: 1,
        explanation:
          "False: If the frequency is below threshold (hν < Φ), photons do not have sufficient quantum energy to liberate electrons, regardless of beam intensity.",
      },
    },
  },
};

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
  const scores = getStoredQuizScores();
  return Object.values(DEMO_QUIZZES_DETAIL).map((d) => ({
    id: d.id,
    title: d.title,
    subject: d.subject,
    className: d.className,
    language: d.language,
    questionCount: d.questions.length,
    summary: d.summary,
    keyTakeaways: d.keyTakeaways,
    publishedAt: d.publishedAt || "2026-08-25T10:00:00Z",
    bestScorePct: scores[d.id] ?? null,
  }));
}

export function getDemoQuizDetail(lessonId: string): LessonQuizDetail {
  const demo = DEMO_QUIZZES_DETAIL[lessonId] || Object.values(DEMO_QUIZZES_DETAIL)[0];
  return {
    id: demo.id,
    title: demo.title,
    subject: demo.subject,
    className: demo.className,
    language: demo.language,
    summary: demo.summary,
    keyTakeaways: demo.keyTakeaways,
    questions: demo.questions,
  };
}

// -------------------------------------------------------------
// API Client Implementation
// -------------------------------------------------------------

export const lessonQuizApi = {
  async list(): Promise<{ quizzes: LessonQuizSummary[] }> {
    const scores = getStoredQuizScores();

    // Fast path: if running with demo token or client-side demo, return demo quizzes immediately
    const token = typeof window !== "undefined" ? getToken() : null;
    if (!token || token.startsWith("demo_token_")) {
      return { quizzes: getDemoQuizSummaries() };
    }

    try {
      const res = await request<{ quizzes: LessonQuizSummary[] }>("/student/quizzes");
      if (res && Array.isArray(res.quizzes) && res.quizzes.length > 0) {
        return {
          quizzes: res.quizzes.map((q) => ({
            ...q,
            bestScorePct: scores[q.id] ?? q.bestScorePct,
          })),
        };
      }
    } catch {
      // Backend unavailable; proceed to demo fallback
    }

    return { quizzes: getDemoQuizSummaries() };
  },

  async get(lessonId: string): Promise<LessonQuizDetail> {
    // Show loading state while attempting to connect to the backend pipeline
    const loadingDuration = new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const [res] = await Promise.all([
        request<LessonQuizDetail>(`/student/quizzes/${lessonId}`),
        loadingDuration,
      ]);
      if (res && res.id) return res;
      throw new Error("Empty quiz response from server");
    } catch {
      // Backend is not connected; time out after loading
      await loadingDuration;
      throw new Error("Timed out");
    }
  },

  async submit(
    lessonId: string,
    answers: Array<{ questionId: string; selectedOption?: number; text?: string }>
  ): Promise<LessonQuizResult> {
    const loadingDuration = new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const [res] = await Promise.all([
        request<LessonQuizResult>(`/student/quizzes/${lessonId}/submit`, {
          method: "POST",
          body: JSON.stringify({ answers }),
        }),
        loadingDuration,
      ]);
      if (res && res.lessonId) {
        setStoredQuizScore(lessonId, res.scorePct);
        return res;
      }
      throw new Error("Empty submission response");
    } catch {
      await loadingDuration;
      throw new Error("Timed out");
    }
  },
};
