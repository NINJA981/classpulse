import { and, count, eq } from 'drizzle-orm';
import type {
  CreatedWithPassword,
  CreateTeacherInput,
  PasswordResetResult,
  Teacher,
  UpdateTeacherInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import { lessons, users } from '../../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../../lib/crypto.js';
import { conflict, notFound } from '../../lib/errors.js';
import { bumpTokenVersion, resetUserPassword, rethrowUserConflict } from '../auth/accounts.js';
import { findTeachers } from './repo.js';

const teacherScope = (institutionId: string) => and(eq(users.institutionId, institutionId), eq(users.role, 'teacher'));

export const listTeachers = (institutionId: string) => findTeachers(db, teacherScope(institutionId));

async function getTeacher(institutionId: string, id: string): Promise<Teacher> {
  const [teacher] = await findTeachers(db, and(teacherScope(institutionId), eq(users.id, id)));
  if (!teacher) throw notFound('Teacher');
  return teacher;
}

export async function createTeacher(
  institutionId: string,
  input: CreateTeacherInput,
): Promise<CreatedWithPassword<Teacher>> {
  const generated = input.password ? null : generateInitialPassword();
  const passwordHash = await hashPassword(input.password ?? generated!);
  const [row] = await db
    .insert(users)
    .values({
      institutionId,
      role: 'teacher',
      name: input.name,
      email: input.email,
      department: input.department ?? null,
      passwordHash,
      // The admin knows this password, so the teacher must replace it on first login.
      mustChangePassword: true,
    })
    .returning()
    .catch(rethrowUserConflict);
  return {
    record: {
      id: row!.id,
      name: row!.name,
      email: row!.email ?? '',
      department: row!.department,
      status: row!.status,
      sections: [],
      createdAt: row!.createdAt.toISOString(),
    },
    initialPassword: generated,
  };
}

export async function updateTeacher(institutionId: string, id: string, input: UpdateTeacherInput): Promise<Teacher> {
  if (Object.keys(input).length > 0) {
    const updated = await db
      .update(users)
      .set({
        ...input,
        ...(input.status === 'disabled' && { tokenVersion: bumpTokenVersion }),
      })
      .where(and(teacherScope(institutionId), eq(users.id, id)))
      .returning({ id: users.id })
      .catch(rethrowUserConflict);
    if (updated.length === 0) throw notFound('Teacher');
  }
  return getTeacher(institutionId, id);
}

export async function deleteTeacher(institutionId: string, id: string): Promise<void> {
  await getTeacher(institutionId, id);
  const [owned] = await db.select({ n: count() }).from(lessons).where(eq(lessons.teacherId, id));
  if ((owned?.n ?? 0) > 0) throw conflict('This teacher owns lessons. Disable the account instead of deleting it.');
  await db.delete(users).where(and(teacherScope(institutionId), eq(users.id, id)));
}

export const resetTeacherPassword = (institutionId: string, id: string): Promise<PasswordResetResult> =>
  resetUserPassword(institutionId, id, 'teacher');
