/**
 * Test-only routes, mounted at /api/test only when E2E_MAIL_CAPTURE is on (refused in production).
 * Installing the router installs the mail capture.
 */
import { Router } from 'express';
import { z } from 'zod';
import { parseQuery } from '../../middleware/validate.js';
import { capturedEmails, installMailCapture } from './mailCapture.js';

const EmailsQuery = z.object({ to: z.string().trim().max(254).optional() });

export function mailCaptureRouter(): Router {
  installMailCapture();
  const router = Router();
  router.get('/emails', async (req, res) => {
    const { to } = parseQuery(req, EmailsQuery);
    res.json(await capturedEmails(to));
  });
  return router;
}
