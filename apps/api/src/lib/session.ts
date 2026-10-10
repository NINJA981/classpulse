import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE, type Role, type SessionUser } from '@classpulse/shared';
import { env, isProd } from '../config/env.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';

interface TokenClaims {
  sub: string;
  ver: number;
  role: Role;
}

export function signSessionToken(user: { id: string; tokenVersion: number; role: Role }): string {
  const claims: TokenClaims = { sub: user.id, ver: user.tokenVersion, role: user.role };
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: `${env.SESSION_TTL_HOURS}h`, algorithm: 'HS256' });
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
 * invalid/expired/revoked token or a disabled account.
 */
export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  let claims: TokenClaims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenClaims;
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string') return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, claims.sub) });
  if (!row || row.status !== 'active' || row.tokenVersion !== claims.ver) return null;
  return toSessionUser(row);
}
