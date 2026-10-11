import 'server-only';
import { cookies } from 'next/headers';
import type { PlatformAdmin, PlatformSessionResponse } from '@classpulse/shared';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:5000';

/** The platform cookie (`cp_platform`, set by /api/platform/auth). */
export const PLATFORM_COOKIE = 'cp_platform';

/** Resolve the signed-in platform admin server-side by forwarding the platform cookie (mirrors server-session.ts). */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/platform/auth/me`, {
      headers: { cookie: `${PLATFORM_COOKIE}=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as PlatformSessionResponse).admin;
  } catch {
    return null;
  }
}
