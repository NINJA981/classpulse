/**
 * Platform (super admin) sessions: a separate `cp_platform` cookie whose JWT carries `aud: 'platform'`.
 * School tokens (no audience) are rejected here, and platform tokens are rejected by the school
 * session check (their subject is not a `users` row). Sessions last 2 hours.
 */
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env, isProd } from '../config/env.js';
import { db } from '../db/client.js';
import { platformAdmins } from '../db/schema/index.js';

export const PLATFORM_COOKIE = 'cp_platform';
export const PLATFORM_SESSION_HOURS = 2;
const AUDIENCE = 'platform';

export type PlatformAdminRow = typeof platformAdmins.$inferSelect;

export interface PlatformSessionAdmin {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

export function signPlatformToken(admin: { id: string; tokenVersion: number }): string {
  return jwt.sign({ sub: admin.id, ver: admin.tokenVersion }, env.JWT_SECRET, {
    expiresIn: `${PLATFORM_SESSION_HOURS}h`,
    algorithm: 'HS256',
    audience: AUDIENCE,
  });
}

function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/', maxAge: PLATFORM_SESSION_HOURS * 3600 * 1000 };
}

export function setPlatformCookie(res: Response, token: string): void {
  res.cookie(PLATFORM_COOKIE, token, cookieOptions());
}

export function clearPlatformCookie(res: Response): void {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(PLATFORM_COOKIE, opts);
}

export function platformTokenFrom(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[PLATFORM_COOKIE];
  if (cookie) return cookie;
  // Scripts/tests may send the token as a bearer with an explicit header marking it as a platform token.
  const header = req.headers.authorization;
  if (header?.startsWith('Platform ')) return header.slice('Platform '.length);
  return null;
}

/** Verify a platform token and load the admin; null for anything invalid, revoked or disabled. */
export async function resolvePlatformSession(token: string | null): Promise<PlatformAdminRow | null> {
  if (!token) return null;
  let claims: { sub: string; ver: number };
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], audience: AUDIENCE }) as { sub: string; ver: number };
  } catch {
    return null;
  }
  const row = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, claims.sub) });
  if (!row || row.status !== 'active' || row.tokenVersion !== claims.ver) return null;
  return row;
}

export function toPlatformSessionAdmin(row: PlatformAdminRow): PlatformSessionAdmin {
  return { id: row.id, email: row.email, name: row.name, mustChangePassword: row.mustChangePassword };
}
