import { Router, type Response } from 'express';
import { ChangePasswordInput, StaffLoginInput, StudentLoginInput, type SessionResponse } from '@classpulse/shared';
import type { users } from '../../db/schema/index.js';
import { authenticate, currentUser } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { parseBody } from '../../middleware/validate.js';
import { clearSessionCookie, setSessionCookie, signSessionToken, toSessionUser } from '../../lib/session.js';
import * as service from './service.js';

export const router = Router();

/** Issue a session cookie for the user and send the SessionResponse. */
function sendSession(res: Response, row: typeof users.$inferSelect): void {
  setSessionCookie(res, signSessionToken(row));
  const body: SessionResponse = { user: toSessionUser(row) };
  res.json(body);
}

router.post('/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StaffLoginInput);
  sendSession(res, await service.staffLogin(input));
});

router.post('/student/login', loginLimiter, async (req, res) => {
  const input = parseBody(req, StudentLoginInput);
  sendSession(res, await service.studentLogin(input));
});

const sessionAuth = authenticate({ allowDuringPasswordChange: true });

router.post('/logout', sessionAuth, (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', sessionAuth, (req, res) => {
  const body: SessionResponse = { user: currentUser(req) };
  res.json(body);
});

router.post('/change-password', sessionAuth, async (req, res) => {
  const input = parseBody(req, ChangePasswordInput);
  sendSession(res, await service.changePassword(currentUser(req).id, input));
});
