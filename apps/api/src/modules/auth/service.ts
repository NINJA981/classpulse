import { and, eq, inArray } from 'drizzle-orm';
import type { ChangePasswordInput, ForgotPasswordInput, StaffLoginInput, StudentLoginInput } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { institutions, users } from '../../db/schema/index.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { AppError, forbidden, notFound, unauthenticated } from '../../lib/errors.js';
import { assertNotInMaintenance, assertSchoolActive } from '../../lib/platformState.js';
import { verifySessionToken } from '../../lib/session.js';
import { bumpTokenVersion, DUMMY_PASSWORD_HASH } from './accounts.js';
import { issueToken } from './passwordTokens.js';

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

/** Refuse sign-in to a suspended school (only revealed to someone who knows the password). */
async function markLoggedIn(user: UserRow): Promise<UserRow> {
  await assertSchoolActive(user.institutionId);
  const [row] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).returning();
  if (!row) throw unauthenticated();
  return row;
}

/**
 * Staff sign-in by email. Each login page accepts only its own role(s); any other account gets the
 * same generic 401 as a wrong password, so the endpoint never reveals which role an email has.
 */
export async function staffLogin(input: StaffLoginInput, roles: readonly ('admin' | 'teacher')[] = ['admin', 'teacher']): Promise<UserRow> {
  await assertNotInMaintenance();
  const row = await db.query.users.findFirst({
    where: and(eq(users.email, input.email), inArray(users.role, [...roles])),
  });
  const user = await checkCredentials(row, input.password, STAFF_INVALID);
  return markLoggedIn(user);
}

/** Schools checked when a roll number is used by several of them and no school code was given. */
const MAX_ROLL_CANDIDATES = 5;

/** Answered to a correct password for a roll number several schools use: the school code is needed. */
export const SCHOOL_CODE_NEEDED = 'Enter your school code to sign in.';

/**
 * Student sign-in by roll number. With a school code, the student of that school. Without one, the
 * school is found from the roll number. When several schools use it, nobody is signed in: every
 * answer is the generic 401, and only a password that is correct for one of those students adds the
 * hint `{ field: 'institutionCode' }` (so the response never reveals whether a roll number exists).
 */
export async function studentLogin(input: StudentLoginInput): Promise<UserRow> {
  await assertNotInMaintenance();
  if (input.institutionCode) {
    const [row] = await db
      .select({ user: users })
      .from(users)
      .innerJoin(institutions, eq(institutions.id, users.institutionId))
      .where(
        and(eq(institutions.code, input.institutionCode), eq(users.rollNumber, input.rollNumber), eq(users.role, 'student')),
      );
    return markLoggedIn(await checkCredentials(row?.user, input.password, STUDENT_INVALID));
  }

  const candidates = await db.query.users.findMany({
    where: and(eq(users.rollNumber, input.rollNumber), eq(users.role, 'student')),
    limit: MAX_ROLL_CANDIDATES,
  });
  if (candidates.length <= 1) return markLoggedIn(await checkCredentials(candidates[0], input.password, STUDENT_INVALID));

  const matches = await Promise.all(candidates.map((c) => verifyPassword(input.password, c.passwordHash)));
  if (matches.some(Boolean)) throw new AppError('UNAUTHENTICATED', SCHOOL_CODE_NEEDED, { field: 'institutionCode' });
  throw unauthenticated(STUDENT_INVALID);
}

/**
 * Sign-out revokes the presented session and every other session of the user (bumps the token
 * version). Returns the signed-out user, or null when no valid session was presented.
 */
export async function signOut(token: string | null): Promise<UserRow | null> {
  const claims = token ? verifySessionToken(token) : null;
  if (!claims) return null;
  const [row] = await db
    .update(users)
    .set({ tokenVersion: bumpTokenVersion })
    .where(and(eq(users.id, claims.sub), eq(users.tokenVersion, claims.ver)))
    .returning();
  return row ?? null;
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


/**
 * "Forgot password?": email a reset link when an active account with an email address
 * matches. Silent otherwise — the route always answers 204 so nothing about the account leaks.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  let userId: string | undefined;
  if ('email' in input) {
    const row = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true, status: true } });
    if (row?.status === 'active') userId = row.id;
  } else {
    const [row] = await db
      .select({ id: users.id, status: users.status, email: users.email })
      .from(users)
      .innerJoin(institutions, eq(institutions.id, users.institutionId))
      .where(
        and(eq(institutions.code, input.institutionCode), eq(users.rollNumber, input.rollNumber), eq(users.role, 'student')),
      );
    if (row?.status === 'active' && row.email) userId = row.id;
  }
  if (userId) await issueToken(userId, 'reset', null);
}
