import { and, eq, inArray } from 'drizzle-orm';
import type { ChangePasswordInput, StaffLoginInput, StudentLoginInput } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { institutions, users } from '../../db/schema/index.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { AppError, badRequest, forbidden, notFound, unauthenticated } from '../../lib/errors.js';
import { bumpTokenVersion, DUMMY_PASSWORD_HASH } from './accounts.js';

type UserRow = typeof users.$inferSelect;

const STAFF_INVALID = 'Invalid email or password';
const STUDENT_INVALID = 'Invalid roll number or password';

/**
 * Always runs exactly one bcrypt comparison (against a dummy hash when the user is missing)
 * so response timing does not reveal whether an account exists.
 */
async function checkCredentials(row: UserRow | undefined, password: string, invalidMessage: string): Promise<UserRow> {
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!row || !ok) throw unauthenticated(invalidMessage);
  // Only revealed to someone who knows the password.
  if (row.status !== 'active') throw forbidden('This account is disabled. Please contact your administrator.');
  return row;
}

async function markLoggedIn(userId: string): Promise<UserRow> {
  const [row] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId)).returning();
  if (!row) throw unauthenticated();
  return row;
}

export async function staffLogin(input: StaffLoginInput): Promise<UserRow> {
  const row = await db.query.users.findFirst({
    where: and(eq(users.email, input.email), inArray(users.role, ['admin', 'teacher'])),
  });
  const user = await checkCredentials(row, input.password, STAFF_INVALID);
  return markLoggedIn(user.id);
}

/**
 * Without a school code, find the institution by roll number: it is only
 * ambiguous (and the code required) when several schools use the same roll number.
 */
async function resolveStudentInstitution(code: string | undefined, rollNumber: string): Promise<string | null> {
  if (code) {
    const inst = await db.query.institutions.findFirst({
      where: eq(institutions.code, code.toUpperCase()),
      columns: { id: true },
    });
    return inst?.id ?? null;
  }
  const rows = await db
    .selectDistinct({ id: users.institutionId })
    .from(users)
    .where(and(eq(users.rollNumber, rollNumber), eq(users.role, 'student')))
    .limit(2);
  if (rows.length > 1) {
    throw badRequest('Several schools use this roll number. Enter your school code to sign in.', { field: 'institutionCode' });
  }
  return rows[0]?.id ?? null;
}

export async function studentLogin(input: StudentLoginInput): Promise<UserRow> {
  const institutionId = await resolveStudentInstitution(input.institutionCode, input.rollNumber);
  const row = institutionId
    ? await db.query.users.findFirst({
        where: and(
          eq(users.institutionId, institutionId),
          eq(users.rollNumber, input.rollNumber),
          eq(users.role, 'student'),
        ),
      })
    : undefined;
  const user = await checkCredentials(row, input.password, STUDENT_INVALID);
  return markLoggedIn(user.id);
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<UserRow> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) throw notFound('User');
  if (!(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw new AppError('BAD_REQUEST', 'Your current password is incorrect', [
      { path: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  if (input.newPassword === input.currentPassword) {
    throw new AppError('BAD_REQUEST', 'Choose a password different from your current one', [
      { path: 'newPassword', message: 'Must differ from the current password' },
    ]);
  }
  const passwordHash = await hashPassword(input.newPassword);
  const [updated] = await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, tokenVersion: bumpTokenVersion })
    .where(and(eq(users.id, userId), eq(users.tokenVersion, row.tokenVersion)))
    .returning();
  // A concurrent password change/revocation won the race; this session is no longer valid.
  if (!updated) throw unauthenticated('Your session has expired. Please sign in again.');
  return updated;
}

