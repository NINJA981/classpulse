import jwt from 'jsonwebtoken';
import { and, eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@classpulse/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { auditLogs, platformAdmins } from '../src/db/schema/index.js';
import { PLATFORM_COOKIE, signPlatformToken } from '../src/lib/platformSession.js';
import { resetPlatformStateCache } from '../src/lib/platformState.js';
import { base32Decode, base32Encode, totpAt, verifyTotp } from '../src/lib/totp.js';
import { anon, as, createWorld, TEST_PASSWORD } from './helpers.js';
import {
  codeFor,
  createPlatformAdmin,
  enrolPlatformAdmin,
  installEncryptionKey,
  PLATFORM_PASSWORD,
  platformCookieFrom,
} from './platform.helpers.js';

beforeAll(installEncryptionKey);
beforeEach(resetPlatformStateCache);

const auditActions = async () => (await db.select({ action: auditLogs.action }).from(auditLogs)).map((r) => r.action);

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    // RFC 6238 appendix B (8 digits) — the 6-digit code is the last six.
    expect(totpAt(secret, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(secret, Math.floor(1234567890 / 30))).toBe('005924');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });

  it('accepts ±1 step and refuses used steps', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    const now = 1111111109_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(secret, totpAt(secret, step + 2), null, now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, step), step, now)).toBeNull();
  });
});

describe('platform sign-in', () => {
  let admin: Awaited<ReturnType<typeof createPlatformAdmin>>;
  beforeEach(async () => {
    admin = await createPlatformAdmin();
  });

  it('enrols on first sign-in: QR data, recovery codes once, then a 2-hour strict cookie', async () => {
    const login = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: PLATFORM_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeUndefined();
    expect(login.body.enrolment.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(login.body.enrolment.otpauthUri).toContain(`otpauth://totp/ClassPulse:${encodeURIComponent(admin.email)}?secret=`);
    expect(login.body.enrolment.otpauthUri).toContain('issuer=ClassPulse');

    // The pending secret is stored sealed, never in plain text.
    const pending = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, admin.id) });
    expect(pending?.totpSecretEnc).toMatch(/^v1\./);
    expect(pending?.totpSecretEnc).not.toContain(login.body.enrolment.secret);
    expect(pending?.totpEnabledAt).toBeNull();

    const wrong = await anon().post('/api/platform/auth/enroll').send({ challengeToken: login.body.challengeToken, code: '000000' });
    expect(wrong.status).toBe(401);

    const enrol = await anon()
      .post('/api/platform/auth/enroll')
      .send({ challengeToken: login.body.challengeToken, code: codeFor(login.body.enrolment.secret) });
    expect(enrol.status).toBe(200);
    expect(enrol.body.recoveryCodes).toHaveLength(10);
    for (const c of enrol.body.recoveryCodes) expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(enrol.body.admin).toMatchObject({ id: admin.id, recoveryCodesLeft: 10 });

    const raw = (enrol.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${PLATFORM_COOKIE}=`))!;
    expect(raw.toLowerCase()).toContain('httponly');
    expect(raw.toLowerCase()).toContain('samesite=strict');
    expect(raw).toMatch(/Max-Age=7200/);

    const me = await anon().get('/api/platform/auth/me').set('Cookie', platformCookieFrom(enrol));
    expect(me.status).toBe(200);
    expect(me.body.admin.email).toBe(admin.email);

    // Enrolling again is refused: the next sign-in asks for a code instead.
    const second = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: PLATFORM_PASSWORD });
    expect(second.body.enrolment).toBeUndefined();
    const again = await anon()
      .post('/api/platform/auth/enroll')
      .send({ challengeToken: second.body.challengeToken, code: codeFor(login.body.enrolment.secret, 1) });
    expect(again.status).toBe(409);

    const actions = await auditActions();
    expect(actions).toContain('platform.totp.enrolled');
    expect(actions).toContain('platform.login.success');
    expect(actions).toContain('platform.login.failure');
  });

  it('verifies with a code, rejects a replayed code and a wrong one', async () => {
    const { secret } = await enrolPlatformAdmin(admin.email);
    const login = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: PLATFORM_PASSWORD });
    const challengeToken = login.body.challengeToken as string;

    const wrong = await anon().post('/api/platform/auth/verify').send({ challengeToken, code: '123456' === codeFor(secret, 1) ? '654321' : '123456' });
    expect(wrong.status).toBe(401);
    expect(wrong.headers['set-cookie']).toBeUndefined();

    const code = codeFor(secret, 1); // a later step than the one used at enrolment
    const ok = await anon().post('/api/platform/auth/verify').send({ challengeToken, code });
    expect(ok.status).toBe(200);
    expect(platformCookieFrom(ok)).toContain(`${PLATFORM_COOKIE}=`);

    const replay = await anon().post('/api/platform/auth/verify').send({ challengeToken, code });
    expect(replay.status).toBe(401);

    // The enrolment code (an earlier step) is refused too.
    const old = await anon().post('/api/platform/auth/verify').send({ challengeToken, code: codeFor(secret) });
    expect(old.status).toBe(401);
  });

  it('recovery codes work once each', async () => {
    const { recoveryCodes } = await enrolPlatformAdmin(admin.email);
    const login = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: PLATFORM_PASSWORD });
    const challengeToken = login.body.challengeToken as string;

    const ok = await anon()
      .post('/api/platform/auth/verify')
      .send({ challengeToken, recoveryCode: recoveryCodes[0]!.toUpperCase().replace('-', '') });
    expect(ok.status).toBe(200);
    expect(ok.body.admin.recoveryCodesLeft).toBe(9);

    const reused = await anon().post('/api/platform/auth/verify').send({ challengeToken, recoveryCode: recoveryCodes[0] });
    expect(reused.status).toBe(401);
    const bogus = await anon().post('/api/platform/auth/verify').send({ challengeToken, recoveryCode: 'zzzz-zzzz' });
    expect(bogus.status).toBe(401);

    const both = await anon()
      .post('/api/platform/auth/verify')
      .send({ challengeToken, recoveryCode: recoveryCodes[1], code: '123456' });
    expect(both.status).toBe(400);
  });

  it('rejects an expired or forged challenge', async () => {
    await enrolPlatformAdmin(admin.email);
    const expired = jwt.sign({ sub: admin.id, ver: 0, exp: Math.floor(Date.now() / 1000) - 5 }, env.JWT_SECRET, {
      audience: 'platform-challenge',
    });
    const res = await anon().post('/api/platform/auth/verify').send({ challengeToken: expired, code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/took too long/);

    // A platform session token is not a challenge token.
    const session = signPlatformToken(admin);
    expect((await anon().post('/api/platform/auth/verify').send({ challengeToken: session, code: '123456' })).status).toBe(401);
  });

  it('wrong password and unknown email get the same 401; school accounts cannot sign in here', async () => {
    const world = await createWorld();
    const wrong = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: 'nope-nope' });
    const unknown = await anon().post('/api/platform/auth/login').send({ email: 'ghost@platform.test', password: 'nope-nope' });
    const school = await anon().post('/api/platform/auth/login').send({ email: world.admin.email, password: TEST_PASSWORD });
    for (const r of [wrong, unknown, school]) {
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe('Invalid email or password');
    }
    const failures = await db.select().from(auditLogs).where(eq(auditLogs.action, 'platform.login.failure'));
    expect(failures.length).toBeGreaterThanOrEqual(3);
    // Never a password in the audit trail.
    expect(JSON.stringify(failures)).not.toContain('nope-nope');
  });

  it('platform admins cannot use the school logins', async () => {
    for (const path of ['/api/auth/login', '/api/auth/admin/login', '/api/auth/teacher/login']) {
      const res = await anon().post(path).send({ email: admin.email, password: PLATFORM_PASSWORD });
      expect(res.status).toBe(401);
    }
  });

  it('refuses to enrol without an encryption key', async () => {
    const key = env.PLATFORM_ENCRYPTION_KEY;
    env.PLATFORM_ENCRYPTION_KEY = '';
    try {
      const res = await anon().post('/api/platform/auth/login').send({ email: admin.email, password: PLATFORM_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/PLATFORM_ENCRYPTION_KEY/);
    } finally {
      env.PLATFORM_ENCRYPTION_KEY = key;
    }
  });

  it('forces a password change, then re-issues the cookie and revokes the old one', async () => {
    await db.update(platformAdmins).set({ mustChangePassword: true }).where(eq(platformAdmins.id, admin.id));
    const { cookie } = await enrolPlatformAdmin(admin.email);

    const blocked = await anon().get('/api/platform/schools').set('Cookie', cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await anon().get('/api/platform/auth/me').set('Cookie', cookie)).body.admin.mustChangePassword).toBe(true);

    const changed = await anon()
      .post('/api/platform/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: PLATFORM_PASSWORD, newPassword: 'Another#Pass-2027' });
    expect(changed.status).toBe(200);
    expect(changed.body.admin.mustChangePassword).toBe(false);
    const fresh = platformCookieFrom(changed);
    expect((await anon().get('/api/platform/schools').set('Cookie', fresh)).status).toBe(200);
    expect((await anon().get('/api/platform/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect(await auditActions()).toContain('platform.password.change');
  });

  it('regenerates recovery codes with a fresh code; logout revokes the session', async () => {
    const { cookie, secret, recoveryCodes } = await enrolPlatformAdmin(admin.email);
    const bad = await anon().post('/api/platform/auth/recovery-codes/regenerate').set('Cookie', cookie).send({ code: codeFor(secret) });
    expect(bad.status).toBe(400); // the enrolment step was already used
    const res = await anon().post('/api/platform/auth/recovery-codes/regenerate').set('Cookie', cookie).send({ code: codeFor(secret, 1) });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCodes).toHaveLength(10);
    expect(res.body.recoveryCodes).not.toContain(recoveryCodes[0]);

    const out = await anon().post('/api/platform/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    expect((await anon().get('/api/platform/auth/me').set('Cookie', cookie)).status).toBe(401);
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'platform.recovery_codes.regenerate'), eq(auditLogs.actorId, admin.id)));
    expect(rows).toHaveLength(1);
  });
});

describe('session separation', () => {
  it('a school session never reaches /api/platform and a platform session never reaches school routes', async () => {
    const world = await createWorld();
    const admin = await createPlatformAdmin();
    const school = as(world.admin);
    for (const url of ['/api/platform/schools', '/api/platform/settings', '/api/platform/users?q=ab', '/api/platform/auth/me']) {
      expect((await school.get(url)).status).toBe(401);
    }
    const token = signPlatformToken(admin);
    expect((await anon().get('/api/auth/me').set('Cookie', `${PLATFORM_COOKIE}=${token}`)).status).toBe(401);
    // Even presented as the school cookie or a bearer token, a platform token is not a school session.
    expect((await anon().get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${token}`)).status).toBe(401);
    expect((await anon().get('/api/admin/teachers').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await anon().get('/api/platform/schools')).status).toBe(401);
  });
});
