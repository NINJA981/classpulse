import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ROLE_HOME,
  ROLE_LOGIN,
  SESSION_COOKIE,
  type ApiErrorBody,
  type MeResponse,
  type Role,
  type SessionUser,
} from '@classiq/shared';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:5000';

/** Why there is no usable session: none/expired, or the platform is blocking the school right now. */
type SessionResult = { user: SessionUser } | { user: null; blocked?: 'suspended' | 'maintenance' };

async function resolve(): Promise<SessionResult> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { user: null };
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      cache: 'no-store',
    });
    if (res.ok) return { user: ((await res.json()) as MeResponse).user };
    const code = ((await res.json().catch(() => null)) as ApiErrorBody | null)?.error.code;
    if (code === 'SCHOOL_SUSPENDED') return { user: null, blocked: 'suspended' };
    if (code === 'MAINTENANCE') return { user: null, blocked: 'maintenance' };
    return { user: null };
  } catch {
    return { user: null };
  }
}

/** Resolve the current user server-side by forwarding the session cookie to the API. */
export async function getSession(): Promise<SessionUser | null> {
  return (await resolve()).user;
}

/** Guard for an area layout: redirects to the role's sign-in page, /change-password or the user's own home. */
export async function requireRole(role: Role, currentPath: string): Promise<SessionUser> {
  const result = await resolve();
  if (!result.user) {
    const qs = new URLSearchParams({ next: currentPath });
    if ('blocked' in result && result.blocked) qs.set('blocked', result.blocked);
    redirect(`${ROLE_LOGIN[role]}?${qs}`);
  }
  const user = result.user;
  if (user.mustChangePassword) redirect('/change-password');
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}
