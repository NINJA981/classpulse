'use client';
import { useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@classpulse/shared';
import { TourProvider } from '@/components/tour';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/session-context';
import { studentTourKey, studentTourSteps } from './steps';

/**
 * First-time guided tour for students. Starts by itself on Home (never over a deep link such as an exam or a
 * live-quiz PIN, and never over /change-password, which sits outside the student layout); any page can
 * restart it through `useTourControls()`.
 */
export function StudentTour({ children }: { children: ReactNode }) {
  const user = useSessionUser();
  const pathname = usePathname();
  // Same query as the app shell (shared cache): the school's feature switches.
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: () => api.get<MeResponse>('/auth/me') });

  // Like the shell's nav: features unknown (request failed) → show everything.
  const exams = me.data?.features.exams ?? true;
  const assignments = me.data?.features.assignments ?? true;
  const liveQuiz = me.data?.features.liveQuiz ?? true;
  const steps = useMemo(() => studentTourSteps({ exams, assignments, liveQuiz }), [exams, assignments, liveQuiz]);

  return (
    <TourProvider storageKey={studentTourKey(user.id)} steps={steps} autoStart={pathname === '/student' && !me.isPending}>
      {children}
    </TourProvider>
  );
}
