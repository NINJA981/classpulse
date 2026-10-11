import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_LOGIN, ROLES, SESSION_COOKIE } from '@classpulse/shared';

const PLATFORM_COOKIE = 'cp_platform';

/**
 * Fast edge gate.
 * - /admin/login, /teacher/login and /student/login are served by app/login/{role} (a rewrite keeps
 *   the URL), so the area layouts — which require a session — never wrap a sign-in page.
 * - Unauthenticated visitors to an area are sent to that area's sign-in page.
 * - /platform/* needs the platform cookie (except /platform/login); the platform layout reads
 *   `x-cp-path` to render its sign-in page without the console shell.
 * Role checks happen in each area's server layout and, authoritatively, in the API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    const headers = new Headers(request.headers);
    headers.set('x-cp-path', pathname);
    if (pathname !== '/platform/login' && !request.cookies.get(PLATFORM_COOKIE)?.value) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }
    return NextResponse.next({ request: { headers } });
  }

  const role = ROLES.find((r) => pathname === `/${r}` || pathname.startsWith(`/${r}/`));
  if (role && pathname === ROLE_LOGIN[role]) {
    return NextResponse.rewrite(new URL(`/login/${role}${request.nextUrl.search}`, request.url));
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL(role ? ROLE_LOGIN[role] : '/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/student/:path*', '/change-password', '/platform/:path*'],
};
