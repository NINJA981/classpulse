import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@classpulse/shared';
import { db } from '../src/db/client.js';
import { users } from '../src/db/schema/index.js';
import { anon, as, createInstitution, createUser, createWorld, TEST_PASSWORD } from './helpers.js';

function sessionCookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  const cookie = list.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

describe('auth', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  describe('staff login', () => {
    it('logs in a teacher, sets an httpOnly cookie and records lastLoginAt', async () => {
      const res = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: world.teacher.id, role: 'teacher', mustChangePassword: false });
      expect(res.body.user.passwordHash).toBeUndefined();
      const header = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(header).toContain(`${SESSION_COOKIE}=`);
      expect(header.toLowerCase()).toContain('httponly');

      const me = await anon().get('/api/auth/me').set('Cookie', sessionCookieFrom(res));
      expect(me.status).toBe(200);
      expect(me.body.user.id).toBe(world.teacher.id);

      const row = await db.query.users.findFirst({ where: eq(users.id, world.teacher.id) });
      expect(row?.lastLoginAt).not.toBeNull();
    });

    it('accepts mixed-case email', async () => {
      const res = await anon().post('/api/auth/login').send({ email: world.admin.email!.toUpperCase(), password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
    });

    it('rejects a wrong password and an unknown email with the same message', async () => {
      const wrong = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: 'nope-nope-nope' });
      const unknown = await anon().post('/api/auth/login').send({ email: 'ghost@test.local', password: 'nope-nope-nope' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error.message).toBe('Invalid email or password');
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
      expect(wrong.headers['set-cookie']).toBeUndefined();
    });

    it('rejects disabled users', async () => {
      await db.update(users).set({ status: 'disabled' }).where(eq(users.id, world.teacher.id));
      const res = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: TEST_PASSWORD });
      expect(res.status).toBe(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('does not let students use staff login', async () => {
      const student = await createUser(world.institution.id, 'student', { email: 'kid@test.local' });
      const res = await anon().post('/api/auth/login').send({ email: 'kid@test.local', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
      expect(student.id).toBeTruthy();
    });

    it('validates the body', async () => {
      const res = await anon().post('/api/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('student login', () => {
    it('logs in by roll number when only one institution exists', async () => {
      const res = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: world.student.id, role: 'student', rollNumber: world.student.rollNumber });
    });

    it('finds the school from the roll number when it is unique across schools', async () => {
      await createInstitution({ code: 'OTHER2' });
      const res = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(world.student.id);
    });

    it('requires a school code when several schools share the roll number', async () => {
      const other = await createInstitution({ code: 'OTHER1' });
      await createUser(other.id, 'student', { rollNumber: world.student.rollNumber });
      const missing = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD });
      expect(missing.status).toBe(400);
      expect(missing.body.error.message).toMatch(/school code/i);
      expect(missing.body.error.details).toEqual({ field: 'institutionCode' });

      const ok = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD, institutionCode: world.institution.code });
      expect(ok.status).toBe(200);
      expect(ok.body.user.id).toBe(world.student.id);

      const badCode = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: world.student.rollNumber, password: TEST_PASSWORD, institutionCode: 'NOPE' });
      expect(badCode.status).toBe(401);
      expect(badCode.body.error.message).toBe('Invalid roll number or password');
    });

    it('rejects wrong passwords and staff accounts', async () => {
      const wrong = await anon().post('/api/auth/student/login').send({ rollNumber: world.student.rollNumber, password: 'x' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.message).toBe('Invalid roll number or password');
      await db.update(users).set({ rollNumber: 'T-1' }).where(eq(users.id, world.teacher.id));
      const staff = await anon().post('/api/auth/student/login').send({ rollNumber: 'T-1', password: TEST_PASSWORD });
      expect(staff.status).toBe(401);
    });
  });

  describe('sessions', () => {
    it('logout clears the cookie', async () => {
      const res = await as(world.admin).post('/api/auth/logout');
      expect(res.status).toBe(204);
      expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(new RegExp(`${SESSION_COOKIE}=;`));
    });

    it('/me requires a session', async () => {
      expect((await anon().get('/api/auth/me')).status).toBe(401);
    });

    it('revokes sessions of a user who was disabled', async () => {
      const client = as(world.teacher);
      await db.update(users).set({ status: 'disabled' }).where(eq(users.id, world.teacher.id));
      expect((await client.get('/api/auth/me')).status).toBe(401);
    });
  });

  describe('change password', () => {
    it('changes the password, issues a fresh cookie and revokes old tokens', async () => {
      const old = as(world.teacher);
      const res = await old.post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNew#2026' });
      expect(res.status).toBe(200);
      expect(res.body.user.mustChangePassword).toBe(false);
      const fresh = sessionCookieFrom(res);

      expect((await old.get('/api/auth/me')).status).toBe(401);
      expect((await anon().get('/api/auth/me').set('Cookie', fresh)).status).toBe(200);

      const relogin = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: 'BrandNew#2026' });
      expect(relogin.status).toBe(200);
      const oldPw = await anon().post('/api/auth/login').send({ email: world.teacher.email, password: TEST_PASSWORD });
      expect(oldPw.status).toBe(401);
    });

    it('rejects a wrong current password', async () => {
      const res = await as(world.teacher)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'wrong-password', newPassword: 'BrandNew#2026' });
      expect(res.status).toBe(400);
    });

    it('rejects reusing the same password', async () => {
      const res = await as(world.teacher)
        .post('/api/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });
      expect(res.status).toBe(400);
    });

    it('rejects short new passwords', async () => {
      const res = await as(world.teacher).post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('forced password change', () => {
    it('gates other routes with PASSWORD_CHANGE_REQUIRED until the password is changed', async () => {
      const [student] = await db
        .update(users)
        .set({ mustChangePassword: true })
        .where(eq(users.id, world.student.id))
        .returning();
      const login = await anon()
        .post('/api/auth/student/login')
        .send({ rollNumber: student!.rollNumber, password: TEST_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);
      const cookie = sessionCookieFrom(login);

      const blocked = await anon().get('/api/student/dashboard').set('Cookie', cookie);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

      const me = await anon().get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);

      const changed = await anon()
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'MyOwnPass#1' });
      expect(changed.status).toBe(200);
      const dash = await anon().get('/api/student/dashboard').set('Cookie', sessionCookieFrom(changed));
      expect(dash.status).toBe(200);
    });
  });
});
