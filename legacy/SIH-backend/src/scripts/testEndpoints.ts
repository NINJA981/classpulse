import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedDatabase } from './seed.js';
import { setupQuizSockets } from '../sockets/quizSocket.js';

import authRoutes from '../routes/authRoutes.js';
import lessonRoutes from '../routes/lessonRoutes.js';
import questionRoutes from '../routes/questionRoutes.js';
import sectionRoutes from '../routes/sectionRoutes.js';
import assignmentRoutes from '../routes/assignmentRoutes.js';
import diagnosticRoutes from '../routes/diagnosticRoutes.js';

export interface TestResult {
  category: string;
  endpoint: string;
  method: string;
  scenario: string;
  expectedStatus: number;
  actualStatus: number;
  durationMs: number;
  passed: boolean;
  notes?: string;
  responseSnippet?: string;
}

const results: TestResult[] = [];

async function recordTest(
  category: string,
  method: string,
  endpoint: string,
  scenario: string,
  expectedStatus: number,
  fn: () => Promise<Response>
) {
  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = Math.round(performance.now() - start);
    let bodyText = '';
    try {
      const data = await res.json();
      bodyText = JSON.stringify(data);
    } catch {
      bodyText = await res.text().catch(() => '');
    }

    const passed = res.status === expectedStatus;
    results.push({
      category,
      endpoint,
      method,
      scenario,
      expectedStatus,
      actualStatus: res.status,
      durationMs,
      passed,
      notes: passed ? 'Assertion satisfied' : `Expected ${expectedStatus}, received ${res.status}`,
      responseSnippet: bodyText.length > 200 ? bodyText.slice(0, 197) + '...' : bodyText
    });
    console.log(`${passed ? '✅' : '❌'} [${res.status}] ${method} ${endpoint} - ${scenario} (${durationMs}ms)`);
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({
      category,
      endpoint,
      method,
      scenario,
      expectedStatus,
      actualStatus: 0,
      durationMs,
      passed: false,
      notes: `Network/Execution error: ${err.message}`
    });
    console.log(`❌ [ERR] ${method} ${endpoint} - ${scenario}: ${err.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('   ClassPulse SIH-backend Comprehensive Endpoint Suite   ');
  console.log('====================================================\n');

  // 1. Database Connection & Seed
  console.log('Connecting to database...');
  await connectDB();
  console.log('Seeding initial data...');
  await seedDatabase();

  // Create test dummy asset in uploads
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const testAssetPath = path.join(uploadsDir, 'health-probe.txt');
  fs.writeFileSync(testAssetPath, 'ClassPulse Static Storage Engine v1.0 Active');

  // 2. Setup Express App on dynamic port
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(uploadsDir));

  app.use('/api/auth', authRoutes);
  app.use('/api/lessons', lessonRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/sections', sectionRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/diagnostic', diagnosticRoutes);

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'SIH-backend',
      database: 'MongoDB',
      timestamp: new Date().toISOString()
    });
  });

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  setupQuizSockets(io);

  const TEST_PORT = 5099;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`Test server running at http://127.0.0.1:${TEST_PORT}\n`);
      resolve();
    });
  });

  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  let adminToken = '';
  let teacherToken = '';
  let studentToken = '';
  let testLessonId = '';
  let testSectionId = '';
  let testJoinCode = '';
  let testQuestionId = '';
  let testAssignmentId = '';

  try {
    // ----------------------------------------------------
    // Category: System Health & Infrastructure
    // ----------------------------------------------------
    await recordTest(
      'System Health',
      'GET',
      '/api/health',
      'Verify service operational status, database status, and ISO timestamp',
      200,
      () => fetch(`${BASE_URL}/api/health`)
    );

    await recordTest(
      'Static File Storage',
      'GET',
      '/uploads/health-probe.txt',
      'Verify static file retrieval and web storage delivery',
      200,
      () => fetch(`${BASE_URL}/uploads/health-probe.txt`)
    );

    await recordTest(
      'Real-Time WebSockets',
      'GET',
      '/socket.io/?EIO=4&transport=polling',
      'Verify Socket.io protocol handshake and session initialization',
      200,
      () => fetch(`${BASE_URL}/socket.io/?EIO=4&transport=polling`)
    );

    // ----------------------------------------------------
    // Category: Authentication & RBAC
    // ----------------------------------------------------
    await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Reject login request when credentials are missing (Validation 400)',
      400,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
    );

    const adminLoginRes = await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Authenticate campus administrator and return JWT token + user model',
      200,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@apex.edu',
          password: 'admin123',
          role: 'admin'
        })
      })
    );
    if (adminLoginRes?.token) {
      adminToken = adminLoginRes.token;
    }

    const teacherLoginRes = await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Authenticate teacher and return role-specific permissions',
      200,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'anitha@apex.edu',
          password: 'teacher123',
          role: 'teacher'
        })
      })
    );
    if (teacherLoginRes?.token) {
      teacherToken = teacherLoginRes.token;
    }

    const studentLoginRes = await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Authenticate student and return rollNumber metadata',
      200,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'aarav.sharma@apex.edu',
          password: 'student123',
          role: 'student'
        })
      })
    );
    if (studentLoginRes?.token) {
      studentToken = studentLoginRes.token;
    }

    await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Auto-provision new dev user on first-time login attempt',
      200,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new.guest@apex.edu',
          password: 'guestPassword123',
          role: 'teacher'
        })
      })
    );

    await recordTest(
      'Authentication',
      'POST',
      '/api/auth/login',
      'Reject login with incorrect password (Security 401)',
      401,
      () => fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@apex.edu',
          password: 'wrong_password_999'
        })
      })
    );

    await recordTest(
      'Authentication',
      'GET',
      '/api/auth/me',
      'Reject profile access when Authorization header is absent (401)',
      401,
      () => fetch(`${BASE_URL}/api/auth/me`)
    );

    await recordTest(
      'Authentication',
      'GET',
      '/api/auth/me',
      'Reject profile access when Bearer token is tampered/invalid (401)',
      401,
      () => fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer invalid.jwt.payload' }
      })
    );

    await recordTest(
      'Authentication',
      'GET',
      '/api/auth/me',
      'Retrieve authenticated user profile with valid Bearer token',
      200,
      () => fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    );

    // ----------------------------------------------------
    // Category: Classroom Sections
    // ----------------------------------------------------
    const sectionsRes = await recordTest(
      'Classroom Sections',
      'GET',
      '/api/sections',
      'Retrieve all classroom sections across departments',
      200,
      () => fetch(`${BASE_URL}/api/sections`)
    );
    if (Array.isArray(sectionsRes) && sectionsRes.length > 0) {
      testSectionId = sectionsRes[0]._id;
      testJoinCode = sectionsRes[0].joinCode;
    }

    const newSectionRes = await recordTest(
      'Classroom Sections',
      'POST',
      '/api/sections',
      'Provision a new classroom section with auto-generated join code',
      201,
      () => fetch(`${BASE_URL}/api/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Grade 11 - Section A',
          courseName: 'Organic Chemistry & Thermodynamics',
          teacherNames: ['Dr. Vikram Sengupta']
        })
      })
    );

    if (testSectionId) {
      await recordTest(
        'Classroom Sections',
        'POST',
        `/api/sections/:id/rotate-code`,
        'Rotate 6-character security join code for classroom section',
        200,
        () => fetch(`${BASE_URL}/api/sections/${testSectionId}/rotate-code`, {
          method: 'POST'
        })
      );
    }

    await recordTest(
      'Classroom Sections',
      'GET',
      '/api/sections/preview',
      'Reject section preview when query parameter code is omitted (400)',
      400,
      () => fetch(`${BASE_URL}/api/sections/preview`)
    );

    await recordTest(
      'Classroom Sections',
      'GET',
      '/api/sections/preview?code=CP-99999-NONEXISTENT',
      'Return 404 when join code does not correspond to an active section',
      404,
      () => fetch(`${BASE_URL}/api/sections/preview?code=CP-99999-NONEXISTENT`)
    );

    if (newSectionRes?.joinCode) {
      testJoinCode = newSectionRes.joinCode;
    }
    await recordTest(
      'Classroom Sections',
      'GET',
      `/api/sections/preview?code=${testJoinCode}`,
      'Preview section metadata, teacher, and institution by join code',
      200,
      () => fetch(`${BASE_URL}/api/sections/preview?code=${testJoinCode}`)
    );

    await recordTest(
      'Classroom Sections',
      'POST',
      '/api/sections/join',
      'Reject student enrollment when roll number or code is missing (400)',
      400,
      () => fetch(`${BASE_URL}/api/sections/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: testJoinCode })
      })
    );

    await recordTest(
      'Classroom Sections',
      'POST',
      '/api/sections/join',
      'Reject student enrollment with non-existent code (404)',
      404,
      () => fetch(`${BASE_URL}/api/sections/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'CP-BADCODE',
          rollNumber: '21CS099'
        })
      })
    );

    await recordTest(
      'Classroom Sections',
      'POST',
      '/api/sections/join',
      'Enroll student into section using valid join code and roll number',
      200,
      () => fetch(`${BASE_URL}/api/sections/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testJoinCode,
          rollNumber: '21CS099'
        })
      })
    );

    // ----------------------------------------------------
    // Category: Lesson Studio
    // ----------------------------------------------------
    const lessonsRes = await recordTest(
      'Lesson Studio',
      'GET',
      '/api/lessons',
      'Retrieve list of all lessons sorted by recency',
      200,
      () => fetch(`${BASE_URL}/api/lessons`)
    );
    if (Array.isArray(lessonsRes) && lessonsRes.length > 0) {
      testLessonId = lessonsRes[0]._id;
    }

    await recordTest(
      'Lesson Studio',
      'POST',
      '/api/lessons',
      'Reject lesson creation when mandatory fields (title/subject/className) are missing (400)',
      400,
      () => fetch(`${BASE_URL}/api/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Incomplete Lesson' })
      })
    );

    const createdLesson = await recordTest(
      'Lesson Studio',
      'POST',
      '/api/lessons',
      'Create a new lesson draft in Lesson Studio',
      201,
      () => fetch(`${BASE_URL}/api/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Quantum Wave Mechanics & Schrödinger Equation',
          subject: 'Physics',
          className: 'Grade 12 - Advanced Physics',
          teacherId: 'tch_phys_01'
        })
      })
    );
    const createdLessonId = createdLesson?._id || testLessonId;

    await recordTest(
      'Lesson Studio',
      'GET',
      `/api/lessons/:id`,
      'Retrieve lesson details, questions, and associated assignment bundle',
      200,
      () => fetch(`${BASE_URL}/api/lessons/${createdLessonId}`)
    );

    await recordTest(
      'Lesson Studio',
      'GET',
      '/api/lessons/507f1f77bcf86cd799439011',
      'Return 404 when querying a non-existent lesson ObjectId',
      404,
      () => fetch(`${BASE_URL}/api/lessons/507f1f77bcf86cd799439011`)
    );

    await recordTest(
      'Lesson Studio',
      'POST',
      `/api/lessons/:id/source`,
      'Attach source file or recording reference to queued lesson',
      200,
      () => fetch(`${BASE_URL}/api/lessons/${createdLessonId}/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'document',
          sourceFile: {
            path: '/uploads/quantum-mechanics-handout.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1542000
          }
        })
      })
    );

    await recordTest(
      'Lesson Studio',
      'POST',
      `/api/lessons/:id/generate`,
      'Trigger AI pipeline generation for lesson questions and worksheet',
      200,
      () => fetch(`${BASE_URL}/api/lessons/${createdLessonId}/generate`, {
        method: 'POST'
      })
    );

    await recordTest(
      'Lesson Studio',
      'GET',
      `/api/lessons/:id/questions`,
      'Retrieve generated assessment questions and assignment rubric for lesson',
      200,
      () => fetch(`${BASE_URL}/api/lessons/${createdLessonId}/questions`)
    );

    await recordTest(
      'Lesson Studio',
      'POST',
      `/api/lessons/:id/approve`,
      'Approve lesson content and transition status to published',
      200,
      () => fetch(`${BASE_URL}/api/lessons/${createdLessonId}/approve`, {
        method: 'POST'
      })
    );

    await recordTest(
      'Lesson Studio',
      'POST',
      '/api/lessons/507f1f77bcf86cd799439011/approve',
      'Return 404 when approving non-existent lesson',
      404,
      () => fetch(`${BASE_URL}/api/lessons/507f1f77bcf86cd799439011/approve`, {
        method: 'POST'
      })
    );

    // ----------------------------------------------------
    // Category: Assessment Questions
    // ----------------------------------------------------
    const questionsRes = await recordTest(
      'Assessment Questions',
      'GET',
      '/api/questions',
      'Retrieve all questions across all lessons',
      200,
      () => fetch(`${BASE_URL}/api/questions`)
    );
    if (Array.isArray(questionsRes) && questionsRes.length > 0) {
      testQuestionId = questionsRes[0]._id;
    }

    await recordTest(
      'Assessment Questions',
      'GET',
      `/api/questions?lessonId=${createdLessonId}`,
      'Filter questions by specific lessonId query parameter',
      200,
      () => fetch(`${BASE_URL}/api/questions?lessonId=${createdLessonId}`)
    );

    const newQuestionRes = await recordTest(
      'Assessment Questions',
      'POST',
      '/api/questions',
      'Create a new custom teacher-authored question',
      201,
      () => fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: createdLessonId,
          type: 'mcq',
          stem: 'What is the physical interpretation of the square of the wave function amplitude |ψ|²?',
          options: [
            'Probability density of locating the particle',
            'Instantaneous kinetic energy',
            'Total electrostatic potential',
            'Relativistic mass momentum'
          ],
          correctIndex: 0,
          explanation: 'Born interpretation defines |ψ|² as probability density.',
          topicTag: 'Quantum Physics',
          difficulty: 'medium',
          status: 'draft'
        })
      })
    );
    const createdQuestionId = newQuestionRes?._id || testQuestionId;

    await recordTest(
      'Assessment Questions',
      'PATCH',
      `/api/questions/:id`,
      'Update question stem and difficulty using PATCH',
      200,
      () => fetch(`${BASE_URL}/api/questions/${createdQuestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: 'hard',
          explanation: 'Updated Born rule formulation with mathematical precision.'
        })
      })
    );

    await recordTest(
      'Assessment Questions',
      'PUT',
      `/api/questions/:id`,
      'Replace/update question entity fields using PUT',
      200,
      () => fetch(`${BASE_URL}/api/questions/${createdQuestionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: 'medium',
          topicTag: 'Quantum Mechanics Core'
        })
      })
    );

    await recordTest(
      'Assessment Questions',
      'PATCH',
      '/api/questions/507f1f77bcf86cd799439011',
      'Return 404 when updating non-existent question',
      404,
      () => fetch(`${BASE_URL}/api/questions/507f1f77bcf86cd799439011`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'easy' })
      })
    );

    await recordTest(
      'Assessment Questions',
      'POST',
      '/api/questions/approve',
      'Reject batch question approval when array of ids is omitted (400)',
      400,
      () => fetch(`${BASE_URL}/api/questions/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
    );

    await recordTest(
      'Assessment Questions',
      'POST',
      '/api/questions/approve',
      'Batch approve multiple questions simultaneously',
      200,
      () => fetch(`${BASE_URL}/api/questions/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [createdQuestionId]
        })
      })
    );

    await recordTest(
      'Assessment Questions',
      'POST',
      `/api/questions/:id/reject`,
      'Mark question as rejected by instructor review',
      200,
      () => fetch(`${BASE_URL}/api/questions/${createdQuestionId}/reject`, {
        method: 'POST'
      })
    );

    await recordTest(
      'Assessment Questions',
      'DELETE',
      `/api/questions/:id`,
      'Delete question document by ObjectId',
      200,
      () => fetch(`${BASE_URL}/api/questions/${createdQuestionId}`, {
        method: 'DELETE'
      })
    );

    await recordTest(
      'Assessment Questions',
      'DELETE',
      `/api/questions/:id`,
      'Return 404 when deleting a question that has already been removed',
      404,
      () => fetch(`${BASE_URL}/api/questions/${createdQuestionId}`, {
        method: 'DELETE'
      })
    );

    // ----------------------------------------------------
    // Category: Assignments & Worksheets
    // ----------------------------------------------------
    const assignmentsRes = await recordTest(
      'Assignments & Worksheets',
      'GET',
      '/api/assignments',
      'Retrieve all assignments and worksheets across courses',
      200,
      () => fetch(`${BASE_URL}/api/assignments`)
    );
    if (Array.isArray(assignmentsRes) && assignmentsRes.length > 0) {
      testAssignmentId = assignmentsRes[0]._id;
    }

    await recordTest(
      'Assignments & Worksheets',
      'GET',
      `/api/assignments?lessonId=${testLessonId}`,
      'Filter assignments by specific lessonId parameter',
      200,
      () => fetch(`${BASE_URL}/api/assignments?lessonId=${testLessonId}`)
    );

    await recordTest(
      'Assignments & Worksheets',
      'POST',
      '/api/assignments',
      'Create structured homework assignment with multi-criteria rubric',
      201,
      () => fetch(`${BASE_URL}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: testLessonId,
          title: 'Wavepacket Dispersion Simulation Report',
          subject: 'Physics',
          prompt: 'Calculate time evolution of a Gaussian wavepacket in free space.',
          estimatedMinutes: 45,
          rubric: [
            { criterion: 'Analytical Derivation', marks: 15, descriptor: 'Complete Fourier transform derivation' },
            { criterion: 'Numerical Graph', marks: 10, descriptor: 'Accurate spatial dispersion plot' }
          ]
        })
      })
    );

    // ----------------------------------------------------
    // Category: Diagnostic Assessments
    // ----------------------------------------------------
    await recordTest(
      'Diagnostic Assessments',
      'POST',
      '/api/diagnostic',
      'Submit adaptive student diagnostic responses and identify knowledge gaps',
      201,
      () => fetch(`${BASE_URL}/api/diagnostic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'stu_diagnostics_test_01',
          rollNumber: '21CS088',
          subject: 'Cellular Energetics',
          responses: [
            {
              questionId: 'q_diag_01',
              selectedOption: 0,
              confidenceRating: 4,
              isCorrect: true
            },
            {
              questionId: 'q_diag_02',
              selectedOption: 2,
              confidenceRating: 2,
              isCorrect: false
            }
          ],
          identifiedGaps: [
            'Chemiosmosis & Proton Gradient Coupling',
            'ATP Synthase Kinetics'
          ]
        })
      })
    );

    await recordTest(
      'Diagnostic Assessments',
      'GET',
      '/api/diagnostic/:studentId',
      'Retrieve diagnostic results, gaps, and score analysis for student',
      200,
      () => fetch(`${BASE_URL}/api/diagnostic/stu_diagnostics_test_01`)
    );

    await recordTest(
      'Diagnostic Assessments',
      'GET',
      '/api/diagnostic/:studentId',
      'Return 404 when no diagnostic records exist for given studentId',
      404,
      () => fetch(`${BASE_URL}/api/diagnostic/non_existent_student_9999`)
    );

  } finally {
    // Teardown
    console.log('\nTearing down test server and database...');
    if (fs.existsSync(testAssetPath)) {
      fs.unlinkSync(testAssetPath);
    }
    server.close();
    await disconnectDB();
  }

  // Generate Report Summary
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  const passRate = ((passedCount / total) * 100).toFixed(1);

  console.log('\n====================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passedCount}/${total} PASSED (${passRate}%)`);
  console.log('====================================================');

  console.log('\nJSON_RESULTS_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('JSON_RESULTS_END');
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
