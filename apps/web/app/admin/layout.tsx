import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { requireRole } from '@/lib/server-session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('admin', '/admin');
  return <AppShell user={user}>{children}</AppShell>;
}
