/**
 * Public routes (no session), served on the school host only: the platform console host answers 404 for
 * everything under /api except /api/platform/* and /api/status (infra/Caddyfile). They are not exempt from
 * the same-origin guard: the product page posts JSON to its own origin.
 */
import { Router } from 'express';
import { DemoRequestInput } from '@classiq/shared';
import { demoRequestLimiters } from '../../middleware/rateLimit.js';
import { parseBody } from '../../middleware/validate.js';
import { isHoneypotFilled, sendDemoRequest } from './demoRequests.js';

export const router = Router();

/**
 * "Book a demo" (/about). 204 for a sent request, a duplicate and a tripped honeypot alike, so the answer
 * says nothing about what happened to it. 503 EMAIL_UNAVAILABLE when email isn't configured.
 */
router.post('/demo-requests', ...demoRequestLimiters(), async (req, res) => {
  if (isHoneypotFilled(req.body)) {
    res.status(204).end();
    return;
  }
  const input = parseBody(req, DemoRequestInput);
  const sent = await sendDemoRequest(input);
  if (sent) {
    res.locals.demoEmailQueued = true; // counted by the daily cap
    req.log.info({ kind: 'demo-request' }, 'Demo request emailed');
  }
  res.status(204).end();
});
