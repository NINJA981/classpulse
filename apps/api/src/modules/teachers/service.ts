import { and, count, eq, inArray } from 'drizzle-orm';
import type {
  CreatedWithPassword,
  CreateTeacherInput,
  ImportTeachersInput,
  ImportTeachersResult,
  PasswordResetResult,
  PasswordTokenPurpose,
  SendLinkResult,
  Teacher,
  UpdateTeacherInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import { institutions, lessons, users } from '../../db/schema/index.js';
import { generateInitialPassword, hashInitialPassword, hashPassword } from '../../lib/crypto.js';
import { conflict, isUniqueViolation, notFound } from '../../lib/errors.js';
import { deleteStorageObjects, teacherMaterialKeys } from '../../lib/storageCleanup.js';
import {
  bumpTokenVersion,
  EMAIL_UNIQUE,
  resetUserPassword,
  rethrowUserConflict,
  sendAccountLink,
  updateUserRevokingOnEmailChange,
} from '../auth/accounts.js';
import { assertSeatsAvailable } from '../../lib/platformState.js';
import { issueInvites, issueTokenFor } from '../auth/passwordTokens.js';
import { findTeachers } from './repo.js';

/**
 * Emails are unique across every school. The message never says whether the address belongs to
 * this school or another one, so an admin can't probe other schools' staff lists.
 */
export const EMAIL_UNAVAILABLE = "This email can't be used. Use a different address.";

function rethrowTeacherConflict(err: unknown): never {
  if (isUniqueViolation(err, EMAIL_UNIQUE)) throw conflict(EMAIL_UNAVAILABLE);
  return rethrowUserConflict(err);
}

const teacherScope = (institutionId: string) => and(eq(users.institutionId, institutionId), eq(users.role, 'teacher'));

export const listTeachers = (institutionId: string) => findTeachers(db, teacherScope(institutionId));

async function getTeacher(institutionId: string, id: string): Promise<Teacher> {
  const [teacher] = await findTeachers(db, and(teacherScope(institutionId), eq(users.id, id)));
  if (!teacher) throw notFound('Teacher');
  return teacher;
}

async function getSchool(institutionId: string) {
  const [school] = await db
    .select({ name: institutions.name, code: institutions.code })
    .from(institutions)
    .where(eq(institutions.id, institutionId));
  if (!school) throw notFound('Institution');
  return school;
}

export async function createTeacher(
  institutionId: string,
  input: CreateTeacherInput,
  actorId: string,
): Promise<CreatedWithPassword<Teacher>> {
  await assertSeatsAvailable(institutionId, 'teacher', 1);
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
    .catch(rethrowTeacherConflict);
  const school = await getSchool(institutionId);
  const invite = await issueTokenFor(
    { ...row!, schoolName: school.name, schoolCode: school.code },
    'invite',
    actorId,
  );
  // Re-read so inviteStatus reflects the queued (or already delivered) email.
  return { record: await getTeacher(institutionId, row!.id), initialPassword: generated, invite };
}

type ImportRow = ImportTeachersInput['rows'][number];

/**
 * Same algorithm as importStudents: drop in-file duplicates and existing emails, hash
 * outside the transaction, insert in one statement, then send invitations.
 */
export async function importTeachers(
  institutionId: string,
  input: ImportTeachersInput,
  actorId: string,
): Promise<ImportTeachersResult> {
  const skipped: ImportTeachersResult['skipped'] = [];

  // 1. Duplicates inside the file.
  const seen = new Set<string>();
  const unique: ImportRow[] = [];
  for (const r of input.rows) {
    if (seen.has(r.email)) skipped.push({ email: r.email, reason: 'Duplicate email in the import' });
    else {
      seen.add(r.email);
      unique.push(r);
    }
  }

  // 2. Emails are unique across all schools.
  const existing = unique.length
    ? await db.select({ v: users.email }).from(users).where(inArray(users.email, unique.map((r) => r.email)))
    : [];
  const taken = new Set(existing.map((r) => r.v));
  const candidates: ImportRow[] = [];
  for (const r of unique) {
    if (taken.has(r.email)) skipped.push({ email: r.email, reason: EMAIL_UNAVAILABLE });
    else candidates.push(r);
  }

  // The school's seat limit (if any) must cover every row that would be created.
  await assertSeatsAvailable(institutionId, 'teacher', candidates.length);

  // 3. Hash before the transaction (cheaper cost: these passwords are random and must be changed).
  const prepared: (ImportRow & { initialPassword: string; passwordHash: string })[] = [];
  for (const row of candidates) {
    const initialPassword = generateInitialPassword();
    prepared.push({ ...row, initialPassword, passwordHash: await hashInitialPassword(initialPassword) });
  }
  if (prepared.length === 0) return { created: [], skipped };

  // 4. One statement; ON CONFLICT DO NOTHING covers emails taken concurrently since the pre-check.
  const inserted = await db.transaction((tx) =>
    tx
      .insert(users)
      .values(
        prepared.map((p) => ({
          institutionId,
          role: 'teacher' as const,
          name: p.name,
          email: p.email,
          department: p.department || null,
          passwordHash: p.passwordHash,
          mustChangePassword: true,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: users.id, name: users.name, email: users.email }),
  );

  // 5. Invitations after commit, so a slow mail server never holds the transaction open.
  const school = await getSchool(institutionId);
  const invites = await issueInvites(
    inserted.map((r) => ({ ...r, role: 'teacher' as const, rollNumber: null, schoolName: school.name, schoolCode: school.code })),
    actorId,
  );

  const byEmail = new Map(inserted.map((r) => [r.email, r]));
  const created: ImportTeachersResult['created'] = [];
  for (const p of prepared) {
    const row = byEmail.get(p.email);
    if (row) {
      created.push({ id: row.id, name: row.name, email: p.email, initialPassword: p.initialPassword, invite: invites.get(row.id) ?? 'no_email' });
    } else skipped.push({ email: p.email, reason: EMAIL_UNAVAILABLE });
  }
  return { created, skipped };
}

export async function updateTeacher(institutionId: string, id: string, input: UpdateTeacherInput): Promise<Teacher> {
  if (Object.keys(input).length > 0) {
    const found = await updateUserRevokingOnEmailChange(teacherScope(institutionId), id, {
      ...input,
      ...(input.status === 'disabled' && { tokenVersion: bumpTokenVersion }),
    }).catch(rethrowTeacherConflict);
    if (!found) throw notFound('Teacher');
  }
  return getTeacher(institutionId, id);
}

export async function deleteTeacher(institutionId: string, id: string): Promise<void> {
  await getTeacher(institutionId, id);
  const [owned] = await db.select({ n: count() }).from(lessons).where(eq(lessons.teacherId, id));
  if ((owned?.n ?? 0) > 0) throw conflict('This teacher owns lessons. Disable the account instead of deleting it.');
  // Materials rows go with the account (cascade); their files are removed afterwards.
  const keys = await teacherMaterialKeys(db, id);
  await db.delete(users).where(and(teacherScope(institutionId), eq(users.id, id)));
  await deleteStorageObjects(keys, { teacherId: id });
}

export const resetTeacherPassword = (institutionId: string, id: string): Promise<PasswordResetResult> =>
  resetUserPassword(institutionId, id, 'teacher');

export const sendTeacherLink = (
  institutionId: string,
  id: string,
  purpose: PasswordTokenPurpose,
  actorId: string,
): Promise<SendLinkResult> => sendAccountLink(institutionId, id, 'teacher', purpose, actorId);
