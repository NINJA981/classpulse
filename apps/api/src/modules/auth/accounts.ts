/**
 * Account helpers shared by the admin people modules (teachers, students) and auth.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { PasswordResetResult, Role } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../../lib/crypto.js';
import { conflict, isUniqueViolation, notFound } from '../../lib/errors.js';

export const EMAIL_UNIQUE = 'users_email_unique';
export const ROLL_UNIQUE = 'users_institution_roll_unique';

/** Valid bcrypt hash (cost 12) of a random string. Compared against when a user is missing so timing is uniform. */
export const DUMMY_PASSWORD_HASH = '$2b$12$VRc88n4aFI57Sh/mjbUyZe2ICjUeoYWyvylu4M8DJ1AOqZt.1Ej.G';

/** Increments token_version — every outstanding session for the user stops working. */
export const bumpTokenVersion = sql`${users.tokenVersion} + 1`;

/** Translate unique violations on `users` into friendly 409s; rethrow anything else. */
export function rethrowUserConflict(err: unknown): never {
  if (isUniqueViolation(err, EMAIL_UNIQUE)) throw conflict('That email address is already in use');
  if (isUniqueViolation(err, ROLL_UNIQUE)) throw conflict('That roll number is already in use');
  throw err;
}

/** Generate a fresh initial password, force a change at next login and revoke existing sessions. */
export async function resetUserPassword(institutionId: string, userId: string, role: Role): Promise<PasswordResetResult> {
  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);
  const updated = await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, tokenVersion: bumpTokenVersion })
    .where(and(eq(users.id, userId), eq(users.institutionId, institutionId), eq(users.role, role)))
    .returning({ id: users.id });
  if (updated.length === 0) throw notFound(role === 'teacher' ? 'Teacher' : 'Student');
  return { initialPassword };
}
