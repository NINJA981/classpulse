/**
 * The single browser API client. Always same-origin `/api` with the httpOnly
 * session cookie — no tokens in JS, no per-app base URLs.
 */
import { ROLE_LOGIN, ROLES, type ApiErrorBody, type ErrorCode } from '@classiq/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level validation messages keyed by dotted path, if any. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_FAILED' || !Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Backslashes, `?`, `#` and control characters never belong in an API path. */
const hasUnsafeChars = (s: string) =>
  s.includes('\\') || s.includes('?') || s.includes('#') || [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);

/**
 * Ids from the address bar end up in API paths (`/lessons/${id}`). A crafted id such as
 * `..%2F..%2Fadmin%2Fteachers` must not turn a request into a call to another endpoint, so every
 * path is checked: no `.`/`..` segments (plain or percent-encoded), no empty segments, no
 * backslashes, control characters, `?` or `#` (queries go through `query`).
 */
export function isSafeApiPath(path: string): boolean {
  if (!path.startsWith('/') || hasUnsafeChars(path)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (hasUnsafeChars(decoded)) return false;
  return decoded
    .slice(1)
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function buildUrl(path: string, query?: Query): string {
  if (!isSafeApiPath(path)) throw new ApiError(0, 'BAD_REQUEST', 'This link is not valid.');
  const url = path.startsWith('/api') ? path : `/api${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

export const PLATFORM_LOGIN = '/platform/login';
const LOGIN_PAGES = new Set(['/login', ...Object.values(ROLE_LOGIN), PLATFORM_LOGIN]);

/** The sign-in page for the area a path belongs to (/admin/x -> /admin/login, /platform/x -> /platform/login). */
export function loginPathFor(pathname: string): string {
  if (pathname === '/platform' || pathname.startsWith('/platform/')) return PLATFORM_LOGIN;
  const role = ROLES.find((r) => pathname === `/${r}` || pathname.startsWith(`/${r}/`));
  return role ? ROLE_LOGIN[role] : '/login';
}

/** Send the browser to the area's sign-in page (full navigation, so area layouts re-run). */
function toLogin(pathname: string, blocked?: 'suspended' | 'maintenance') {
  const qs = new URLSearchParams({ next: pathname });
  if (blocked) qs.set('blocked', blocked);
  window.location.assign(`${loginPathFor(pathname)}?${qs}`);
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query); // throws before anything is sent for an unsafe path
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  opts.signal?.addEventListener('abort', () => controller.abort());

  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ApiError(0, 'INTERNAL', 'The request timed out. Check your connection.');
    throw new ApiError(0, 'INTERNAL', 'Cannot reach the server. Check your connection.');
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const apiError = new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Request failed (${res.status})`, err?.details);
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const onLogin = LOGIN_PAGES.has(path) || path.startsWith('/login/');
      const platform = loginPathFor(path) === PLATFORM_LOGIN;
      if (apiError.code === 'UNAUTHENTICATED' && !onLogin) {
        toLogin(path);
      } else if (apiError.code === 'PASSWORD_CHANGE_REQUIRED' && !onLogin && path !== '/change-password') {
        window.location.assign(platform ? PLATFORM_LOGIN : '/change-password');
      } else if ((apiError.code === 'SCHOOL_SUSPENDED' || apiError.code === 'MAINTENANCE') && !onLogin && !platform) {
        // The school can't be used right now: the sign-in page explains why.
        toLogin(path, apiError.code === 'SCHOOL_SUSPENDED' ? 'suspended' : 'maintenance');
      }
    }
    throw apiError;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  /** `body` is for deletes that need a typed confirmation (e.g. a school code). */
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  /** Multipart upload (e.g. lecture audio). Long timeout. */
  upload: <T>(path: string, form: FormData, timeoutMs = 15 * 60_000) => request<T>('POST', path, { body: form, timeoutMs }),
};

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
