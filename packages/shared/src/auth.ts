import { z } from 'zod';
import type { Id } from './common.js';

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
