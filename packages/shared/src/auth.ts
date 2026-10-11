import { z } from 'zod';
import type { Id, IsoDate } from './common.js';
import type { InstitutionFeatures, PlatformNotice } from './platform.js';

export const ROLES = ['admin', 'teacher', 'student'] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};

/** Name of the httpOnly session cookie set by the API. */
export const SESSION_COOKIE = 'cp_session';

export const PASSWORD_MIN_LENGTH = 8;
export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(128);

export const StaffLoginInput = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type StaffLoginInput = z.infer<typeof StaffLoginInput>;

export const StudentLoginInput = z.object({
  rollNumber: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(128),
  /** Required only when more than one institution exists. */
  institutionCode: z.string().trim().min(1).max(20).optional(),
});
export type StudentLoginInput = z.infer<typeof StudentLoginInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: Password,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export interface SessionUser {
  id: Id;
  name: string;
  email: string | null;
  role: Role;
  institutionId: Id;
  rollNumber: string | null;
  mustChangePassword: boolean;
}

export interface SessionResponse {
  user: SessionUser;
}

/** GET /api/auth/me: the session plus the platform notice and the school's feature switches. */
export interface MeResponse extends SessionResponse {
  notice: PlatformNotice;
  features: InstitutionFeatures;
}

/** Where each school role signs in (POST /api/auth/{role}/login; students use roll numbers). */
export const ROLE_LOGIN: Record<Role, string> = {
  admin: '/admin/login',
  teacher: '/teacher/login',
  student: '/student/login',
};

/* ----------------------------------------------------------------------------
 * Set-password links (invites and resets sent by email)
 * ------------------------------------------------------------------------- */

/** How long an emailed set-password link stays valid. */
export const PASSWORD_TOKEN_TTL_HOURS = 72;

export const PasswordTokenPurpose = z.enum(['invite', 'reset']);
export type PasswordTokenPurpose = z.infer<typeof PasswordTokenPurpose>;

/** Account invitation state shown to admins next to each teacher/student. */
export const InviteStatus = z.enum(['none', 'queued', 'sent', 'failed', 'accepted']);
export type InviteStatus = z.infer<typeof InviteStatus>;

/** What happened to the email when an account was created or a link was requested. */
export type EmailDelivery = 'queued' | 'no_email' | 'email_disabled';

export const PasswordTokenParams = z.object({ token: z.string().trim().min(20).max(200) });

/** Shown on /set-password before the user picks a password. */
export interface PasswordTokenPreview {
  purpose: PasswordTokenPurpose;
  name: string;
  role: Role;
  schoolName: string;
  /** Email for staff, roll number for students. */
  identifier: string;
  expiresAt: IsoDate;
}

export const SetPasswordInput = z.object({
  token: z.string().trim().min(20).max(200),
  newPassword: Password,
});
export type SetPasswordInput = z.infer<typeof SetPasswordInput>;

export const ForgotPasswordInput = z.union([
  z.object({ email: z.email().trim().toLowerCase() }),
  z.object({
    rollNumber: z.string().trim().min(1).max(40),
    institutionCode: z.string().trim().toUpperCase().min(2).max(20),
  }),
]);
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;
