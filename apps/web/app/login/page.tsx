'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, GraduationCap, School, UserRound, type LucideIcon } from 'lucide-react';
import { ROLE_HOME, ROLE_LOGIN, ROLES, type Role } from '@classpulse/shared';
import { LoginNotice } from '@/components/auth/platform-notice';
import { ROLE_LOGIN_COPY } from '@/components/auth/role-login';

const CARDS: Record<Role, { icon: LucideIcon; description: string }> = {
  admin: { icon: School, description: 'Manage teachers, students, classes and devices.' },
  teacher: { icon: GraduationCap, description: 'Record lessons, review quizzes, exams and assignments.' },
  student: { icon: UserRound, description: 'Take quizzes, exams and hand in assignments.' },
};

/** "Who are you?" — links to each role's own sign-in page, forwarding ?next= (and any notice). */
function Chooser() {
  const params = useSearchParams();
  const next = params.get('next');
  const blocked = params.get('blocked');

  const hrefFor = (role: Role) => {
    const qs = new URLSearchParams();
    if (next && (next === ROLE_HOME[role] || next.startsWith(`${ROLE_HOME[role]}/`))) qs.set('next', next);
    if (blocked) qs.set('blocked', blocked);
    const s = qs.toString();
    return s ? `${ROLE_LOGIN[role]}?${s}` : ROLE_LOGIN[role];
  };

  return (
    <div className="w-full max-w-3xl">
      <p className="eyebrow">Welcome to</p>
      <h1 className="font-display text-3xl font-black sm:text-4xl">ClassPulse</h1>
      <p className="mt-1 text-sm text-muted">Choose how you sign in.</p>
      <LoginNotice className="mt-5" />
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => {
          const { icon: Icon, description } = CARDS[role];
          return (
            <li key={role}>
              <Link
                href={hrefFor(role)}
                className="group flex h-full flex-col gap-3 border border-line-strong bg-surface p-5 rounded-card hover:shadow-hard"
              >
                <Icon className="size-6" aria-hidden />
                <span className="font-display text-lg font-extrabold">{ROLE_LOGIN_COPY[role].heading}</span>
                <span className="text-sm text-muted">{description}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold">
                  Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="inline-block py-1 font-semibold underline underline-offset-4">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense>
        <Chooser />
      </Suspense>
    </main>
  );
}
