/**
 * Open curriculum: courses (any level — school class, college course, diploma…) and their ordered units.
 * Every teacher of a school sees all of the school's courses; only the teacher who created a course edits it
 * and its units (others get 403; other schools' courses are 404).
 */
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type {
  CatalogEntry,
  Course,
  CourseDetail,
  CourseInput,
  ReorderUnitsInput,
  SessionUser,
  Unit,
  UnitInput,
} from '@classiq/shared';
import { z } from 'zod';
import { db, type DbOrTx } from '../../db/client.js';
import { courses, sections, units, users } from '../../db/schema/index.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { CATALOG, catalogEntry } from './catalog.js';

type CourseRow = typeof courses.$inferSelect;
type UnitRow = typeof units.$inferSelect;

export const ListCoursesQuery = z.object({
  q: z.string().trim().max(120).optional(),
  mine: z.enum(['true', 'false']).optional(),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuery>;

export const CatalogQuery = z.object({
  level: z.string().trim().max(80).optional(),
  board: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(120).optional(),
});
export type CatalogQuery = z.infer<typeof CatalogQuery>;

/* ------------------------------------------ mapping ------------------------------------------ */

export const toUnit = (u: UnitRow): Unit => ({
  id: u.id,
  courseId: u.courseId,
  position: u.position,
  title: u.title,
  summary: u.summary,
  objectives: u.objectives,
});

const unitCount = sql<number>`(select count(*)::int from ${units} u where u.course_id = ${courses.id})`;

const selectCourses = (dbx: DbOrTx = db) =>
  dbx
    .select({ c: courses, sectionName: sections.name, creatorName: users.name, unitCount })
    .from(courses)
    .leftJoin(sections, eq(sections.id, courses.sectionId))
    .leftJoin(users, eq(users.id, courses.createdBy));

type CourseJoined = { c: CourseRow; sectionName: string | null; creatorName: string | null; unitCount: number };

function toCourse({ c, sectionName, creatorName, unitCount: n }: CourseJoined): Course {
  return {
    id: c.id,
    title: c.title,
    level: c.level,
    board: c.board,
    subject: c.subject,
    description: c.description,
    section: c.sectionId && sectionName ? { id: c.sectionId, name: sectionName } : null,
    catalogKey: c.catalogKey,
    unitCount: n,
    createdBy: c.createdBy && creatorName ? { id: c.createdBy, name: creatorName } : null,
    createdAt: c.createdAt.toISOString(),
  };
}

/* ------------------------------------------ access ------------------------------------------ */

/** A course of the user's school, else 404. */
export async function getSchoolCourse(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<CourseRow> {
  const course = await dbx.query.courses.findFirst({ where: and(eq(courses.id, id), eq(courses.institutionId, user.institutionId)) });
  if (!course) throw notFound('Course');
  return course;
}

async function getEditableCourse(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<CourseRow> {
  const course = await getSchoolCourse(user, id, dbx);
  if (course.createdBy !== user.id) throw forbidden('Only the teacher who created this course can change it');
  return course;
}

/** A unit of a school course (with its course), else 404. */
export async function getSchoolUnit(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<{ unit: UnitRow; course: CourseRow }> {
  const [row] = await dbx
    .select({ unit: units, course: courses })
    .from(units)
    .innerJoin(courses, eq(courses.id, units.courseId))
    .where(and(eq(units.id, id), eq(courses.institutionId, user.institutionId)));
  if (!row) throw notFound('Unit');
  return row;
}

async function getEditableUnit(user: SessionUser, id: string, dbx: DbOrTx = db) {
  const row = await getSchoolUnit(user, id, dbx);
  if (row.course.createdBy !== user.id) throw forbidden('Only the teacher who created this course can change it');
  return row;
}

async function checkSection(user: SessionUser, sectionId: string | null | undefined) {
  if (!sectionId) return;
  const section = await db.query.sections.findFirst({ where: and(eq(sections.id, sectionId), eq(sections.institutionId, user.institutionId)) });
  if (!section) throw notFound('Section');
}

const blankToNull = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);

/* ------------------------------------------ courses ------------------------------------------ */

export async function listCourses(user: SessionUser, query: ListCoursesQuery): Promise<Course[]> {
  const q = query.q?.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const rows = await selectCourses()
    .where(
      and(
        eq(courses.institutionId, user.institutionId),
        query.mine === 'true' ? eq(courses.createdBy, user.id) : undefined,
        q ? or(ilike(courses.title, `%${q}%`), ilike(courses.subject, `%${q}%`), ilike(courses.level, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(courses.createdAt), asc(courses.title));
  return rows.map(toCourse);
}

async function courseDetail(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<CourseDetail> {
  const [row] = await selectCourses(dbx).where(and(eq(courses.id, id), eq(courses.institutionId, user.institutionId)));
  if (!row) throw notFound('Course');
  const unitRows = await dbx.select().from(units).where(eq(units.courseId, id)).orderBy(asc(units.position), asc(units.createdAt));
  return { ...toCourse(row), units: unitRows.map(toUnit) };
}

export const getCourse = (user: SessionUser, id: string) => courseDetail(user, id);

export async function createCourse(user: SessionUser, input: CourseInput): Promise<CourseDetail> {
  await checkSection(user, input.sectionId);
  const [row] = await db
    .insert(courses)
    .values({
      institutionId: user.institutionId,
      createdBy: user.id,
      title: input.title,
      level: blankToNull(input.level) ?? null,
      board: blankToNull(input.board) ?? null,
      subject: blankToNull(input.subject) ?? null,
      description: blankToNull(input.description) ?? null,
      sectionId: input.sectionId ?? null,
    })
    .returning({ id: courses.id });
  return courseDetail(user, row!.id);
}

export async function updateCourse(user: SessionUser, id: string, input: Partial<CourseInput>): Promise<CourseDetail> {
  await getEditableCourse(user, id);
  await checkSection(user, input.sectionId);
  const values: Partial<typeof courses.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.level !== undefined) values.level = blankToNull(input.level);
  if (input.board !== undefined) values.board = blankToNull(input.board);
  if (input.subject !== undefined) values.subject = blankToNull(input.subject);
  if (input.description !== undefined) values.description = blankToNull(input.description);
  if (input.sectionId !== undefined) values.sectionId = input.sectionId;
  if (Object.keys(values).length) await db.update(courses).set(values).where(eq(courses.id, id));
  return courseDetail(user, id);
}

export async function deleteCourse(user: SessionUser, id: string): Promise<void> {
  await getEditableCourse(user, id);
  await db.delete(courses).where(eq(courses.id, id));
}

/* ------------------------------------------ units ------------------------------------------ */

export async function createUnit(user: SessionUser, courseId: string, input: UnitInput): Promise<Unit> {
  return db.transaction(async (tx) => {
    await getEditableCourse(user, courseId, tx);
    // Serialise concurrent appends to the same course.
    await tx.execute(sql`select id from ${courses} where id = ${courseId} for update`);
    const [last] = await tx.select({ n: sql<number>`coalesce(max(${units.position}), 0)::int` }).from(units).where(eq(units.courseId, courseId));
    const [row] = await tx
      .insert(units)
      .values({ courseId, position: (last?.n ?? 0) + 1, title: input.title, summary: blankToNull(input.summary) ?? null, objectives: input.objectives ?? [] })
      .returning();
    return toUnit(row!);
  });
}

export async function updateUnit(user: SessionUser, id: string, input: Partial<UnitInput>): Promise<Unit> {
  await getEditableUnit(user, id);
  const values: Partial<typeof units.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.summary !== undefined) values.summary = blankToNull(input.summary);
  if (input.objectives !== undefined) values.objectives = input.objectives;
  const [row] = Object.keys(values).length
    ? await db.update(units).set(values).where(eq(units.id, id)).returning()
    : await db.select().from(units).where(eq(units.id, id));
  return toUnit(row!);
}

export async function deleteUnit(user: SessionUser, id: string): Promise<void> {
  const { unit } = await getEditableUnit(user, id);
  await db.transaction(async (tx) => {
    await tx.delete(units).where(eq(units.id, id));
    // Close the gap so positions stay 1..n.
    await tx
      .update(units)
      .set({ position: sql`${units.position} - 1` })
      .where(and(eq(units.courseId, unit.courseId), sql`${units.position} > ${unit.position}`));
  });
}

export async function reorderUnits(user: SessionUser, courseId: string, input: ReorderUnitsInput): Promise<CourseDetail> {
  return db.transaction(async (tx) => {
    await getEditableCourse(user, courseId, tx);
    const existing = await tx.select({ id: units.id }).from(units).where(eq(units.courseId, courseId));
    const ids = new Set(existing.map((u) => u.id));
    if (input.unitIds.length !== ids.size || new Set(input.unitIds).size !== ids.size || input.unitIds.some((id) => !ids.has(id))) {
      throw badRequest('List every unit of the course exactly once');
    }
    if (input.unitIds.length) {
      const cases = sql.join(
        input.unitIds.map((id, i) => sql`when ${id}::uuid then ${i + 1}::int`),
        sql` `,
      );
      await tx.update(units).set({ position: sql`case ${units.id} ${cases} end` }).where(inArray(units.id, input.unitIds));
    }
    return courseDetail(user, courseId, tx);
  });
}

/* ------------------------------------------ catalog ------------------------------------------ */

const matches = (value: string, filter?: string) => !filter || value.toLowerCase().includes(filter.toLowerCase());

export function listCatalog(query: CatalogQuery): CatalogEntry[] {
  return CATALOG.filter((e) => matches(e.level, query.level) && matches(e.board, query.board) && matches(e.subject, query.subject));
}

export async function importCatalog(user: SessionUser, key: string, sectionId?: string | null): Promise<CourseDetail> {
  const entry = catalogEntry(key);
  if (!entry) throw notFound('Catalog entry');
  await checkSection(user, sectionId);
  const id = await db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        institutionId: user.institutionId,
        createdBy: user.id,
        title: entry.title,
        level: entry.level,
        board: entry.board,
        subject: entry.subject,
        sectionId: sectionId ?? null,
        catalogKey: entry.key,
      })
      .returning({ id: courses.id });
    if (entry.units.length) {
      await tx.insert(units).values(entry.units.map((title, i) => ({ courseId: course!.id, position: i + 1, title })));
    }
    return course!.id;
  });
  return courseDetail(user, id);
}

