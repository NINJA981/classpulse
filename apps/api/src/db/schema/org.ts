import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  DEFAULT_INSTITUTION_FEATURES,
  DEFAULT_INSTITUTION_LIMITS,
  DEFAULT_NOTIFICATION_PREFS,
  type InstitutionContact,
  type InstitutionFeatures,
  type InstitutionLimits,
  type NotificationPrefs,
} from '@classpulse/shared';
import { dayOfWeek, emailStatus, institutionStatus, passwordTokenPurpose, recordStatus, userRole } from './enums.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
export { timestamps };

export const institutions = pgTable('institutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kolkata'),
  academicYear: varchar('academic_year', { length: 20 }),
  /** Platform controls (super admin). */
  status: institutionStatus('status').notNull().default('active'),
  suspendedReason: varchar('suspended_reason', { length: 300 }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  features: jsonb('features').$type<InstitutionFeatures>().notNull().default(DEFAULT_INSTITUTION_FEATURES),
  limits: jsonb('limits').$type<InstitutionLimits>().notNull().default(DEFAULT_INSTITUTION_LIMITS),
  contact: jsonb('contact').$type<InstitutionContact>(),
  notes: text('notes'),
  ...timestamps,
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'restrict' }),
    role: userRole('role').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    /** Required for staff; optional for students. Stored lower-cased. */
    email: varchar('email', { length: 254 }),
    /** Students only. Unique per institution. */
    rollNumber: varchar('roll_number', { length: 40 }),
    department: varchar('department', { length: 120 }),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    /** Incremented on password change / disable to revoke outstanding sessions. */
    tokenVersion: integer('token_version').notNull().default(0),
    status: recordStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Per-person notification channels (in-app is always on). */
    notificationPrefs: jsonb('notification_prefs').$type<NotificationPrefs>().notNull().default(DEFAULT_NOTIFICATION_PREFS),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email).where(sql`${t.email} is not null`),
    uniqueIndex('users_institution_roll_unique')
      .on(t.institutionId, t.rollNumber)
      .where(sql`${t.rollNumber} is not null`),
    index('users_institution_role_idx').on(t.institutionId, t.role),
  ],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    building: varchar('building', { length: 80 }),
    capacity: integer('capacity'),
    ...timestamps,
  },
  (t) => [uniqueIndex('rooms_institution_name_unique').on(t.institutionId, t.name)],
);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    grade: varchar('grade', { length: 20 }),
    subject: varchar('subject', { length: 120 }),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    joinCode: varchar('join_code', { length: 6 }).notNull().unique(),
    joinCodeExpiresAt: timestamp('join_code_expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('sections_institution_name_unique').on(t.institutionId, t.name),
    index('sections_room_idx').on(t.roomId),
  ],
);

export const sectionTeachers = pgTable(
  'section_teachers',
  {
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.teacherId] }), index('section_teachers_teacher_idx').on(t.teacherId)],
);

export const enrollments = pgTable(
  'enrollments',
  {
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.studentId] }), index('enrollments_student_idx').on(t.studentId)],
);

export const timetableSlots = pgTable(
  'timetable_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    day: dayOfWeek('day').notNull(),
    period: integer('period').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    subject: varchar('subject', { length: 120 }).notNull(),
    teacherId: uuid('teacher_id').references(() => users.id, { onDelete: 'set null' }),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('timetable_section_day_period_unique').on(t.sectionId, t.day, t.period),
    index('timetable_teacher_idx').on(t.teacherId),
    index('timetable_room_idx').on(t.roomId),
  ],
);

/** Emailed set-password links (account invitations and password resets). Only the sha256 is stored. */
export const passwordTokens = pgTable(
  'password_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: passwordTokenPurpose('purpose').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    /** Set when a newer link for the same user replaced this one. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    emailStatus: emailStatus('email_status'),
    emailError: varchar('email_error', { length: 300 }),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('password_tokens_user_idx').on(t.userId, t.createdAt)],
);
