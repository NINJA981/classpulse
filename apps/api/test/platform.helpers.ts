/** Platform (super admin) test helpers: accounts, TOTP codes and signed-in agents. */
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { platformAdmins } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/crypto.js';
import { PLATFORM_COOKIE, signPlatformToken } from '../src/lib/platformSession.js';
import { resetPlatformStateCache } from '../src/lib/platformState.js';
import { currentStep, totpAt } from '../src/lib/totp.js';
import { anon, testApp } from './helpers.js';

export const PLATFORM_PASSWORD = 'Platform#Pass-2026';

/** The test config has no key; install one (secretBox reads env on every call). */
export function installEncryptionKey(): void {
  env.PLATFORM_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  resetPlatformStateCache();
}

export async function createPlatformAdmin(overrides: Partial<typeof platformAdmins.$inferInsert> = {}) {
  const [row] = await db
    .insert(platformAdmins)
    .values({
      email: `owner${Math.floor(Math.random() * 1e9)}@platform.test`,
      name: 'Platform Owner',
      passwordHash: await hashPassword(PLATFORM_PASSWORD),
      mustChangePassword: false,
      ...overrides,
    })
    .returning();
  return row!;
}

/** The code `offset` steps from now (0 = current; +1 is still accepted and is a later step). */
export const codeFor = (secret: string, offset = 0) => totpAt(secret, currentStep() + offset);

export function platformCookieFrom(res: { headers: Record<string, unknown> }): string {
  const list = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const cookie = list.find((c) => c.startsWith(`${PLATFORM_COOKIE}=`) && !c.startsWith(`${PLATFORM_COOKIE}=;`));
  if (!cookie) throw new Error('no platform cookie');
  return cookie.split(';')[0]!;
}

/** Full first sign-in (password → enrol). Returns the session cookie, the TOTP secret and the recovery codes. */
export async function enrolPlatformAdmin(email: string) {
  const login = await anon().post('/api/platform/auth/login').send({ email, password: PLATFORM_PASSWORD });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  const secret = login.body.enrolment.secret as string;
  const enrol = await anon()
    .post('/api/platform/auth/enroll')
    .send({ challengeToken: login.body.challengeToken, code: codeFor(secret) });
  if (enrol.status !== 200) throw new Error(`enrol failed: ${enrol.status} ${JSON.stringify(enrol.body)}`);
  return { cookie: platformCookieFrom(enrol), secret, recoveryCodes: enrol.body.recoveryCodes as string[] };
}

/** supertest agent with a platform session (signed directly; the sign-in flow has its own tests). */
export function asPlatform(admin: { id: string; tokenVersion: number }) {
  const cookie = `${PLATFORM_COOKIE}=${signPlatformToken(admin)}`;
  const a = testApp();
  return {
    get: (url: string) => request(a).get(url).set('Cookie', cookie),
    post: (url: string) => request(a).post(url).set('Cookie', cookie),
    put: (url: string) => request(a).put(url).set('Cookie', cookie),
    patch: (url: string) => request(a).patch(url).set('Cookie', cookie),
    delete: (url: string) => request(a).delete(url).set('Cookie', cookie),
  };
}
