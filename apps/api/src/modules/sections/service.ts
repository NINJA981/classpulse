import { and, count, eq, inArray, notInArray } from 'drizzle-orm';
import type { Section, SectionInput, SetSectionStudentsInput, Student, UpdateSectionInput } from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { enrollments, lessons, rooms, sections, sectionTeachers, users } from '../../db/schema/index.js';
import { generateJoinCode } from '../../lib/crypto.js';
import { badRequest, conflict, isUniqueViolation, notFound } from '../../lib/errors.js';
import { addDays } from '../../lib/time.js';
import { findStudents } from '../students/repo.js';
import { findSections } from './repo.js';

const JOIN_CODE_TTL_DAYS = 30;
const JOIN_CODE_ATTEMPTS = 8;
const SECTION_NAME_UNIQUE = 'sections_institution_name_unique';

const sectionScope = (institutionId: string, id: string) =>
  and(eq(sections.id, id), eq(sections.institutionId, institutionId));

export const listSections = (institutionId: string) => findSections(db, eq(sections.institutionId, institutionId));

export async function getSection(institutionId: string, id: string, dbx: DbOrTx = db): Promise<Section> {
  const [section] = await findSections(dbx, sectionScope(institutionId, id));
  if (!section) throw notFound('Section');
  return section;
}

function rethrowSectionConflict(err: unknown): never {
  if (isUniqueViolation(err, SECTION_NAME_UNIQUE)) throw conflict('A section with that name already exists');
  throw err;
}

async function assertRoom(dbx: DbOrTx, institutionId: string, roomId: string | null | undefined): Promise<void> {
  if (!roomId) return;
  const [row] = await dbx
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.institutionId, institutionId)));
  if (!row) throw badRequest('Unknown room', [{ path: 'roomId', message: 'Room not found' }]);
}

async function assertTeachers(dbx: DbOrTx, institutionId: string, teacherIds: string[]): Promise<string[]> {
  const ids = [...new Set(teacherIds)];
  if (ids.length === 0) return ids;
  const [row] = await dbx
    .select({ n: count() })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.institutionId, institutionId), eq(users.role, 'teacher')));
  if ((row?.n ?? 0) !== ids.length) {
    throw badRequest('Unknown teacher', [{ path: 'teacherIds', message: 'One or more teachers were not found' }]);
  }
  return ids;
}

async function replaceTeachers(tx: DbOrTx, sectionId: string, teacherIds: string[]): Promise<void> {
  await tx.delete(sectionTeachers).where(eq(sectionTeachers.sectionId, sectionId));
  if (teacherIds.length > 0) {
    await tx.insert(sectionTeachers).values(teacherIds.map((teacherId) => ({ sectionId, teacherId })));
  }
}

export async function createSection(institutionId: string, input: SectionInput): Promise<Section> {
  const id = await db
    .transaction(async (tx) => {
      await assertRoom(tx, institutionId, input.roomId);
      const teacherIds = await assertTeachers(tx, institutionId, input.teacherIds ?? []);
      for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt++) {
        // Targeted ON CONFLICT: a join-code clash returns no row (retry); a name clash still throws.
        const [row] = await tx
          .insert(sections)
          .values({
            institutionId,
            name: input.name,
            grade: input.grade ?? null,
            subject: input.subject ?? null,
            roomId: input.roomId ?? null,
            joinCode: generateJoinCode(),
            joinCodeExpiresAt: addDays(new Date(), JOIN_CODE_TTL_DAYS),
          })
          .onConflictDoNothing({ target: sections.joinCode })
          .returning({ id: sections.id });
        if (row) {
          await replaceTeachers(tx, row.id, teacherIds);
          return row.id;
        }
      }
      throw new Error('Could not allocate a unique join code');
    })
    .catch(rethrowSectionConflict);
  return getSection(institutionId, id);
}

export async function updateSection(institutionId: string, id: string, input: UpdateSectionInput): Promise<Section> {
  const { teacherIds, ...fields } = input;
  await db
    .transaction(async (tx) => {
      await getSection(institutionId, id, tx);
      if (fields.roomId !== undefined) await assertRoom(tx, institutionId, fields.roomId);
      if (Object.keys(fields).length > 0) {
        await tx.update(sections).set(fields).where(sectionScope(institutionId, id));
      }
      if (teacherIds !== undefined) {
        await replaceTeachers(tx, id, await assertTeachers(tx, institutionId, teacherIds));
      }
    })
    .catch(rethrowSectionConflict);
  return getSection(institutionId, id);
}

export async function deleteSection(institutionId: string, id: string): Promise<void> {
  await getSection(institutionId, id);
  const [row] = await db.select({ n: count() }).from(lessons).where(eq(lessons.sectionId, id));
  if ((row?.n ?? 0) > 0) throw conflict('This section has lessons and cannot be deleted');
  await db.delete(sections).where(sectionScope(institutionId, id));
}

export async function rotateJoinCode(institutionId: string, id: string): Promise<Section> {
  await getSection(institutionId, id);
  for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt++) {
    try {
      await db
        .update(sections)
        .set({ joinCode: generateJoinCode(), joinCodeExpiresAt: addDays(new Date(), JOIN_CODE_TTL_DAYS) })
        .where(sectionScope(institutionId, id));
      return getSection(institutionId, id);
    } catch (err) {
      if (!isUniqueViolation(err, 'sections_join_code_unique')) throw err;
    }
  }
  throw new Error('Could not allocate a unique join code');
}

const enrolledIn = (sectionId: string) =>
  inArray(users.id, db.select({ id: enrollments.studentId }).from(enrollments).where(eq(enrollments.sectionId, sectionId)));

export async function listSectionStudents(institutionId: string, id: string): Promise<Student[]> {
  await getSection(institutionId, id);
  return findStudents(db, and(eq(users.institutionId, institutionId), eq(users.role, 'student'), enrolledIn(id)));
}

export async function setSectionStudents(
  institutionId: string,
  id: string,
  input: SetSectionStudentsInput,
): Promise<Student[]> {
  const studentIds = [...new Set(input.studentIds)];
  await db.transaction(async (tx) => {
    await getSection(institutionId, id, tx);
    if (studentIds.length > 0) {
      const [row] = await tx
        .select({ n: count() })
        .from(users)
        .where(and(inArray(users.id, studentIds), eq(users.institutionId, institutionId), eq(users.role, 'student')));
      if ((row?.n ?? 0) !== studentIds.length) {
        throw badRequest('Unknown student', [{ path: 'studentIds', message: 'One or more students were not found' }]);
      }
    }
    await tx
      .delete(enrollments)
      .where(
        studentIds.length > 0
          ? and(eq(enrollments.sectionId, id), notInArray(enrollments.studentId, studentIds))
          : eq(enrollments.sectionId, id),
      );
    if (studentIds.length > 0) {
      await tx
        .insert(enrollments)
        .values(studentIds.map((studentId) => ({ sectionId: id, studentId })))
        .onConflictDoNothing();
    }
  });
  return listSectionStudents(institutionId, id);
}
