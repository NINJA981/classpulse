import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@classpulse/shared';

/**
 * Fast edge gate: unauthenticated visitors to any area are sent to /login.
 * Role checks happen in each area's server layout (via /api/auth/me) and,
 * authoritatively, in the API itself.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/student/:path*', '/change-password'],
};
