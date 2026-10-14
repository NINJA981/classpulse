/**
 * In-app notifications ("your background job finished") and the Web Push subscriptions they are also sent
 * to. A row belongs to exactly one recipient: a school user (with their school) or a platform admin.
 * Rows cascade away with their user, platform admin or school. Per-person channel switches live in
 * `users.notification_prefs` / `platform_admins.notification_prefs`.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { NOTIFICATION_KINDS, NOTIFICATION_TONES } from '@classiq/shared';
import { institutions, users } from './org.js';
import { platformAdmins } from './platform.js';

export const notificationKind = pgEnum('notification_kind', NOTIFICATION_KINDS);
export const notificationTone = pgEnum('notification_tone', NOTIFICATION_TONES);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Set for school users (null for platform admins). */
    institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    platformAdminId: uuid('platform_admin_id').references(() => platformAdmins.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    tone: notificationTone('tone').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: varchar('body', { length: 500 }),
    /** Same-origin path ("/teacher/lessons/<id>"); validated by notify(). */
    link: varchar('link', { length: 300 }),
    entityType: varchar('entity_type', { length: 20 }),
    entityId: uuid('entity_id'),
    entityAttempt: integer('entity_attempt'),
    /** recipient + kind + entity + attempt: retries and recovery never notify twice. */
    dedupeKey: varchar('dedupe_key', { length: 200 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    /** Millisecond precision so the `before` cursor (an ISO string) matches stored values exactly. */
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'notifications_one_recipient',
      sql`(${t.userId} is not null and ${t.platformAdminId} is null and ${t.institutionId} is not null) or (${t.userId} is null and ${t.platformAdminId} is not null)`,
    ),
    uniqueIndex('notifications_dedupe_unique').on(t.dedupeKey),
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()).where(sql`${t.userId} is not null`),
    index('notifications_admin_created_idx').on(t.platformAdminId, t.createdAt.desc()).where(sql`${t.platformAdminId} is not null`),
    index('notifications_user_unread_idx').on(t.userId).where(sql`${t.readAt} is null and ${t.userId} is not null`),
    index('notifications_admin_unread_idx').on(t.platformAdminId).where(sql`${t.readAt} is null and ${t.platformAdminId} is not null`),
    index('notifications_institution_idx').on(t.institutionId),
    index('notifications_created_idx').on(t.createdAt),
  ],
);

/** A browser/device that accepts Web Push for one recipient. The endpoint is a capability URL: never log it. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    platformAdminId: uuid('platform_admin_id').references(() => platformAdmins.id, { onDelete: 'cascade' }),
    endpoint: varchar('endpoint', { length: 500 }).notNull(),
    /** sha256 hex of the endpoint: the unique key, and the only form that appears in logs (first 12 chars). */
    endpointHash: varchar('endpoint_hash', { length: 64 }).notNull(),
    p256dh: varchar('p256dh', { length: 128 }).notNull(),
    auth: varchar('auth', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 200 }),
    /** Bumped on every (re-)subscribe: the per-account cap drops the oldest. */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    failureCount: integer('failure_count').notNull().default(0),
  },
  (t) => [
    check(
      'push_subscriptions_one_recipient',
      sql`(${t.userId} is not null and ${t.platformAdminId} is null and ${t.institutionId} is not null) or (${t.userId} is null and ${t.platformAdminId} is not null)`,
    ),
    uniqueIndex('push_subscriptions_endpoint_hash_unique').on(t.endpointHash),
    index('push_subscriptions_user_idx').on(t.userId).where(sql`${t.userId} is not null`),
    index('push_subscriptions_admin_idx').on(t.platformAdminId).where(sql`${t.platformAdminId} is not null`),
    index('push_subscriptions_institution_idx').on(t.institutionId),
  ],
);
