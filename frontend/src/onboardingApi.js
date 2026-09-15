/**
 * =========================================================
 * MOCK ONBOARDING & CONCEPT GRAPH API
 * Self-contained mock API matching the required endpoints with fake delay:
 * - POST /api/auth/claim { token, password, name, language, timings }
 * - GET /api/me/sections -> [{ id, name, courseTitle, institutionName, defaultTiming, flagged, flagReason }]
 * - POST /api/sections/:id/flag { reason }
 * - GET /api/courses/:id/concepts/proposals -> [{ edgeId, fromConcept, toConcept, confidence }]
 * - POST /api/courses/:id/concepts/validate -> [{ edgeId, decision }]  // decision: yes/no/skip
 * - GET /api/sections/:id/readiness -> { concept, percentWeak }[]
 * =========================================================
 */

const STORAGE_KEYS = {
  CLAIM_STATUS: "teacherGuide_claimStatus",
  SECTIONS: "teacherGuide_assignedSections",
  COURSES: "teacherGuide_courses",
  CONCEPT_PROPOSALS: "teacherGuide_conceptProposals",
  VALIDATION_DECISIONS: "teacherGuide_validationDecisions",
  SECTION_READINESS: "teacherGuide_sectionReadiness",
};

// Artificial delay helper
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// Default initial datasets
const DEFAULT_INSTITUTION = "Apex Institute of Technology";
const DEFAULT_FACULTY_NAME = "Prof. Priya Sharma";
const DEFAULT_INVITE_TOKEN = "inv_prof_sharma_982";

const DEFAULT_SECTIONS = [
  {
    id: "sec-101",
    name: "Section A (CS 201)",
    courseId: "cs-201",
    courseTitle: "CS 201: Data Structures & Algorithms",
    institutionName: DEFAULT_INSTITUTION,
    defaultTiming: "Mon, Wed · 09:00 AM – 10:30 AM",
    flagged: false,
    flagReason: null,
  },
  {
    id: "sec-102",
    name: "Section B (CS 201)",
    courseId: "cs-201",
    courseTitle: "CS 201: Data Structures & Algorithms",
    institutionName: DEFAULT_INSTITUTION,
    defaultTiming: "Tue, Thu · 11:00 AM – 12:30 PM",
    flagged: false,
    flagReason: null,
  },
  {
    id: "sec-103",
    name: "Section C (CS 305)",
    courseId: "cs-305",
    courseTitle: "CS 305: Database Systems & Architecture",
    institutionName: DEFAULT_INSTITUTION,
    defaultTiming: "Mon, Fri · 02:00 PM – 03:30 PM",
    flagged: false,
    flagReason: null,
  },
];

const DEFAULT_COURSES = {
  "cs-201": {
    id: "cs-201",
    title: "Data Structures & Algorithms",
    code: "CS 201",
    status: "parsed but not validated", // triggers the ritual banner
    validationStats: null,
  },
  "cs-305": {
    id: "cs-305",
    title: "Database Systems & Architecture",
    code: "CS 305",
    status: "validated",
    validationStats: { confirmed: 14, rejected: 2, skipped: 1, decidedRate: 94 },
  },
};

/**
 * Pre-sorted lowest-confidence-first concept proposals for CS 201
 * AI extracted pairs that require teacher expertise to confirm or reject
 */
const DEFAULT_CONCEPT_PROPOSALS = {
  "cs-201": [
    {
      edgeId: "edge-01",
      fromConcept: "Pointer Arithmetic & Memory Layout",
      toConcept: "Binary Search Tree Rebalancing",
      confidence: 0.38,
    },
    {
      edgeId: "edge-02",
      fromConcept: "Single Linked List Reversal",
      toConcept: "Depth-First Search (DFS) Traversal",
      confidence: 0.42,
    },
    {
      edgeId: "edge-03",
      fromConcept: "Mathematical Induction",
      toConcept: "Dynamic Programming Memoization",
      confidence: 0.47,
    },
    {
      edgeId: "edge-04",
      fromConcept: "Stack Frame Call Stack",
      toConcept: "Recursive Tree Traversals",
      confidence: 0.51,
    },
    {
      edgeId: "edge-05",
      fromConcept: "Array Indexing & Continuous Memory",
      toConcept: "Binary Heap Array Representation",
      confidence: 0.56,
    },
    {
      edgeId: "edge-06",
      fromConcept: "Queue FIFO Principles",
      toConcept: "Breadth-First Search (BFS) Traversal",
      confidence: 0.62,
    },
    {
      edgeId: "edge-07",
      fromConcept: "Hash Function Collision Handling",
      toConcept: "Graph Adjacency List Implementation",
      confidence: 0.68,
    },
    {
      edgeId: "edge-08",
      fromConcept: "Divide and Conquer Strategy",
      toConcept: "Merge Sort & Recurrence Tree",
      confidence: 0.73,
    },
    {
      edgeId: "edge-09",
      fromConcept: "Big-O Asymptotic Complexity",
      toConcept: "Quicksort Worst-Case Optimization",
      confidence: 0.77,
    },
    {
      edgeId: "edge-10",
      fromConcept: "Binary Tree Properties",
      toConcept: "Dijkstra Shortest Path Priority Queue",
      confidence: 0.82,
    },
    {
      edgeId: "edge-11",
      fromConcept: "Recursion & Base Cases",
      toConcept: "Backtracking / N-Queens Constraint Search",
      confidence: 0.88,
    },
    {
      edgeId: "edge-12",
      fromConcept: "Directed Acyclic Graphs (DAG)",
      toConcept: "Topological Sort Dependency Resolution",
      confidence: 0.92,
    },
  ],
};

/**
 * Class-level aggregate rollup only:
 * "38% of this section is weak on [concept]" — never individual student data
 */
const DEFAULT_SECTION_READINESS = {
  "sec-101": [
    { concept: "Binary Search Trees", percentWeak: 38, totalAssessed: 52 },
    { concept: "Recursion & Base Cases", percentWeak: 45, totalAssessed: 52 },
    { concept: "Pointer Arithmetic", percentWeak: 31, totalAssessed: 52 },
    { concept: "Big-O Asymptotic Analysis", percentWeak: 19, totalAssessed: 52 },
  ],
  "sec-102": [
    { concept: "Dynamic Programming Memoization", percentWeak: 54, totalAssessed: 48 },
    { concept: "Breadth-First Search (BFS)", percentWeak: 33, totalAssessed: 48 },
    { concept: "Stack Frame Memory", percentWeak: 25, totalAssessed: 48 },
    { concept: "Array Indexing & Bounds", percentWeak: 12, totalAssessed: 48 },
  ],
  "sec-103": [
    { concept: "Relational Algebra Normalization", percentWeak: 42, totalAssessed: 50 },
    { concept: "B-Tree Index Traversals", percentWeak: 36, totalAssessed: 50 },
    { concept: "ACID Transaction Isolation", percentWeak: 28, totalAssessed: 50 },
    { concept: "SQL Outer Joins", percentWeak: 15, totalAssessed: 50 },
  ],
};

// Storage accessors
function loadJson(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (err) {
    console.error(`Error reading ${key}:`, err);
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key}:`, err);
  }
}

/* =========================================================
   PUBLIC API ENDPOINTS
========================================================= */

/**
 * POST /api/auth/claim
 * Payload: { token, password, name, language, timings?: { [sectionId]: timing } }
 */
export async function claimAccount({ token, password, name, language, timings = {} }) {
  await delay(280);

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const sections = loadJson(STORAGE_KEYS.SECTIONS, DEFAULT_SECTIONS);
  const updatedSections = sections.map((sec) => {
    if (timings && timings[sec.id]) {
      return { ...sec, defaultTiming: timings[sec.id] };
    }
    return sec;
  });
  saveJson(STORAGE_KEYS.SECTIONS, updatedSections);

  const claimData = {
    isClaimed: true,
    claimedAt: new Date().toISOString(),
    token: token || DEFAULT_INVITE_TOKEN,
    name: name || DEFAULT_FACULTY_NAME,
    languagePreference: language || "English",
    institutionName: DEFAULT_INSTITUTION,
    password: password, // preserved for login validation
  };

  saveJson(STORAGE_KEYS.CLAIM_STATUS, claimData);

  // Sync with general app profile and set logged in
  try {
    localStorage.setItem("teacherGuideTeacherName", claimData.name);
    localStorage.setItem("teacherGuideTeacherLanguage", claimData.languagePreference);
    localStorage.setItem("teacherGuideClaimed", "true");
    localStorage.setItem("teacherGuideLoggedIn", "true");
  } catch {}

  return {
    success: true,
    message: "Account claimed successfully.",
    user: claimData,
  };
}

/**
 * POST /api/auth/login
 * Payload: { emailOrToken, password }
 */
export async function loginTeacher({ emailOrToken, password }) {
  await delay(250);

  const claimData = loadJson(STORAGE_KEYS.CLAIM_STATUS, null);

  // If no account claimed yet
  if (!claimData || !claimData.isClaimed) {
    // Check if user is trying with default demo credentials
    if (password === "Password123!" || password === "admin123") {
      // Auto-claim default account for convenience if desired, or require claim
      throw new Error(
        "No claimed account found for this institution. Please claim your account using your faculty invite token first."
      );
    }
    throw new Error(
      "Account not yet claimed. Please complete the account claim ritual first."
    );
  }

  // Validate password (allow either the set password or demo fallback)
  const storedPassword = claimData.password || "Password123!";
  if (password !== storedPassword && password !== "Password123!" && password !== "admin123") {
    throw new Error("Invalid password. Please verify your credentials and try again.");
  }

  try {
    localStorage.setItem("teacherGuideLoggedIn", "true");
  } catch {}

  return {
    success: true,
    message: "Login successful.",
    user: claimData,
  };
}

/**
 * Log out the current teacher session
 */
export function logoutTeacher() {
  try {
    localStorage.removeItem("teacherGuideLoggedIn");
  } catch {}
}

/**
 * Check if teacher session is currently authenticated
 */
export function isTeacherLoggedIn() {
  try {
    const isClaimed = isAccountClaimed();
    const loggedIn = localStorage.getItem("teacherGuideLoggedIn");
    // If account was claimed before login tracking existed, default to true
    if (isClaimed && loggedIn === null) {
      localStorage.setItem("teacherGuideLoggedIn", "true");
      return true;
    }
    return Boolean(isClaimed && loggedIn === "true");
  } catch {
    return false;
  }
}


/**
 * GET /api/me/sections
 * Returns: [{ id, name, courseTitle, institutionName, defaultTiming, flagged, flagReason }]
 */
export async function getMySections() {
  await delay(180);
  const sections = loadJson(STORAGE_KEYS.SECTIONS, DEFAULT_SECTIONS);
  return sections;
}

/**
 * POST /api/sections/:id/flag
 * Payload: { reason }
 */
export async function flagSection(sectionId, { reason }) {
  await delay(220);
  if (!reason || !reason.trim()) {
    throw new Error("A reason must be provided to flag this section assignment.");
  }

  const sections = loadJson(STORAGE_KEYS.SECTIONS, DEFAULT_SECTIONS);
  let flaggedSec = null;

  const updatedSections = sections.map((sec) => {
    if (sec.id === sectionId) {
      flaggedSec = {
        ...sec,
        flagged: true,
        flagReason: reason.trim(),
        flaggedAt: new Date().toISOString(),
      };
      return flaggedSec;
    }
    return sec;
  });

  saveJson(STORAGE_KEYS.SECTIONS, updatedSections);

  return {
    success: true,
    message: "Section assignment has been flagged for administrator review.",
    section: flaggedSec,
  };
}

/**
 * GET /api/courses/:id/concepts/proposals
 * Returns: [{ edgeId, fromConcept, toConcept, confidence }]
 * Strictly ordered lowest-confidence-first as returned by mock data
 */
export async function getConceptProposals(courseId = "cs-201") {
  await delay(200);
  const allProposals = loadJson(STORAGE_KEYS.CONCEPT_PROPOSALS, DEFAULT_CONCEPT_PROPOSALS);
  const proposals = allProposals[courseId] || DEFAULT_CONCEPT_PROPOSALS["cs-201"] || [];
  return proposals;
}

/**
 * POST /api/courses/:id/concepts/validate
 * Payload: [{ edgeId, decision }] // decision: 'yes' | 'no' | 'skip'
 * Computes confirmed, rejected, skipped, and if >= 80% decided, validates course.
 */
export async function validateConceptDecisions(courseId = "cs-201", decisions = []) {
  await delay(320);

  const existingDecisions = loadJson(STORAGE_KEYS.VALIDATION_DECISIONS, {});
  existingDecisions[courseId] = decisions;
  saveJson(STORAGE_KEYS.VALIDATION_DECISIONS, existingDecisions);

  const total = decisions.length;
  const confirmed = decisions.filter((d) => d.decision === "yes").length;
  const rejected = decisions.filter((d) => d.decision === "no").length;
  const skipped = decisions.filter((d) => d.decision === "skip").length;
  const decidedCount = confirmed + rejected;
  const decidedRate = total > 0 ? Math.round((decidedCount / total) * 100) : 0;
  const isThresholdMet = decidedRate >= 80;

  // Update course validation status
  const courses = loadJson(STORAGE_KEYS.COURSES, DEFAULT_COURSES);
  if (courses[courseId]) {
    courses[courseId] = {
      ...courses[courseId],
      status: isThresholdMet ? "validated" : "parsed but not validated",
      validationStats: {
        confirmed,
        rejected,
        skipped,
        total,
        decidedRate,
        isThresholdMet,
        validatedAt: new Date().toISOString(),
      },
    };
    saveJson(STORAGE_KEYS.COURSES, courses);
  }

  return {
    success: true,
    courseId,
    total,
    confirmed,
    rejected,
    skipped,
    decidedRate,
    isThresholdMet,
    status: isThresholdMet ? "validated" : "parsed but not validated",
  };
}

/**
 * GET /api/courses/:id/status
 */
export async function getCourseStatus(courseId = "cs-201") {
  await delay(120);
  const courses = loadJson(STORAGE_KEYS.COURSES, DEFAULT_COURSES);
  return courses[courseId] || DEFAULT_COURSES["cs-201"];
}

/**
 * GET /api/sections/:id/readiness
 * Returns: [{ concept, percentWeak, totalAssessed }]
 * STRICT CLASS-LEVEL AGGREGATE ONLY — no individual student data
 */
export async function getSectionReadiness(sectionId = "sec-101") {
  await delay(190);
  const readinessMap = loadJson(STORAGE_KEYS.SECTION_READINESS, DEFAULT_SECTION_READINESS);
  return readinessMap[sectionId] || DEFAULT_SECTION_READINESS["sec-101"] || [];
}

/**
 * Convenience helper to check if the current user has completed account claim.
 */
export function isAccountClaimed() {
  const claimData = loadJson(STORAGE_KEYS.CLAIM_STATUS, null);
  if (claimData && claimData.isClaimed) return true;
  return localStorage.getItem("teacherGuideClaimed") === "true";
}

/**
 * Get current claim details.
 */
export function getClaimDetails() {
  return loadJson(STORAGE_KEYS.CLAIM_STATUS, {
    isClaimed: false,
    token: DEFAULT_INVITE_TOKEN,
    name: DEFAULT_FACULTY_NAME,
    languagePreference: "English",
    institutionName: DEFAULT_INSTITUTION,
  });
}

/**
 * Reset onboarding & validation state for clean demonstration/testing.
 */
export function resetOnboardingData() {
  localStorage.removeItem(STORAGE_KEYS.CLAIM_STATUS);
  localStorage.removeItem(STORAGE_KEYS.SECTIONS);
  localStorage.removeItem(STORAGE_KEYS.COURSES);
  localStorage.removeItem(STORAGE_KEYS.CONCEPT_PROPOSALS);
  localStorage.removeItem(STORAGE_KEYS.VALIDATION_DECISIONS);
  localStorage.removeItem(STORAGE_KEYS.SECTION_READINESS);
  localStorage.removeItem("teacherGuideClaimed");
  localStorage.removeItem("teacherGuideLoggedIn");
}

/**
 * Generic mock fetch matching the exact route patterns:
 * /api/auth/claim, /api/auth/login, /api/me/sections, /api/sections/:id/flag,
 * /api/courses/:id/concepts/proposals, /api/courses/:id/concepts/validate,
 * /api/sections/:id/readiness
 */
export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // POST /api/auth/claim
  if (endpoint === "/api/auth/claim" && method === "POST") {
    return claimAccount(body);
  }

  // POST /api/auth/login
  if (endpoint === "/api/auth/login" && method === "POST") {
    return loginTeacher(body);
  }

  // GET /api/me/sections
  if (endpoint === "/api/me/sections" && method === "GET") {
    return getMySections();
  }

  // POST /api/sections/:id/flag
  const flagMatch = endpoint.match(/^\/api\/sections\/([^/]+)\/flag$/);
  if (flagMatch && method === "POST") {
    const sectionId = flagMatch[1];
    return flagSection(sectionId, body);
  }

  // GET /api/courses/:id/concepts/proposals
  const proposalsMatch = endpoint.match(/^\/api\/courses\/([^/]+)\/concepts\/proposals$/);
  if (proposalsMatch && method === "GET") {
    const courseId = proposalsMatch[1];
    return getConceptProposals(courseId);
  }

  // POST /api/courses/:id/concepts/validate
  const validateMatch = endpoint.match(/^\/api\/courses\/([^/]+)\/concepts\/validate$/);
  if (validateMatch && method === "POST") {
    const courseId = validateMatch[1];
    return validateConceptDecisions(courseId, body);
  }

  // GET /api/sections/:id/readiness
  const readinessMatch = endpoint.match(/^\/api\/sections\/([^/]+)\/readiness$/);
  if (readinessMatch && method === "GET") {
    const sectionId = readinessMatch[1];
    return getSectionReadiness(sectionId);
  }

  throw new Error(`Unhandled mock API route: ${method} ${endpoint}`);
}
