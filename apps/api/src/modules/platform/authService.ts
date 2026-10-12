/**
 * Platform (super admin) sign-in: password, then a mandatory authenticator code.
 *
 *   1. passwordStep  → a 5-minute challenge token (+ a pending TOTP secret on first sign-in, kept
 *                      until /enroll confirms it)
 *   2. enroll        → first sign-in: confirms the secret, issues 10 recovery codes (shown once)
 *      verify        → later sign-ins: an authenticator code or a single-use recovery code
 *
 * TOTP secrets are stored sealed (lib/secretBox), the last accepted step blocks replays, and
 * every attempt is audited. Codes and passwords are never logged or audited.
 *
 * Wrong codes are counted per admin (lib/failureCounter: Redis, or memory in dev): after
 * MAX_CODE_FAILURES the admin's code steps (enrol, verify, regenerate recovery codes) are refused for
 * CODE_LOCK_MINUTES, and a challenge token stops working after MAX_CODE_FAILURES wrong codes.
 */
import { randomInt, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import {
  RECOVERY_CODE_COUNT,
  type PlatformAdmin,
  type PlatformChangePasswordInput,
  type PlatformEnrollInput,
  type PlatformLoginInput,
  type PlatformLoginResponse,
  type PlatformVerifyInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import { platformAdmins } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { hashInitialPassword, hashPassword, verifyPassword } from '../../lib/crypto.js';
import { AppError, invalidState, unauthenticated } from '../../lib/errors.js';
import { failureCounter } from '../../lib/failureCounter.js';
import { keyFor } from '../../lib/keys.js';
import type { PlatformAdminRow } from '../../lib/platformSession.js';
import { open, seal, secretBoxReady } from '../../lib/secretBox.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../../lib/totp.js';
import { DUMMY_PASSWORD_HASH } from '../auth/accounts.js';

const CHALLENGE_AUDIENCE = 'platform-challenge';
const CHALLENGE_TTL = '5m';

/** Wrong 2FA codes (TOTP or recovery) allowed per admin, and per challenge token. */
export const MAX_CODE_FAILURES = 5;
export const CODE_LOCK_MINUTES = 15;
const adminCodeFailures = failureCounter('platform-2fa-admin', CODE_LOCK_MINUTES * 60_000);
/** Outlives every challenge token (5 minutes). */
const challengeCodeFailures = failureCounter('platform-2fa-challenge', 10 * 60_000);

const INVALID_LOGIN = 'Invalid email or password';
const INVALID_CODE = 'That code is not valid. Check your authenticator app and try again.';
const INVALID_RECOVERY = 'That recovery code is not valid or was already used.';
const CHALLENGE_EXPIRED = 'Your sign-in took too long. Please start again.';
const NOT_CONFIGURED = 'Two-factor sign-in is not configured on this server (PLATFORM_ENCRYPTION_KEY).';
const LOCKED = `Too many incorrect codes. Try again in ${CODE_LOCK_MINUTES} minutes.`;

const platformTokenVersion = (row: PlatformAdminRow) => row.tokenVersion + 1;

export function toPlatformAdmin(row: PlatformAdminRow): PlatformAdmin {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    mustChangePassword: row.mustChangePassword,
    recoveryCodesLeft: row.recoveryCodeHashes.length,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

const actorOf = (row: PlatformAdminRow) => ({ type: 'platform' as const, id: row.id, role: 'superadmin', name: row.name });

async function failure(req: Request, reason: string, row?: PlatformAdminRow, email?: string): Promise<void> {
  await audit(req, {
    action: 'platform.login.failure',
    actor: row ? actorOf(row) : { type: 'anonymous' },
    metadata: { reason, ...(email && !row ? { email } : {}) },
  });
}

/* ---------------------------------------------------------------- challenge tokens */

interface ChallengeClaims {
  sub: string;
  ver: number;
  /** Unique per challenge: wrong codes are counted against it. */
  jti: string;
}

function signChallenge(row: PlatformAdminRow): string {
  return jwt.sign({ sub: row.id, ver: row.tokenVersion }, keyFor('platform-challenge'), {
    expiresIn: CHALLENGE_TTL,
    algorithm: 'HS256',
    audience: CHALLENGE_AUDIENCE,
    jwtid: randomUUID(),
  });
}

interface Challenge {
  row: PlatformAdminRow;
  jti: string;
}

/**
 * The admin a challenge token was issued to; 401 when it expired, the account changed since, or the
 * challenge was spent on MAX_CODE_FAILURES wrong codes.
 */
async function fromChallenge(req: Request, token: string): Promise<Challenge> {
  let claims: ChallengeClaims;
  try {
    claims = jwt.verify(token, keyFor('platform-challenge'), {
      algorithms: ['HS256'],
      audience: CHALLENGE_AUDIENCE,
    }) as ChallengeClaims;
  } catch {
    await failure(req, 'challenge_invalid');
    throw unauthenticated(CHALLENGE_EXPIRED);
  }
  if (typeof claims.jti !== 'string' || (await challengeCodeFailures.count(claims.jti)) >= MAX_CODE_FAILURES) {
    await failure(req, 'challenge_revoked');
    throw unauthenticated(CHALLENGE_EXPIRED);
  }
  const row = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, claims.sub) });
  if (!row || row.status !== 'active' || row.tokenVersion !== claims.ver) {
    await failure(req, 'challenge_stale', row);
    throw unauthenticated(CHALLENGE_EXPIRED);
  }
  return { row, jti: claims.jti };
}

/* ---------------------------------------------------------------- wrong-code lockout */

/** 429 while the admin is locked out of the code steps. */
async function assertCodeAttemptsLeft(row: PlatformAdminRow): Promise<void> {
  if ((await adminCodeFailures.count(row.id)) >= MAX_CODE_FAILURES) throw new AppError('RATE_LIMITED', LOCKED);
}

/** Count a wrong code against the admin (and the challenge); the attempt that reaches the limit locks. */
async function codeFailed(req: Request, row: PlatformAdminRow, reason: string, jti?: string): Promise<void> {
  await failure(req, reason, row);
  const [failures] = await Promise.all([adminCodeFailures.fail(row.id), jti ? challengeCodeFailures.fail(jti) : null]);
  if (failures === MAX_CODE_FAILURES) {
    await audit(req, {
      action: 'platform.login.locked',
      actor: actorOf(row),
      targetType: 'platform_admin',
      targetId: row.id,
      metadata: { failures, minutes: CODE_LOCK_MINUTES },
    });
  }
}

const codeSucceeded = (row: PlatformAdminRow) => adminCodeFailures.reset(row.id);

/* ---------------------------------------------------------------- recovery codes */

const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newRecoveryCodes(): string[] {
  const pick = () => Array.from({ length: 4 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => `${pick()}-${pick()}`);
}

/** Codes are random and single-use, so the cheaper bcrypt cost keeps verification fast. */
const hashRecoveryCodes = (codes: string[]) => Promise.all(codes.map((c) => hashInitialPassword(c)));

/* ---------------------------------------------------------------- TOTP helpers */

function secretOf(row: PlatformAdminRow): string {
  if (!row.totpSecretEnc) throw invalidState('No authenticator is set up for this account.');
  if (!secretBoxReady()) throw invalidState(NOT_CONFIGURED);
  return open(row.totpSecretEnc);
}

/**
 * Accept `code` for the admin and record its step atomically: the conditional update fails when
 * the same (or a later) step was already used, so a code works once even under concurrency.
 */
async function consumeCode(row: PlatformAdminRow, code: string, extra: Partial<typeof platformAdmins.$inferInsert> = {}) {
  const step = verifyTotp(secretOf(row), code, row.totpLastStep);
  if (step === null) return null;
  const [updated] = await db
    .update(platformAdmins)
    .set({ totpLastStep: step, ...extra })
    .where(and(eq(platformAdmins.id, row.id), or(isNull(platformAdmins.totpLastStep), lt(platformAdmins.totpLastStep, step))))
    .returning();
  return updated ?? null;
}

/* ---------------------------------------------------------------- sign-in steps */

export async function passwordStep(req: Request, input: PlatformLoginInput): Promise<PlatformLoginResponse> {
  const row = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.email, input.email) });
  // Always one bcrypt comparison, so timing doesn't reveal whether the account exists.
  const ok = await verifyPassword(input.password, row?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!row || !ok || row.status !== 'active') {
    await failure(req, row && ok ? 'disabled' : 'password', row, input.email);
    throw unauthenticated(INVALID_LOGIN);
  }

  if (row.totpEnabledAt) return { challengeToken: signChallenge(row) };

  // First sign-in: a pending secret until /enroll confirms it. A pending secret is reused (never
  // replaced) by later password steps, so a second sign-in can't swap the authenticator being set up.
  if (!secretBoxReady()) throw invalidState(NOT_CONFIGURED);
  let secret = pendingSecret(row);
  if (!secret) {
    secret = generateTotpSecret();
    await db.update(platformAdmins).set({ totpSecretEnc: seal(secret), totpLastStep: null }).where(eq(platformAdmins.id, row.id));
  }
  return { challengeToken: signChallenge(row), enrolment: { secret, otpauthUri: otpauthUri(row.email, secret) } };
}

/** The unconfirmed secret stored by an earlier password step, or null (none, or sealed with an old key). */
function pendingSecret(row: PlatformAdminRow): string | null {
  if (!row.totpSecretEnc) return null;
  try {
    return open(row.totpSecretEnc);
  } catch {
    return null;
  }
}

export async function enroll(req: Request, input: PlatformEnrollInput): Promise<{ row: PlatformAdminRow; recoveryCodes: string[] }> {
  const { row, jti } = await fromChallenge(req, input.challengeToken);
  if (row.totpEnabledAt) throw invalidState('An authenticator is already set up. Sign in with a code instead.');
  await assertCodeAttemptsLeft(row);
  const recoveryCodes = newRecoveryCodes();
  const recoveryCodeHashes = await hashRecoveryCodes(recoveryCodes);
  const now = new Date();
  const updated = await consumeCode(row, input.code, { totpEnabledAt: now, recoveryCodeHashes, lastLoginAt: now });
  if (!updated) {
    await codeFailed(req, row, 'enrol_code', jti);
    throw unauthenticated(INVALID_CODE);
  }
  await codeSucceeded(updated);
  await audit(req, { action: 'platform.totp.enrolled', actor: actorOf(updated), targetType: 'platform_admin', targetId: updated.id });
  await audit(req, { action: 'platform.login.success', actor: actorOf(updated), metadata: { method: 'enrol' } });
  return { row: updated, recoveryCodes };
}

export async function verify(req: Request, input: PlatformVerifyInput): Promise<PlatformAdminRow> {
  const { row, jti } = await fromChallenge(req, input.challengeToken);
  if (!row.totpEnabledAt) throw invalidState('Set up your authenticator app first.');
  await assertCodeAttemptsLeft(row);
  const now = new Date();

  if (input.code) {
    const updated = await consumeCode(row, input.code, { lastLoginAt: now });
    if (!updated) {
      await codeFailed(req, row, 'totp', jti);
      throw unauthenticated(INVALID_CODE);
    }
    await codeSucceeded(updated);
    await audit(req, { action: 'platform.login.success', actor: actorOf(updated), metadata: { method: 'totp' } });
    return updated;
  }

  // Recovery code: find the matching hash, then remove exactly that element � only while it is
  // still stored, so two concurrent uses of one code can't both succeed.
  const code = input.recoveryCode!;
  let match: string | null = null;
  for (const hash of row.recoveryCodeHashes) {
    if (await verifyPassword(code, hash)) {
      match = hash;
      break;
    }
  }
  const [updated] = match
    ? await db
        .update(platformAdmins)
        .set({ recoveryCodeHashes: sql`${platformAdmins.recoveryCodeHashes} - ${match}::text`, lastLoginAt: now })
        .where(and(eq(platformAdmins.id, row.id), sql`jsonb_exists(${platformAdmins.recoveryCodeHashes}, ${match}::text)`))
        .returning()
    : [];
  if (!updated) {
    await codeFailed(req, row, 'recovery_code', jti);
    throw unauthenticated(INVALID_RECOVERY);
  }
  await codeSucceeded(updated);
  await audit(req, {
    action: 'platform.login.success',
    actor: actorOf(updated),
    metadata: { method: 'recovery_code', recoveryCodesLeft: updated.recoveryCodeHashes.length },
  });
  return updated;
}

/* ---------------------------------------------------------------- account */

export async function changePassword(req: Request, admin: PlatformAdminRow, input: PlatformChangePasswordInput): Promise<PlatformAdminRow> {
  if (!(await verifyPassword(input.currentPassword, admin.passwordHash))) {
    throw new AppError('BAD_REQUEST', 'Your current password is incorrect', [
      { path: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  if (input.newPassword === input.currentPassword) {
    throw new AppError('BAD_REQUEST', 'Choose a password different from your current one', [
      { path: 'newPassword', message: 'Must differ from the current password' },
    ]);
  }
  const passwordHash = await hashPassword(input.newPassword);
  const [updated] = await db
    .update(platformAdmins)
    .set({ passwordHash, mustChangePassword: false, tokenVersion: platformTokenVersion(admin) })
    .where(and(eq(platformAdmins.id, admin.id), eq(platformAdmins.tokenVersion, admin.tokenVersion)))
    .returning();
  if (!updated) throw unauthenticated('Your session has expired. Please sign in again.');
  await audit(req, { action: 'platform.password.change', targetType: 'platform_admin', targetId: admin.id });
  return updated;
}

export async function regenerateRecoveryCodes(req: Request, admin: PlatformAdminRow, code: string): Promise<string[]> {
  await assertCodeAttemptsLeft(admin);
  const recoveryCodes = newRecoveryCodes();
  const updated = await consumeCode(admin, code, { recoveryCodeHashes: await hashRecoveryCodes(recoveryCodes) });
  if (!updated) {
    await codeFailed(req, admin, 'regenerate_code');
    throw new AppError('BAD_REQUEST', INVALID_CODE, [{ path: 'code', message: 'Invalid code' }]);
  }
  await codeSucceeded(updated);
  await audit(req, { action: 'platform.recovery_codes.regenerate', targetType: 'platform_admin', targetId: admin.id });
  return recoveryCodes;
}

/** Sign-out revokes every platform session of the admin (bumps the token version). */
export async function signOut(req: Request, admin: PlatformAdminRow | null): Promise<void> {
  if (!admin) return;
  await db.update(platformAdmins).set({ tokenVersion: platformTokenVersion(admin) }).where(eq(platformAdmins.id, admin.id));
  await audit(req, { action: 'platform.logout', actor: actorOf(admin) });
}
