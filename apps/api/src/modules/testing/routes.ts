/**
 * Test-only routes, mounted at /api/test only when E2E_MAIL_CAPTURE is on (refused in production).
 * Installing the mail-capture router installs the mail capture.
 */
import { Router } from 'express';
import { z } from 'zod';
import { NOTIFICATION_TONES, NotificationKind } from '@classpulse/shared';
import { isProd } from '../../config/env.js';
import { notFound } from '../../lib/errors.js';
import { authenticate, currentUser } from '../../middleware/auth.js';
import { parseBody, parseQuery } from '../../middleware/validate.js';
import { notify } from '../notifications/notify.js';
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

/** POST /api/test/notifications: a notification for the signed-in school user, as a finished job would send. */
export const TestNotificationInput = z
  .object({
    kind: NotificationKind,
    tone: z.enum(NOTIFICATION_TONES),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(500).nullable().optional(),
    link: z.string().max(300).nullable().optional(),
  })
  .strict();

export function notificationTestRouter(): Router {
  const router = Router();
  router.post('/notifications', authenticate(), async (req, res) => {
    // Never in production, even if mounted by mistake (production also refuses E2E_MAIL_CAPTURE at start-up).
    if (isProd) throw notFound();
    const user = currentUser(req);
    const input = parseBody(req, TestNotificationInput);
    await notify({ recipient: { userId: user.id, institutionId: user.institutionId }, ...input });
    res.status(204).end();
  });
  return router;
}
