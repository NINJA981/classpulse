/**
 * Notification retention (daily): read notifications go after NOTIFICATION_RETENTION_DAYS.read days and
 * every notification after NOTIFICATION_RETENTION_DAYS.all days. Push subscriptions that keep failing
 * (MAX_PUSH_FAILURES) or have not delivered anything for PUSH_SUBSCRIPTION_STALE_DAYS are removed too.
 */
import { and, gte, isNotNull, lt, or, sql } from 'drizzle-orm';
import { NOTIFICATION_RETENTION_DAYS } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { notifications, pushSubscriptions } from '../../db/schema/index.js';
import { logger } from '../../lib/logger.js';
import type { PeriodicTask } from '../../jobs/periodic.js';
import { MAX_PUSH_FAILURES } from './push.js';

export const PUSH_SUBSCRIPTION_STALE_DAYS = 120;
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86400_000);

export async function purgeOldNotifications(now = new Date()): Promise<number> {
  const rows = await db
    .delete(notifications)
    .where(
      or(
        and(isNotNull(notifications.readAt), lt(notifications.createdAt, daysAgo(now, NOTIFICATION_RETENTION_DAYS.read))),
        lt(notifications.createdAt, daysAgo(now, NOTIFICATION_RETENTION_DAYS.all)),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}

export async function purgeStalePushSubscriptions(now = new Date()): Promise<number> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(
      or(
        gte(pushSubscriptions.failureCount, MAX_PUSH_FAILURES),
        lt(sql`coalesce(${pushSubscriptions.lastSuccessAt}, ${pushSubscriptions.createdAt})`, daysAgo(now, PUSH_SUBSCRIPTION_STALE_DAYS)),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}

export const notificationRetentionTask: PeriodicTask = {
  name: 'notification-retention',
  intervalMs: 24 * 3600_000,
  run: async () => {
    const notificationsDeleted = await purgeOldNotifications();
    const subscriptionsDeleted = await purgeStalePushSubscriptions();
    if (notificationsDeleted || subscriptionsDeleted) {
      logger.info({ notificationsDeleted, subscriptionsDeleted }, 'Old notifications and stale push subscriptions deleted');
    }
  },
};
