import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROLE_HOME, SESSION_COOKIE, type Role, type SessionResponse, type SessionUser } from '@classpulse/shared';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:5000';

/** Resolve the current user server-side by forwarding the session cookie to the API. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as SessionResponse).user;
  } catch {
    return null;
  }
}

/** Guard for an area layout: redirects to /login, /change-password or the user's own home. */
export async function requireRole(role: Role, currentPath: string): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (user.mustChangePassword) redirect('/change-password');
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}
