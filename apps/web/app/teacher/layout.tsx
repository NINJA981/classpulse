import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { requireRole } from '@/lib/server-session';

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('teacher', '/teacher');
  return <AppShell user={user}>{children}</AppShell>;
}
