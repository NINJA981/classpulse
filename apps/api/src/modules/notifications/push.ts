/**
 * Web Push delivery (VAPID, via the `web-push` library). One notification goes to every subscribed browser
 * of its recipient in parallel, each with a 5 s socket timeout:
 *  - 404/410 from the push service: the subscription is gone, delete it;
 *  - any other failure: failure_count + 1, deleted at MAX_PUSH_FAILURES;
 *  - success: failure_count back to 0, last_success_at = now.
 * Endpoints are capability URLs and the keys are secrets: logs carry only the first 12 hex characters of
 * the endpoint's sha256, a status code and an error code — never the endpoint, the keys, the VAPID keys or
 * the notification text.
 */
import webpush from 'web-push';
import { eq, sql } from 'drizzle-orm';
import { isAllowedPushEndpoint, type NotificationDto, type PushPayload } from '@classpulse/shared';
import { env, pushEnabled } from '../../config/env.js';
import { db } from '../../db/client.js';
import { pushSubscriptions } from '../../db/schema/index.js';
import { logger } from '../../lib/logger.js';
import { subscriptionOwner, type Owner } from './repo.js';

export const PUSH_TIMEOUT_MS = 5_000;
/** How long the push service keeps an undelivered message (the device is off): one day. */
export const PUSH_TTL_SEC = 24 * 3600;
/** Consecutive failed deliveries after which a subscription is dropped. */
export const MAX_PUSH_FAILURES = 5;
/** Web Push payloads are capped at ~4 KB after encryption; stay well below. */
const MAX_PAYLOAD_BYTES = 3_000;

/** The send function, behind an object so tests can replace it (vi.spyOn(pushTransport, 'send')). */
export const pushTransport = {
  send: (subscription: webpush.PushSubscription, payload: string, options: webpush.RequestOptions) =>
    webpush.sendNotification(subscription, payload, options),
};

export const shortHash = (endpointHash: string) => endpointHash.slice(0, 12);

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Minimal payload (id, title, short body, link, tone), trimmed until it fits MAX_PAYLOAD_BYTES. */
export function buildPushPayload(n: NotificationDto): string {
  const payload: PushPayload = { id: n.id, title: cut(n.title, 200), body: n.body ? cut(n.body, 300) : null, link: n.link, tone: n.tone };
  let json = JSON.stringify(payload);
  if (Buffer.byteLength(json) > MAX_PAYLOAD_BYTES) json = JSON.stringify({ ...payload, body: null });
  if (Buffer.byteLength(json) > MAX_PAYLOAD_BYTES) json = JSON.stringify({ ...payload, body: null, title: cut(payload.title, 80) });
  return json;
}

type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

async function deliverOne(sub: SubscriptionRow, payload: string): Promise<'sent' | 'removed' | 'failed'> {
  const short = shortHash(sub.endpointHash);
  if (!isAllowedPushEndpoint(sub.endpoint)) {
    // Stored before the allow-list changed: never POST to it.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    logger.warn({ sub: short }, 'Push subscription to an unsupported service removed');
    return 'removed';
  }
  try {
    await pushTransport.send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      TTL: PUSH_TTL_SEC,
      urgency: 'normal',
      timeout: PUSH_TIMEOUT_MS,
    });
  } catch (err) {
    const status = (err as { statusCode?: unknown }).statusCode;
    const code = (err as { code?: unknown }).code;
    if (status === 404 || status === 410) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      logger.info({ sub: short, status }, 'Push subscription expired and was removed');
      return 'removed';
    }
    const [row] = await db
      .update(pushSubscriptions)
      .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
      .where(eq(pushSubscriptions.id, sub.id))
      .returning({ failureCount: pushSubscriptions.failureCount });
    const dropped = row !== undefined && row.failureCount >= MAX_PUSH_FAILURES;
    if (dropped) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    logger.warn(
      { sub: short, status: typeof status === 'number' ? status : undefined, code: typeof code === 'string' ? code : undefined, dropped },
      'Web Push delivery failed',
    );
    return 'failed';
  }
  await db.update(pushSubscriptions).set({ failureCount: 0, lastSuccessAt: new Date() }).where(eq(pushSubscriptions.id, sub.id));
  return 'sent';
}

/** Push one notification to every subscription of `owner`. Resolves when all attempts settled; never throws. */
export async function pushToOwner(owner: Owner, notification: NotificationDto): Promise<void> {
  if (!pushEnabled()) return;
  try {
    const subs = await db.select().from(pushSubscriptions).where(subscriptionOwner(owner));
    if (!subs.length) return;
    const payload = buildPushPayload(notification);
    const results = await Promise.allSettled(subs.map((s) => deliverOne(s, payload)));
    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') logger.warn({ sub: shortHash(subs[i]!.endpointHash), err: (r.reason as Error)?.message }, 'Web Push bookkeeping failed');
    }
  } catch (err) {
    logger.warn({ err: (err as Error)?.message }, 'Web Push fan-out failed');
  }
}
