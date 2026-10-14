import { Router } from 'express';
import {
  PlatformChangePasswordInput,
  PlatformEnrollInput,
  PlatformLoginInput,
  PlatformVerifyInput,
  RegenerateRecoveryCodesInput,
  type PlatformEnrollResponse,
  type PlatformLoginResponse,
  type PlatformSessionResponse,
  type RecoveryCodesResponse,
} from '@classiq/shared';
import { authenticatePlatform, currentPlatformAdmin } from '../../middleware/platformAuth.js';
import { authIpLimiter, platformCodeLimiter, platformLoginLimiter } from '../../middleware/rateLimit.js';
import { parseBody } from '../../middleware/validate.js';
import {
  clearPlatformCookie,
  platformTokenFrom,
  resolvePlatformSession,
  setPlatformCookie,
  signPlatformToken,
} from '../../lib/platformSession.js';
import * as service from './authService.js';

/** /api/platform/auth — public sign-in steps plus the signed-in admin's own account. */
export const platformAuthRouter = Router();

platformAuthRouter.post('/login', authIpLimiter, platformLoginLimiter, async (req, res) => {
  const input = parseBody(req, PlatformLoginInput);
  const body: PlatformLoginResponse = await service.passwordStep(req, input);
  res.json(body);
});

platformAuthRouter.post('/enroll', authIpLimiter, platformCodeLimiter, async (req, res) => {
  const input = parseBody(req, PlatformEnrollInput);
  const { row, recoveryCodes } = await service.enroll(req, input);
  setPlatformCookie(res, signPlatformToken(row));
  const body: PlatformEnrollResponse = { admin: service.toPlatformAdmin(row), recoveryCodes };
  res.json(body);
});

platformAuthRouter.post('/verify', authIpLimiter, platformCodeLimiter, async (req, res) => {
  const input = parseBody(req, PlatformVerifyInput);
  const row = await service.verify(req, input);
  setPlatformCookie(res, signPlatformToken(row));
  const body: PlatformSessionResponse = { admin: service.toPlatformAdmin(row) };
  res.json(body);
});

platformAuthRouter.post('/logout', async (req, res) => {
  await service.signOut(req, await resolvePlatformSession(platformTokenFrom(req)));
  clearPlatformCookie(res);
  res.status(204).end();
});

const accountAuth = authenticatePlatform({ allowDuringPasswordChange: true });

platformAuthRouter.get('/me', accountAuth, (req, res) => {
  const body: PlatformSessionResponse = { admin: service.toPlatformAdmin(currentPlatformAdmin(req)) };
  res.json(body);
});

platformAuthRouter.post('/change-password', accountAuth, async (req, res) => {
  const input = parseBody(req, PlatformChangePasswordInput);
  const row = await service.changePassword(req, currentPlatformAdmin(req), input);
  setPlatformCookie(res, signPlatformToken(row));
  const body: PlatformSessionResponse = { admin: service.toPlatformAdmin(row) };
  res.json(body);
});

platformAuthRouter.post('/recovery-codes/regenerate', authenticatePlatform(), platformCodeLimiter, async (req, res) => {
  const { code } = parseBody(req, RegenerateRecoveryCodesInput);
  const body: RecoveryCodesResponse = { recoveryCodes: await service.regenerateRecoveryCodes(req, currentPlatformAdmin(req), code) };
  res.json(body);
});
