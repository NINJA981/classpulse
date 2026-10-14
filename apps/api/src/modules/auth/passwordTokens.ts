/**
 * Emailed set-password links: account invitations and password resets.
 *
 * Only the sha256 of a token is stored. A user has at most one live link: issuing a
 * new one revokes the older ones, and redeeming one revokes the rest. Links are
 * single-use and expire after PASSWORD_TOKEN_TTL_HOURS. Raw tokens and the emails
 * that carry them are never logged.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  PASSWORD_TOKEN_TTL_HOURS,
  type EmailDelivery,
  type InviteStatus,
  type PasswordTokenPreview,
  type PasswordTokenPurpose,
  type Role,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import { institutions, passwordTokens, users } from '../../db/schema/index.js';
import { enqueueEmail } from '../../jobs/emailQueue.js';
import { hashPassword, randomToken, sha256Hex } from '../../lib/crypto.js';
import { appUrl, renderEmail } from '../../lib/emailTemplates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { emailEnabled, type MailMessage } from '../../lib/mailer.js';
import { institutionState } from '../../lib/platformState.js';
import { bumpTokenVersion, revokeOpenTokens } from './accounts.js';

type UserRow = typeof users.$inferSelect;

/** Same message for every unusable link, so it reveals nothing about the account. */
const INVALID_LINK = 'This link is invalid or has expired. Ask your school administrator for a new one.';
const invalidLink = () => badRequest(INVALID_LINK);

const ROLE_LABEL: Record<Role, string> = { admin: 'administrator', teacher: 'teacher', student: 'student' };

/** Everything needed to address a set-password email. */
export interface TokenTarget {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  rollNumber: string | null;
  schoolName: string;
  schoolCode: string;
}

/** Load a user (optionally scoped to an institution and role) with their school's name and code. */
export async function findTokenTarget(
  userId: string,
  scope?: { institutionId: string; role: Role },
): Promise<(TokenTarget & { status: UserRow['status'] }) | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      rollNumber: users.rollNumber,
      status: users.status,
      schoolName: institutions.name,
      schoolCode: institutions.code,
    })
    .from(users)
    .innerJoin(institutions, eq(institutions.id, users.institutionId))
    .where(
      and(
        eq(users.id, userId),
        scope && eq(users.institutionId, scope.institutionId),
        scope && eq(users.role, scope.role),
      ),
    );
  return row;
}

const loginLine = (t: TokenTarget) =>
  t.role === 'student'
    ? `You sign in with your roll number ${t.rollNumber ?? ''} (school code ${t.schoolCode}).`
    : `You sign in with your email address ${t.email ?? ''}.`;

const EXPIRY_NOTE = `This link expires in ${PASSWORD_TOKEN_TTL_HOURS} hours and can be used only once.`;

function composeEmail(t: TokenTarget & { email: string }, purpose: PasswordTokenPurpose, rawToken: string): MailMessage {
  // The token goes in the fragment: browsers never send it, so it stays out of proxy logs and Referer headers.
  const button = { url: appUrl(`/set-password#token=${encodeURIComponent(rawToken)}`) };
  if (purpose === 'invite') {
    return renderEmail({
      to: t.email,
      subject: 'Welcome to ClassIQ — set your password',
      schoolName: t.schoolName,
      heading: `Welcome to ClassIQ, ${t.name}`,
      paragraphs: [
        `${t.schoolName} has created a ClassIQ ${ROLE_LABEL[t.role]} account for you.`,
        loginLine(t),
        'Choose your own password with the button below to finish setting up your account.',
      ],
      button: { ...button, label: 'Set your password' },
      footnote: `${EXPIRY_NOTE} If it has expired, ask your school administrator to send a new invitation.`,
    });
  }
  return renderEmail({
    to: t.email,
    subject: 'Reset your ClassIQ password',
    schoolName: t.schoolName,
    heading: 'Reset your password',
    paragraphs: [
      `Hi ${t.name}, a password reset was requested for your ClassIQ account at ${t.schoolName}.`,
      loginLine(t),
      'Choose a new password with the button below. Your current password keeps working until you do.',
    ],
    button: { ...button, label: 'Choose a new password' },
    footnote: `${EXPIRY_NOTE} If you didn't ask for this, you can ignore this email.`,
  });
}

/**
 * Create a link for `target` and queue the email. Nothing is created when the user has no
 * email or email is not configured (the admin falls back to a one-time password).
 */
export async function issueTokenFor(
  target: TokenTarget,
  purpose: PasswordTokenPurpose,
  createdBy: string | null,
): Promise<EmailDelivery> {
  const email = target.email;
  if (!email) return 'no_email';
  if (!emailEnabled()) return 'email_disabled';
  // The platform can switch emailed links off per school (feature "emailInvites"): admins fall back to passwords.
  const [owner] = await db.select({ institutionId: users.institutionId }).from(users).where(eq(users.id, target.id));
  const school = owner?.institutionId ? await institutionState(owner.institutionId) : null;
  if (school && !school.features.emailInvites) return 'email_disabled';

  const raw = randomToken(32);
  const tokenId = await db.transaction(async (tx) => {
    await revokeOpenTokens(tx, target.id);
    const [row] = await tx
      .insert(passwordTokens)
      .values({
        userId: target.id,
        purpose,
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + PASSWORD_TOKEN_TTL_HOURS * 3600_000),
        createdBy,
        emailStatus: 'queued',
      })
      .returning({ id: passwordTokens.id });
    return row!.id;
  });

  const queued = await enqueueEmail({ kind: purpose, message: composeEmail({ ...target, email }, purpose, raw), passwordTokenId: tokenId });
  if (!queued) {
    // Email was switched off between the check and the send.
    await db.update(passwordTokens).set({ emailStatus: null, revokedAt: new Date() }).where(eq(passwordTokens.id, tokenId));
    return 'email_disabled';
  }
  return 'queued';
}

/** issueTokenFor by user id. */
export async function issueToken(userId: string, purpose: PasswordTokenPurpose, createdBy: string | null): Promise<EmailDelivery> {
  const target = await findTokenTarget(userId);
  if (!target) throw notFound('User');
  return issueTokenFor(target, purpose, createdBy);
}

/** Invite many freshly created users, a few at a time (each is one small transaction + an enqueue). */
export async function issueInvites(targets: TokenTarget[], createdBy: string | null): Promise<Map<string, EmailDelivery>> {
  const result = new Map<string, EmailDelivery>();
  const CONCURRENCY = 8;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(batch.map((t) => issueTokenFor(t, 'invite', createdBy)));
    batch.forEach((t, j) => result.set(t.id, outcomes[j]!));
  }
  return result;
}

/** Live (unused, unrevoked, unexpired) token by its raw value. Locks the row when inside a transaction. */
function liveTokenWhere(raw: string) {
  return and(
    eq(passwordTokens.tokenHash, sha256Hex(raw)),
    isNull(passwordTokens.usedAt),
    isNull(passwordTokens.revokedAt),
    sql`${passwordTokens.expiresAt} > now()`,
  );
}

export async function previewToken(raw: string): Promise<PasswordTokenPreview> {
  const [row] = await db
    .select({
      purpose: passwordTokens.purpose,
      expiresAt: passwordTokens.expiresAt,
      name: users.name,
      role: users.role,
      email: users.email,
      rollNumber: users.rollNumber,
      status: users.status,
      schoolName: institutions.name,
    })
    .from(passwordTokens)
    .innerJoin(users, eq(users.id, passwordTokens.userId))
    .innerJoin(institutions, eq(institutions.id, users.institutionId))
    .where(liveTokenWhere(raw));
  if (!row || row.status !== 'active') throw invalidLink();
  return {
    purpose: row.purpose,
    name: row.name,
    role: row.role,
    schoolName: row.schoolName,
    identifier: (row.role === 'student' ? row.rollNumber : row.email) ?? '',
    expiresAt: row.expiresAt.toISOString(),
  };
}

/**
 * Set the password from a link and sign the user in: every other session and every other
 * outstanding link of the user stops working.
 */
export async function redeemToken(raw: string, newPassword: string): Promise<UserRow> {
  // Hash before opening the transaction so row locks aren't held during bcrypt work.
  const passwordHash = await hashPassword(newPassword);
  return db.transaction(async (tx) => {
    const [token] = await tx.select().from(passwordTokens).where(liveTokenWhere(raw)).for('update');
    if (!token) throw invalidLink();
    const now = new Date();
    const [user] = await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, tokenVersion: bumpTokenVersion, lastLoginAt: now })
      .where(and(eq(users.id, token.userId), eq(users.status, 'active')))
      .returning();
    if (!user) throw invalidLink();
    await tx.update(passwordTokens).set({ usedAt: now }).where(eq(passwordTokens.id, token.id));
    await revokeOpenTokens(tx, user.id);
    return user;
  });
}

/**
 * Per-user invitation state for admin lists (correlated subqueries on the outer `users` row,
 * evaluated in the same query — no N+1):
 * accepted (signed in or redeemed a link) → latest live link's email status → none.
 */
export const inviteStatusSql = sql<InviteStatus>`case
  when "users"."last_login_at" is not null
    or exists (select 1 from ${passwordTokens} pt where pt.user_id = "users"."id" and pt.used_at is not null)
  then 'accepted'
  else coalesce((
    select pt.email_status::text from ${passwordTokens} pt
    where pt.user_id = "users"."id" and pt.used_at is null and pt.revoked_at is null
    order by pt.created_at desc limit 1
  ), 'none')
end`;
