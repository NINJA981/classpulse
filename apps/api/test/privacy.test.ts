/**
 * DPDP data rights: per-student export (right of access) and school offboarding (export + hard delete).
 */
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/client.js';
import {
  assignmentSubmissions,
  assignments,
  auditLogs,
  enrollments,
  examAttempts,
  examEvents,
  examQuestions,
  exams,
  guardians,
  institutions,
  lessons,
  liveParticipants,
  liveSessions,
  quizAttemptAnswers,
  quizAttempts,
  submissionFiles,
  users,
} from '../src/db/schema/index.js';
import { resetPlatformStateCache } from '../src/lib/platformState.js';
import { storage, storageKeys } from '../src/lib/storage.js';
import { anon, as, createWorld } from './helpers.js';
import { asPlatform, createPlatformAdmin, installEncryptionKey } from './platform.helpers.js';

beforeAll(installEncryptionKey);

type World = Awaited<ReturnType<typeof createWorld>>;

/** A lesson with a quiz attempt, an exam attempt with events, a graded submission with a file, a live game and a guardian. */
async function seedStudentRecords(w: World) {
  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: w.institution.id,
      teacherId: w.teacher.id,
      sectionId: w.section.id,
      title: 'Photosynthesis',
      subject: 'Science',
      status: 'published',
      transcript: 'Plants make food from light.',
    })
    .returning();
  const audioKey = storageKeys.lessonAudio(lesson!.id);
  await storage.put(audioKey, Buffer.from('RIFF-audio'));
  await db.update(lessons).set({ audioObjectKey: audioKey }).where(eq(lessons.id, lesson!.id));

  const [attempt] = await db
    .insert(quizAttempts)
    .values({ lessonId: lesson!.id, studentId: w.student.id, idempotencyKey: crypto.randomUUID(), correct: 1, total: 1, scorePct: 100 })
    .returning();
  await db.insert(quizAttemptAnswers).values({
    attemptId: attempt!.id,
    position: 0,
    stemSnapshot: 'What do plants need?',
    optionsSnapshot: ['Light', 'Sand', 'Salt', 'Iron'],
    correctIndexSnapshot: 0,
    selectedIndex: 0,
    isCorrect: true,
  });

  const now = Date.now();
  const [exam] = await db
    .insert(exams)
    .values({
      institutionId: w.institution.id,
      teacherId: w.teacher.id,
      sectionId: w.section.id,
      title: 'Unit test 1',
      status: 'published',
      opensAt: new Date(now - 3600_000),
      closesAt: new Date(now + 3600_000),
      durationMin: 30,
      questionsPerStudent: 1,
      accessCode: 'SECRET1',
    })
    .returning();
  const [eq1] = await db
    .insert(examQuestions)
    .values({ examId: exam!.id, position: 0, stem: 'Chlorophyll is…', options: ['green', 'red', 'blue', 'grey'], correctIndex: 0 })
    .returning();
  const [examAttempt] = await db
    .insert(examAttempts)
    .values({
      examId: exam!.id,
      studentId: w.student.id,
      deadlineAt: new Date(now + 1800_000),
      paper: [{ examQuestionId: eq1!.id, optionOrder: [0, 1, 2, 3] }],
      deviceTokenHash: 'f'.repeat(64),
    })
    .returning();
  await db.insert(examEvents).values({ attemptId: examAttempt!.id, type: 'tab_hidden' });

  const [assignment] = await db
    .insert(assignments)
    .values({ sectionId: w.section.id, teacherId: w.teacher.id, title: 'Leaf diagram', prompt: 'Draw a leaf', status: 'published' })
    .returning();
  const [submission] = await db
    .insert(assignmentSubmissions)
    .values({ assignmentId: assignment!.id, studentId: w.student.id, text: 'My leaf', feedback: 'Nice work', totalMarks: 8 })
    .returning();
  const fileKey = storageKeys.submissionFile(assignment!.id, w.student.id, '.png');
  await storage.put(fileKey, Buffer.from('png-bytes'));
  const [file] = await db
    .insert(submissionFiles)
    .values({ submissionId: submission!.id, objectKey: fileKey, originalName: 'leaf.png', mime: 'image/png', sizeBytes: 9 })
    .returning();

  const [live] = await db.insert(liveSessions).values({ lessonId: lesson!.id, hostTeacherId: w.teacher.id, pin: '123456', status: 'ended' }).returning();
  await db.insert(liveParticipants).values({ sessionId: live!.id, studentId: w.student.id, score: 900, correct: 1 });
  await db.insert(guardians).values({ studentId: w.student.id, name: 'Lakshmi', relation: 'mother', phone: '+919800000001' });

  return { lesson: lesson!, exam: exam!, assignment: assignment!, file: file!, audioKey, fileKey };
}

describe('student data export (right of access)', () => {
  let w: World;
  beforeEach(async () => {
    w = await createWorld();
  });

  it('gives an admin everything about the student, without secrets, and audits it', async () => {
    const seeded = await seedStudentRecords(w);
    const res = await as(w.admin).get(`/api/admin/students/${w.student.id}/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="classpulse-student-/);
    expect(res.headers['cache-control']).toContain('no-store');

    const body = res.body;
    expect(body.format).toBe('classpulse.student-export');
    expect(body.student).toMatchObject({ id: w.student.id, rollNumber: w.student.rollNumber, name: w.student.name });
    expect(body.school).toMatchObject({ id: w.institution.id });
    expect(body.enrolments).toEqual([expect.objectContaining({ sectionId: w.section.id })]);
    expect(body.guardians).toEqual([expect.objectContaining({ name: 'Lakshmi', relation: 'mother' })]);
    expect(body.quizAttempts).toHaveLength(1);
    expect(body.quizAttempts[0]).toMatchObject({ lessonTitle: 'Photosynthesis', scorePct: 100 });
    expect(body.quizAttempts[0].answers).toEqual([expect.objectContaining({ question: 'What do plants need?', selectedIndex: 0, isCorrect: true })]);
    expect(body.examAttempts[0]).toMatchObject({ examTitle: 'Unit test 1', status: 'in_progress' });
    expect(body.examAttempts[0].integrityEvents).toEqual([expect.objectContaining({ type: 'tab_hidden' })]);
    expect(body.assignmentSubmissions[0]).toMatchObject({ assignmentTitle: 'Leaf diagram', text: 'My leaf', feedback: 'Nice work' });
    expect(body.assignmentSubmissions[0].files).toEqual([
      expect.objectContaining({ id: seeded.file.id, name: 'leaf.png', downloadPath: `/api/admin/students/${w.student.id}/export/files/${seeded.file.id}` }),
    ]);
    expect(body.liveQuizzes).toEqual([expect.objectContaining({ lessonTitle: 'Photosynthesis', score: 900 })]);

    const text = JSON.stringify(body);
    for (const secret of ['passwordHash', 'password_hash', 'tokenVersion', 'deviceTokenHash', 'objectKey', w.student.passwordHash]) {
      expect(text).not.toContain(secret);
    }

    const [entry] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'student.export'));
    expect(entry).toMatchObject({ actorId: w.admin.id, institutionId: w.institution.id, targetId: w.student.id });

    // The listed file downloads for the admin (and is audited).
    const file = await as(w.admin).get(body.assignmentSubmissions[0].files[0].downloadPath);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toMatch(/^attachment; filename="leaf.png"/);
    expect(Buffer.from(file.body as Buffer).toString()).toBe('png-bytes');
    const fileAudit = await db.select().from(auditLogs).where(eq(auditLogs.action, 'student.export_file'));
    expect(fileAudit).toHaveLength(1);
  });

  it('includes audit entries about the student (own actions with IP; staff actions without staff details)', async () => {
    await db.insert(auditLogs).values([
      { actorType: 'user', actorId: w.student.id, actorRole: 'student', actorName: w.student.name, institutionId: w.institution.id, action: 'auth.login', ip: '10.1.2.3' },
      { actorType: 'user', actorId: w.admin.id, actorRole: 'admin', actorName: 'Head Admin', institutionId: w.institution.id, action: 'user.reset_password', targetType: 'user', targetId: w.student.id, ip: '10.9.9.9' },
    ]);
    const res = await as(w.admin).get(`/api/admin/students/${w.student.id}/export`);
    expect(res.status).toBe(200);
    expect(res.body.auditEntries).toEqual([
      expect.objectContaining({ action: 'auth.login', actor: 'student', ip: '10.1.2.3' }),
      expect.objectContaining({ action: 'user.reset_password', actor: 'admin' }),
    ]);
    expect(JSON.stringify(res.body.auditEntries)).not.toContain('Head Admin');
    expect(JSON.stringify(res.body.auditEntries)).not.toContain('10.9.9.9');
  });

  it('refuses other roles, other schools and non-students', async () => {
    const url = `/api/admin/students/${w.student.id}/export`;
    expect((await anon().get(url)).status).toBe(401);
    expect((await as(w.teacher).get(url)).status).toBe(403);
    expect((await as(w.student).get(url)).status).toBe(403);

    const other = await createWorld();
    expect((await as(other.admin).get(url)).status).toBe(404);
    expect((await as(w.admin).get(`/api/admin/students/${w.teacher.id}/export`)).status).toBe(404);
    expect((await as(w.admin).get('/api/admin/students/not-a-uuid/export')).status).toBe(400);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, 'student.export'))).toHaveLength(0);
  });

  it('serves export files only for that student in the admin’s school', async () => {
    const seeded = await seedStudentRecords(w);
    const path = `/api/admin/students/${w.student.id}/export/files/${seeded.file.id}`;
    expect((await as(w.teacher).get(path)).status).toBe(403);
    expect((await as(w.admin).get(`/api/admin/students/${w.otherStudent.id}/export/files/${seeded.file.id}`)).status).toBe(404);
    const other = await createWorld();
    expect((await as(other.admin).get(path)).status).toBe(404);
  });

  it('deleting a student erases every row that refers to them', async () => {
    await seedStudentRecords(w);
    expect((await as(w.admin).delete(`/api/admin/students/${w.student.id}`)).status).toBe(204);
    const left = await Promise.all([
      db.select().from(users).where(eq(users.id, w.student.id)),
      db.select().from(enrollments).where(eq(enrollments.studentId, w.student.id)),
      db.select().from(guardians).where(eq(guardians.studentId, w.student.id)),
      db.select().from(quizAttempts).where(eq(quizAttempts.studentId, w.student.id)),
      db.select().from(examAttempts).where(eq(examAttempts.studentId, w.student.id)),
      db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.studentId, w.student.id)),
      db.select().from(liveParticipants).where(eq(liveParticipants.studentId, w.student.id)),
    ]);
    expect(left.map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('school offboarding (platform console)', () => {
  let w: World;
  let platform: ReturnType<typeof asPlatform>;
  beforeEach(async () => {
    resetPlatformStateCache();
    w = await createWorld();
    platform = asPlatform(await createPlatformAdmin());
  });

  const suspend = () => platform.post(`/api/platform/schools/${w.institution.id}/suspend`).send({ reason: 'Contract ended' });

  it('exports the school as one JSON document without secrets, and audits it', async () => {
    await seedStudentRecords(w);
    await db.update(institutions).set({ notes: 'private platform note' }).where(eq(institutions.id, w.institution.id));
    const res = await platform.post(`/api/platform/schools/${w.institution.id}/export`).send({});
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="classpulse-school-/);
    const body = res.body;
    expect(body.format).toBe('classpulse.school-export');
    expect(body.school).toMatchObject({ id: w.institution.id, code: w.institution.code });
    expect(body.school.notes).toBeUndefined();
    expect(body.tables.users).toHaveLength(5);
    expect(body.tables.lessons[0]).toMatchObject({ title: 'Photosynthesis', transcript: 'Plants make food from light.', hasAudio: true });
    expect(body.tables.quizAttempts).toHaveLength(1);
    expect(body.tables.examEvents).toHaveLength(1);
    expect(body.tables.submissionFiles[0]).toMatchObject({ originalName: 'leaf.png' });
    expect(body.tables.guardians).toHaveLength(1);
    const text = JSON.stringify(body);
    for (const secret of ['passwordHash', 'apiKeyHash', 'deviceTokenHash', 'objectKey', 'audioObjectKey', 'SECRET1', 'private platform note']) {
      expect(text).not.toContain(secret);
    }
    // The route writes the audit entry after the download has been sent: wait for it.
    const entry = await vi.waitFor(async () => {
      const [row] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'platform.school.export'));
      if (!row) throw new Error('export not audited yet');
      return row;
    });
    expect(entry).toMatchObject({ actorType: 'platform', institutionId: w.institution.id, targetId: w.institution.id });
    expect((entry!.metadata as { counts: Record<string, number> }).counts.users).toBe(5);
  });

  it('only exports for a platform session', async () => {
    const url = `/api/platform/schools/${w.institution.id}/export`;
    expect((await anon().post(url).send({})).status).toBe(401);
    expect((await as(w.admin).post(url).send({})).status).toBe(401);
    expect((await platform.post(`/api/platform/schools/${crypto.randomUUID()}/export`).send({})).status).toBe(404);
  });

  it('refuses to delete an active school or without the exact school code', async () => {
    const url = `/api/platform/schools/${w.institution.id}`;
    const active = await platform.delete(url).send({ confirmCode: w.institution.code });
    expect(active.status).toBe(409);
    await suspend();
    expect((await platform.delete(url).send({ confirmCode: 'WRONG' })).status).toBe(400);
    expect((await platform.delete(url).send({})).status).toBe(400);
    expect((await as(w.admin).delete(url).send({ confirmCode: w.institution.code })).status).toBe(401);
    expect((await anon().delete(url).send({ confirmCode: w.institution.code })).status).toBe(401);
    expect((await platform.delete(`/api/platform/schools/${crypto.randomUUID()}`).send({ confirmCode: 'X' })).status).toBe(404);
    expect(await db.select().from(institutions).where(eq(institutions.id, w.institution.id))).toHaveLength(1);
  });

  it('hard-deletes a suspended school: rows, stored files and nothing of other schools', async () => {
    const seeded = await seedStudentRecords(w);
    const other = await createWorld();
    await seedStudentRecords(other);
    await db.insert(auditLogs).values({ actorType: 'user', actorId: w.admin.id, institutionId: w.institution.id, action: 'auth.login' });
    await suspend();

    const res = await platform.delete(`/api/platform/schools/${w.institution.id}`).send({ confirmCode: w.institution.code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: w.institution.code,
      counts: { admins: 1, teachers: 2, students: 2, lessons: 1, exams: 1, assignments: 1, sections: 1, rooms: 1 },
      storage: { failed: 0 },
    });

    expect(await db.select().from(institutions).where(eq(institutions.id, w.institution.id))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.institutionId, w.institution.id))).toHaveLength(0);
    expect(await db.select().from(lessons).where(eq(lessons.institutionId, w.institution.id))).toHaveLength(0);
    expect(await db.select().from(guardians).where(eq(guardians.studentId, w.student.id))).toHaveLength(0);
    expect(await storage.stat(seeded.audioKey)).toBeNull();
    expect(await storage.stat(seeded.fileKey)).toBeNull();

    // The other school is untouched.
    expect(await db.select().from(users).where(eq(users.institutionId, other.institution.id))).toHaveLength(5);
    expect(await db.select().from(lessons).where(eq(lessons.institutionId, other.institution.id))).toHaveLength(1);

    // The school's audit trail survives unlinked, and the deletion itself is recorded.
    const [login] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.login'));
    expect(login!.institutionId).toBeNull();
    const [entry] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'platform.school.delete'));
    expect(entry).toMatchObject({ actorType: 'platform', institutionId: null, targetType: 'institution', targetId: w.institution.id });
    expect(entry!.metadata).toMatchObject({ code: w.institution.code, counts: { students: 2 } });
  });

  it('a deleted school can no longer be fetched and its sessions stop working', async () => {
    await suspend();
    await platform.delete(`/api/platform/schools/${w.institution.id}`).send({ confirmCode: w.institution.code });
    expect((await platform.get(`/api/platform/schools/${w.institution.id}`)).status).toBe(404);
    expect((await as(w.admin).get('/api/admin/students')).status).toBe(401);
  });
});
