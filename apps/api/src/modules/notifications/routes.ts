/**
 * Notifications, for every signed-in person:
 *  - school users (any role) at /api/notifications, behind authenticate();
 *  - super admins at /api/platform/notifications, behind authenticatePlatform() (school sessions get 401).
 * The same handlers serve both; the owner always comes from the session (no ids in bodies, no IDOR).
 *
 *   GET    /                       NotificationListQuery → NotificationListResponse (newest first, `before` cursor)
 *   POST   /read-all               → MarkAllReadResponse
 *   POST   /:id/read               → NotificationDto (404 for someone else's id)
 *   GET    /prefs                  → NotificationPrefs
 *   PUT    /prefs                  NotificationPrefs → NotificationPrefs
 *   GET    /push-key               → PushKeyResponse (publicKey null when push is not configured)
 *   POST   /push-subscriptions     PushSubscriptionInput → 204
 *   DELETE /push-subscriptions     PushUnsubscribeInput → 204
 * Subscribe/unsubscribe/prefs changes are limited per account (notificationSettingsLimiter), marking read
 * too (notificationReadLimiter); the list is unlimited but paged (limit ≤ 50). No audit rows (by design).
 */
import { Router, type Request } from 'express';
import { IdParams, NotificationListQuery, NotificationPrefs, PushSubscriptionInput, PushUnsubscribeInput } from '@classpulse/shared';
import { authenticate, currentUser } from '../../middleware/auth.js';
import { authenticatePlatform, currentPlatformAdmin } from '../../middleware/platformAuth.js';
import { notificationReadLimiter, notificationSettingsLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import type { Owner } from './repo.js';
import * as service from './service.js';

function notificationRoutes(ownerOf: (req: Request) => Owner): Router {
  const r = Router();

  r.get('/', async (req, res) => {
    res.json(await service.listNotifications(ownerOf(req), parseQuery(req, NotificationListQuery)));
  });

  r.post('/read-all', notificationReadLimiter, async (req, res) => {
    res.json(await service.markAllRead(ownerOf(req)));
  });

  r.post('/:id/read', notificationReadLimiter, async (req, res) => {
    const { id } = parseParams(req, IdParams);
    res.json(await service.markRead(ownerOf(req), id));
  });

  r.get('/prefs', async (req, res) => {
    res.json(await service.getPrefs(ownerOf(req)));
  });

  r.put('/prefs', notificationSettingsLimiter, async (req, res) => {
    res.json(await service.updatePrefs(ownerOf(req), parseBody(req, NotificationPrefs)));
  });

  r.get('/push-key', (_req, res) => {
    res.json(service.pushKey());
  });

  r.post('/push-subscriptions', notificationSettingsLimiter, async (req, res) => {
    await service.subscribe(ownerOf(req), parseBody(req, PushSubscriptionInput), req.get('user-agent'));
    res.status(204).end();
  });

  r.delete('/push-subscriptions', notificationSettingsLimiter, async (req, res) => {
    await service.unsubscribe(ownerOf(req), parseBody(req, PushUnsubscribeInput));
    res.status(204).end();
  });

  return r;
}

/** /api/notifications — school users, any role. */
export const notificationsRouter = Router().use(
  authenticate(),
  notificationRoutes((req) => {
    const user = currentUser(req);
    return { type: 'user', userId: user.id, institutionId: user.institutionId };
  }),
);

/** /api/platform/notifications — super admins only (authenticates the platform session itself). */
export const platformNotificationsRouter = Router().use(
  authenticatePlatform(),
  notificationRoutes((req) => ({ type: 'platform', adminId: currentPlatformAdmin(req).id })),
);
