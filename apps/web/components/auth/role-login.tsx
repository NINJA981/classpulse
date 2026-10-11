'use client';
import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_HOME, ROLE_LOGIN, type Role, type SessionResponse } from '@classpulse/shared';
import { Button, Field, InlineError, Input } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { LoginNotice } from './platform-notice';

export const ROLE_LOGIN_COPY: Record<Role, { heading: string; short: string; endpoint: string }> = {
  admin: { heading: 'School admin sign in', short: 'School admin', endpoint: '/auth/admin/login' },
  teacher: { heading: 'Teacher sign in', short: 'Teacher', endpoint: '/auth/teacher/login' },
  student: { heading: 'Student sign in', short: 'Student', endpoint: '/auth/student/login' },
};

const BLOCKED_MESSAGE = {
  suspended: "Your school's access is paused. Contact support.",
  maintenance: 'ClassPulse is undergoing maintenance. Please try again later.',
} as const;

/** Only follow `next` when it stays inside the role's own area. */
export function safeNext(next: string | null, role: Role): string {
  const home = ROLE_HOME[role];
  if (next && (next === home || next.startsWith(`${home}/`)) && !next.startsWith('//') && next !== ROLE_LOGIN[role]) return next;
  return home;
}

function RoleLoginForm({ role }: { role: Role }) {
  const router = useRouter();
  const params = useSearchParams();
  const copy = ROLE_LOGIN_COPY[role];
  const staff = role !== 'student';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [needSchoolCode, setNeedSchoolCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const blocked = params.get('blocked');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body = staff
        ? { email: identifier, password }
        : { rollNumber: identifier, password, ...(schoolCode.trim() ? { institutionCode: schoolCode.trim() } : {}) };
      const { user } = await api.post<SessionResponse>(copy.endpoint, body);
      router.replace(user.mustChangePassword ? '/change-password' : safeNext(params.get('next'), user.role));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.details as { field?: string } | undefined)?.field === 'institutionCode') {
        setNeedSchoolCode(true);
      }
      setError(err);
      setPending(false);
    }
  }

  const others = (Object.keys(ROLE_LOGIN_COPY) as Role[]).filter((r) => r !== role);

  return (
    <div className="w-full max-w-md border border-line-strong bg-surface p-6 shadow-hard rounded-card sm:p-8">
      <p className="eyebrow">ClassPulse</p>
      <h1 className="font-display text-3xl font-black">{copy.heading}</h1>
      <p className="mt-1 text-sm text-muted">
        {staff ? 'Use the email address your school registered.' : 'Use the roll number your school gave you.'}
      </p>

      <LoginNotice className="mt-5" />
      {blocked && blocked in BLOCKED_MESSAGE && !error && (
        <p role="alert" className="mt-4 border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger rounded-control">
          {BLOCKED_MESSAGE[blocked as keyof typeof BLOCKED_MESSAGE]}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {staff ? (
          <Field label="Email" required>
            {(p) => (
              <Input {...p} type="email" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            )}
          </Field>
        ) : (
          <Field label="Roll number" required hint="As given by your school, e.g. 10B-01">
            {(p) => <Input {...p} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />}
          </Field>
        )}
        {!staff && needSchoolCode && (
          <Field label="School code" required hint="Ask your teacher if you don’t know it">
            {(p) => (
              <Input {...p} autoComplete="organization" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} />
            )}
          </Field>
        )}
        <Field label="Password" required>
          {(p) => (
            <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={pending} disabled={!identifier || !password}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="inline-block py-1 font-semibold underline underline-offset-4">
          Forgot password?
        </Link>
      </p>
      <p className="mt-1 text-xs text-muted">No email on your account? Ask your school administrator to reset it.</p>

      <nav aria-label="Other sign-in pages" className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-xs">
        {others.map((r) => (
          <Link key={r} href={ROLE_LOGIN[r]} className="inline-block py-1 font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
            {ROLE_LOGIN_COPY[r].short} sign in
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** A role's own sign-in page (/admin/login, /teacher/login, /student/login). */
export function RoleLoginPage({ role }: { role: Role }) {
  const form = (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense>
        <RoleLoginForm role={role} />
      </Suspense>
    </main>
  );
  return role === 'student' ? (
    <div data-theme="student" className="min-h-dvh">
      {form}
    </div>
  ) : (
    form
  );
}
