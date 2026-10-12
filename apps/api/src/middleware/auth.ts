import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SESSION_COOKIE, type Role, type SessionUser } from '@classpulse/shared';
import { AppError, forbidden, unauthenticated } from '../lib/errors.js';
import { loadSessionUser, sessionBlock } from '../lib/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

/** The school session token of a request: the `cp_session` cookie, or a `Bearer` header (scripts, tests). */
export function extractToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Requires a valid session. Users who must change their password may only reach `allowDuringPasswordChange` routes.
 * Platform maintenance (blockLogins) answers 503 MAINTENANCE and a suspended school 403 SCHOOL_SUSPENDED.
 */
export function authenticate(options: { allowDuringPasswordChange?: boolean } = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = await loadSessionUser(extractToken(req));
    if (!user) return next(unauthenticated());
    const blocked = await sessionBlock(user);
    if (blocked) return next(blocked);
    if (user.mustChangePassword && !options.allowDuringPasswordChange) {
      return next(new AppError('PASSWORD_CHANGE_REQUIRED', 'Please change your password to continue'));
    }
    req.user = user;
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthenticated());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Typed accessor for handlers mounted behind `authenticate()`. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}
