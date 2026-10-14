/**
 * Notification ownership and row mapping. Every query on `notifications` or `push_subscriptions` is scoped
 * with `notificationOwner()` / `subscriptionOwner()`, built only from the signed-in session (never from ids
 * in a request body or path), so one person can never read or change another person's rows.
 */
import { and, eq, type SQL } from 'drizzle-orm';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs, type NotificationDto } from '@classiq/shared';
import { db } from '../../db/client.js';
import { notifications, platformAdmins, pushSubscriptions, users } from '../../db/schema/index.js';

/** Who a notification belongs to: a school user (always with their school) or a platform admin. */
export type Owner = { type: 'user'; userId: string; institutionId: string } | { type: 'platform'; adminId: string };

export const notificationOwner = (owner: Owner): SQL =>
  owner.type === 'user'
    ? and(eq(notifications.userId, owner.userId), eq(notifications.institutionId, owner.institutionId))!
    : eq(notifications.platformAdminId, owner.adminId);

export const subscriptionOwner = (owner: Owner): SQL =>
  owner.type === 'user'
    ? and(eq(pushSubscriptions.userId, owner.userId), eq(pushSubscriptions.institutionId, owner.institutionId))!
    : eq(pushSubscriptions.platformAdminId, owner.adminId);

/** The owner columns of a new row (the other recipient's columns explicitly null). */
export const ownerColumns = (owner: Owner) =>
  owner.type === 'user'
    ? { userId: owner.userId, institutionId: owner.institutionId, platformAdminId: null }
    : { userId: null, institutionId: null, platformAdminId: owner.adminId };

/** Short, stable label for logs ("u:…"/"p:…" + id): no names, no endpoints. */
export const ownerKey = (owner: Owner): string => (owner.type === 'user' ? `u:${owner.userId}` : `p:${owner.adminId}`);

type NotificationRow = typeof notifications.$inferSelect;

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    tone: row.tone,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

/** Stored prefs with defaults for switches added later; anything unexpected falls back to the defaults. */
export function normalizePrefs(value: unknown): NotificationPrefs {
  const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...(value && typeof value === 'object' ? value : {}) };
  const parsed = NotificationPrefs.safeParse({ push: (merged as { push?: unknown }).push });
  return parsed.success ? parsed.data : { ...DEFAULT_NOTIFICATION_PREFS };
}

/** The owner's prefs, or null when the account does not exist (or the user is not in that school). */
export async function loadPrefs(owner: Owner): Promise<NotificationPrefs | null> {
  if (owner.type === 'user') {
    const [row] = await db
      .select({ prefs: users.notificationPrefs })
      .from(users)
      .where(and(eq(users.id, owner.userId), eq(users.institutionId, owner.institutionId)));
    return row ? normalizePrefs(row.prefs) : null;
  }
  const [row] = await db.select({ prefs: platformAdmins.notificationPrefs }).from(platformAdmins).where(eq(platformAdmins.id, owner.adminId));
  return row ? normalizePrefs(row.prefs) : null;
}

export async function savePrefs(owner: Owner, prefs: NotificationPrefs): Promise<boolean> {
  const rows =
    owner.type === 'user'
      ? await db
          .update(users)
          .set({ notificationPrefs: prefs })
          .where(and(eq(users.id, owner.userId), eq(users.institutionId, owner.institutionId)))
          .returning({ id: users.id })
      : await db
          .update(platformAdmins)
          .set({ notificationPrefs: prefs })
          .where(eq(platformAdmins.id, owner.adminId))
          .returning({ id: platformAdmins.id });
  return rows.length > 0;
}
