'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PASSWORD_MIN_LENGTH, ROLE_HOME, type SessionResponse } from '@classiq/shared';
import { Button, Field, InlineError, Input } from '@/components/ui';
import { api } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return;
    setPending(true);
    setError(null);
    try {
      const { user } = await api.post<SessionResponse>('/auth/change-password', { currentPassword: current, newPassword: next });
      router.replace(ROLE_HOME[user.role]);
      router.refresh();
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-md border border-line-strong bg-surface p-8 shadow-hard rounded-card" noValidate>
        <p className="eyebrow">Account security</p>
        <h1 className="font-display text-2xl font-black">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">For your security, replace the password you were given before continuing.</p>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="Current password" required>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label="New password" required hint={`At least ${PASSWORD_MIN_LENGTH} characters`}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <Field label="Confirm new password" required error={mismatch ? 'Passwords do not match' : null}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <InlineError error={error} />
          <Button type="submit" size="lg" loading={pending} disabled={!current || next.length < PASSWORD_MIN_LENGTH || next !== confirm}>
            Save and continue
          </Button>
        </div>
      </form>
    </main>
  );
}
