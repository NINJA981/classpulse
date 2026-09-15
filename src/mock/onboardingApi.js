/**
 * Mock API module for Onboarding & Setup
 * Simulates network latency with realistic delays and mimics backend REST endpoints:
 * - POST /api/institutions
 * - POST /api/imports/roster -> { importJobId }
 * - GET /api/imports/:id -> { status, rowCount, successCount, errors: [{row, field, message}] }
 * - POST /api/imports/:id/confirm
 * - GET /api/sections?courseId= -> [{ id, name, joinCode, joinCodeExpiresAt, teacherNames, enrolledCount }]
 * - POST /api/sections/:id/rotate-code
 * - POST /api/courses/:id/syllabus -> { importJobId }
 * - GET /api/courses/:id/concepts -> [{ id, title, unit, order, coTags, bloomLevel }]
 *
 * Keep all API calls behind this one module so a real backend can be swapped in later
 * by changing only its internals. Component state and props do not know or care that data is mocked.
 */

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock In-Memory Database
const db = {
  institution: {
    id: 'inst-apex-01',
    name: 'Apex Institute of Technology',
    code: 'apex-tech',
    emailDomains: ['apex.edu', 'alumni.apex.edu'],
    timezone: 'Asia/Kolkata (IST, UTC+05:30)',
    academicYear: '2026-2027',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'active'
  },

  importJobs: {
    'job-init-101': {
      id: 'job-init-101',
      status: 'done',
      files: ['departments.csv', 'courses.csv', 'sections.csv', 'students.csv'],
      rowCount: 148,
      successCount: 144,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      confirmed: false,
      errors: [
        {
          row: 14,
          field: 'email',
          value: 'karthik.s@gmail.com',
          message: 'Domain @gmail.com not permitted. Must match @apex.edu',
          suggestedValue: 'karthik.s@apex.edu'
        },
        {
          row: 28,
          field: 'rollNumber',
          value: '',
          message: 'Missing required unique Roll Number for student: Priya Ram',
          suggestedValue: '21CS094'
        },
        {
          row: 73,
          field: 'sectionNames',
          value: 'SEC-X',
          message: 'Referenced section SEC-X does not exist in sections.csv',
          suggestedValue: 'SEC-A'
        },
        {
          row: 102,
          field: 'email',
          value: 'anand.v@yahoo.com',
          message: 'Domain @yahoo.com not permitted. Must match @apex.edu',
          suggestedValue: 'anand.v@apex.edu'
        }
      ]
    }
  },

  courses: [
    {
      id: 'cs-301',
      code: 'CS301',
      title: 'Data Structures & Algorithms in C++',
      department: 'Computer Science',
      credits: 4,
      semester: 'Semester 3',
      status: 'validated', // 'none' | 'uploaded' | 'parsed' | 'validated'
      syllabusFileName: 'CS301_Data_Structures_Syllabus_2026.pdf',
      copoFileName: 'CS301_CO_PO_Matrix.xlsx',
      uploadedAt: '2026-08-14T09:30:00Z',
      conceptCount: 18
    },
    {
      id: 'cs-304',
      code: 'CS304',
      title: 'Database Management Systems & SQL',
      department: 'Computer Science',
      credits: 3,
      semester: 'Semester 3',
      status: 'parsed',
      syllabusFileName: 'CS304_DBMS_Syllabus_2026.pdf',
      copoFileName: 'CS304_CO_PO_Matrix.xlsx',
      uploadedAt: '2026-08-15T11:20:00Z',
      conceptCount: 14
    },
    {
      id: 'ec-202',
      code: 'EC202',
      title: 'Digital Electronics & Logic Design',
      department: 'Electronics & Comm.',
      credits: 4,
      semester: 'Semester 2',
      status: 'uploaded',
      syllabusFileName: 'EC202_Digital_Electronics.pdf',
      copoFileName: 'EC202_CO_PO_Mapping.xlsx',
      uploadedAt: '2026-08-20T14:15:00Z',
      conceptCount: 0
    },
    {
      id: 'ma-201',
      code: 'MA201',
      title: 'Probability, Statistics & Linear Algebra',
      department: 'Mathematics',
      credits: 4,
      semester: 'Semester 2',
      status: 'none',
      syllabusFileName: null,
      copoFileName: null,
      uploadedAt: null,
      conceptCount: 0
    },
    {
      id: 'ai-401',
      code: 'AI401',
      title: 'Artificial Intelligence & Intelligent Agents',
      department: 'Artificial Intelligence',
      credits: 4,
      semester: 'Semester 4',
      status: 'validated',
      syllabusFileName: 'AI401_Core_Syllabus_2026.pdf',
      copoFileName: 'AI401_CO_PO_Outcomes.xlsx',
      uploadedAt: '2026-08-22T08:45:00Z',
      conceptCount: 16
    }
  ],

  concepts: {
    'cs-301': [
      { id: 'cnc-01', unit: 'Unit 1: Linear Structures', order: 1, title: 'Asymptotic Analysis & Big-O Notation', coTags: ['CO1'], bloomLevel: 'L2 Understand' },
      { id: 'cnc-02', unit: 'Unit 1: Linear Structures', order: 2, title: 'Dynamic Array Allocation & Amortized Doubling', coTags: ['CO1', 'CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-03', unit: 'Unit 1: Linear Structures', order: 3, title: 'Singly and Doubly Linked Lists Pointer Arithmetic', coTags: ['CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-04', unit: 'Unit 1: Linear Structures', order: 4, title: 'Stack Infix to Postfix Evaluation and Call Stack Frames', coTags: ['CO2'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-05', unit: 'Unit 2: Tree Hierarchies', order: 5, title: 'Binary Search Trees Insert, Search & Deletion Cases', coTags: ['CO3'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-06', unit: 'Unit 2: Tree Hierarchies', order: 6, title: 'AVL Trees Height Balance & Four Rotation Types', coTags: ['CO3'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-07', unit: 'Unit 2: Tree Hierarchies', order: 7, title: 'Binary Min/Max Heaps & Priority Queues', coTags: ['CO3'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-08', unit: 'Unit 3: Graphs & Shortest Paths', order: 8, title: 'Graph Representations: Adjacency Matrix vs List', coTags: ['CO4'], bloomLevel: 'L2 Understand' },
      { id: 'cnc-09', unit: 'Unit 3: Graphs & Shortest Paths', order: 9, title: 'Breadth-First and Depth-First Search Traversals', coTags: ['CO4'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-10', unit: 'Unit 3: Graphs & Shortest Paths', order: 10, title: 'Dijkstra Single-Source Shortest Path Algorithm', coTags: ['CO4', 'CO5'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-11', unit: 'Unit 3: Graphs & Shortest Paths', order: 11, title: 'Kruskal and Prim Minimum Spanning Trees', coTags: ['CO4'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-12', unit: 'Unit 4: Hashing & Sorting', order: 12, title: 'Hash Collision Resolution: Chaining vs Open Addressing', coTags: ['CO5'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-13', unit: 'Unit 4: Hashing & Sorting', order: 13, title: 'Divide-and-Conquer Quicksort & Pivot Strategies', coTags: ['CO5'], bloomLevel: 'L4 Analyze' }
    ],
    'cs-304': [
      { id: 'cnc-21', unit: 'Unit 1: Relational Foundations', order: 1, title: 'Relational Model, Schemas, & Primary/Foreign Keys', coTags: ['CO1'], bloomLevel: 'L2 Understand' },
      { id: 'cnc-22', unit: 'Unit 1: Relational Foundations', order: 2, title: 'Relational Algebra: Select, Project, Join, Cartesian', coTags: ['CO1', 'CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-23', unit: 'Unit 2: SQL & Query Execution', order: 3, title: 'Complex Aggregations, GROUP BY, and HAVING Clauses', coTags: ['CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-24', unit: 'Unit 2: SQL & Query Execution', order: 4, title: 'Subqueries, Correlated Subqueries, and Window Functions', coTags: ['CO2', 'CO3'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-25', unit: 'Unit 3: Normalization & Schema Design', order: 5, title: 'Functional Dependencies & Closure Calculations', coTags: ['CO3'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-26', unit: 'Unit 3: Normalization & Schema Design', order: 6, title: '1NF, 2NF, 3NF and Boyce-Codd Normal Form (BCNF)', coTags: ['CO3'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-27', unit: 'Unit 4: Transactions & Concurrency', order: 7, title: 'ACID Properties and Serializability Conflict Graphs', coTags: ['CO4'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-28', unit: 'Unit 4: Transactions & Concurrency', order: 8, title: 'Two-Phase Locking (2PL) and Deadlock Handling', coTags: ['CO4', 'CO5'], bloomLevel: 'L4 Analyze' }
    ],
    'ai-401': [
      { id: 'cnc-31', unit: 'Unit 1: Intelligent Agents & Search', order: 1, title: 'PEAS Specification and Rational Agent Architectures', coTags: ['CO1'], bloomLevel: 'L2 Understand' },
      { id: 'cnc-32', unit: 'Unit 1: Intelligent Agents & Search', order: 2, title: 'Informed Heuristic Search: A* Algorithm & Admissibility', coTags: ['CO1', 'CO2'], bloomLevel: 'L4 Analyze' },
      { id: 'cnc-33', unit: 'Unit 2: Adversarial Games', order: 3, title: 'Minimax Algorithm with Alpha-Beta Pruning Bounds', coTags: ['CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-34', unit: 'Unit 3: Knowledge Representation', order: 4, title: 'First-Order Logic Resolution and Forward Chaining', coTags: ['CO3'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-35', unit: 'Unit 4: Probabilistic Reasoning', order: 5, title: 'Bayesian Networks Conditional Independence Semantics', coTags: ['CO4'], bloomLevel: 'L4 Analyze' }
    ]
  },

  sections: [
    {
      id: 'sec-cs301-a',
      courseId: 'cs-301',
      name: 'Section A (Core)',
      joinCode: 'CP-4821',
      joinCodeExpiresAt: new Date(Date.now() + 14 * 3600000).toISOString(),
      teacherNames: ['Dr. Anitha', 'Prof. Rajesh Kumar'],
      enrolledCount: 42
    },
    {
      id: 'sec-cs301-b',
      courseId: 'cs-301',
      name: 'Section B (Accelerated)',
      joinCode: 'CP-9304',
      joinCodeExpiresAt: new Date(Date.now() + 22 * 3600000).toISOString(),
      teacherNames: ['Dr. Meena Sundaram'],
      enrolledCount: 38
    },
    {
      id: 'sec-cs304-a',
      courseId: 'cs-304',
      name: 'Section A (Morning)',
      joinCode: 'CP-1582',
      joinCodeExpiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      teacherNames: ['Prof. Vikram Seth'],
      enrolledCount: 45
    },
    {
      id: 'sec-cs304-b',
      courseId: 'cs-304',
      name: 'Section B (Evening)',
      joinCode: 'CP-6729',
      joinCodeExpiresAt: new Date(Date.now() + 36 * 3600000).toISOString(),
      teacherNames: ['Dr. Anitha'],
      enrolledCount: 40
    },
    {
      id: 'sec-ai401-a',
      courseId: 'ai-401',
      name: 'Section A (Honors)',
      joinCode: 'CP-7710',
      joinCodeExpiresAt: new Date(Date.now() + 18 * 3600000).toISOString(),
      teacherNames: ['Dr. Alan Turing', 'Dr. Meena Sundaram'],
      enrolledCount: 32
    },
    {
      id: 'sec-ec202-a',
      courseId: 'ec-202',
      name: 'Section A (General)',
      joinCode: 'CP-3209',
      joinCodeExpiresAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      teacherNames: ['Prof. Rajesh Kumar'],
      enrolledCount: 36
    },
    {
      id: 'sec-ma201-a',
      courseId: 'ma-201',
      name: 'Section A (Foundation)',
      joinCode: 'CP-8842',
      joinCodeExpiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      teacherNames: ['Prof. Vikram Seth'],
      enrolledCount: 50
    }
  ]
};

// Generate random alphanumeric 4-digit code e.g. "CP-7931"
const generateRandomJoinCode = () => {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `CP-${digits}`;
};

/**
 * Public Onboarding API facade.
 * All functions return Promises resolving to data objects.
 */
export const onboardingApi = {
  /**
   * POST /api/institutions
   * Create or update the institution profile.
   */
  async createInstitution(payload) {
    await delay(500);
    const { name, code, emailDomains, timezone, academicYear } = payload;
    if (!name || !code) {
      throw new Error('Institution name and code are required.');
    }
    const record = {
      id: `inst-${code}-${Date.now().toString(36)}`,
      name: name.trim(),
      code: code.trim().toLowerCase().replace(/\s+/g, '-'),
      emailDomains: Array.isArray(emailDomains) ? emailDomains : [emailDomains].filter(Boolean),
      timezone: timezone || 'Asia/Kolkata (IST, UTC+05:30)',
      academicYear: academicYear || '2026-2027',
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.institution = record;
    return { ...record };
  },

  /**
   * GET /api/institutions/current
   * Get the active institution record.
   */
  async getCurrentInstitution() {
    await delay(300);
    return db.institution ? { ...db.institution } : null;
  },

  /**
   * POST /api/imports/roster
   * Initiate a roster import job. Returns { importJobId }.
   */
  async uploadRoster(fileData = {}) {
    await delay(600);
    const importJobId = `job-${Date.now().toString(36)}`;
    const newJob = {
      id: importJobId,
      status: 'pending', // 'pending' -> 'processing' -> 'done'
      files: Object.keys(fileData).length > 0 ? Object.keys(fileData) : ['departments.csv', 'courses.csv', 'sections.csv', 'students.csv'],
      rowCount: 148,
      successCount: 144,
      createdAt: new Date().toISOString(),
      confirmed: false,
      errors: [
        {
          row: 14,
          field: 'email',
          value: 'karthik.s@gmail.com',
          message: 'Domain @gmail.com not permitted. Must match @apex.edu',
          suggestedValue: 'karthik.s@apex.edu'
        },
        {
          row: 28,
          field: 'rollNumber',
          value: '',
          message: 'Missing required unique Roll Number for student: Priya Ram',
          suggestedValue: '21CS094'
        },
        {
          row: 73,
          field: 'sectionNames',
          value: 'SEC-X',
          message: 'Referenced section SEC-X does not exist in sections.csv',
          suggestedValue: 'SEC-A'
        },
        {
          row: 102,
          field: 'email',
          value: 'anand.v@yahoo.com',
          message: 'Domain @yahoo.com not permitted. Must match @apex.edu',
          suggestedValue: 'anand.v@apex.edu'
        }
      ]
    };

    db.importJobs[importJobId] = newJob;
    return { importJobId };
  },

  /**
   * GET /api/imports/:id
   * Get the current status and errors of an import job.
   */
  async getImportStatus(importJobId) {
    await delay(350);
    const job = db.importJobs[importJobId] || db.importJobs['job-init-101'];
    if (!job) {
      throw new Error(`Import job ${importJobId} not found.`);
    }
    return {
      id: job.id,
      status: job.status,
      rowCount: job.rowCount,
      successCount: job.successCount,
      errors: job.errors.map((err) => ({ ...err }))
    };
  },

  /**
   * Simulate job stage transition: 'pending' -> 'processing' -> 'done'
   */
  async advanceJobProgress(importJobId, targetStatus) {
    await delay(400);
    const job = db.importJobs[importJobId];
    if (job) {
      job.status = targetStatus;
    }
    return { status: targetStatus };
  },

  /**
   * Fix a specific error row inline and re-check.
   */
  async fixImportRow(importJobId, rowNumber, field, newValue) {
    await delay(450);
    const job = db.importJobs[importJobId] || db.importJobs['job-init-101'];
    if (!job) throw new Error('Job not found');

    const errIndex = job.errors.findIndex((e) => e.row === rowNumber && e.field === field);
    if (errIndex === -1) {
      return { success: true, message: 'Row already clean or verified.' };
    }

    // Validation logic
    let isValid = false;
    let feedback = '';

    if (field === 'email') {
      const activeDomain = db.institution?.emailDomains?.[0] || 'apex.edu';
      if (newValue && (newValue.endsWith(`@${activeDomain}`) || newValue.includes('@apex.'))) {
        isValid = true;
      } else {
        feedback = `Must end with @${activeDomain}`;
      }
    } else if (field === 'rollNumber') {
      if (newValue && newValue.trim().length >= 3) {
        isValid = true;
      } else {
        feedback = 'Roll number must be at least 3 characters.';
      }
    } else if (field === 'sectionNames') {
      if (['SEC-A', 'SEC-B', 'Section A', 'Section B'].includes(newValue.trim())) {
        isValid = true;
      } else {
        feedback = 'Valid sections: SEC-A, SEC-B';
      }
    }

    if (isValid) {
      job.errors.splice(errIndex, 1);
      job.successCount = Math.min(job.rowCount, job.successCount + 1);
      return {
        resolved: true,
        message: 'Re-check passed. Row resolved.',
        remainingErrors: job.errors.length,
        successCount: job.successCount
      };
    } else {
      job.errors[errIndex].value = newValue;
      job.errors[errIndex].message = feedback || 'Invalid value provided.';
      return {
        resolved: false,
        message: feedback || 'Validation failed. Please correct the value.',
        remainingErrors: job.errors.length,
        successCount: job.successCount
      };
    }
  },

  /**
   * POST /api/imports/:id/confirm
   * Finalize and confirm roster import.
   */
  async confirmImport(importJobId) {
    await delay(500);
    const job = db.importJobs[importJobId] || db.importJobs['job-init-101'];
    if (job) {
      job.confirmed = true;
    }
    return {
      success: true,
      confirmedAt: new Date().toISOString(),
      importedCount: job ? job.successCount : 144
    };
  },

  /**
   * GET /api/courses
   * List all courses with their syllabus statuses.
   */
  async getCourses() {
    await delay(350);
    return db.courses.map((c) => ({ ...c }));
  },

  /**
   * POST /api/courses/:id/syllabus
   * Upload syllabus PDF and CO-PO mapping sheet for a course.
   */
  async uploadSyllabus(courseId, { syllabusFileName = 'syllabus.pdf', copoFileName = 'co_po_matrix.xlsx' } = {}) {
    await delay(650);
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) {
      throw new Error(`Course ${courseId} not found.`);
    }

    course.status = 'parsed';
    course.syllabusFileName = syllabusFileName;
    course.copoFileName = copoFileName;
    course.uploadedAt = new Date().toISOString();
    course.conceptCount = 14;

    const importJobId = `job-syl-${Date.now().toString(36)}`;
    return {
      importJobId,
      courseId,
      status: course.status
    };
  },

  /**
   * Mark course as validated
   */
  async validateCourseSyllabus(courseId) {
    await delay(300);
    const course = db.courses.find((c) => c.id === courseId);
    if (course) {
      course.status = 'validated';
    }
    return { success: true, courseId, status: course?.status };
  },

  /**
   * GET /api/courses/:id/concepts
   * Returns [{ id, title, unit, order, coTags, bloomLevel }]
   */
  async getCourseConcepts(courseId) {
    await delay(400);
    const conceptList = db.concepts[courseId] || [
      { id: 'cnc-gen-01', unit: 'Unit 1: Foundations', order: 1, title: 'Course Core Axioms & Scope', coTags: ['CO1'], bloomLevel: 'L2 Understand' },
      { id: 'cnc-gen-02', unit: 'Unit 1: Foundations', order: 2, title: 'Mathematical Formulations', coTags: ['CO1', 'CO2'], bloomLevel: 'L3 Apply' },
      { id: 'cnc-gen-03', unit: 'Unit 2: Applied Paradigms', order: 3, title: 'Algorithmic Optimization Framework', coTags: ['CO3'], bloomLevel: 'L4 Analyze' }
    ];
    return conceptList.map((node) => ({ ...node }));
  },

  /**
   * GET /api/sections?courseId=
   * Returns [{ id, name, joinCode, joinCodeExpiresAt, teacherNames, enrolledCount }]
   */
  async getSections(courseId = null) {
    await delay(350);
    let list = db.sections;
    if (courseId) {
      list = list.filter((s) => s.courseId === courseId);
    }
    return list.map((sec) => ({ ...sec }));
  },

  /**
   * POST /api/sections/:id/rotate-code
   * Rotate a section's join code with new expiry.
   */
  async rotateSectionCode(sectionId) {
    await delay(450);
    const section = db.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    const newCode = generateRandomJoinCode();
    section.joinCode = newCode;
    // Set 24 hours from now
    section.joinCodeExpiresAt = new Date(Date.now() + 24 * 3600000).toISOString();

    return { ...section };
  }
};
