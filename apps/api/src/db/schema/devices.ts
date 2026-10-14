import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { DeviceSystemStats } from '@classiq/shared';
import { deviceCommandStatus, deviceCommandType, deviceStatus, recordingStatus } from './enums.js';
import { lessons } from './content.js';
import { institutions, rooms, timestamps, users } from './org.js';

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    /** Human/agent identifier, e.g. "rpi5-room-101". */
    deviceId: varchar('device_id', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 80 }).notNull(),
    /** sha256(deviceKey) hex — the raw key is only ever shown to the device once. */
    apiKeyHash: varchar('api_key_hash', { length: 64 }).notNull(),
    status: deviceStatus('status').notNull().default('offline'),
    agentVersion: varchar('agent_version', { length: 40 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 64 }),
    stats: jsonb('stats').$type<DeviceSystemStats>(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('devices_room_idx').on(t.roomId), index('devices_institution_idx').on(t.institutionId)],
);

export const deviceEnrollmentTokens = pgTable(
  'device_enrollment_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByDeviceId: uuid('used_by_device_id').references(() => devices.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const recordingSessions = pgTable(
  'recording_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'restrict' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .unique()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: recordingStatus('status').notNull().default('pending'),
    expectedChunks: integer('expected_chunks'),
    durationSec: integer('duration_sec'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    failureReason: varchar('failure_reason', { length: 500 }),
    ...timestamps,
  },
  (t) => [
    index('recording_sessions_device_idx').on(t.deviceId),
    uniqueIndex('recording_sessions_one_active_per_device')
      .on(t.deviceId)
      .where(sql`${t.status} in ('pending', 'recording', 'stopping')`),
  ],
);

export const recordingChunks = pgTable(
  'recording_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => recordingSessions.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    bytes: integer('bytes').notNull(),
    objectKey: text('object_key').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recording_chunks_session_idx_unique').on(t.sessionId, t.idx)],
);

export const deviceCommands = pgTable(
  'device_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    type: deviceCommandType('type').notNull(),
    payload: jsonb('payload').$type<Record<string, string>>().notNull(),
    status: deviceCommandStatus('status').notNull().default('pending'),
    error: varchar('error', { length: 500 }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('device_commands_device_status_idx').on(t.deviceId, t.status, t.createdAt)],
);
