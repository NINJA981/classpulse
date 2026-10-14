/**
 * Application lifecycle hardening: the audit trail of school-side actions (M8), feature and
 * suspension gates (L1), the exam answer key (L4), generic email clashes (L5) and storage clean-up
 * on delete (M12).
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DEFAULT_INSTITUTION_FEATURES, DEFAULT_INSTITUTION_LIMITS, type ExamDetail, type InstitutionFeature, type StudentExamResult } from '@classiq/shared';
import { db } from '../src/db/client.js';
import {
  assignments,
  assignmentSubmissions,
  auditLogs,
  examAttempts,
  exams,
  institutions,
  lessons,
  platformSettings,
  recordingSessions,
  questions,
  submissionFiles,
  teacherMaterials,
} from '../src/db/schema/index.js';
import { invalidateInstitutionState, invalidatePlatformSettings } from '../src/lib/platformState.js';
import { storage } from '../src/lib/storage.js';
import { anon, as, createInstitution, createUser, createWorld } from './helpers.js';
import { heartbeat, pcm, provisionDevice, putChunk, startedRecording } from './devices.fixtures.js';
import { insertLesson, insertQuestions } from './fixtures/lessons.js';
import { asPlatform, createPlatformAdmin } from './platform.helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;

const inMin = (m: number) => new Date(Date.now() + m * 60_000);

async function auditRows(action: string) {
  return db.select().from(auditLogs).where(eq(auditLogs.action, action));
}

async function setFeature(institutionId: string, feature: InstitutionFeature, on: boolean) {
  await db
    .update(institutions)
    .set({ features: { ...DEFAULT_INSTITUTION_FEATURES, [feature]: on } })
    .where(eq(institutions.id, institutionId));
  invalidateInstitutionState(institutionId);
}

async function suspend(institutionId: string) {
  await db.update(institutions).set({ status: 'suspended' }).where(eq(institutions.id, institutionId));
  invalidateInstitutionState(institutionId);
}

async function setMaintenance(blockLogins: boolean) {
  const value = { enabled: blockLogins, message: '', blockLogins };
  await db
    .insert(platformSettings)
    .values({ key: 'maintenance', value })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value } });
  invalidatePlatformSettings();
}

/** A standalone assignment with one submission by `studentId` carrying one stored file. */
async function submissionWithFile(w: World, studentId = w.student.id) {
  const [a] = await db
    .insert(assignments)
    .values({ sectionId: w.section.id, teacherId: w.teacher.id, title: 'Essay', prompt: 'Write', status: 'published' })
    .returning();
  const [sub] = await db.insert(assignmentSubmissions).values({ assignmentId: a!.id, studentId, text: 'Hi' }).returning();
  const key = `submissions/${a!.id}/${studentId}/${randomUUID()}.pdf`;
  await storage.put(key, Buffer.from('%PDF-1.4 test'));
  await db.insert(submissionFiles).values({ submissionId: sub!.id, objectKey: key, originalName: 'essay.pdf', mime: 'application/pdf', sizeBytes: 13 });
  return { assignment: a!, submission: sub!, key };
}

/* -------------------------------------------------------------------------- */

describe('audit trail of admin people operations', () => {
  it('records create, update, disable, reset, links and delete of a teacher (no secrets)', async () => {
    const w = await createWorld();
    const admin = as(w.admin);
    const created = await admin.post('/api/admin/teachers').send({ name: 'New Teacher', email: 'new.teacher@test.local' });
    expect(created.status).toBe(201);
    const id = created.body.record.id as string;
    expect((await admin.patch(`/api/admin/teachers/${id}`).send({ department: 'Maths' })).status).toBe(200);
    expect((await admin.patch(`/api/admin/teachers/${id}`).send({ status: 'disabled' })).status).toBe(200);
    expect((await admin.patch(`/api/admin/teachers/${id}`).send({ status: 'active' })).status).toBe(200);
    const reset = await admin.post(`/api/admin/teachers/${id}/reset-password`);
    expect(reset.status).toBe(200);
    expect((await admin.post(`/api/admin/teachers/${id}/send-reset-link`)).status).toBe(200);
    expect((await admin.delete(`/api/admin/teachers/${id}`)).status).toBe(204);

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.targetId, id));
    expect(rows.map((r) => r.action).sort()).toEqual(
      ['teacher.create', 'teacher.delete', 'teacher.disable', 'teacher.enable', 'teacher.reset_password', 'teacher.send_reset_link', 'teacher.update'].sort(),
    );
    for (const r of rows) {
      expect(r).toMatchObject({ actorType: 'user', actorId: w.admin.id, actorRole: 'admin', institutionId: w.institution.id });
    }
    const text = JSON.stringify(rows);
    expect(text).not.toContain(reset.body.initialPassword as string);
    expect(text).not.toContain(created.body.initialPassword as string);
  });

  it('records student import counts and enrolment changes', async () => {
    const w = await createWorld();
    const imported = await as(w.admin)
      .post('/api/admin/students/import')
      .send({ rows: [{ name: 'A', rollNumber: 'X1' }, { name: 'B', rollNumber: 'X2' }, { name: 'C', rollNumber: 'X1' }] });
    expect(imported.status).toBe(200);
    const [row] = await auditRows('student.import');
    expect(row!.metadata).toEqual({ rows: 3, created: 2, skipped: 1, sectionId: null });
    expect(JSON.stringify(row)).not.toContain(imported.body.created[0].initialPassword);

    const ids = (imported.body.created as { id: string }[]).map((c) => c.id);
    const set = await as(w.admin).put(`/api/admin/sections/${w.section.id}/students`).send({ studentIds: [w.student.id, ...ids] });
    expect(set.status).toBe(200);
    const [enrol] = await auditRows('section.enrolments.set');
    expect(enrol).toMatchObject({ targetType: 'section', targetId: w.section.id, metadata: { added: 2, removed: 1, total: 3 } });
  });

  it('records timetable, room and model-settings changes', async () => {
    const w = await createWorld();
    expect((await as(w.admin).post('/api/admin/rooms').send({ name: 'Lab 2' })).status).toBe(201);
    const tt = await as(w.admin)
      .put(`/api/admin/timetable/${w.section.id}`)
      .send({ slots: [{ day: 'mon', period: 1, startTime: '09:00', endTime: '09:45', subject: 'Science' }] });
    expect(tt.status).toBe(200);
    expect((await as(w.admin).patch('/api/admin/settings/models').send({ questionsPerLesson: 7 })).status).toBe(200);
    expect(await auditRows('room.create')).toHaveLength(1);
    expect((await auditRows('timetable.replace'))[0]!.metadata).toEqual({ slots: 1 });
    expect((await auditRows('settings.models.update'))[0]!.metadata).toEqual({ questionsPerLesson: 7 });
  });
});

describe('audit trail of devices, grades and platform reads', () => {
  it('records enrolment tokens (without the token) and revocations', async () => {
    const w = await createWorld();
    const device = await provisionDevice(w);
    expect((await as(w.admin).delete(`/api/admin/devices/${device.id}`)).status).toBe(204);
    const [token] = await auditRows('device.enrollment_token.create');
    expect(token).toMatchObject({ targetType: 'room', targetId: w.room.id });
    expect(JSON.stringify(token!.metadata)).not.toMatch(/token/i);
    expect(await auditRows('device.revoke')).toHaveLength(1);
  });

  it('records grade saves and returns', async () => {
    const w = await createWorld();
    const { assignment, submission } = await submissionWithFile(w);
    const base = `/api/assignments/${assignment.id}/submissions/${submission.id}`;
    expect((await as(w.teacher).put(`${base}/grade`).send({ rubricMarks: [], feedback: 'Good work' })).status).toBe(200);
    expect((await as(w.teacher).post(`${base}/return`)).status).toBe(200);
    expect((await as(w.teacher).post(`/api/assignments/${assignment.id}/return-all`)).status).toBe(200);
    const [grade] = await auditRows('assignment.grade');
    expect(grade).toMatchObject({ targetType: 'submission', targetId: submission.id, actorId: w.teacher.id });
    expect(grade!.metadata).toMatchObject({ assignmentId: assignment.id, studentId: w.student.id });
    expect(JSON.stringify(grade)).not.toContain('Good work');
    expect(await auditRows('assignment.return')).toHaveLength(1);
    expect((await auditRows('assignment.return_all'))[0]!.metadata).toEqual({ returned: 0 });
  });

  it('records super-admin reads of school data and searches', async () => {
    const w = await createWorld();
    const admin = await createPlatformAdmin();
    const view = await asPlatform(admin).get(`/api/platform/schools/${w.institution.id}/students`);
    expect(view.status).toBe(200);
    const search = await asPlatform(admin).get('/api/platform/users?q=student');
    expect(search.status).toBe(200);
    const [v] = await auditRows('platform.school.view');
    expect(v).toMatchObject({ actorType: 'platform', actorId: admin.id, institutionId: w.institution.id, metadata: { view: 'students' } });
    const [s] = await auditRows('platform.users.search');
    expect(s).toMatchObject({ actorType: 'platform', metadata: { q: 'student' } });
  });
});

/* -------------------------------------------------------------------------- */

describe('feature switches and suspension', () => {
  it('gates student assignment routes and lesson assignment routes behind the assignments switch', async () => {
    const w = await createWorld();
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'ready_for_review' });
    expect((await as(w.student).get('/api/student/assignments')).status).toBe(200);
    await setFeature(w.institution.id, 'assignments', false);
    const list = await as(w.student).get('/api/student/assignments');
    expect(list.status).toBe(403);
    expect(list.body.error.code).toBe('FEATURE_DISABLED');
    expect((await as(w.student).post(`/api/student/assignments/${randomUUID()}/submission`).send({ text: 'x' })).status).toBe(403);
    const body = { title: 'Homework', prompt: 'Do it' };
    expect((await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send(body)).body.error.code).toBe('FEATURE_DISABLED');
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send(body)).body.error.code).toBe('FEATURE_DISABLED');
    // Other student routes still work.
    expect((await as(w.student).get('/api/student/sections')).status).toBe(200);
  });

  it('refuses device commands and uploads (but not heartbeats) when the school is suspended, devices are off or in maintenance', async () => {
    const w = await createWorld();
    const device = await provisionDevice(w);
    const poll = () => anon().get('/api/devices/me/commands').set(device.headers);
    expect((await poll()).status).toBe(200);

    await setFeature(w.institution.id, 'devices', false);
    expect((await poll()).body.error.code).toBe('FEATURE_DISABLED');
    const hb = await heartbeat(device.headers);
    expect(hb.status).toBe(200);
    expect(hb.body.access).toBe('disabled');

    await setFeature(w.institution.id, 'devices', true);
    await setMaintenance(true);
    const m = await poll();
    expect(m.status).toBe(503);
    expect((await heartbeat(device.headers)).body.access).toBe('maintenance');
    await setMaintenance(false);
    expect((await poll()).status).toBe(200);

    await suspend(w.institution.id);
    const s = await anon().get(`/api/devices/me/sessions/${randomUUID()}/chunks`).set(device.headers);
    expect(s.status).toBe(403);
    expect(s.body.error.code).toBe('SCHOOL_SUSPENDED');
    expect((await heartbeat(device.headers)).body.access).toBe('suspended');
  });

  it('refuses to finalize a recording over the school storage limit and fails the session', async () => {
    const w = await createWorld();
    const device = await provisionDevice(w);
    const { sessionId } = await startedRecording(w, device);
    expect((await putChunk(device.headers, sessionId, 0, pcm(1))).status).toBe(200);
    // 0.2 GB already used against a 0.1 GB limit.
    const used = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    await db.update(lessons).set({ audioObjectKey: `audio/${used.id}/x.wav`, audioSizeBytes: 200 * 1024 ** 2 }).where(eq(lessons.id, used.id));
    await db.update(institutions).set({ limits: { ...DEFAULT_INSTITUTION_LIMITS, storageGb: 0.1 } }).where(eq(institutions.id, w.institution.id));
    invalidateInstitutionState(w.institution.id);

    const fin = await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(device.headers).send({ totalChunks: 1, durationSec: 1 });
    expect(fin.status).toBe(409);
    expect(fin.body.error.message).toMatch(/storage/);
    const [session] = await db.select().from(recordingSessions).where(eq(recordingSessions.id, sessionId));
    expect(session!.status).toBe('failed');
    expect(session!.failureReason).toMatch(/storage/);
    expect((await heartbeat(device.headers)).status).toBe(200);
  });

  it('refuses device registration for a suspended school', async () => {
    const w = await createWorld();
    const token = (await as(w.admin).post('/api/admin/devices/enrollment-tokens').send({ roomId: w.room.id, name: 'Pi' })).body.token as string;
    await suspend(w.institution.id);
    const reg = await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId: `rpi-s4-${Date.now()}`, agentVersion: '2.0.0' });
    expect(reg.status).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */

describe('email clashes never reveal another school', () => {
  it('uses one generic message for teacher create, import and student profile clashes', async () => {
    const other = await createInstitution();
    const foreign = await createUser(other.id, 'teacher', { email: 'taken@elsewhere.test' });
    const w = await createWorld();
    const local = await createUser(w.institution.id, 'teacher', { email: 'taken@here.test' });

    const a = await as(w.admin).post('/api/admin/teachers').send({ name: 'X', email: foreign.email });
    const b = await as(w.admin).post('/api/admin/teachers').send({ name: 'Y', email: local.email });
    expect(a.status).toBe(409);
    expect(a.body.error.message).toBe(b.body.error.message);
    expect(a.body.error.message).toMatch(/can't be used/);

    const imp = await as(w.admin)
      .post('/api/admin/teachers/import')
      .send({ rows: [{ name: 'X', email: foreign.email }, { name: 'Y', email: local.email }] });
    expect(imp.status).toBe(200);
    const reasons = (imp.body.skipped as { reason: string }[]).map((s) => s.reason);
    expect(new Set(reasons).size).toBe(1);
    expect(reasons[0]).toMatch(/can't be used/);

    const p = await as(w.student).patch('/api/student/profile').send({ email: foreign.email });
    expect(p.status).toBe(409);
    expect(p.body.error.message).toMatch(/can't be used/);
    expect(p.body.error.message).not.toMatch(/in use/);
  });
});

/* -------------------------------------------------------------------------- */

describe('stored files are deleted with their owner', () => {
  it('deletes a student’s submission files', async () => {
    const w = await createWorld();
    const { key } = await submissionWithFile(w);
    const keep = await submissionWithFile(w, w.otherStudent.id);
    expect(await storage.stat(key)).not.toBeNull();
    expect((await as(w.admin).delete(`/api/admin/students/${w.student.id}`)).status).toBe(204);
    expect(await storage.stat(key)).toBeNull();
    expect(await storage.stat(keep.key)).not.toBeNull();
    expect(await auditRows('student.delete')).toHaveLength(1);
  });

  it('deletes a teacher’s materials and a lesson’s submission files', async () => {
    const w = await createWorld();
    const teacher = await createUser(w.institution.id, 'teacher');
    const materialKey = `materials/${w.institution.id}/${randomUUID()}.pdf`;
    await storage.put(materialKey, Buffer.from('notes'));
    await db.insert(teacherMaterials).values({ institutionId: w.institution.id, teacherId: teacher.id, title: 'Notes', kind: 'pdf', objectKey: materialKey });
    expect((await as(w.admin).delete(`/api/admin/teachers/${teacher.id}`)).status).toBe(204);
    expect(await storage.stat(materialKey)).toBeNull();

    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'draft' });
    const { assignment, key } = await submissionWithFile(w);
    await db.update(assignments).set({ lessonId: lesson.id }).where(eq(assignments.id, assignment.id));
    expect((await as(w.teacher).delete(`/api/lessons/${lesson.id}`)).status).toBe(204);
    expect(await storage.stat(key)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe('exam answer key (results "immediately")', () => {
  async function exam(w: World) {
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'published' });
    const qs = await insertQuestions(lesson.id, 3, 'approved');
    await db.update(questions).set({ explanation: 'Secret explanation' }).where(eq(questions.lessonId, lesson.id));
    const created = await as(w.teacher)
      .post('/api/exams')
      .send({
        title: 'Quick test',
        sectionId: w.section.id,
        opensAt: inMin(-5).toISOString(),
        closesAt: inMin(60).toISOString(),
        durationMin: 30,
        questionsPerStudent: 3,
        resultsVisibility: 'immediately',
        useAccessCode: false,
      });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect((await as(w.teacher).put(`/api/exams/${id}/questions`).send({ questionIds: qs.map((q) => q.id) })).status).toBe(200);
    const pub = await as(w.teacher).post(`/api/exams/${id}/publish`);
    expect(pub.status).toBe(200);
    return pub.body as ExamDetail;
  }

  const start = async (user: World['student'], id: string) => {
    const res = await as(user).post(`/api/student/exams/${id}/start`).send({});
    expect(res.status).toBe(201);
    return res.body.attemptToken as string;
  };

  it('holds back correct answers until every classmate (including extra time) has finished, and audits interventions', async () => {
    const w = await createWorld();
    const e = await exam(w);
    const tokenA = await start(w.student, e.id);
    await start(w.otherStudent, e.id);
    const submitted = await as(w.student).post(`/api/student/exams/${e.id}/attempt/submit`).set('X-Exam-Token', tokenA);
    expect(submitted.status).toBe(200);
    expect((submitted.body as StudentExamResult).score).not.toBeNull();

    // The window closes while the classmate still has extra time.
    const [other] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, e.id), eq(examAttempts.studentId, w.otherStudent.id)));
    const extra = await as(w.teacher).post(`/api/exams/${e.id}/attempts/${other!.id}/extra-time`).send({ minutes: 10 });
    expect(extra.status).toBe(200);
    await db.update(exams).set({ closesAt: inMin(-1) }).where(eq(exams.id, e.id));
    await db.update(examAttempts).set({ deadlineAt: inMin(9) }).where(eq(examAttempts.id, other!.id));

    const early = (await as(w.student).get(`/api/student/exams/${e.id}/result`)).body as StudentExamResult;
    expect(early.score).not.toBeNull();
    expect(early.answers!.every((a) => a.correctIndex === null && a.explanation === null)).toBe(true);
    expect(Date.parse(early.answerKeyAvailableAt!)).toBeGreaterThan(Date.now());
    expect(JSON.stringify(early)).not.toContain('Secret explanation');

    const forced = await as(w.teacher).post(`/api/exams/${e.id}/attempts/${other!.id}/force-submit`);
    expect(forced.status).toBe(200);
    const after = (await as(w.student).get(`/api/student/exams/${e.id}/result`)).body as StudentExamResult;
    expect(after.answerKeyAvailableAt).toBeNull();
    expect(after.answers!.every((a) => a.correctIndex !== null && a.explanation === 'Secret explanation')).toBe(true);

    expect((await auditRows('exam.publish'))[0]).toMatchObject({ targetType: 'exam', targetId: e.id, actorId: w.teacher.id });
    expect((await auditRows('exam.attempt.extra_time'))[0]!.metadata).toMatchObject({ attemptId: other!.id, minutes: 10 });
    expect((await auditRows('exam.attempt.force_submit'))[0]!.metadata).toMatchObject({ studentId: w.otherStudent.id });
  });
});
