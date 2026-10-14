/**
 * A school's admin accounts, managed from the platform console: list, create (one-time password
 * plus an emailed invitation), disable/enable, reset password and resend the invitation.
 * Links issued here have no `createdBy` (platform admins are not `users` rows).
 */
import { and, asc, eq } from 'drizzle-orm';
import type { CreatedSchoolAdmin, PasswordResetResult, PlatformSchoolAdmin, SchoolAdminInput, SendLinkResult } from '@classiq/shared';
import { db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../../lib/crypto.js';
import { badRequest, invalidState, notFound } from '../../lib/errors.js';
import { bumpTokenVersion, resetUserPassword, rethrowUserConflict } from '../auth/accounts.js';
import { findTokenTarget, inviteStatusSql, issueToken, issueTokenFor } from '../auth/passwordTokens.js';

const adminScope = (institutionId: string) => and(eq(users.institutionId, institutionId), eq(users.role, 'admin'));

async function findAdmins(institutionId: string, id?: string): Promise<PlatformSchoolAdmin[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      inviteStatus: inviteStatusSql,
    })
    .from(users)
    .where(and(adminScope(institutionId), id ? eq(users.id, id) : undefined))
    .orderBy(asc(users.name));
  return rows.map((r) => ({
    ...r,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export const listSchoolAdmins = (institutionId: string) => findAdmins(institutionId);

export async function getSchoolAdmin(institutionId: string, id: string): Promise<PlatformSchoolAdmin> {
  const [admin] = await findAdmins(institutionId, id);
  if (!admin) throw notFound('Admin');
  return admin;
}

export async function createSchoolAdmin(institutionId: string, input: SchoolAdminInput): Promise<CreatedSchoolAdmin> {
  const initialPassword = generateInitialPassword();
  const [row] = await db
    .insert(users)
    .values({
      institutionId,
      role: 'admin',
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(initialPassword),
      mustChangePassword: true,
    })
    .returning({ id: users.id })
    .catch(rethrowUserConflict);
  const invite = await issueToken(row!.id, 'invite', null);
  return { admin: await getSchoolAdmin(institutionId, row!.id), initialPassword, invite };
}

/** Disabling revokes the admin's sessions at once. */
export async function setSchoolAdminStatus(institutionId: string, id: string, status: 'active' | 'disabled'): Promise<PlatformSchoolAdmin> {
  const updated = await db
    .update(users)
    .set({ status, ...(status === 'disabled' && { tokenVersion: bumpTokenVersion }) })
    .where(and(adminScope(institutionId), eq(users.id, id)))
    .returning({ id: users.id });
  if (updated.length === 0) throw notFound('Admin');
  return getSchoolAdmin(institutionId, id);
}

export const resetSchoolAdminPassword = (institutionId: string, id: string): Promise<PasswordResetResult> =>
  resetUserPassword(institutionId, id, 'admin');

export async function sendSchoolAdminInvite(institutionId: string, id: string): Promise<SendLinkResult> {
  const target = await findTokenTarget(id, { institutionId, role: 'admin' });
  if (!target) throw notFound('Admin');
  if (!target.email) throw badRequest('This admin has no email address.');
  if (target.status !== 'active') throw invalidState('This account is disabled. Enable it before sending an invitation.');
  return { invite: await issueTokenFor(target, 'invite', null) };
}
