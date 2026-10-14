import { Router } from 'express';
import type { PlatformStatus } from '@classiq/shared';
import { platformNotice } from '../../lib/platformState.js';

/** Public platform status for the login pages: banner and maintenance message. Never blocked by maintenance. */
export const statusRouter = Router();

statusRouter.get('/', async (_req, res) => {
  const body: PlatformStatus = { ok: true, ...(await platformNotice()) };
  res.set('Cache-Control', 'no-store').json(body);
});
