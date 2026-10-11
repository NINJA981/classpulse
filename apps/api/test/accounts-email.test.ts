import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_INSTITUTION_FEATURES, SESSION_COOKIE } from '@classpulse/shared';
import { db } from '../src/db/client.js';
import { institutions, passwordTokens, users } from '../src/db/schema/index.js';
import { invalidateInstitutionState } from '../src/lib/platformState.js';
import { setMailerForTests, type MailMessage } from '../src/lib/mailer.js';
import { mailCaptureRouter } from '../src/modules/testing/routes.js';
import { anon, as, createUser, createWorld, TEST_PASSWORD } from './helpers.js';

const NEW_PASSWORD = 'Brand-new#2026';

let outbox: MailMessage[] = [];
const captureMail = () => setMailerForTests(async (m) => void outbox.push(m));

function sessionCookieFrom(res: { headers: Record<string, unknown> }): string {
  const list = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const cookie = list.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

/** Raw token from the newest captured email to `to`. */
function tokenFor(to: string): string {
  const mail = [...outbox].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`no email to ${to}`);
  const match = /\/set-password\?token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error('no link in email');
  return decodeURIComponent(match[1]!);
}

/** forgot-password answers before it sends; wait for the background work. */
async function waitForMail(to: string, count = 1): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (outbox.filter((m) => m.to === to).length >= count) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for email to ${to}`);
}

const settle = () => new Promise((r) => setTimeout(r, 300));

describe('account emails: invitations, set-password links and resets', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
    outbox = [];
    captureMail();
  });
  afterEach(() => setMailerForTests(null));

  describe('invitations on create', () => {
    it('emails a new teacher a working set-password link', async () => {
      const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Neha Rao', email: 'neha@school.in' });
      expect(res.status).toBe(201);
      expect(res.body.invite).toBe('queued');
      expect(res.body.initialPassword).toMatch(/^[A-Z2-9-]{12}$/);
      expect(res.body.record.inviteStatus).toBe('sent');

      expect(outbox).toHaveLength(1);
      const mail = outbox[0]!;
      expect(mail.to).toBe('neha@school.in');
      expect(mail.subject).toBe('Welcome to ClassPulse — set your password');
      expect(mail.text).toContain(world.institution.name);
      expect(mail.text).toContain('teacher');
      expect(mail.text).toContain('neha@school.in');
      expect(mail.text).toContain('72 hours');
      expect(mail.text).toContain('http://localhost:3000/set-password?token=');
      expect(mail.html).toContain('Set your password');
      // The fallback password is never emailed.
      expect(mail.text).not.toContain(res.body.initialPassword);

      const stored = await db.select().from(passwordTokens);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ purpose: 'invite', emailStatus: 'sent', createdBy: world.admin.id });
      expect(stored[0]!.tokenHash).not.toBe(tokenFor('neha@school.in'));

      const preview = await anon().get(`/api/auth/password-token/${tokenFor('neha@school.in')}`);
      expect(preview.status).toBe(200);
      expect(preview.body).toMatchObject({
        purpose: 'invite',
        name: 'Neha Rao',
        role: 'teacher',
        schoolName: world.institution.name,
        identifier: 'neha@school.in',
      });
      expect(new Date(preview.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 71 * 3600_000);
    });

    it('invites a student with an email (roll number as identifier) and reports no_email otherwise', async () => {
      const withEmail = await as(world.admin).post('/api/admin/students').send({ name: 'Asha', rollNumber: 'A-1', email: 'asha@home.in' });
      expect(withEmail.status).toBe(201);
      expect(withEmail.body.invite).toBe('queued');
      expect(outbox[0]!.text).toContain('A-1');
      expect(outbox[0]!.text).toContain(world.institution.code);
      const preview = await anon().get(`/api/auth/password-token/${tokenFor('asha@home.in')}`);
      expect(preview.body).toMatchObject({ role: 'student', identifier: 'A-1' });

      const without = await as(world.admin).post('/api/admin/students').send({ name: 'Ravi', rollNumber: 'A-2' });
      expect(without.status).toBe(201);
      expect(without.body.invite).toBe('no_email');
      expect(without.body.initialPassword).toBeTruthy();
      expect(without.body.record.inviteStatus).toBe('none');
      expect(outbox).toHaveLength(1);
    });

    it('reports email_disabled when email is not configured', async () => {
      setMailerForTests(null);
      const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'No Mail', email: 'nomail@school.in' });
      expect(res.status).toBe(201);
      expect(res.body.invite).toBe('email_disabled');
      expect(res.body.initialPassword).toBeTruthy();
      expect(await db.select().from(passwordTokens)).toHaveLength(0);
    });

    it('sends no link when the platform switched email invitations off for the school', async () => {
      await db
        .update(institutions)
        .set({ features: { ...DEFAULT_INSTITUTION_FEATURES, emailInvites: false } })
        .where(eq(institutions.id, world.institution.id));
      invalidateInstitutionState(world.institution.id);
      const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Off Switch', email: 'off@school.in' });
      expect(res.status).toBe(201);
      expect(res.body.invite).toBe('email_disabled');
      expect(res.body.initialPassword).toBeTruthy();
      expect(outbox).toHaveLength(0);
      expect(await db.select().from(passwordTokens)).toHaveLength(0);
    });

    it('records a failed delivery', async () => {
      setMailerForTests(async () => {
        throw new Error('SMTP down');
      });
      const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Fail', email: 'fail@school.in' });
      expect(res.body.invite).toBe('queued');
      expect(res.body.record.inviteStatus).toBe('failed');
    });
  });

  describe('set-password', () => {
    async function inviteTeacher(email = 'neha@school.in') {
      const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Neha', email });
      return { id: res.body.record.id as string, token: tokenFor(email) };
    }

    it('sets the password, signs in, revokes old sessions and is single-use', async () => {
      // An existing session (e.g. signed in earlier with the one-time password).
      const pre = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: TEST_PASSWORD });
      const oldCookie = sessionCookieFrom(pre);
      await as(world.admin).post(`/api/admin/teachers/${world.teacher.id}/send-reset-link`).expect(200);
      const token = tokenFor(world.teacher.email!);

      const res = await anon().post('/api/auth/set-password').send({ token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: world.teacher.id, role: 'teacher', mustChangePassword: false });
      const me = await anon().get('/api/auth/me').set('Cookie', sessionCookieFrom(res));
      expect(me.status).toBe(200);
      expect((await anon().get('/api/auth/me').set('Cookie', oldCookie)).status).toBe(401);

      const login = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: NEW_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(false);

      const again = await anon().post('/api/auth/set-password').send({ token, newPassword: 'Another#Pass1' });
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe('BAD_REQUEST');
      expect((await anon().get(`/api/auth/password-token/${token}`)).status).toBe(400);
    });

    it('clears the forced change for invited users', async () => {
      const { id, token } = await inviteTeacher();
      const res = await anon().post('/api/auth/set-password').send({ token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      const row = await db.query.users.findFirst({ where: eq(users.id, id) });
      expect(row?.mustChangePassword).toBe(false);
      const list = await as(world.admin).get('/api/admin/teachers');
      expect(list.body.find((t: { id: string }) => t.id === id).inviteStatus).toBe('accepted');
    });

    it('rejects expired, unknown and malformed tokens with 400 and the same message', async () => {
      const { id, token } = await inviteTeacher();
      await db.update(passwordTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(passwordTokens.userId, id));
      const expired = await anon().post('/api/auth/set-password').send({ token, newPassword: NEW_PASSWORD });
      expect(expired.status).toBe(400);
      expect(expired.body.error.message).toBe('This link is invalid or has expired. Ask your school administrator for a new one.');
      const preview = await anon().get(`/api/auth/password-token/${token}`);
      expect(preview.status).toBe(400);
      expect(preview.body.error.message).toBe(expired.body.error.message);

      const unknown = await anon().get(`/api/auth/password-token/${'x'.repeat(43)}`);
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.message).toBe(expired.body.error.message);
      expect((await anon().get('/api/auth/password-token/short')).status).toBe(400);
    });

    it('a newer link revokes the older one', async () => {
      const { id, token: first } = await inviteTeacher();
      const resend = await as(world.admin).post(`/api/admin/teachers/${id}/send-invite`);
      expect(resend.status).toBe(200);
      expect(resend.body).toEqual({ invite: 'queued' });
      const second = tokenFor('neha@school.in');
      expect(second).not.toBe(first);
      expect((await anon().post('/api/auth/set-password').send({ token: first, newPassword: NEW_PASSWORD })).status).toBe(400);
      expect((await anon().post('/api/auth/set-password').send({ token: second, newPassword: NEW_PASSWORD })).status).toBe(200);
    });

    it('disabled users cannot preview or redeem', async () => {
      const { id, token } = await inviteTeacher();
      await as(world.admin).patch(`/api/admin/teachers/${id}`).send({ status: 'disabled' }).expect(200);
      expect((await anon().get(`/api/auth/password-token/${token}`)).status).toBe(400);
      expect((await anon().post('/api/auth/set-password').send({ token, newPassword: NEW_PASSWORD })).status).toBe(400);
      const row = await db.query.users.findFirst({ where: eq(users.id, id) });
      expect(row?.mustChangePassword).toBe(true);
    });

    it('an admin one-time password reset revokes outstanding links', async () => {
      const { id, token } = await inviteTeacher();
      await as(world.admin).post(`/api/admin/teachers/${id}/reset-password`).expect(200);
      expect((await anon().get(`/api/auth/password-token/${token}`)).status).toBe(400);
      const list = await as(world.admin).get('/api/admin/teachers');
      expect(list.body.find((t: { id: string }) => t.id === id).inviteStatus).toBe('none');
    });

    it('changing the email address revokes links sent to the old one (but other edits do not)', async () => {
      const { id, token } = await inviteTeacher();
      await as(world.admin).patch(`/api/admin/teachers/${id}`).send({ name: 'Neha R', email: 'neha@school.in' }).expect(200);
      expect((await anon().get(`/api/auth/password-token/${token}`)).status).toBe(200);
      await as(world.admin).patch(`/api/admin/teachers/${id}`).send({ email: 'neha.rao@school.in' }).expect(200);
      expect((await anon().get(`/api/auth/password-token/${token}`)).status).toBe(400);
    });

    it('validates the new password', async () => {
      const { token } = await inviteTeacher();
      const res = await anon().post('/api/auth/set-password').send({ token, newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('forgot password', () => {
    it('always answers 204 and only emails accounts that exist and have an email', async () => {
      const unknown = await anon().post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.in' });
      expect(unknown.status).toBe(204);
      const known = await anon().post('/api/auth/forgot-password').send({ email: world.teacher.email!.toUpperCase() });
      expect(known.status).toBe(204);
      await waitForMail(world.teacher.email!);
      await settle();
      expect(outbox.map((m) => m.to)).toEqual([world.teacher.email]);
      expect(outbox[0]!.subject).toBe('Reset your ClassPulse password');

      const token = tokenFor(world.teacher.email!);
      const preview = await anon().get(`/api/auth/password-token/${token}`);
      expect(preview.body.purpose).toBe('reset');
      const res = await anon().post('/api/auth/set-password').send({ token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
    });

    it('finds students by roll number and school code; students without email get nothing', async () => {
      const withEmail = await createUser(world.institution.id, 'student', { email: 'kid@home.in' });
      const res = await anon()
        .post('/api/auth/forgot-password')
        .send({ rollNumber: withEmail.rollNumber, institutionCode: world.institution.code.toLowerCase() });
      expect(res.status).toBe(204);
      await waitForMail('kid@home.in');

      const noEmail = await anon()
        .post('/api/auth/forgot-password')
        .send({ rollNumber: world.student.rollNumber, institutionCode: world.institution.code });
      expect(noEmail.status).toBe(204);
      const wrongSchool = await anon().post('/api/auth/forgot-password').send({ rollNumber: withEmail.rollNumber, institutionCode: 'NOPE' });
      expect(wrongSchool.status).toBe(204);
      await settle();
      expect(outbox).toHaveLength(1);
    });

    it('sends nothing to disabled users', async () => {
      await db.update(users).set({ status: 'disabled' }).where(eq(users.id, world.teacher.id));
      expect((await anon().post('/api/auth/forgot-password').send({ email: world.teacher.email })).status).toBe(204);
      await settle();
      expect(outbox).toHaveLength(0);
    });

    it('validates the body', async () => {
      expect((await anon().post('/api/auth/forgot-password').send({})).status).toBe(400);
      expect((await anon().post('/api/auth/forgot-password').send({ email: 'not-an-email' })).status).toBe(400);
    });
  });

  describe('admin: send invite / reset link', () => {
    it('emails a reset link to a student with an email; 400 without one; 404 across schools', async () => {
      await as(world.admin).patch(`/api/admin/students/${world.student.id}`).send({ email: 's1@home.in' }).expect(200);
      const ok = await as(world.admin).post(`/api/admin/students/${world.student.id}/send-reset-link`);
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ invite: 'queued' });
      expect(outbox[0]!.subject).toBe('Reset your ClassPulse password');

      const none = await as(world.admin).post(`/api/admin/students/${world.otherStudent.id}/send-invite`);
      expect(none.status).toBe(400);
      expect(none.body.error.code).toBe('BAD_REQUEST');

      // A teacher id on the students route is not found.
      expect((await as(world.admin).post(`/api/admin/students/${world.teacher.id}/send-invite`)).status).toBe(404);
    });

    it('returns email_disabled when email is off and 409 for disabled accounts', async () => {
      setMailerForTests(null);
      const off = await as(world.admin).post(`/api/admin/teachers/${world.teacher.id}/send-invite`);
      expect(off.status).toBe(200);
      expect(off.body).toEqual({ invite: 'email_disabled' });

      captureMail();
      await as(world.admin).patch(`/api/admin/teachers/${world.otherTeacher.id}`).send({ status: 'disabled' }).expect(200);
      expect((await as(world.admin).post(`/api/admin/teachers/${world.otherTeacher.id}/send-invite`)).status).toBe(409);
    });

    it('is admin-only', async () => {
      for (const path of [
        `/api/admin/teachers/${world.teacher.id}/send-invite`,
        `/api/admin/teachers/${world.teacher.id}/send-reset-link`,
        `/api/admin/students/${world.student.id}/send-invite`,
        `/api/admin/students/${world.student.id}/send-reset-link`,
        '/api/admin/teachers/import',
      ]) {
        expect((await as(world.teacher).post(path).send({ rows: [] })).status).toBe(403);
        expect((await as(world.student).post(path).send({ rows: [] })).status).toBe(403);
        expect((await anon().post(path).send({ rows: [] })).status).toBe(401);
      }
    });
  });

  describe('invite status in lists', () => {
    it('reports none / sent / failed / accepted', async () => {
      // world.teacher has never signed in and has no link.
      const a = await as(world.admin).post('/api/admin/teachers').send({ name: 'Sent', email: 'sent@school.in' });
      setMailerForTests(async () => {
        throw new Error('nope');
      });
      const b = await as(world.admin).post('/api/admin/teachers').send({ name: 'Failed', email: 'failed@school.in' });
      captureMail();
      await anon().post('/api/auth/login').send({ email: world.otherTeacher.email, password: TEST_PASSWORD }).expect(200);

      const list = await as(world.admin).get('/api/admin/teachers');
      const status = (id: string) => list.body.find((t: { id: string }) => t.id === id).inviteStatus;
      expect(status(world.teacher.id)).toBe('none');
      expect(status(a.body.record.id)).toBe('sent');
      expect(status(b.body.record.id)).toBe('failed');
      expect(status(world.otherTeacher.id)).toBe('accepted');

      // Queued: the link exists but delivery has not been recorded yet.
      await db.update(passwordTokens).set({ emailStatus: 'queued' }).where(eq(passwordTokens.userId, a.body.record.id));
      const again = await as(world.admin).get('/api/admin/teachers');
      expect(again.body.find((t: { id: string }) => t.id === a.body.record.id).inviteStatus).toBe('queued');

      const students = await as(world.admin).get('/api/admin/students');
      expect(students.body.items.every((s: { inviteStatus: string }) => s.inviteStatus === 'none')).toBe(true);
    });
  });

  describe('teacher CSV import', () => {
    it('creates teachers, skips duplicates and existing emails, and sends invitations', async () => {
      // Emails are unique across roles and schools.
      await createUser(world.institution.id, 'student', { email: 'kid@home.in' });
      const res = await as(world.admin)
        .post('/api/admin/teachers/import')
        .send({
          rows: [
            { name: 'Imp One', email: 'One@School.in', department: 'Maths' },
            { name: 'Imp Two', email: 'two@school.in' },
            { name: 'Imp Dup', email: 'one@school.in' },
            { name: 'Existing', email: world.teacher.email },
            { name: 'Student clash', email: 'kid@home.in' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.created.map((c: { email: string }) => c.email).sort()).toEqual(['one@school.in', 'two@school.in']);
      expect(res.body.created.every((c: { invite: string; initialPassword: string }) => c.invite === 'queued' && c.initialPassword)).toBe(true);
      expect(res.body.skipped).toEqual(
        expect.arrayContaining([
          { email: 'one@school.in', reason: 'Duplicate email in the import' },
          { email: world.teacher.email, reason: 'Email already in use' },
          { email: 'kid@home.in', reason: 'Email already in use' },
        ]),
      );
      expect(res.body.skipped).toHaveLength(3);
      expect(outbox.map((m) => m.to).sort()).toEqual(['one@school.in', 'two@school.in']);

      const list = await as(world.admin).get('/api/admin/teachers');
      const one = list.body.find((t: { email: string }) => t.email === 'one@school.in');
      expect(one).toMatchObject({ name: 'Imp One', department: 'Maths', status: 'active', inviteStatus: 'sent' });

      // Imported teachers can also use the fallback password, which must be changed.
      const created = res.body.created.find((c: { email: string }) => c.email === 'two@school.in');
      const login = await anon().post('/api/auth/login').send({ email: 'two@school.in', password: created.initialPassword });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);
    });

    it('reports email_disabled per row when email is off', async () => {
      setMailerForTests(null);
      const res = await as(world.admin).post('/api/admin/teachers/import').send({ rows: [{ name: 'A', email: 'a@school.in' }] });
      expect(res.status).toBe(200);
      expect(res.body.created[0].invite).toBe('email_disabled');
    });

    it('validates rows', async () => {
      expect((await as(world.admin).post('/api/admin/teachers/import').send({ rows: [] })).status).toBe(400);
      expect((await as(world.admin).post('/api/admin/teachers/import').send({ rows: [{ name: 'X', email: 'bad' }] })).status).toBe(400);
    });
  });

  describe('student CSV import', () => {
    it('invites imported students who have an email', async () => {
      const res = await as(world.admin)
        .post('/api/admin/students/import')
        .send({
          rows: [
            { name: 'With', rollNumber: 'I-1', email: 'with@home.in' },
            { name: 'Without', rollNumber: 'I-2' },
          ],
        });
      expect(res.status).toBe(200);
      const byRoll = Object.fromEntries(res.body.created.map((c: { rollNumber: string; invite: string }) => [c.rollNumber, c.invite]));
      expect(byRoll).toEqual({ 'I-1': 'queued', 'I-2': 'no_email' });
      expect(outbox.map((m) => m.to)).toEqual(['with@home.in']);
    });
  });

  describe('e2e mail capture (E2E_MAIL_CAPTURE)', () => {
    it('captures outgoing email and lists it newest first, filtered by recipient', async () => {
      const testApp = express().use('/api/test', mailCaptureRouter());
      await as(world.admin).post('/api/admin/teachers').send({ name: 'Cap', email: 'cap@school.in' }).expect(201);
      await as(world.admin).post('/api/admin/teachers').send({ name: 'Other', email: 'other@school.in' }).expect(201);
      await as(world.admin).post(`/api/admin/teachers/${world.teacher.id}/send-reset-link`).expect(200);

      const res = await request(testApp).get('/api/test/emails').query({ to: 'CAP@school.in' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ to: 'cap@school.in', subject: 'Welcome to ClassPulse — set your password' });
      expect(res.body[0].text).toContain('/set-password?token=');
      expect(typeof res.body[0].html).toBe('string');
      expect(typeof res.body[0].at).toBe('string');
      const all = await request(testApp).get('/api/test/emails');
      expect(all.body.map((m: { to: string }) => m.to)).toEqual([world.teacher.email, 'other@school.in', 'cap@school.in']);
    });
  });
});
