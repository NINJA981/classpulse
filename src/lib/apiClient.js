/**
 * One place that knows how to reach SIH-backend: the base URL, the signed-in admin's token,
 * and how the API reports an error. Everything else in the console goes through here.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'cp_admin_token';
const USER_KEY = 'cp_admin_user';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isBrowser = () => typeof window !== 'undefined';

export function getToken() {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(token, user) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* a private window can refuse; the session just will not survive a reload */
  }
}

export function clearSession() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* nothing to do */
  }
}

export function isSignedIn() {
  return getToken() !== null;
}

export async function request(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  // 204 has no body to parse — DELETE answers this way.
  if (res.status === 204) return undefined;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const error = data && data.error;
    // A stale token should not leave the console half-signed-in.
    if (res.status === 401) clearSession();
    throw new ApiError(
      (error && error.message) || `Request failed (${res.status})`,
      res.status,
      error && error.code
    );
  }

  return data;
}

/** POST /api/auth/login — the console signs in as a staff account. */
export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  storeSession(data.token, data.teacher);
  return data.teacher;
}

export function logout() {
  clearSession();
}
