import type { ErrorCode } from '@classpulse/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  UPSTREAM_FAILED: 502,
  SCHOOL_SUSPENDED: 403,
  MAINTENANCE: 503,
  EMAIL_UNAVAILABLE: 503,
  FEATURE_DISABLED: 403,
  INTERNAL: 500,
};

/** An error that is safe to show to API clients. Anything else becomes a generic 500. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError('BAD_REQUEST', message, details);
export const unauthenticated = (message = 'Please sign in') => new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have access to this resource') => new AppError('FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new AppError('CONFLICT', message);
export const invalidState = (message: string) => new AppError('INVALID_STATE', message);

/** Postgres unique-violation helper. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  // drizzle wraps driver errors; the pg error is on `.cause`
  const e = (err as { cause?: { code?: string; constraint?: string } })?.cause ?? (err as { code?: string; constraint?: string });
  if (!e || e.code !== '23505') return false;
  return constraint ? e.constraint === constraint : true;
}
