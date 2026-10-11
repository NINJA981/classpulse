/** Platform console: platform auth, schools, admins, global search and settings DTOs (owned by the platform module). */
import { z } from 'zod';
import { ChangePasswordInput, type EmailDelivery, type InviteStatus, type Role } from './auth.js';
import { Id, PaginationQuery, type IsoDate } from './common.js';
import { InstitutionInput } from './org.js';
import {
  InstitutionContact,
  InstitutionFeatures,
  InstitutionLimits,
  type InstitutionStatus,
} from './platform.js';
import { LlmProvider, SttProvider } from './settings.js';

/* ----------------------------------------------------------------------------
 * Platform sign-in: password, then an authenticator (TOTP) code or a recovery code
 * ------------------------------------------------------------------------- */

/** How many single-use recovery codes are issued at enrolment / regeneration. */
export const RECOVERY_CODE_COUNT = 10;

/** 6-digit authenticator code; spaces are ignored ("123 456"). */
export const TotpCode = z
  .string()
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'));

/** Recovery code "abcd-2345" (case and the dash are optional when typing). */
export const RecoveryCode = z
  .string()
  .transform((s) => s.trim().toLowerCase().replace(/[\s-]+/g, ''))
  .pipe(z.string().regex(/^[a-z0-9]{8}$/, 'Recovery codes look like abcd-2345'))
  .transform((s) => `${s.slice(0, 4)}-${s.slice(4)}`);

export const PlatformLoginInput = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type PlatformLoginInput = z.infer<typeof PlatformLoginInput>;

/** Shown once, at first sign-in, to add the account to an authenticator app. */
export interface TotpEnrolment {
  /** Base32 secret for manual entry. */
  secret: string;
  /** otpauth:// URI rendered as a QR code. */
  otpauthUri: string;
}

export interface PlatformLoginResponse {
  /** Short-lived (5 min) token for the second step. */
  challengeToken: string;
  /** Present only when the account has not enrolled an authenticator yet: call /enroll next. */
  enrolment?: TotpEnrolment;
}

const ChallengeToken = z.string().trim().min(20).max(2000);

export const PlatformEnrollInput = z.object({ challengeToken: ChallengeToken, code: TotpCode });
export type PlatformEnrollInput = z.infer<typeof PlatformEnrollInput>;

export const PlatformVerifyInput = z
  .object({ challengeToken: ChallengeToken, code: TotpCode.optional(), recoveryCode: RecoveryCode.optional() })
  .refine((v) => Boolean(v.code) !== Boolean(v.recoveryCode), {
    message: 'Enter either an authenticator code or a recovery code',
    path: ['code'],
  });
export type PlatformVerifyInput = z.infer<typeof PlatformVerifyInput>;

export const PlatformChangePasswordInput = ChangePasswordInput;
export type PlatformChangePasswordInput = z.infer<typeof PlatformChangePasswordInput>;

export const RegenerateRecoveryCodesInput = z.object({ code: TotpCode });
export type RegenerateRecoveryCodesInput = z.infer<typeof RegenerateRecoveryCodesInput>;

export interface PlatformAdmin {
  id: Id;
  email: string;
  name: string;
  mustChangePassword: boolean;
  recoveryCodesLeft: number;
  lastLoginAt: IsoDate | null;
}

export interface PlatformSessionResponse {
  admin: PlatformAdmin;
}

/** Enrolment finished: the recovery codes are shown exactly once. */
export interface PlatformEnrollResponse extends PlatformSessionResponse {
  recoveryCodes: string[];
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

/* ----------------------------------------------------------------------------
 * Schools
 * ------------------------------------------------------------------------- */

export interface PlatformSchoolCounts {
  admins: number;
  teachers: number;
  students: number;
  sections: number;
  lessons: number;
}

export interface PlatformSchool {
  id: Id;
  name: string;
  code: string;
  timezone: string;
  academicYear: string | null;
  status: InstitutionStatus;
  suspendedReason: string | null;
  suspendedAt: IsoDate | null;
  createdAt: IsoDate;
  /** Latest of any user's last sign-in and the latest lesson created. */
  lastActivityAt: IsoDate | null;
  counts: PlatformSchoolCounts;
  limits: InstitutionLimits;
}

export interface PlatformSchoolDetail extends PlatformSchool {
  features: InstitutionFeatures;
  contact: InstitutionContact | null;
  notes: string | null;
  extraCounts: { devices: number; exams: number; assignments: number; liveSessions: number };
}

export const SchoolAdminInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase(),
});
export type SchoolAdminInput = z.infer<typeof SchoolAdminInput>;

export const CreateSchoolInput = InstitutionInput.extend({
  contact: InstitutionContact.optional(),
  notes: z.string().trim().max(2000).optional(),
  admin: SchoolAdminInput,
});
export type CreateSchoolInput = z.infer<typeof CreateSchoolInput>;

export const UpdateSchoolInput = z
  .object({
    name: InstitutionInput.shape.name,
    code: InstitutionInput.shape.code,
    timezone: z.string().trim().min(1).max(64),
    academicYear: z.string().trim().max(20).nullable(),
    contact: InstitutionContact.nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial();
export type UpdateSchoolInput = z.infer<typeof UpdateSchoolInput>;

export const SuspendSchoolInput = z.object({ reason: z.string().trim().min(3).max(300) });
export type SuspendSchoolInput = z.infer<typeof SuspendSchoolInput>;

export const UpdateSchoolFeaturesInput = InstitutionFeatures;
export const UpdateSchoolLimitsInput = InstitutionLimits;

export interface PlatformSchoolAdmin {
  id: Id;
  name: string;
  email: string | null;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt: IsoDate | null;
  createdAt: IsoDate;
  inviteStatus: InviteStatus;
}

export interface CreatedSchoolAdmin {
  admin: PlatformSchoolAdmin;
  /** One-time password, shown once. */
  initialPassword: string;
  invite: EmailDelivery;
}

export interface CreateSchoolResult extends CreatedSchoolAdmin {
  school: PlatformSchoolDetail;
}

/* ----------------------------------------------------------------------------
 * Read-only views of a school (paged, searchable)
 * ------------------------------------------------------------------------- */

export const PLATFORM_SCHOOL_VIEWS = [
  'teachers',
  'students',
  'sections',
  'lessons',
  'exams',
  'assignments',
  'devices',
  'live-sessions',
] as const;
export type PlatformSchoolView = (typeof PLATFORM_SCHOOL_VIEWS)[number];

export const PlatformViewQuery = PaginationQuery.extend({ q: z.string().trim().max(100).optional() });
export type PlatformViewQuery = z.infer<typeof PlatformViewQuery>;

/** One row of a read-only view: a title, a subtitle and a few labelled facts. */
export interface PlatformViewRow {
  id: Id;
  title: string;
  subtitle: string | null;
  status: string | null;
  /** Ordered label → value pairs (already formatted, null = blank). */
  facts: { label: string; value: string | number | null }[];
  at: IsoDate | null;
}

/* ----------------------------------------------------------------------------
 * Global user search
 * ------------------------------------------------------------------------- */

export const PlatformUserSearchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(100),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
});
export type PlatformUserSearchQuery = z.infer<typeof PlatformUserSearchQuery>;

export interface PlatformUserHit {
  id: Id;
  name: string;
  email: string | null;
  rollNumber: string | null;
  role: Role;
  status: 'active' | 'disabled';
  lastLoginAt: IsoDate | null;
  school: { id: Id; name: string; code: string; status: InstitutionStatus };
}

/* ----------------------------------------------------------------------------
 * Platform settings
 * ------------------------------------------------------------------------- */

export const MaintenanceSetting = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(500),
  /** Refuse school sign-ins and requests (503) while enabled. */
  blockLogins: z.boolean(),
});
export type MaintenanceSetting = z.infer<typeof MaintenanceSetting>;

export const BannerLevel = z.enum(['info', 'warning', 'critical']);
export const BannerSetting = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(300),
  level: BannerLevel,
});
export type BannerSetting = z.infer<typeof BannerSetting>;

/** AI models given to every new school (the school admin can change them later). */
export const DefaultModelsSetting = z.object({
  sttProvider: SttProvider,
  sttModel: z.string().trim().min(1).max(80),
  llmProvider: LlmProvider,
  llmModel: z.string().trim().min(1).max(80),
});
export type DefaultModelsSetting = z.infer<typeof DefaultModelsSetting>;

const Price = z.number().min(0).max(10_000);
/**
 * Editable rates (USD) used for cost ESTIMATES only — providers change prices, so check invoices.
 * llm: per 1M input/output tokens by model id; stt: per audio hour by model id.
 */
export const AiPrices = z.object({
  llm: z.record(z.string().trim().min(1).max(80), z.object({ inputPer1M: Price, outputPer1M: Price })),
  stt: z.record(z.string().trim().min(1).max(80), z.object({ perHour: Price })),
});
export type AiPrices = z.infer<typeof AiPrices>;

export const PlatformSettings = z.object({
  maintenance: MaintenanceSetting,
  banner: BannerSetting,
  defaultModels: DefaultModelsSetting,
  aiPrices: AiPrices,
});
export type PlatformSettings = z.infer<typeof PlatformSettings>;

/** PUT /api/platform/settings: any subset of the sections (each replaced whole). */
export const UpdatePlatformSettingsInput = PlatformSettings.partial();
export type UpdatePlatformSettingsInput = z.infer<typeof UpdatePlatformSettingsInput>;

export const DEFAULT_AI_PRICES: AiPrices = {
  llm: {
    'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 },
    'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
    'gpt-5-mini': { inputPer1M: 0.25, outputPer1M: 2 },
  },
  stt: {
    'saaras:v3': { perHour: 0.36 },
    'saarika:v2.5': { perHour: 0.36 },
    'whisper-1': { perHour: 0.36 },
  },
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenance: { enabled: false, message: '', blockLogins: false },
  banner: { enabled: false, message: '', level: 'info' },
  defaultModels: { sttProvider: 'sarvam', sttModel: 'saaras:v3', llmProvider: 'openai', llmModel: 'gpt-4.1-mini' },
  aiPrices: DEFAULT_AI_PRICES,
};

export const PlatformIdParams = z.object({ id: Id });
export const PlatformSchoolAdminParams = z.object({ id: Id, adminId: Id });
