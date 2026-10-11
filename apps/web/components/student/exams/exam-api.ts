/**
 * Exam attempt calls need the per-attempt device token in the X-Exam-Token
 * header, which `api` from lib/api cannot send. This mirrors its error handling
 * (ApiError, session redirects) for those calls only. The token lives in
 * sessionStorage, so closing the tab ends the device binding.
 */
import { EXAM_TOKEN_HEADER, type ApiErrorBody } from '@classpulse/shared';
import { ApiError } from '@/lib/api';

const tokenKey = (examId: string) => `classpulse:exam-token:${examId}`;

export function getExamToken(examId: string): string | null {
  try {
    return window.sessionStorage.getItem(tokenKey(examId));
  } catch {
    return null;
  }
}

export function setExamToken(examId: string, token: string): void {
  try {
    window.sessionStorage.setItem(tokenKey(examId), token);
  } catch {
    /* storage unavailable: the token is still kept in memory by the player */
  }
}

export function clearExamToken(examId: string): void {
  try {
    window.sessionStorage.removeItem(tokenKey(examId));
  } catch {
    /* storage unavailable */
  }
}

export async function examRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  opts: { body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers[EXAM_TOKEN_HEADER] = opts.token;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError')
      throw new ApiError(0, 'INTERNAL', 'The request timed out. Check your connection.');
    throw new ApiError(0, 'INTERNAL', 'Cannot reach the server. Check your connection.');
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const apiError = new ApiError(
      res.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
    if (apiError.code === 'UNAUTHENTICATED')
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    else if (apiError.code === 'PASSWORD_CHANGE_REQUIRED') window.location.assign('/change-password');
    throw apiError;
  }
  return data as T;
}

/** Network failure (worth retrying) rather than a server answer. */
export const isNetworkError = (err: unknown) => err instanceof ApiError && err.status === 0;
/** The attempt is bound to another device (or was unlocked for one). */
export const isDeviceConflict = (err: unknown) => err instanceof ApiError && err.code === 'CONFLICT';
/** The attempt already ended (submitted, auto-submitted, time up). */
export const isEnded = (err: unknown) => err instanceof ApiError && err.code === 'INVALID_STATE';
