/**
 * Platform (super admin) tables. Platform admins are deliberately NOT rows in `users`: they belong to no
 * school, sign in on their own endpoints with mandatory 2FA, and can never reach school routes.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@classpulse/shared';
import { emailStatus, recordStatus } from './enums.js';
import { institutions, timestamps } from './org.js';

export const aiUsageKind = pgEnum('ai_usage_kind', ['stt', 'quiz', 'questions', 'remedial', 'grading', 'resource', 'voice']);

export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  tokenVersion: integer('token_version').notNull().default(0),
  status: recordStatus('status').notNull().default('active'),
  /** AES-256-GCM encrypted TOTP secret (lib/crypto); null until enrolled. */
  totpSecretEnc: text('totp_secret_enc'),
  totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
  /** Last accepted TOTP time step — blocks code replay. */
  totpLastStep: integer('totp_last_step'),
  /** bcrypt hashes of unused recovery codes. */
  recoveryCodeHashes: jsonb('recovery_code_hashes').$type<string[]>().notNull().default([]),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** Per-person notification channels (in-app is always on). */
  notificationPrefs: jsonb('notification_prefs').$type<NotificationPrefs>().notNull().default(DEFAULT_NOTIFICATION_PREFS),
  ...timestamps,
});

/** Key → JSON value (maintenance, banner, default models, AI price rates…). */
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
});

/** Who did what. actor_type distinguishes school users from platform admins (no FK: either table). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actorType: varchar('actor_type', { length: 16 }).notNull(), // 'platform' | 'user' | 'system' | 'anonymous'
    actorId: uuid('actor_id'),
    actorRole: varchar('actor_role', { length: 20 }),
    actorName: varchar('actor_name', { length: 120 }),
    institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(),
    targetType: varchar('target_type', { length: 40 }),
    targetId: varchar('target_id', { length: 80 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
  },
  (t) => [
    index('audit_logs_at_idx').on(t.at),
    index('audit_logs_institution_at_idx').on(t.institutionId, t.at),
    index('audit_logs_actor_at_idx').on(t.actorId, t.at),
    index('audit_logs_action_at_idx').on(t.action, t.at),
  ],
);

/** Application log lines kept for the platform console (14 days). */
export const appLogs = pgTable(
  'app_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull(),
    level: smallint('level').notNull(), // pino numeric level (30 info, 40 warn, 50 error, 60 fatal)
    service: varchar('service', { length: 20 }).notNull(),
    msg: text('msg').notNull(),
    reqId: varchar('req_id', { length: 100 }),
    institutionId: uuid('institution_id'),
    userId: uuid('user_id'),
    context: jsonb('context').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('app_logs_at_idx').on(t.at),
    index('app_logs_level_at_idx').on(t.level, t.at),
    index('app_logs_institution_at_idx').on(t.institutionId, t.at).where(sql`${t.institutionId} is not null`),
  ],
);

/** One row per AI provider call, for usage and cost statistics. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'set null' }),
    lessonId: uuid('lesson_id'),
    kind: aiUsageKind('kind').notNull(),
    provider: varchar('provider', { length: 20 }).notNull(),
    model: varchar('model', { length: 80 }).notNull(),
    audioSeconds: doublePrecision('audio_seconds'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    ok: boolean('ok').notNull(),
    errorCode: varchar('error_code', { length: 60 }),
  },
  (t) => [index('ai_usage_at_idx').on(t.at), index('ai_usage_institution_at_idx').on(t.institutionId, t.at)],
);

/** Every email the queue tried to deliver (recipient stored only as a sha256). */
export const emailLog = pgTable(
  'email_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    kind: varchar('kind', { length: 40 }).notNull(),
    institutionId: uuid('institution_id'),
    toHash: varchar('to_hash', { length: 64 }).notNull(),
    status: emailStatus('status').notNull(),
    error: varchar('error', { length: 300 }),
  },
  (t) => [index('email_log_at_idx').on(t.at)],
);

/** Health check snapshots every 5 minutes (30 days) for uptime/latency charts. */
export const healthSnapshots = pgTable(
  'health_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 10 }).notNull(), // ok | degraded | down
    checks: jsonb('checks').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index('health_snapshots_at_idx').on(t.at)],
);
