import { z } from 'zod';

/* ----------------------------------------------------------------------------
 * Platform (super admin) — shared core types. Feature-specific DTOs live in
 * platform-*.ts files owned by the modules that serve them.
 * ------------------------------------------------------------------------- */

export const InstitutionStatus = z.enum(['active', 'suspended']);
export type InstitutionStatus = z.infer<typeof InstitutionStatus>;

/** Per-school feature switches (all on by default). */
export const InstitutionFeatures = z.object({
  exams: z.boolean(),
  assignments: z.boolean(),
  liveQuiz: z.boolean(),
  devices: z.boolean(),
  emailInvites: z.boolean(),
  aiGrading: z.boolean(),
  teacherTools: z.boolean(),
});
export type InstitutionFeatures = z.infer<typeof InstitutionFeatures>;
export type InstitutionFeature = keyof InstitutionFeatures;

export const DEFAULT_INSTITUTION_FEATURES: InstitutionFeatures = {
  exams: true,
  assignments: true,
  liveQuiz: true,
  devices: true,
  emailInvites: true,
  aiGrading: true,
  teacherTools: true,
};

/**
 * Per-school limits; null = unlimited, except `aiAudioMinutesPerMonth`, where null means the platform
 * default (the API's DEFAULT_AI_AUDIO_MINUTES_PER_MONTH, 3000 minutes unless configured).
 * `storageGb` covers lesson audio, submission files and teacher materials; uploads over it are refused.
 */
export const InstitutionLimits = z.object({
  maxStudents: z.number().int().min(1).nullable(),
  maxTeachers: z.number().int().min(1).nullable(),
  aiAudioMinutesPerMonth: z.number().int().min(1).nullable(),
  storageGb: z.number().min(0.1).nullable(),
});
export type InstitutionLimits = z.infer<typeof InstitutionLimits>;

export const DEFAULT_INSTITUTION_LIMITS: InstitutionLimits = {
  maxStudents: null,
  maxTeachers: null,
  aiAudioMinutesPerMonth: null,
  storageGb: null,
};

export const InstitutionContact = z.object({
  name: z.string().trim().max(120).default(''),
  email: z.string().trim().max(254).default(''),
  phone: z.string().trim().max(30).default(''),
});
export type InstitutionContact = z.infer<typeof InstitutionContact>;

/** Platform-wide notice shown to every school user (and the login pages). */
export interface PlatformNotice {
  banner: { message: string; level: 'info' | 'warning' | 'critical' } | null;
  maintenance: { message: string; blockLogins: boolean } | null;
}

/** Public, unauthenticated platform status (login pages). */
export interface PlatformStatus extends PlatformNotice {
  ok: true;
}
