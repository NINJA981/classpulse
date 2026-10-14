import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE, type Role, type SessionUser } from '@classiq/shared';
import { env, isProd } from '../config/env.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { AppError } from './errors.js';
import { keyFor } from './keys.js';
import { assertNotInMaintenance, assertSchoolActive } from './platformState.js';

interface TokenClaims {
  sub: string;
  ver: number;
  role: Role;
}

/** School session tokens carry `aud: 'school'` and are signed with their own derived key. */
const AUDIENCE = 'school';

export function signSessionToken(user: { id: string; tokenVersion: number; role: Role }): string {
  const claims: TokenClaims = { sub: user.id, ver: user.tokenVersion, role: user.role };
  return jwt.sign(claims, keyFor('school-session'), {
    expiresIn: `${env.SESSION_TTL_HOURS}h`,
    algorithm: 'HS256',
    audience: AUDIENCE,
  });
}

/** The claims of a valid school session token (signature, expiry and audience checked), or null. */
export function verifySessionToken(token: string): TokenClaims | null {
  try {
    const claims = jwt.verify(token, keyFor('school-session'), { algorithms: ['HS256'], audience: AUDIENCE }) as TokenClaims;
    return typeof claims.sub === 'string' && typeof claims.ver === 'number' ? claims : null;
  } catch {
    return null;
  }
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3600 * 1000,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
}

export function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    institutionId: row.institutionId,
    rollNumber: row.rollNumber,
    mustChangePassword: row.mustChangePassword,
  };
}

/**
 * Verify a session token and load the current user. Returns null for any
 * invalid/expired/revoked token or a disabled account. Platform state is not checked here.
 */
export async function loadSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, claims.sub) });
  if (!row || row.status !== 'active' || row.tokenVersion !== claims.ver) return null;
  return toSessionUser(row);
}

/** Why a valid session may not be used right now: maintenance (503) or a suspended school (403). */
export async function sessionBlock(user: SessionUser): Promise<AppError | null> {
  try {
    await assertNotInMaintenance();
    await assertSchoolActive(user.institutionId);
    return null;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
}

/** loadSessionUser + platform state: null also while maintenance blocks or the school is suspended (sockets). */
export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  const user = await loadSessionUser(token);
  if (!user) return null;
  return (await sessionBlock(user)) ? null : user;
}
