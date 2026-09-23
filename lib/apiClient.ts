/**
 * One place that knows how to talk to SIH-backend: the base URL, the student's token, and
 * how the API reports an error. Everything else in lib/ goes through here.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

const TOKEN_KEY = "cp_student_token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* a private window can refuse; the session just will not survive a reload */
  }
}

export function clearToken(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do */
  }
}

export function isSignedIn(): boolean {
  return getToken() !== null;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };

  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  // 204 has no body to parse — DELETE answers this way.
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string } })?.error;
    // A stale token should not leave the app half-signed-in.
    if (res.status === 401) clearToken();
    throw new ApiError(
      error?.message || `Request failed (${res.status})`,
      res.status,
      error?.code
    );
  }

  return data as T;
}
