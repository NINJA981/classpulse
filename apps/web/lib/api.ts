/**
 * The single browser API client. Always same-origin `/api` with the httpOnly
 * session cookie — no tokens in JS, no per-app base URLs.
 */
import type { ApiErrorBody, ErrorCode } from '@classpulse/shared';

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

function buildUrl(path: string, query?: Query): string {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  opts.signal?.addEventListener('abort', () => controller.abort());

  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
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
      if (apiError.code === 'UNAUTHENTICATED' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      } else if (apiError.code === 'PASSWORD_CHANGE_REQUIRED' && window.location.pathname !== '/change-password') {
        window.location.assign('/change-password');
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
  delete: <T = void>(path: string) => request<T>('DELETE', path),
  /** Multipart upload (e.g. lecture audio). Long timeout. */
  upload: <T>(path: string, form: FormData, timeoutMs = 15 * 60_000) => request<T>('POST', path, { body: form, timeoutMs }),
};

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
