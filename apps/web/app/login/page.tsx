'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_HOME, type SessionResponse } from '@classpulse/shared';
import { Button, Field, InlineError, Input, Tabs } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

type Mode = 'staff' | 'student';

function safeNext(next: string | null, role: keyof typeof ROLE_HOME): string {
  const home = ROLE_HOME[role];
  if (next && next.startsWith(home) && !next.startsWith('//')) return next;
  return home;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>('staff');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [needSchoolCode, setNeedSchoolCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { user } =
        mode === 'staff'
          ? await api.post<SessionResponse>('/auth/login', { email: identifier, password })
          : await api.post<SessionResponse>('/auth/student/login', {
              rollNumber: identifier,
              password,
              ...(schoolCode.trim() ? { institutionCode: schoolCode.trim() } : {}),
            });
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

  return (
    <div className="w-full max-w-md border border-line-strong bg-surface p-8 shadow-hard rounded-card">
      <p className="eyebrow">Welcome to</p>
      <h1 className="font-display text-3xl font-black">ClassPulse</h1>
      <p className="mt-1 text-sm text-muted">Sign in to continue.</p>

      <div className="mt-6">
        <Tabs
          label="Account type"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setIdentifier('');
            setError(null);
          }}
          tabs={[
            { value: 'staff', label: 'Teacher / Admin' },
            { value: 'student', label: 'Student' },
          ]}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {mode === 'staff' ? (
          <Field label="Email" required>
            {(p) => (
              <Input {...p} type="email" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            )}
          </Field>
        ) : (
          <Field label="Roll number" required hint="As given by your school, e.g. 10B-01">
            {(p) => (
              <Input {...p} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            )}
          </Field>
        )}
        {mode === 'student' && needSchoolCode && (
          <Field label="School code" required hint="Ask your teacher if you don’t know it">
            {(p) => (
              <Input {...p} autoComplete="organization" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} />
            )}
          </Field>
        )}
        <Field label="Password" required>
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={pending} disabled={!identifier || !password}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-xs text-muted">Forgot your password? Ask your school administrator to reset it.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
