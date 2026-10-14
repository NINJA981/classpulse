import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PlatformShell } from '@/components/platform/shell';
import { getPlatformAdmin } from '@/lib/platform-session';

export const metadata: Metadata = {
  title: { default: 'Platform console', template: '%s · ClassIQ platform' },
  robots: { index: false, follow: false },
};

/**
 * The platform console: the same design as the school admin/teacher panels, with its own sidebar and
 * session (cp_platform). The sign-in page shares this segment, so proxy.ts passes the path in
 * `x-cp-path` and the login renders bare. Moving between the sign-in page and the console is always a
 * full navigation.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get('x-cp-path') ?? '';
  if (path === '/platform/login') return children;
  const admin = await getPlatformAdmin();
  if (!admin || admin.mustChangePassword) redirect('/platform/login');
  return <PlatformShell admin={admin}>{children}</PlatformShell>;
}
