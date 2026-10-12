import { createHmac } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  ChangePasswordInput,
  DEFAULT_INSTITUTION_FEATURES,
  ForgotPasswordInput,
  PasswordTokenParams,
  PasswordTokenPreviewInput,
  SetPasswordInput,
  StaffLoginInput,
  StudentLoginInput,
  type ErrorCode,
  type MeResponse,
  type SessionResponse,
} from '@classpulse/shared';
import type { users } from '../../db/schema/index.js';
import { authenticate, currentUser, extractToken } from '../../middleware/auth.js';
import { authIpLimiter, staffLoginLimiter, studentLoginLimiter, tokenLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { keyFor } from '../../lib/keys.js';
import { assertNotInMaintenance, institutionState, platformNotice } from '../../lib/platformState.js';
import { clearSessionCookie, setSessionCookie, signSessionToken, toSessionUser } from '../../lib/session.js';
import * as passwordTokens from './passwordTokens.js';
import { disconnectUserSockets } from '../../sockets/sessions.js';
import * as service from './service.js';

export const router = Router();

type UserRow = typeof users.$inferSelect;

/** Issue a session cookie for the user and send the SessionResponse. */
function sendSession(res: Response, row: UserRow): void {
  setSessionCookie(res, signSessionToken(row));
  const body: SessionResponse = { user: toSessionUser(row) };
  res.json(body);
}

const actorOf = (row: UserRow) => ({ type: 'user' as const, id: row.id, role: row.role, name: row.name });

/** Successful sign-in: recorded as `auth.login` (daily active users in the platform statistics). */
async function signedIn(req: Request, res: Response, row: UserRow): Promise<void> {
  await audit(req, { action: 'auth.login', institutionId: row.institutionId, actor: actorOf(row) });
  sendSession(res, row);
}

/* ---------------------------------------------------------------- failed sign-ins */

const FAILURE_REASONS: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: 'invalid_credentials',
  FORBIDDEN: 'disabled',
  SCHOOL_SUSPENDED: 'school_suspended',
};

/** "ne***@school.in" / "10***": enough to recognise an account, never the whole identifier. */
function maskIdentifier(identifier: string): string {
  const at = identifier.lastIndexOf('@');
  if (at > 0) return `${identifier.slice(0, Math.min(2, at))}***${identifier.slice(at)}`;
  return `${identifier.slice(0, 2)}***`;
}

/** Keyed hash of the identifier, so failures against one account can be grouped without storing it. */
const identifierHash = (identifier: string) =>
  createHmac('sha256', keyFor('audit-identifier')).update(identifier.toLowerCase()).digest('hex').slice(0, 16);

/** Run a sign-in; a refused one is recorded as `auth.login.failed` (never with the password). */
async function attemptLogin(
  req: Request,
  who: { kind: 'staff' | 'student'; identifier: string; institutionCode?: string | undefined },
  login: () => Promise<UserRow>,
): Promise<UserRow> {
  try {
    return await login();
  } catch (err) {
    const reason = err instanceof AppError ? FAILURE_REASONS[err.code] : undefined;
    if (reason) {
      await audit(req, {
        action: 'auth.login.failed',
        actor: { type: 'anonymous' },
        metadata: {
          endpoint: req.path,
          kind: who.kind,
          reason: err instanceof AppError && err.message === service.SCHOOL_CODE_NEEDED ? 'school_code_needed' : reason,
          identifier: maskIdentifier(who.identifier),
          identifierHash: identifierHash(who.identifier),
          ...(who.institutionCode ? { institutionCode: who.institutionCode } : {}),
        },
      });
    }
    throw err;
  }
}

/*
 * Each role signs in on its own page and endpoint. POST /login (any staff role) is kept for
 * older clients and scripts; the web app uses the role endpoints.
 */

const staffLogin = (roles?: readonly ('admin' | 'teacher')[]) => async (req: Request, res: Response) => {
  const input = parseBody(req, StaffLoginInput);
  const row = await attemptLogin(req, { kind: 'staff', identifier: input.email }, () => service.staffLogin(input, roles));
  await signedIn(req, res, row);
};

router.post('/admin/login', authIpLimiter, staffLoginLimiter, staffLogin(['admin']));
router.post('/teacher/login', authIpLimiter, staffLoginLimiter, staffLogin(['teacher']));
router.post('/login', authIpLimiter, staffLoginLimiter, staffLogin());

router.post('/student/login', authIpLimiter, studentLoginLimiter, async (req, res) => {
  const input = parseBody(req, StudentLoginInput);
  const who = { kind: 'student' as const, identifier: input.rollNumber, institutionCode: input.institutionCode };
  await signedIn(req, res, await attemptLogin(req, who, () => service.studentLogin(input)));
});

const sessionAuth = authenticate({ allowDuringPasswordChange: true });

/*
 * No session needed: clearing the cookie must work even while maintenance or a suspension blocks
 * requests. A valid session that is presented is revoked (with every other session of the user).
 */
router.post('/logout', async (req, res) => {
  const user = await service.signOut(extractToken(req));
  if (user) {
    disconnectUserSockets(user.id);
    await audit(req, { action: 'auth.logout', institutionId: user.institutionId, actor: actorOf(user) });
  }
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', sessionAuth, async (req, res) => {
  const user = currentUser(req);
  const [notice, state] = await Promise.all([platformNotice(), institutionState(user.institutionId)]);
  const body: MeResponse = { user, notice, features: state?.features ?? DEFAULT_INSTITUTION_FEATURES };
  res.json(body);
});

router.post('/change-password', sessionAuth, async (req, res) => {
  const input = parseBody(req, ChangePasswordInput);
  sendSession(res, await service.changePassword(currentUser(req).id, input));
});

/*
 * Emailed set-password links. Public routes; an unusable link is a 400 (not a 401, which the
 * web client treats as "go to the login page"). Links carry the token in the URL fragment
 * (/set-password#token=…), which browsers never send, and the page posts it to /preview.
 */

router.post('/password-token/preview', authIpLimiter, tokenLimiter, async (req, res) => {
  const { token } = parseBody(req, PasswordTokenPreviewInput);
  res.json(await passwordTokens.previewToken(token));
});

/** Deprecated: the token sits in the URL (and so in access logs). Kept while older links and pages are around. */
router.get('/password-token/:token', authIpLimiter, tokenLimiter, async (req, res) => {
  const { token } = parseParams(req, PasswordTokenParams);
  res.json(await passwordTokens.previewToken(token));
});

router.post('/set-password', authIpLimiter, tokenLimiter, async (req, res) => {
  const input = parseBody(req, SetPasswordInput);
  await assertNotInMaintenance();
  sendSession(res, await passwordTokens.redeemToken(input.token, input.newPassword));
});

router.post('/forgot-password', authIpLimiter, tokenLimiter, (req, res) => {
  const input = parseBody(req, ForgotPasswordInput);
  // Answer before looking anything up so timing doesn't reveal whether the account exists.
  res.status(204).end();
  service.requestPasswordReset(input).catch((err: unknown) => {
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, 'Password reset request failed');
  });
});
