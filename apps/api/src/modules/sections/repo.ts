/**
 * Section DTO queries shared by the admin sections module and the teacher studio.
 * Correlated subqueries spell outer columns as "table"."column": drizzle renders `${table.col}`
 * unqualified in single-table selects, which would bind to the inner alias instead.
 */
import { asc, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import type { Section } from '@classiq/shared';
import type { DbOrTx } from '../../db/client.js';
import { enrollments, rooms, sections, sectionTeachers, users } from '../../db/schema/index.js';

type Ref = { id: string; name: string };

const teachersJson = sql<Ref[]>`coalesce((
  select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
  from ${sectionTeachers} st join ${users} u on u.id = st.teacher_id
  where st.section_id = "sections"."id"
), '[]'::json)`;

export const sectionStudentCountSql = sql<number>`(select count(*)::int from ${enrollments} e where e.section_id = "sections"."id")`;

export async function findSections(dbx: DbOrTx, where: SQL | undefined): Promise<Section[]> {
  const rows = await dbx
    .select({
      ...getTableColumns(sections),
      roomName: rooms.name,
      teachers: teachersJson,
      studentCount: sectionStudentCountSql,
    })
    .from(sections)
    .leftJoin(rooms, eq(rooms.id, sections.roomId))
    .where(where)
    .orderBy(asc(sections.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    grade: r.grade,
    subject: r.subject,
    room: r.roomId && r.roomName ? { id: r.roomId, name: r.roomName } : null,
    joinCode: r.joinCode,
    joinCodeExpiresAt: r.joinCodeExpiresAt.toISOString(),
    teachers: r.teachers,
    studentCount: r.studentCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Sections a teacher is assigned to (subquery usable in `where`). */
export const sectionsTaughtBy = (dbx: DbOrTx, teacherId: string) =>
  inArray(
    sections.id,
    dbx.select({ id: sectionTeachers.sectionId }).from(sectionTeachers).where(eq(sectionTeachers.teacherId, teacherId)),
  );
