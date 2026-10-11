import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { StudentTour } from '@/components/student/tour/student-tour';
import { requireRole } from '@/lib/server-session';

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('student', '/student');
  return (
    <div data-theme="student" className="min-h-dvh">
      <AppShell user={user}>
        <StudentTour>{children}</StudentTour>
      </AppShell>
    </div>
  );
}
