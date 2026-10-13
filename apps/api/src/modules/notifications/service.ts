/**
 * Reading and managing one's own notifications, channel prefs and push subscriptions. Shared by the school
 * routes (/api/notifications) and the platform console (/api/platform/notifications): the `Owner` always
 * comes from the session, and every query is scoped to it.
 */
import { and, desc, eq, isNull, lt, notInArray } from 'drizzle-orm';
import {
  MAX_PUSH_SUBSCRIPTIONS,
  type MarkAllReadResponse,
  type NotificationDto,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPrefs,
  type PushKeyResponse,
  type PushSubscriptionInput,
  type PushUnsubscribeInput,
} from '@classpulse/shared';
import { env, pushEnabled } from '../../config/env.js';
import { db } from '../../db/client.js';
import { notifications, pushSubscriptions } from '../../db/schema/index.js';
import { sha256Hex } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { shortHash } from './push.js';
import { loadPrefs, notificationOwner, ownerColumns, savePrefs, subscriptionOwner, toNotificationDto, type Owner } from './repo.js';

export async function listNotifications(owner: Owner, q: NotificationListQuery): Promise<NotificationListResponse> {
  const where = and(
    notificationOwner(owner),
    q.unreadOnly ? isNull(notifications.readAt) : undefined,
    q.before ? lt(notifications.createdAt, new Date(q.before)) : undefined,
  );
  const [rows, unreadCount] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(q.limit + 1),
    db.$count(notifications, and(notificationOwner(owner), isNull(notifications.readAt))),
  ]);
  const more = rows.length > q.limit;
  const items = rows.slice(0, q.limit).map(toNotificationDto);
  return { items, unreadCount, nextBefore: more ? items[items.length - 1]!.createdAt : null };
}

/** Idempotent: an already-read notification keeps its first read time. Someone else's id is a 404. */
export async function markRead(owner: Owner, id: string): Promise<NotificationDto> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), notificationOwner(owner), isNull(notifications.readAt)))
    .returning();
  if (updated) return toNotificationDto(updated);
  const [row] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), notificationOwner(owner)));
  if (!row) throw notFound('Notification');
  return toNotificationDto(row);
}

export async function markAllRead(owner: Owner): Promise<MarkAllReadResponse> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(notificationOwner(owner), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { updated: rows.length };
}

export async function getPrefs(owner: Owner): Promise<NotificationPrefs> {
  const prefs = await loadPrefs(owner);
  if (!prefs) throw notFound('Account');
  return prefs;
}

export async function updatePrefs(owner: Owner, prefs: NotificationPrefs): Promise<NotificationPrefs> {
  if (!(await savePrefs(owner, prefs))) throw notFound('Account');
  return prefs;
}

export function pushKey(): PushKeyResponse {
  return { publicKey: pushEnabled() ? env.VAPID_PUBLIC_KEY : null };
}

/**
 * Save this browser's push subscription for the owner. An endpoint is unique: if another account had it
 * (someone else signed in on this browser before), it moves to the caller. Each account keeps its
 * MAX_PUSH_SUBSCRIPTIONS most recent subscriptions; older ones are dropped.
 */
export async function subscribe(owner: Owner, input: PushSubscriptionInput, userAgent: string | undefined): Promise<void> {
  const endpointHash = sha256Hex(input.endpoint);
  const columns = {
    ...ownerColumns(owner),
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: userAgent ? userAgent.slice(0, 200) : null,
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(pushSubscriptions)
      .values({ ...columns, endpointHash })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpointHash,
        set: { ...columns, createdAt: new Date(), lastSuccessAt: null, failureCount: 0 },
      });
    const keep = tx
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(subscriptionOwner(owner))
      .orderBy(desc(pushSubscriptions.createdAt), desc(pushSubscriptions.id))
      .limit(MAX_PUSH_SUBSCRIPTIONS);
    const dropped = await tx
      .delete(pushSubscriptions)
      .where(and(subscriptionOwner(owner), notInArray(pushSubscriptions.id, keep)))
      .returning({ hash: pushSubscriptions.endpointHash });
    if (dropped.length) logger.info({ subs: dropped.map((d) => shortHash(d.hash)) }, 'Oldest push subscriptions dropped (per-account cap)');
  });
}

/** Remove one of the owner's subscriptions. Unknown endpoints (or someone else's) are a no-op. */
export async function unsubscribe(owner: Owner, input: PushUnsubscribeInput): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(subscriptionOwner(owner), eq(pushSubscriptions.endpointHash, sha256Hex(input.endpoint))));
}
