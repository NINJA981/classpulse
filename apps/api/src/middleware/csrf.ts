import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { isOwnOrigin } from '../lib/origins.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Bodies the API accepts from browsers: JSON, and multipart uploads. */
const BODY_TYPES = ['application/json', 'multipart/form-data'];

const crossSite = () => new AppError('FORBIDDEN', 'Cross-site request blocked');

/** Classroom devices authenticate with their device key header (no cookies) and send raw audio chunks. */
const isDeviceRoute = (path: string) => path === '/api/devices' || path.startsWith('/api/devices/');

/**
 * CSRF guard for cookie-authenticated routes. State-changing requests (POST/PUT/PATCH/DELETE) under
 * /api are accepted only when
 *   - `Origin` is the request's own origin (lib/origins), or
 *   - there is no `Origin` and `Sec-Fetch-Site` is `same-origin` or `none`, or
 *   - neither header is present (not a browser: scripts, tests, server-to-server calls).
 * A request with a body must also be JSON or multipart: `text/plain` and urlencoded bodies (which
 * plain HTML forms can send cross-site without a preflight) are refused.
 */
export function sameOriginGuard(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!UNSAFE.has(req.method) || !req.path.startsWith('/api/') || isDeviceRoute(req.path)) return next();

    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site')?.toLowerCase();
    if (origin !== undefined) {
      if (!isOwnOrigin(origin, [req.get('host'), req.host])) return next(crossSite());
    } else if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return next(crossSite());
    }

    // A body without a Content-Type is ignored by every parser, so only a declared type is checked.
    // (req.is() is null when there is no body, false when the type doesn't match.)
    if (req.get('content-type') !== undefined && req.is(BODY_TYPES) === false) {
      return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Send the request body as application/json'));
    }
    next();
  };
}
