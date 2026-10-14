/**
 * Teacher tools: an open curriculum (courses → units, for any level: school class, college course, …),
 * teacher materials used to ground AI output, generated teaching resources (lesson plans, worksheets,
 * question papers, presentations) that can be shared with the school, and simulation links.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { ResourceContent, ResourceOptions } from '@classiq/shared';
import { institutions, sections, timestamps, users } from './org.js';

export const resourceType = pgEnum('resource_type', ['lesson_plan', 'worksheet', 'question_paper', 'presentation']);
export const resourceStatus = pgEnum('resource_status', ['queued', 'generating', 'ready', 'failed']);
export const materialKind = pgEnum('material_kind', ['pdf', 'text', 'docx']);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    /** e.g. "Class 10 Science", "B.Tech Data Structures". */
    title: varchar('title', { length: 200 }).notNull(),
    /** Free text: "Grade 10", "Semester 3", "Diploma year 1"… */
    level: varchar('level', { length: 80 }),
    /** Free text: "CBSE", "Anna University", "Self-defined"… */
    board: varchar('board', { length: 80 }),
    subject: varchar('subject', { length: 120 }),
    description: text('description'),
    /** Optional link to a class section that follows this course. */
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
    /** Catalog entry this course was imported from (e.g. "ncert-10-science"). */
    catalogKey: varchar('catalog_key', { length: 80 }),
    ...timestamps,
  },
  (t) => [index('courses_institution_idx').on(t.institutionId)],
);

export const units = pgTable(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    /** Chapter / topic / module title. */
    title: varchar('title', { length: 300 }).notNull(),
    /** What the unit covers — written by the teacher or drafted by AI; used to ground generation. */
    summary: text('summary'),
    objectives: jsonb('objectives').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index('units_course_idx').on(t.courseId, t.position)],
);

/** Notes / textbook chapters uploaded by a teacher; extracted text grounds AI output. */
export const teacherMaterials = pgTable(
  'teacher_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    kind: materialKind('kind').notNull(),
    objectKey: text('object_key'),
    originalName: varchar('original_name', { length: 255 }),
    sizeBytes: integer('size_bytes'),
    /** Extracted plain text (capped). */
    textContent: text('text_content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('teacher_materials_teacher_idx').on(t.teacherId)],
);

export const teachingResources = pgTable(
  'teaching_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: resourceType('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    status: resourceStatus('status').notNull().default('queued'),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    unitIds: jsonb('unit_ids').$type<string[]>().notNull().default([]),
    lessonIds: jsonb('lesson_ids').$type<string[]>().notNull().default([]),
    materialIds: jsonb('material_ids').$type<string[]>().notNull().default([]),
    /** The teacher's request in their own words (typed or spoken). */
    prompt: text('prompt').notNull().default(''),
    language: varchar('language', { length: 10 }).notNull().default('en-IN'),
    options: jsonb('options').$type<ResourceOptions>().notNull(),
    content: jsonb('content').$type<ResourceContent>(),
    failureReason: varchar('failure_reason', { length: 500 }),
    generationAttempt: integer('generation_attempt').notNull().default(0),
    aiMeta: jsonb('ai_meta').$type<Record<string, unknown>>(),
    /** Visible to every teacher in the school's library. */
    shared: boolean('shared').notNull().default(false),
    sharedAt: timestamp('shared_at', { withTimezone: true }),
    copiedFromId: uuid('copied_from_id'),
    ...timestamps,
  },
  (t) => [
    index('teaching_resources_teacher_idx').on(t.teacherId, t.type),
    index('teaching_resources_shared_idx').on(t.institutionId, t.type).where(sql`${t.shared}`),
  ],
);

/** School-added simulation / interactive links (in addition to the built-in catalog). */
export const simulationLinks = pgTable(
  'simulation_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    url: text('url').notNull(),
    subject: varchar('subject', { length: 120 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('simulation_links_institution_idx').on(t.institutionId)],
);
