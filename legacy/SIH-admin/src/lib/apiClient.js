/**
 * One place that knows how to reach SIH-backend: the base URL, the signed-in admin's token,
 * and how the API reports an error. Everything else in the console goes through here.
 */

/**
 * The API host is resolved in the browser, not baked in.
 *
 * NEXT_PUBLIC_API_BASE_URL is fixed when the dev server starts, so it pins whatever LAN IP
 * the machine had at that moment. Change Wi-Fi, renew a DHCP lease, or open the app from a
 * different host and every request goes to an address that no longer answers — and a
 * hanging fetch looks like a frozen page, not an error. The page's own hostname is always
 * reachable from the browser that loaded it, so only the port and path are taken from the
 * configured value.
 */
function resolveApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
  if (typeof window === 'undefined') return configured;
  try {
    const url = new URL(configured, window.location.origin);
    url.hostname = window.location.hostname;
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}

const API_BASE_URL = resolveApiBase();

const REQUEST_TIMEOUT_MS = 15_000;

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

  // Without this a request to an unreachable host hangs indefinitely, and the caller's
  // loading overlay never clears — a frozen screen instead of a message.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new ApiError(
        `Could not reach the server at ${API_BASE_URL}. Is the backend running?`,
        0,
        'network_timeout'
      );
    }
    throw new ApiError(
      `Could not reach the server at ${API_BASE_URL}.`,
      0,
      'network_error'
    );
  } finally {
    clearTimeout(timer);
  }

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
