import { eq } from 'drizzle-orm';
import express, { Router } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@classiq/shared';
import { db } from '../src/db/client.js';
import { auditLogs, institutions, modelSettings, passwordTokens, users } from '../src/db/schema/index.js';
import { setMailerForTests, type MailMessage } from '../src/lib/mailer.js';
import { resetPlatformStateCache } from '../src/lib/platformState.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireFeature } from '../src/middleware/requireFeature.js';
import { requireRole } from '../src/middleware/auth.js';
import { lessons } from '../src/db/schema/index.js';
import { signSessionToken } from '../src/lib/session.js';
import { anon, as, createUser, createWorld, TEST_PASSWORD } from './helpers.js';
import { asPlatform, createPlatformAdmin, installEncryptionKey } from './platform.helpers.js';

beforeAll(installEncryptionKey);

let outbox: MailMessage[] = [];

async function createLesson(world: { institution: { id: string }; teacher: { id: string }; section: { id: string } }) {
  await db.insert(lessons).values({
    institutionId: world.institution.id,
    teacherId: world.teacher.id,
    sectionId: world.section.id,
    title: 'Photosynthesis',
    subject: 'Science',
  });
}

describe('platform: schools, admins, settings and enforcement', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  let owner: Awaited<ReturnType<typeof createPlatformAdmin>>;
  let platform: ReturnType<typeof asPlatform>;

  beforeEach(async () => {
    resetPlatformStateCache();
    world = await createWorld();
    owner = await createPlatformAdmin();
    platform = asPlatform(owner);
    outbox = [];
  });
  afterEach(() => setMailerForTests(null));

  const actions = async () => (await db.select({ action: auditLogs.action }).from(auditLogs)).map((r) => r.action);

  it('lists schools with counts and last activity', async () => {
    await createLesson(world);
    const res = await platform.get('/api/platform/schools');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: world.institution.id,
      status: 'active',
      counts: { admins: 1, teachers: 2, students: 2, sections: 1, lessons: 1 },
      limits: { maxStudents: null },
    });
    expect(res.body[0].lastActivityAt).not.toBeNull();

    const detail = await platform.get(`/api/platform/schools/${world.institution.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.features.exams).toBe(true);
    expect(detail.body.extraCounts).toMatchObject({ devices: 0, exams: 0 });
  });

  it('creates a school with its first admin, default models and an emailed invite', async () => {
    setMailerForTests(async (m) => void outbox.push(m));
    await platform.put('/api/platform/settings').send({
      defaultModels: { sttProvider: 'openai', sttModel: 'whisper-1', llmProvider: 'openai', llmModel: 'gpt-4o-mini' },
    });
    const res = await platform.post('/api/platform/schools').send({
      name: 'Hill View School',
      code: 'hillview',
      contact: { name: 'Principal', email: 'principal@hillview.in', phone: '' },
      admin: { name: 'Asha Rao', email: 'asha@hillview.in' },
    });
    expect(res.status).toBe(201);
    expect(res.body.school).toMatchObject({ code: 'HILLVIEW', status: 'active', counts: { admins: 1 } });
    expect(res.body.initialPassword).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    expect(res.body.invite).toBe('queued');
    expect(res.body.admin).toMatchObject({ email: 'asha@hillview.in', mustChangePassword: true });

    const settings = await db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, res.body.school.id) });
    expect(settings).toMatchObject({ sttModel: 'whisper-1', llmModel: 'gpt-4o-mini' });
    const tokens = await db.select().from(passwordTokens).where(eq(passwordTokens.userId, res.body.admin.id));
    expect(tokens).toHaveLength(1);
    expect(outbox.some((m) => m.to === 'asha@hillview.in')).toBe(true);

    // The new admin signs in on the admin page with the one-time password.
    const login = await anon().post('/api/auth/admin/login').send({ email: 'asha@hillview.in', password: res.body.initialPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const dup = await platform.post('/api/platform/schools').send({ name: 'Copy', code: 'HILLVIEW', admin: { name: 'X', email: 'x@y.in' } });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/school code/);
    const dupEmail = await platform.post('/api/platform/schools').send({ name: 'Copy', code: 'COPY1', admin: { name: 'X', email: 'asha@hillview.in' } });
    expect(dupEmail.status).toBe(409);
    expect(await db.query.institutions.findFirst({ where: eq(institutions.code, 'COPY1') })).toBeUndefined();

    expect(await actions()).toEqual(expect.arrayContaining(['platform.school.create', 'platform.admin.create', 'platform.settings.update']));
  });

  it('edits the profile, features and limits', async () => {
    const id = world.institution.id;
    const patch = await platform.patch(`/api/platform/schools/${id}`).send({ name: 'Renamed', notes: 'Pilot school' });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ name: 'Renamed', notes: 'Pilot school' });

    const features = await platform.put(`/api/platform/schools/${id}/features`).send({
      exams: false, assignments: true, liveQuiz: true, devices: true, emailInvites: true, aiGrading: true, teacherTools: true,
    });
    expect(features.status).toBe(200);
    expect(features.body.features.exams).toBe(false);

    const badLimits = await platform.put(`/api/platform/schools/${id}/limits`).send({ maxStudents: 0 });
    expect(badLimits.status).toBe(400);
    const limits = await platform.put(`/api/platform/schools/${id}/limits`).send({
      maxStudents: 3, maxTeachers: null, aiAudioMinutesPerMonth: null, storageGb: null,
    });
    expect(limits.status).toBe(200);
    expect(limits.body.limits.maxStudents).toBe(3);

    // /api/auth/me reports the switches to the web app.
    const me = await as(world.teacher).get('/api/auth/me');
    expect(me.body.features.exams).toBe(false);
    expect(me.body.notice).toEqual({ banner: null, maintenance: null });

    expect(await actions()).toEqual(expect.arrayContaining(['platform.school.update', 'platform.school.features', 'platform.school.limits']));
  });

  it('suspending blocks sign-in and existing sessions; reactivating restores them', async () => {
    const session = as(world.teacher);
    expect((await session.get('/api/auth/me')).status).toBe(200);

    const noReason = await platform.post(`/api/platform/schools/${world.institution.id}/suspend`).send({});
    expect(noReason.status).toBe(400);
    const res = await platform.post(`/api/platform/schools/${world.institution.id}/suspend`).send({ reason: 'Unpaid invoice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'suspended', suspendedReason: 'Unpaid invoice' });

    const blocked = await session.get('/api/teacher/dashboard');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatchObject({ code: 'SCHOOL_SUSPENDED', message: "Your school's access is paused. Contact support." });
    const login = await anon().post('/api/auth/teacher/login').send({ email: world.teacher.email, password: TEST_PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('SCHOOL_SUSPENDED');
    expect(login.headers['set-cookie']).toBeUndefined();
    const student = await anon().post('/api/auth/student/login').send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD });
    expect(student.body.error.code).toBe('SCHOOL_SUSPENDED');
    // A wrong password is still the generic 401 (the suspension is only revealed with valid credentials).
    expect((await anon().post('/api/auth/teacher/login').send({ email: world.teacher.email, password: 'wrong-pass' })).status).toBe(401);

    const back = await platform.post(`/api/platform/schools/${world.institution.id}/reactivate`);
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('active');
    expect((await session.get('/api/teacher/dashboard')).status).toBe(200);
    expect(await actions()).toEqual(expect.arrayContaining(['platform.school.suspend', 'platform.school.reactivate']));
  });

  it('maintenance with blockLogins answers 503 to school users only', async () => {
    const res = await platform.put('/api/platform/settings').send({
      maintenance: { enabled: true, message: 'Upgrading — back at 6 pm', blockLogins: true },
      banner: { enabled: true, message: 'Planned upgrade tonight', level: 'warning' },
    });
    expect(res.status).toBe(200);
    expect(res.body.maintenance.blockLogins).toBe(true);

    const status = await anon().get('/api/status');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      ok: true,
      banner: { message: 'Planned upgrade tonight', level: 'warning' },
      maintenance: { message: 'Upgrading — back at 6 pm', blockLogins: true },
    });
    expect((await anon().get('/api/health/live')).status).toBe(200);

    const me = await as(world.admin).get('/api/auth/me');
    expect(me.status).toBe(503);
    expect(me.body.error).toMatchObject({ code: 'MAINTENANCE', message: 'Upgrading — back at 6 pm' });
    const login = await anon().post('/api/auth/admin/login').send({ email: world.admin.email, password: TEST_PASSWORD });
    expect(login.status).toBe(503);
    expect((await as(world.admin).post('/api/auth/logout')).status).toBe(204);
    // Logout revoked that session (token_version bumped): later requests use a fresh one.
    const adminRow = (await db.query.users.findFirst({ where: eq(users.id, world.admin.id) }))!;
    expect(adminRow.tokenVersion).toBe(world.admin.tokenVersion + 1);

    // The platform keeps working.
    expect((await platform.get('/api/platform/schools')).status).toBe(200);

    // Banner only (no blocking): school users see it in /me.
    await platform.put('/api/platform/settings').send({ maintenance: { enabled: false, message: '', blockLogins: false } });
    const after = await as(adminRow).get('/api/auth/me');
    expect(after.status).toBe(200);
    expect(after.body.notice).toEqual({ banner: { message: 'Planned upgrade tonight', level: 'warning' }, maintenance: null });
  });

  it('settings: defaults, validation and round trip', async () => {
    const res = await platform.get('/api/platform/settings');
    expect(res.status).toBe(200);
    expect(res.body.maintenance).toEqual({ enabled: false, message: '', blockLogins: false });
    expect(res.body.aiPrices.llm['gpt-4.1-mini']).toEqual({ inputPer1M: 0.4, outputPer1M: 1.6 });

    const bad = await platform.put('/api/platform/settings').send({
      defaultModels: { sttProvider: 'sarvam', sttModel: 'whisper-1', llmProvider: 'openai', llmModel: 'gpt-4.1' },
    });
    expect(bad.status).toBe(400);
    const prices = { llm: { 'gpt-4.1': { inputPer1M: 3, outputPer1M: 9 } }, stt: { 'saaras:v3': { perHour: 0.5 } } };
    const put = await platform.put('/api/platform/settings').send({ aiPrices: prices });
    expect(put.status).toBe(200);
    expect((await platform.get('/api/platform/settings')).body.aiPrices).toEqual(prices);
  });

  it('manages the admins of a school', async () => {
    setMailerForTests(async (m) => void outbox.push(m));
    const base = `/api/platform/schools/${world.institution.id}/admins`;
    const list = await platform.get(base);
    expect(list.status).toBe(200);
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([world.admin.id]);

    const created = await platform.post(base).send({ name: 'Second Admin', email: 'second@school.in' });
    expect(created.status).toBe(201);
    expect(created.body.invite).toBe('queued');
    const adminId = created.body.admin.id as string;

    const session = as(world.admin);
    const disabled = await platform.post(`${base}/${world.admin.id}/disable`);
    expect(disabled.body.status).toBe('disabled');
    expect((await session.get('/api/auth/me')).status).toBe(401);
    expect((await platform.post(`${base}/${world.admin.id}/enable`)).body.status).toBe('active');

    const reset = await platform.post(`${base}/${adminId}/reset-password`);
    expect(reset.status).toBe(200);
    const login = await anon().post('/api/auth/admin/login').send({ email: 'second@school.in', password: reset.body.initialPassword });
    expect(login.status).toBe(200);

    const invite = await platform.post(`${base}/${adminId}/send-invite`);
    expect(invite.body.invite).toBe('queued');

    // Teachers are not admins.
    expect((await platform.post(`${base}/${world.teacher.id}/reset-password`)).status).toBe(404);
    expect((await platform.get(`/api/platform/schools/${crypto.randomUUID()}/admins`)).status).toBe(404);
    expect(await actions()).toEqual(
      expect.arrayContaining(['platform.admin.create', 'platform.admin.disable', 'platform.admin.enable', 'platform.admin.reset_password', 'platform.admin.send_invite']),
    );
  });

  it('read-only views and global user search', async () => {
    await createLesson(world);
    const id = world.institution.id;
    for (const view of ['teachers', 'students', 'sections', 'lessons', 'exams', 'assignments', 'devices', 'live-sessions']) {
      const res = await platform.get(`/api/platform/schools/${id}/${view}`);
      expect(res.status, view).toBe(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
    }
    const students = await platform.get(`/api/platform/schools/${id}/students?q=${world.student.rollNumber}`);
    expect(students.body.total).toBe(1);
    expect(students.body.items[0]).toMatchObject({ id: world.student.id, subtitle: world.student.rollNumber });
    const lessons = await platform.get(`/api/platform/schools/${id}/lessons`);
    expect(lessons.body.items[0].title).toBe('Photosynthesis');
    expect((await platform.get(`/api/platform/schools/${id}/nope`)).status).toBe(400);

    const other = await createWorld();
    await createUser(other.institution.id, 'teacher', { name: 'Meera Search', email: 'meera@other.in' });
    const hits = await platform.get('/api/platform/users?q=meera');
    expect(hits.status).toBe(200);
    expect(hits.body).toHaveLength(1);
    expect(hits.body[0]).toMatchObject({ role: 'teacher', school: { id: other.institution.id, code: other.institution.code } });
    expect((await platform.get(`/api/platform/users?q=${world.student.rollNumber}`)).body[0].id).toBe(world.student.id);
    expect((await platform.get('/api/platform/users?q=a')).status).toBe(400);
  });

  it('enforces maxStudents and maxTeachers on create and import', async () => {
    await platform.put(`/api/platform/schools/${world.institution.id}/limits`).send({
      maxStudents: 3, maxTeachers: 2, aiAudioMinutesPerMonth: null, storageGb: null,
    });
    const admin = as(world.admin);
    const one = await admin.post('/api/admin/students').send({ name: 'Third', rollNumber: 'LIM-3' });
    expect(one.status).toBe(201);
    const four = await admin.post('/api/admin/students').send({ name: 'Fourth', rollNumber: 'LIM-4' });
    expect(four.status).toBe(409);
    expect(four.body.error.message).toMatch(/allows 3 students/);
    const imported = await admin.post('/api/admin/students/import').send({
      rows: [{ name: 'A', rollNumber: 'LIM-5' }],
    });
    expect(imported.status).toBe(409);

    const teacher = await admin.post('/api/admin/teachers').send({ name: 'T3', email: 't3@school.in' });
    expect(teacher.status).toBe(409);
    expect(teacher.body.error.message).toMatch(/allows 2 teachers/);
    const teacherImport = await admin.post('/api/admin/teachers/import').send({ rows: [{ name: 'T4', email: 't4@school.in' }] });
    expect(teacherImport.status).toBe(409);
    const count = await db.select().from(users).where(eq(users.institutionId, world.institution.id));
    expect(count.filter((u) => u.role === 'student')).toHaveLength(3);
  });

  it('requireFeature answers 403 FEATURE_DISABLED (and 401 without a session)', async () => {
    const app = express();
    app.use(cookieParser());
    const r = Router();
    r.get('/', requireFeature('exams'), requireRole('teacher'), (_req, res) => void res.json({ ok: true }));
    app.use('/x', r);
    app.use(errorHandler);
    const cookie = `${SESSION_COOKIE}=${signSessionToken(world.teacher)}`;

    expect((await request(app).get('/x').set('Cookie', cookie)).status).toBe(200);
    await platform.put(`/api/platform/schools/${world.institution.id}/features`).send({
      exams: false, assignments: true, liveQuiz: true, devices: true, emailInvites: true, aiGrading: true, teacherTools: true,
    });
    const off = await request(app).get('/x').set('Cookie', cookie);
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('FEATURE_DISABLED');
    expect((await request(app).get('/x')).status).toBe(401);
  });

  it('every platform route needs a platform session', async () => {
    const id = world.institution.id;
    const routes: [string, string][] = [
      ['get', '/api/platform/schools'],
      ['post', '/api/platform/schools'],
      ['get', `/api/platform/schools/${id}`],
      ['patch', `/api/platform/schools/${id}`],
      ['put', `/api/platform/schools/${id}/features`],
      ['put', `/api/platform/schools/${id}/limits`],
      ['post', `/api/platform/schools/${id}/suspend`],
      ['post', `/api/platform/schools/${id}/reactivate`],
      ['get', `/api/platform/schools/${id}/admins`],
      ['post', `/api/platform/schools/${id}/admins`],
      ['get', `/api/platform/schools/${id}/students`],
      ['get', '/api/platform/users?q=ab'],
      ['get', '/api/platform/settings'],
      ['put', '/api/platform/settings'],
      ['get', '/api/platform/auth/me'],
      ['post', '/api/platform/auth/change-password'],
      ['post', '/api/platform/auth/recovery-codes/regenerate'],
    ];
    for (const [method, url] of routes) {
      const res = await (anon() as unknown as Record<string, (u: string) => request.Test>)[method]!(url);
      expect(res.status, `${method} ${url}`).toBe(401);
      const school = await (as(world.admin) as unknown as Record<string, (u: string) => request.Test>)[method]!(url);
      expect(school.status, `${method} ${url} (school session)`).toBe(401);
    }
  });
});
