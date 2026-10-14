import { and, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  Id,
  PaginationQuery,
  type CreatedWithPassword,
  type CreateStudentInput,
  type ImportStudentsInput,
  type ImportStudentsResult,
  type Paginated,
  type PasswordResetResult,
  type PasswordTokenPurpose,
  type SendLinkResult,
  type Student,
  type UpdateStudentInput,
} from '@classiq/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { enrollments, institutions, sections, users } from '../../db/schema/index.js';
import { generateInitialPassword, hashInitialPassword, hashPassword } from '../../lib/crypto.js';
import { badRequest, conflict, isUniqueViolation, notFound } from '../../lib/errors.js';
import { deleteStorageObjects, studentSubmissionKeys } from '../../lib/storageCleanup.js';
import {
  bumpTokenVersion,
  EMAIL_UNIQUE,
  resetUserPassword,
  rethrowUserConflict,
  sendAccountLink,
  updateUserRevokingOnEmailChange,
} from '../auth/accounts.js';
import { assertSeatsAvailable } from '../../lib/platformState.js';
import { issueInvites, issueToken } from '../auth/passwordTokens.js';
import { EMAIL_UNAVAILABLE } from '../teachers/service.js';
import { findStudents } from './repo.js';

/** Like rethrowUserConflict, but an email clash never says whose (or which school's) address it is. */
function rethrowStudentConflict(err: unknown): never {
  if (isUniqueViolation(err, EMAIL_UNIQUE)) throw conflict(EMAIL_UNAVAILABLE);
  return rethrowUserConflict(err);
}

export const ListStudentsQuery = PaginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  sectionId: Id.optional(),
});
export type ListStudentsQuery = z.infer<typeof ListStudentsQuery>;

export const studentScope = (institutionId: string) =>
  and(eq(users.institutionId, institutionId), eq(users.role, 'student'));

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listStudents(institutionId: string, query: ListStudentsQuery): Promise<Paginated<Student>> {
  const filters: (SQL | undefined)[] = [studentScope(institutionId)];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(or(ilike(users.name, pattern), ilike(users.rollNumber, pattern)));
  }
  if (query.sectionId) {
    filters.push(
      inArray(
        users.id,
        db.select({ id: enrollments.studentId }).from(enrollments).where(eq(enrollments.sectionId, query.sectionId)),
      ),
    );
  }
  const where = and(...filters);
  const [items, totalRows] = await Promise.all([
    findStudents(db, where, { limit: query.pageSize, offset: (query.page - 1) * query.pageSize }),
    db.select({ n: count() }).from(users).where(where),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: totalRows[0]?.n ?? 0 };
}

async function getStudent(institutionId: string, id: string): Promise<Student> {
  const [student] = await findStudents(db, and(studentScope(institutionId), eq(users.id, id)));
  if (!student) throw notFound('Student');
  return student;
}

/** Body references must point at a section of the caller's institution. */
export async function assertSectionInInstitution(dbx: DbOrTx, institutionId: string, sectionId: string): Promise<void> {
  const [row] = await dbx
    .select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.institutionId, institutionId)));
  if (!row) throw badRequest('Unknown section', [{ path: 'sectionId', message: 'Section not found' }]);
}

export async function createStudent(
  institutionId: string,
  input: CreateStudentInput,
  actorId: string,
): Promise<CreatedWithPassword<Student>> {
  await assertSeatsAvailable(institutionId, 'student', 1);
  const generated = input.password ? null : generateInitialPassword();
  const passwordHash = await hashPassword(input.password ?? generated ?? '');
  const id = await db
    .transaction(async (tx) => {
      if (input.sectionId) await assertSectionInInstitution(tx, institutionId, input.sectionId);
      const [row] = await tx
        .insert(users)
        .values({
          institutionId,
          role: 'student',
          name: input.name,
          rollNumber: input.rollNumber,
          email: input.email ?? null,
          passwordHash,
          // Admin-created students must choose their own password on first login.
          mustChangePassword: true,
        })
        .returning({ id: users.id });
      if (input.sectionId) await tx.insert(enrollments).values({ sectionId: input.sectionId, studentId: row!.id });
      return row!.id;
    })
    .catch(rethrowStudentConflict);
  const invite = await issueToken(id, 'invite', actorId);
  return { record: await getStudent(institutionId, id), initialPassword: generated, invite };
}

type ImportRow = ImportStudentsInput['rows'][number];

export async function importStudents(
  institutionId: string,
  input: ImportStudentsInput,
  actorId: string,
): Promise<ImportStudentsResult> {
  const skipped: ImportStudentsResult['skipped'] = [];
  if (input.sectionId) await assertSectionInInstitution(db, institutionId, input.sectionId);

  // 1. Duplicates inside the file.
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const unique: ImportRow[] = [];
  for (const r of input.rows) {
    if (seenRolls.has(r.rollNumber)) {
      skipped.push({ rollNumber: r.rollNumber, reason: 'Duplicate roll number in the import' });
    } else if (r.email && seenEmails.has(r.email)) {
      skipped.push({ rollNumber: r.rollNumber, reason: 'Duplicate email in the import' });
    } else {
      seenRolls.add(r.rollNumber);
      if (r.email) seenEmails.add(r.email);
      unique.push(r);
    }
  }

  // 2. Rows that clash with existing users.
  const rolls = unique.map((r) => r.rollNumber);
  const emails = unique.flatMap((r) => (r.email ? [r.email] : []));
  const [existingRolls, existingEmails] = await Promise.all([
    rolls.length
      ? db
          .select({ v: users.rollNumber })
          .from(users)
          .where(and(eq(users.institutionId, institutionId), inArray(users.rollNumber, rolls)))
      : Promise.resolve([]),
    emails.length
      ? db.select({ v: users.email }).from(users).where(inArray(users.email, emails))
      : Promise.resolve([]),
  ]);
  const takenRolls = new Set(existingRolls.map((r) => r.v));
  const takenEmails = new Set(existingEmails.map((r) => r.v));
  const candidates: ImportRow[] = [];
  for (const r of unique) {
    if (takenRolls.has(r.rollNumber)) skipped.push({ rollNumber: r.rollNumber, reason: 'Roll number already exists' });
    else if (r.email && takenEmails.has(r.email)) skipped.push({ rollNumber: r.rollNumber, reason: EMAIL_UNAVAILABLE });
    else candidates.push(r);
  }

  // The school's seat limit (if any) must cover every row that would be created.
  await assertSeatsAvailable(institutionId, 'student', candidates.length);

  // 3. Hash before opening the transaction so it is not held open during bcrypt work.
  const prepared: (ImportRow & { initialPassword: string; passwordHash: string })[] = [];
  for (const row of candidates) {
    const initialPassword = generateInitialPassword();
    prepared.push({ ...row, initialPassword, passwordHash: await hashInitialPassword(initialPassword) });
  }
  if (prepared.length === 0) return { created: [], skipped };

  // 4. One transaction; ON CONFLICT DO NOTHING covers rows created concurrently since the pre-check.
  const sectionId = input.sectionId;
  const inserted = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(users)
      .values(
        prepared.map((p) => ({
          institutionId,
          role: 'student' as const,
          name: p.name,
          rollNumber: p.rollNumber,
          email: p.email ?? null,
          passwordHash: p.passwordHash,
          mustChangePassword: true,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: users.id, name: users.name, rollNumber: users.rollNumber, email: users.email });
    if (sectionId && rows.length > 0) {
      await tx.insert(enrollments).values(rows.map((r) => ({ sectionId, studentId: r.id })));
    }
    return rows;
  });

  // 5. Invitations after commit, for the students who have an email address.
  const [school] = await db
    .select({ name: institutions.name, code: institutions.code })
    .from(institutions)
    .where(eq(institutions.id, institutionId));
  const invites = await issueInvites(
    inserted.map((r) => ({ ...r, role: 'student' as const, schoolName: school!.name, schoolCode: school!.code })),
    actorId,
  );

  const byRoll = new Map(inserted.map((r) => [r.rollNumber, r]));
  const created: ImportStudentsResult['created'] = [];
  for (const p of prepared) {
    const row = byRoll.get(p.rollNumber);
    if (row) {
      created.push({
        id: row.id,
        name: row.name,
        rollNumber: p.rollNumber,
        initialPassword: p.initialPassword,
        invite: invites.get(row.id) ?? 'no_email',
      });
    }
    else skipped.push({ rollNumber: p.rollNumber, reason: 'Roll number or email already exists' });
  }
  return { created, skipped };
}

export async function updateStudent(institutionId: string, id: string, input: UpdateStudentInput): Promise<Student> {
  if (Object.keys(input).length > 0) {
    const found = await updateUserRevokingOnEmailChange(studentScope(institutionId), id, {
      ...input,
      ...(input.status === 'disabled' && { tokenVersion: bumpTokenVersion }),
    }).catch(rethrowStudentConflict);
    if (!found) throw notFound('Student');
  }
  return getStudent(institutionId, id);
}

export async function deleteStudent(institutionId: string, id: string): Promise<void> {
  // Submission rows go with the account (cascade); their uploaded files are removed afterwards.
  const keys = await studentSubmissionKeys(db, id);
  const deleted = await db
    .delete(users)
    .where(and(studentScope(institutionId), eq(users.id, id)))
    .returning({ id: users.id });
  if (deleted.length === 0) throw notFound('Student');
  await deleteStorageObjects(keys, { studentId: id });
}

export const resetStudentPassword = (institutionId: string, id: string): Promise<PasswordResetResult> =>
  resetUserPassword(institutionId, id, 'student');

export const sendStudentLink = (
  institutionId: string,
  id: string,
  purpose: PasswordTokenPurpose,
  actorId: string,
): Promise<SendLinkResult> => sendAccountLink(institutionId, id, 'student', purpose, actorId);
