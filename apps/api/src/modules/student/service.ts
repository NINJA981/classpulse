import path from 'node:path';
import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type {
  Guardian,
  GuardianInput,
  QuizAttemptResult,
  SectionPreview,
  SessionResponse,
  StudentAssignment,
  StudentAssignmentState,
  StudentDashboard,
  StudentQuiz,
  StudentQuizListItem,
  StudentSection,
  SubmitAssignmentInput,
  SubmitQuizAttemptInput,
  UpdateStudentProfileInput,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import {
  assignments,
  assignmentSubmissions,
  enrollments,
  guardians,
  lessons,
  questions,
  quizAttemptAnswers,
  quizAttempts,
  sections,
  sectionTeachers,
  submissionFiles,
  users,
} from '../../db/schema/index.js';
import { AppError, badRequest, conflict, invalidState, isUniqueViolation, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { toSessionUser } from '../../lib/session.js';
import { storage, storageKeys } from '../../lib/storage.js';
import { filesBySubmission, maxMarksOf, toSubmissionFile, type SubmissionFileRow } from '../assignments/repo.js';
import { cleanupUploads, uploadExtension } from '../assignments/upload.js';
import { EMAIL_UNIQUE } from '../auth/accounts.js';

const IDEMPOTENCY_UNIQUE = 'quiz_attempts_idempotency_unique';
const RECENT_ATTEMPTS = 5;
const UPCOMING_ASSIGNMENTS = 5;

const roundPct = (n: number) => Math.round(n * 10) / 10;
const isoFromDb = (v: string | Date) => new Date(v).toISOString();

/* ----------------------------------------------------------------------------
 * Visibility: a student sees published lessons of sections they are enrolled in.
 * ------------------------------------------------------------------------- */

const enrolledSectionIds = (studentId: string) =>
  db.select({ id: enrollments.sectionId }).from(enrollments).where(eq(enrollments.studentId, studentId));

const visibleLessons = (studentId: string): SQL =>
  and(eq(lessons.status, 'published'), inArray(lessons.sectionId, enrolledSectionIds(studentId)))!;

async function getVisibleLesson(studentId: string, lessonId: string) {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), visibleLessons(studentId)));
  if (!lesson) throw notFound('Quiz');
  return lesson;
}

/* ----------------------------------------------------------------------------
 * Sections & enrollment
 * ------------------------------------------------------------------------- */

const teacherNamesJson = sql<string[]>`coalesce((
  select json_agg(u.name order by u.name)
  from ${sectionTeachers} st join ${users} u on u.id = st.teacher_id
  where st.section_id = "sections"."id"
), '[]'::json)`;

export async function listMySections(studentId: string): Promise<StudentSection[]> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      subject: sections.subject,
      grade: sections.grade,
      teachers: teacherNamesJson,
      joinedAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(sections, eq(sections.id, enrollments.sectionId))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(asc(sections.name));
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

async function findSectionByCode(institutionId: string, joinCode: string) {
  const [row] = await db
    .select({
      id: sections.id,
      name: sections.name,
      subject: sections.subject,
      grade: sections.grade,
      joinCodeExpiresAt: sections.joinCodeExpiresAt,
      teachers: teacherNamesJson,
    })
    .from(sections)
    .where(and(eq(sections.joinCode, joinCode), eq(sections.institutionId, institutionId)));
  if (!row) throw notFound('Class');
  return row;
}

async function isEnrolled(studentId: string, sectionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.sectionId })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.sectionId, sectionId)));
  return Boolean(row);
}

const expiredCode = () => invalidState('This join code has expired. Ask your teacher for a new one.');

export async function previewSection(studentId: string, institutionId: string, joinCode: string): Promise<SectionPreview> {
  const section = await findSectionByCode(institutionId, joinCode);
  const alreadyEnrolled = await isEnrolled(studentId, section.id);
  if (!alreadyEnrolled && section.joinCodeExpiresAt.getTime() <= Date.now()) throw expiredCode();
  return {
    id: section.id,
    name: section.name,
    subject: section.subject,
    grade: section.grade,
    teachers: section.teachers,
    alreadyEnrolled,
  };
}

export async function joinSection(
  studentId: string,
  institutionId: string,
  joinCode: string,
): Promise<{ section: StudentSection; created: boolean }> {
  const section = await findSectionByCode(institutionId, joinCode);
  let created = false;
  if (!(await isEnrolled(studentId, section.id))) {
    if (section.joinCodeExpiresAt.getTime() <= Date.now()) throw expiredCode();
    const inserted = await db
      .insert(enrollments)
      .values({ sectionId: section.id, studentId })
      .onConflictDoNothing()
      .returning({ id: enrollments.sectionId });
    created = inserted.length > 0;
  }
  const mine = await listMySections(studentId);
  const joined = mine.find((s) => s.id === section.id);
  if (!joined) throw notFound('Class');
  return { section: joined, created };
}

/* ----------------------------------------------------------------------------
 * Quizzes
 * ------------------------------------------------------------------------- */

const approvedCountSql = sql<number>`(select count(*)::int from ${questions} q where q.lesson_id = "lessons"."id" and q.status = 'approved')`;

export async function listQuizzes(studentId: string): Promise<StudentQuizListItem[]> {
  const latestAttemptJson = sql<{ id: string; scorePct: number; submittedAt: string } | null>`(
    select json_build_object('id', qa.id, 'scorePct', qa.score_pct, 'submittedAt', qa.submitted_at)
    from ${quizAttempts} qa
    where qa.lesson_id = "lessons"."id" and qa.student_id = ${studentId}
    order by qa.submitted_at desc
    limit 1
  )`;
  const rows = await db
    .select({
      lessonId: lessons.id,
      title: lessons.title,
      subject: lessons.subject,
      sectionId: sections.id,
      sectionName: sections.name,
      teacherName: users.name,
      questionCount: approvedCountSql,
      publishedAt: lessons.publishedAt,
      createdAt: lessons.createdAt,
      latestAttempt: latestAttemptJson,
    })
    .from(lessons)
    .innerJoin(sections, eq(sections.id, lessons.sectionId))
    .innerJoin(users, eq(users.id, lessons.teacherId))
    .where(visibleLessons(studentId))
    .orderBy(desc(lessons.publishedAt), desc(lessons.createdAt));
  return rows.map((r) => ({
    lessonId: r.lessonId,
    title: r.title,
    subject: r.subject,
    section: { id: r.sectionId, name: r.sectionName },
    teacherName: r.teacherName,
    questionCount: r.questionCount,
    publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
    latestAttempt: r.latestAttempt
      ? { id: r.latestAttempt.id, scorePct: r.latestAttempt.scorePct, submittedAt: isoFromDb(r.latestAttempt.submittedAt) }
      : null,
  }));
}

const approvedQuestions = (lessonId: string) =>
  db
    .select()
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), eq(questions.status, 'approved')))
    .orderBy(asc(questions.position));

export async function getQuiz(studentId: string, lessonId: string): Promise<StudentQuiz> {
  const lesson = await getVisibleLesson(studentId, lessonId);
  const qs = await approvedQuestions(lessonId);
  return {
    lessonId: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    summary: lesson.summary,
    keyTakeaways: lesson.keyTakeaways,
    // Student-safe projection: never include correctIndex or explanations.
    questions: qs.map((q) => ({
      id: q.id,
      position: q.position,
      stem: q.stem,
      stemLocal: q.stemLocal,
      options: q.options,
      optionsLocal: q.optionsLocal,
      difficulty: q.difficulty,
    })),
  };
}

/** Builds the graded result from the stored snapshots (identical for the first submit and every replay). */
async function loadAttemptResult(attemptId: string): Promise<QuizAttemptResult> {
  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId));
  if (!attempt) throw notFound('Attempt');
  const answers = await db
    .select({
      questionId: quizAttemptAnswers.questionId,
      stem: quizAttemptAnswers.stemSnapshot,
      options: quizAttemptAnswers.optionsSnapshot,
      selectedIndex: quizAttemptAnswers.selectedIndex,
      correctIndex: quizAttemptAnswers.correctIndexSnapshot,
      isCorrect: quizAttemptAnswers.isCorrect,
      explanation: questions.explanation,
      explanationLocal: questions.explanationLocal,
      citationStartSec: questions.citationStartSec,
      citationEndSec: questions.citationEndSec,
      difficulty: questions.difficulty,
    })
    .from(quizAttemptAnswers)
    .leftJoin(questions, eq(questions.id, quizAttemptAnswers.questionId))
    .where(eq(quizAttemptAnswers.attemptId, attemptId))
    .orderBy(asc(quizAttemptAnswers.position));
  return {
    id: attempt.id,
    lessonId: attempt.lessonId,
    correct: attempt.correct,
    total: attempt.total,
    scorePct: attempt.scorePct,
    submittedAt: attempt.submittedAt.toISOString(),
    answers: answers.map((a) => ({
      // A question deleted after the attempt keeps its snapshot; its id is no longer resolvable.
      questionId: a.questionId ?? '',
      stem: a.stem,
      options: a.options,
      selectedIndex: a.selectedIndex,
      correctIndex: a.correctIndex,
      isCorrect: a.isCorrect,
      explanation: a.explanation,
      explanationLocal: a.explanationLocal,
      citationStartSec: a.citationStartSec,
      citationEndSec: a.citationEndSec,
      difficulty: a.difficulty ?? 'medium',
    })),
  };
}

async function findAttemptByKey(studentId: string, idempotencyKey: string) {
  const [row] = await db
    .select({ id: quizAttempts.id, lessonId: quizAttempts.lessonId })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.idempotencyKey, idempotencyKey)));
  return row ?? null;
}

async function replay(studentId: string, lessonId: string, idempotencyKey: string): Promise<QuizAttemptResult | null> {
  const existing = await findAttemptByKey(studentId, idempotencyKey);
  if (!existing) return null;
  if (existing.lessonId !== lessonId) throw conflict('This submission key was already used for a different quiz');
  return loadAttemptResult(existing.id);
}

export async function submitAttempt(
  studentId: string,
  lessonId: string,
  input: SubmitQuizAttemptInput,
): Promise<{ result: QuizAttemptResult; created: boolean }> {
  await getVisibleLesson(studentId, lessonId);
  const previous = await replay(studentId, lessonId, input.idempotencyKey);
  if (previous) return { result: previous, created: false };

  const qs = await approvedQuestions(lessonId);
  if (qs.length === 0) throw invalidState('This quiz has no questions yet');

  const known = new Set(qs.map((q) => q.id));
  const selected = new Map<string, number | null>();
  const issues: { path: string; message: string }[] = [];
  input.answers.forEach((a, i) => {
    if (!known.has(a.questionId)) issues.push({ path: `answers.${i}.questionId`, message: 'Not a question in this quiz' });
    else if (selected.has(a.questionId)) issues.push({ path: `answers.${i}.questionId`, message: 'Answered more than once' });
    else selected.set(a.questionId, a.selectedIndex);
  });
  if (issues.length > 0) throw new AppError('BAD_REQUEST', 'Some answers do not match this quiz', issues);

  // Grade server-side; unanswered questions count as wrong.
  const graded = qs.map((q) => {
    const selectedIndex = selected.get(q.id) ?? null;
    return { q, selectedIndex, isCorrect: selectedIndex === q.correctIndex };
  });
  const correct = graded.filter((g) => g.isCorrect).length;
  const total = graded.length;

  let attemptId: string;
  try {
    attemptId = await db.transaction(async (tx) => {
      const [attempt] = await tx
        .insert(quizAttempts)
        .values({
          lessonId,
          studentId,
          idempotencyKey: input.idempotencyKey,
          correct,
          total,
          scorePct: roundPct((correct / total) * 100),
        })
        .returning({ id: quizAttempts.id });
      await tx.insert(quizAttemptAnswers).values(
        graded.map((g) => ({
          attemptId: attempt!.id,
          questionId: g.q.id,
          position: g.q.position,
          stemSnapshot: g.q.stem,
          optionsSnapshot: g.q.options,
          correctIndexSnapshot: g.q.correctIndex,
          selectedIndex: g.selectedIndex,
          isCorrect: g.isCorrect,
        })),
      );
      return attempt!.id;
    });
  } catch (err) {
    // A concurrent submit with the same key won the race: return its result.
    if (isUniqueViolation(err, IDEMPOTENCY_UNIQUE)) {
      const winner = await replay(studentId, lessonId, input.idempotencyKey);
      if (winner) return { result: winner, created: false };
    }
    throw err;
  }
  return { result: await loadAttemptResult(attemptId), created: true };
}

export async function latestAttempt(studentId: string, lessonId: string): Promise<QuizAttemptResult> {
  await getVisibleLesson(studentId, lessonId);
  const [row] = await db
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))
    .orderBy(desc(quizAttempts.submittedAt))
    .limit(1);
  if (!row) throw notFound('Attempt');
  return loadAttemptResult(row.id);
}

/* ----------------------------------------------------------------------------
 * Assignments: published and closed ones of my sections (standalone, or of a published lesson)
 * ------------------------------------------------------------------------- */

type AssignmentRow = typeof assignments.$inferSelect;
type SubmissionRow = typeof assignmentSubmissions.$inferSelect;

const visibleAssignments = (studentId: string): SQL =>
  and(
    inArray(assignments.status, ['published', 'closed']),
    inArray(assignments.sectionId, enrolledSectionIds(studentId)),
    or(isNull(assignments.lessonId), eq(lessons.status, 'published')),
  )!;

const isPastDue = (a: Pick<AssignmentRow, 'dueAt'>, now = Date.now()) => !!a.dueAt && a.dueAt.getTime() < now;

/** Work is refused once the teacher closes the assignment, or after the due date under the "closed" policy. */
const acceptsWork = (a: AssignmentRow) => a.status === 'published' && !(a.latePolicy === 'closed' && isPastDue(a));

function assignmentState(a: AssignmentRow, sub: SubmissionRow | null): StudentAssignmentState {
  if (sub?.status === 'returned') return 'returned';
  if (sub) return sub.isLate ? 'late' : 'submitted';
  return acceptsWork(a) ? 'todo' : 'closed';
}

function toStudentAssignment(
  a: AssignmentRow,
  sub: SubmissionRow | null,
  names: { lessonTitle: string | null; sectionName: string },
  files: SubmissionFileRow[],
): StudentAssignment {
  // Marks and feedback stay hidden until the teacher returns the work.
  const returned = sub?.status === 'returned';
  return {
    id: a.id,
    lessonId: a.lessonId,
    lessonTitle: a.lessonId ? names.lessonTitle : null,
    sectionName: names.sectionName,
    title: a.title,
    prompt: a.prompt,
    rubric: a.rubric.map((item) => ({ criterion: item.criterion, marks: item.marks, descriptor: item.descriptor ?? '' })),
    estimatedMinutes: a.estimatedMinutes,
    dueAt: a.dueAt?.toISOString() ?? null,
    latePolicy: a.latePolicy,
    allowFiles: a.allowFiles,
    maxFiles: a.maxFiles,
    state: assignmentState(a, sub),
    submission: sub
      ? {
          id: sub.id,
          submittedAt: sub.submittedAt.toISOString(),
          updatedAt: sub.updatedAt.toISOString(),
          text: sub.text,
          files: files.map(toSubmissionFile),
          isLate: sub.isLate,
          status: sub.status,
          rubricMarks: returned ? sub.rubricMarks : null,
          totalMarks: returned ? sub.totalMarks : null,
          maxMarks: maxMarksOf(a.rubric),
          feedback: returned ? sub.feedback : null,
          returnedAt: returned ? (sub.returnedAt?.toISOString() ?? null) : null,
        }
      : null,
  };
}

async function findAssignments(studentId: string, extra?: SQL): Promise<StudentAssignment[]> {
  const rows = await db
    .select({ a: assignments, sub: assignmentSubmissions, lessonTitle: lessons.title, sectionName: sections.name })
    .from(assignments)
    .innerJoin(sections, eq(sections.id, assignments.sectionId))
    .leftJoin(lessons, eq(lessons.id, assignments.lessonId))
    .leftJoin(
      assignmentSubmissions,
      and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, studentId)),
    )
    .where(and(visibleAssignments(studentId), extra))
    .orderBy(asc(assignments.dueAt), desc(assignments.createdAt));
  const files = await filesBySubmission(rows.flatMap((r) => (r.sub ? [r.sub.id] : [])));
  return rows.map((r) => toStudentAssignment(r.a, r.sub, r, r.sub ? (files.get(r.sub.id) ?? []) : []));
}

export const listAssignments = (studentId: string) => findAssignments(studentId);

async function findAssignment(studentId: string, assignmentId: string): Promise<StudentAssignment> {
  const [found] = await findAssignments(studentId, eq(assignments.id, assignmentId));
  if (!found) throw notFound('Assignment');
  return found;
}

const returnedLocked = () => invalidState('Your teacher has returned this work, so it can no longer be changed.');

/** Visible, still accepting work, and not returned yet. Checked before accepting an upload body, and again inside the write. */
export async function assertCanSubmit(studentId: string, assignmentId: string): Promise<AssignmentRow> {
  const [row] = await db
    .select({ a: assignments, status: assignmentSubmissions.status })
    .from(assignments)
    .leftJoin(lessons, eq(lessons.id, assignments.lessonId))
    .leftJoin(
      assignmentSubmissions,
      and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, studentId)),
    )
    .where(and(eq(assignments.id, assignmentId), visibleAssignments(studentId)));
  if (!row) throw notFound('Assignment');
  if (row.a.status === 'closed') throw invalidState('This assignment is closed.');
  if (!acceptsWork(row.a)) throw invalidState('The due date for this assignment has passed');
  if (row.status === 'returned') throw returnedLocked();
  return row.a;
}

/** Strip any path and control characters from a client file name (display only; never used as a path). */
const displayName = (name: string) =>
  [...path.basename(name.replace(/\\/g, '/'))]
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .slice(-255) || 'file';

/**
 * Create or update my submission: `text` (when sent) replaces the answer, uploaded files are added. Past the
 * due date the work is flagged late ("allow late") or refused ("closed"). Needs text or a file overall.
 */
export async function submitAssignment(
  studentId: string,
  assignmentId: string,
  input: SubmitAssignmentInput,
  uploads: Express.Multer.File[] = [],
): Promise<StudentAssignment> {
  const stored: string[] = [];
  try {
    const a = await assertCanSubmit(studentId, assignmentId);
    if (uploads.length && !a.allowFiles) throw badRequest('This assignment does not accept file uploads.');
    if (uploads.length > a.maxFiles) throw badRequest(`You can attach at most ${a.maxFiles} file(s) to this assignment.`);
    const files: Omit<typeof submissionFiles.$inferInsert, 'submissionId'>[] = [];
    for (const f of uploads) {
      const key = storageKeys.submissionFile(a.id, studentId, uploadExtension(f));
      const stat = await storage.putFile(key, f.path);
      stored.push(key);
      files.push({ objectKey: key, originalName: displayName(f.originalname), mime: f.mimetype.toLowerCase(), sizeBytes: stat.size });
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      // Create-or-lock my submission row so concurrent submits serialize (rolled back if anything below fails).
      await tx.insert(assignmentSubmissions).values({ assignmentId, studentId, submittedAt: now }).onConflictDoNothing();
      const [sub] = await tx
        .select()
        .from(assignmentSubmissions)
        .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.studentId, studentId)))
        .for('update');
      if (sub!.status === 'returned') throw returnedLocked();
      const [existing] = await tx.select({ n: count() }).from(submissionFiles).where(eq(submissionFiles.submissionId, sub!.id));
      const fileCount = (existing?.n ?? 0) + files.length;
      if (fileCount > a.maxFiles) throw badRequest(`You can attach at most ${a.maxFiles} file(s) to this assignment.`);
      const text = input.text === undefined ? sub!.text : input.text || null;
      if (!text && fileCount === 0) throw badRequest('Write an answer or attach at least one file.');
      await tx
        .update(assignmentSubmissions)
        .set({ text, submittedAt: now, isLate: isPastDue(a, now.getTime()) })
        .where(eq(assignmentSubmissions.id, sub!.id));
      if (files.length) await tx.insert(submissionFiles).values(files.map((f) => ({ ...f, submissionId: sub!.id })));
    });
    stored.length = 0; // now owned by the submission
  } finally {
    await cleanupUploads(uploads);
    await Promise.all(stored.map((key) => storage.delete(key).catch(() => undefined)));
  }
  return findAssignment(studentId, assignmentId);
}

/** Remove one of my files (not after the work was returned). A submission left empty is withdrawn. */
export async function removeSubmissionFile(studentId: string, assignmentId: string, fileId: string): Promise<StudentAssignment> {
  await assertCanSubmit(studentId, assignmentId);
  const key = await db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.studentId, studentId)))
      .for('update');
    if (!sub) throw notFound('File');
    if (sub.status === 'returned') throw returnedLocked();
    const [file] = await tx
      .delete(submissionFiles)
      .where(and(eq(submissionFiles.id, fileId), eq(submissionFiles.submissionId, sub.id)))
      .returning();
    if (!file) throw notFound('File');
    const [left] = await tx.select({ n: count() }).from(submissionFiles).where(eq(submissionFiles.submissionId, sub.id));
    if (!sub.text && (left?.n ?? 0) === 0) await tx.delete(assignmentSubmissions).where(eq(assignmentSubmissions.id, sub.id));
    return file.objectKey;
  });
  await storage.delete(key).catch((err: Error) => logger.warn({ err: err.message }, 'Failed to delete a submission file'));
  return findAssignment(studentId, assignmentId);
}

/* ----------------------------------------------------------------------------
 * Dashboard & profile
 * ------------------------------------------------------------------------- */

/** `assignmentsEnabled` false (the school switched Assignments off) hides upcoming assignments. */
export async function dashboard(studentId: string, assignmentsEnabled = true): Promise<StudentDashboard> {
  const [mySections, quizzes, recent, assignmentList] = await Promise.all([
    listMySections(studentId),
    listQuizzes(studentId),
    db
      .select({
        lessonId: quizAttempts.lessonId,
        title: lessons.title,
        scorePct: quizAttempts.scorePct,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
      .where(eq(quizAttempts.studentId, studentId))
      .orderBy(desc(quizAttempts.submittedAt))
      .limit(RECENT_ATTEMPTS),
    assignmentsEnabled ? listAssignments(studentId) : Promise.resolve([]),
  ]);
  const scored = quizzes.flatMap((q) => (q.latestAttempt ? [q.latestAttempt.scorePct] : []));
  const now = Date.now();
  return {
    sections: mySections,
    pendingQuizzes: quizzes.filter((q) => q.latestAttempt === null),
    recentAttempts: recent.map((r) => ({ ...r, submittedAt: r.submittedAt.toISOString() })),
    upcomingAssignments: assignmentList
      .filter((a) => a.state !== 'closed' && a.state !== 'returned' && (a.dueAt === null || Date.parse(a.dueAt) >= now))
      .slice(0, UPCOMING_ASSIGNMENTS)
      .map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt, submitted: a.submission !== null })),
    // Average of the latest attempt per quiz.
    averageScorePct: scored.length ? roundPct(scored.reduce((s, n) => s + n, 0) / scored.length) : null,
  };
}

/** Never says whether (or whose) account already uses the address. */
const EMAIL_UNAVAILABLE = "This email can't be used. Use a different address.";

export async function updateProfile(userId: string, input: UpdateStudentProfileInput): Promise<SessionResponse> {
  if (input.email !== undefined) {
    const [row] = await db
      .update(users)
      .set({ email: input.email })
      .where(eq(users.id, userId))
      .returning()
      .catch((err: unknown) => {
        if (isUniqueViolation(err, EMAIL_UNIQUE)) throw conflict(EMAIL_UNAVAILABLE);
        throw err;
      });
    if (!row) throw notFound('User');
    return { user: toSessionUser(row) };
  }
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) throw notFound('User');
  return { user: toSessionUser(row) };
}

/* ----------------------------------------------------------------------------
 * Guardians (own only)
 * ------------------------------------------------------------------------- */

function toGuardian(row: typeof guardians.$inferSelect): Guardian {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    phone: row.phone,
    email: row.email,
    receiveUpdates: row.receiveUpdates,
  };
}

export async function listGuardians(studentId: string): Promise<Guardian[]> {
  const rows = await db
    .select()
    .from(guardians)
    .where(eq(guardians.studentId, studentId))
    .orderBy(asc(guardians.createdAt));
  return rows.map(toGuardian);
}

export async function addGuardian(studentId: string, input: GuardianInput): Promise<Guardian> {
  try {
    const [row] = await db
      .insert(guardians)
      .values({
        studentId,
        name: input.name,
        relation: input.relation,
        phone: input.phone,
        email: input.email ?? null,
        receiveUpdates: input.receiveUpdates,
      })
      .returning();
    return toGuardian(row!);
  } catch (err) {
    if (isUniqueViolation(err, 'guardians_student_phone_unique')) {
      throw conflict('A guardian with that phone number is already on your profile');
    }
    throw err;
  }
}

export async function removeGuardian(studentId: string, guardianId: string): Promise<void> {
  const deleted = await db
    .delete(guardians)
    .where(and(eq(guardians.id, guardianId), eq(guardians.studentId, studentId)))
    .returning({ id: guardians.id });
  if (deleted.length === 0) throw notFound('Guardian');
}
