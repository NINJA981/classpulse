import { Router, type Request, type Response } from 'express';
import {
  ChangePasswordInput,
  DEFAULT_INSTITUTION_FEATURES,
  ForgotPasswordInput,
  PasswordTokenParams,
  SetPasswordInput,
  StaffLoginInput,
  StudentLoginInput,
  type MeResponse,
  type SessionResponse,
} from '@classpulse/shared';
import type { users } from '../../db/schema/index.js';
import { authenticate, currentUser } from '../../middleware/auth.js';
import { loginLimiter, tokenLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { audit } from '../../lib/audit.js';
import { assertNotInMaintenance, institutionState, platformNotice } from '../../lib/platformState.js';
import { clearSessionCookie, setSessionCookie, signSessionToken, toSessionUser } from '../../lib/session.js';
import * as passwordTokens from './passwordTokens.js';
import * as service from './service.js';

export const router = Router();

/** Issue a session cookie for the user and send the SessionResponse. */
function sendSession(res: Response, row: typeof users.$inferSelect): void {
  setSessionCookie(res, signSessionToken(row));
  const body: SessionResponse = { user: toSessionUser(row) };
  res.json(body);
}

/** Successful sign-in: recorded as `auth.login` (daily active users in the platform statistics). */
async function signedIn(req: Request, res: Response, row: typeof users.$inferSelect): Promise<void> {
  await audit(req, {
    action: 'auth.login',
    institutionId: row.institutionId,
    actor: { type: 'user', id: row.id, role: row.role, name: row.name },
  });
  sendSession(res, row);
}

/*
 * Each role signs in on its own page and endpoint. POST /login (any staff role) is kept for
 * older clients and scripts; the web app uses the role endpoints.
 */

router.post('/admin/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StaffLoginInput);
  await signedIn(req, res, await service.staffLogin(input, ['admin']));
});

router.post('/teacher/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StaffLoginInput);
  await signedIn(req, res, await service.staffLogin(input, ['teacher']));
});

router.post('/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StaffLoginInput);
  await signedIn(req, res, await service.staffLogin(input));
});

router.post('/student/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StudentLoginInput);
  await signedIn(req, res, await service.studentLogin(input));
});

const sessionAuth = authenticate({ allowDuringPasswordChange: true });

// No session needed: clearing the cookie must work even while maintenance or a suspension blocks requests.
router.post('/logout', (_req, res) => {
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
 * web client treats as "go to the login page").
 */

router.get('/password-token/:token', tokenLimiter, async (req, res) => {
  const { token } = parseParams(req, PasswordTokenParams);
  res.json(await passwordTokens.previewToken(token));
});

router.post('/set-password', tokenLimiter, async (req, res) => {
  const input = parseBody(req, SetPasswordInput);
  await assertNotInMaintenance();
  sendSession(res, await passwordTokens.redeemToken(input.token, input.newPassword));
});

router.post('/forgot-password', tokenLimiter, (req, res) => {
  const input = parseBody(req, ForgotPasswordInput);
  // Answer before looking anything up so timing doesn't reveal whether the account exists.
  res.status(204).end();
  service.requestPasswordReset(input).catch((err: unknown) => {
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, 'Password reset request failed');
  });
});
