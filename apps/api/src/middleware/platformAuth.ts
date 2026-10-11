import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError, unauthenticated } from '../lib/errors.js';
import { platformTokenFrom, resolvePlatformSession, type PlatformAdminRow } from '../lib/platformSession.js';

declare module 'express-serve-static-core' {
  interface Request {
    platformAdmin?: PlatformAdminRow;
  }
}

/**
 * Requires a platform (super admin) session (`cp_platform`). School sessions never pass.
 * Admins who must change their password may only reach `allowDuringPasswordChange` routes.
 */
export function authenticatePlatform(options: { allowDuringPasswordChange?: boolean } = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const admin = await resolvePlatformSession(platformTokenFrom(req));
    if (!admin) return next(unauthenticated());
    if (admin.mustChangePassword && !options.allowDuringPasswordChange) {
      return next(new AppError('PASSWORD_CHANGE_REQUIRED', 'Please change your password to continue'));
    }
    req.platformAdmin = admin;
    next();
  };
}

export function currentPlatformAdmin(req: Request): PlatformAdminRow {
  if (!req.platformAdmin) throw unauthenticated();
  return req.platformAdmin;
}
