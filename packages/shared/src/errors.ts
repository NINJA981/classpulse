export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'PASSWORD_CHANGE_REQUIRED',
  'INVALID_STATE',
  'UPSTREAM_FAILED',
  /** The school was suspended by the platform (403). */
  'SCHOOL_SUSPENDED',
  /** Platform maintenance with sign-ins blocked (503). */
  'MAINTENANCE',
  /** The feature is switched off for this school (403). */
  'FEATURE_DISABLED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Every non-2xx API response has exactly this body. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
