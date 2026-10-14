/**
 * Account helpers shared by the admin people modules (teachers, students) and auth.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { PasswordResetResult, PasswordTokenPurpose, Role, SendLinkResult } from '@classiq/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { passwordTokens, users } from '../../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../../lib/crypto.js';
import { badRequest, conflict, invalidState, isUniqueViolation, notFound } from '../../lib/errors.js';
import { findTokenTarget, issueTokenFor } from './passwordTokens.js';

export const EMAIL_UNIQUE = 'users_email_unique';
export const ROLL_UNIQUE = 'users_institution_roll_unique';

/** Valid bcrypt hash (cost 12) of a random string. Compared against when a user is missing so timing is uniform. */
export const DUMMY_PASSWORD_HASH = '$2b$12$VRc88n4aFI57Sh/mjbUyZe2ICjUeoYWyvylu4M8DJ1AOqZt.1Ej.G';

/** Increments token_version — every outstanding session for the user stops working. */
export const bumpTokenVersion = sql`${users.tokenVersion} + 1`;

const label = (role: Role) => (role === 'teacher' ? 'Teacher' : role === 'student' ? 'Student' : 'User');

/** Translate unique violations on `users` into friendly 409s; rethrow anything else. */
export function rethrowUserConflict(err: unknown): never {
  if (isUniqueViolation(err, EMAIL_UNIQUE)) throw conflict('That email address is already in use');
  if (isUniqueViolation(err, ROLL_UNIQUE)) throw conflict('That roll number is already in use');
  throw err;
}

/** Revoke every unused, unrevoked set-password link of a user (admin reset, email change, newer link). */
export async function revokeOpenTokens(dbx: DbOrTx, userId: string): Promise<void> {
  await dbx
    .update(passwordTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(passwordTokens.userId, userId), isNull(passwordTokens.usedAt), isNull(passwordTokens.revokedAt)));
}

/**
 * Generate a fresh initial password, force a change at next login, revoke existing sessions
 * and any emailed set-password links.
 */
export async function resetUserPassword(institutionId: string, userId: string, role: Role): Promise<PasswordResetResult> {
  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, tokenVersion: bumpTokenVersion })
      .where(and(eq(users.id, userId), eq(users.institutionId, institutionId), eq(users.role, role)))
      .returning({ id: users.id });
    if (updated.length === 0) throw notFound(label(role));
    await revokeOpenTokens(tx, userId);
  });
  return { initialPassword };
}

/** Admin "resend invite" / "email a reset link". Replaces any earlier link. */
export async function sendAccountLink(
  institutionId: string,
  userId: string,
  role: Role,
  purpose: PasswordTokenPurpose,
  actorId: string,
): Promise<SendLinkResult> {
  const target = await findTokenTarget(userId, { institutionId, role });
  if (!target) throw notFound(label(role));
  if (!target.email) {
    throw badRequest('This account has no email address. Add one first, or reset the password to a one-time password.');
  }
  if (target.status !== 'active') throw invalidState('This account is disabled. Enable it before sending a link.');
  return { invite: await issueTokenFor(target, purpose, actorId) };
}

/**
 * Update a user's columns; when the email address actually changes, links already sent to
 * the old address are revoked. Returns false when no row matched.
 */
export async function updateUserRevokingOnEmailChange(
  where: ReturnType<typeof and>,
  id: string,
  values: PgUpdateSetSource<typeof users>,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ email: users.email }).from(users).where(and(where, eq(users.id, id))).for('update');
    if (!before) return false;
    await tx.update(users).set(values).where(eq(users.id, id));
    if (values.email !== undefined && values.email !== before.email) await revokeOpenTokens(tx, id);
    return true;
  });
}
