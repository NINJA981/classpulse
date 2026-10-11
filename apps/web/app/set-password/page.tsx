'use client';
import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PASSWORD_MIN_LENGTH, ROLE_HOME, type PasswordTokenPreview, type SessionResponse } from '@classpulse/shared';
import { Button, ButtonLink, Field, InlineError, Input, LoadingBlock } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

/** Shown for missing, expired, used or revoked links (the API doesn't say which). */
function InvalidLink({ message }: { message?: string }) {
  return (
    <>
      <p className="eyebrow">Link not valid</p>
      <h1 className="font-display text-2xl font-black">This link can’t be used</h1>
      <p className="mt-2 text-sm text-muted">
        {message ?? 'This link is invalid or has expired. Ask your school administrator for a new one.'}
      </p>
      <p className="mt-2 text-sm text-muted">Links work once and expire after 72 hours. You can request a fresh one by email.</p>
      <div className="mt-6 flex flex-col gap-3">
        <ButtonLink href="/forgot-password" size="lg">
          Email me a new link
        </ButtonLink>
        <Link href="/login" className="text-center text-sm font-semibold underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token')?.trim() ?? '';
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const preview = useQuery({
    queryKey: ['auth', 'password-token', token],
    queryFn: ({ signal }) => api.get<PasswordTokenPreview>(`/auth/password-token/${encodeURIComponent(token)}`, undefined, signal),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < PASSWORD_MIN_LENGTH;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm || next.length < PASSWORD_MIN_LENGTH) return;
    setPending(true);
    setError(null);
    try {
      const { user } = await api.post<SessionResponse>('/auth/set-password', { token, newPassword: next });
      router.replace(ROLE_HOME[user.role]);
      router.refresh();
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  if (!token) return <InvalidLink />;
  if (preview.isPending) return <LoadingBlock label="Checking your link…" />;
  if (preview.error) {
    const known = preview.error instanceof ApiError && preview.error.status === 400;
    return <InvalidLink message={known ? undefined : 'We couldn’t check this link right now. Check your connection and reload the page.'} />;
  }
  // The link was used or expired while the form was open.
  if (error instanceof ApiError && error.code === 'BAD_REQUEST') return <InvalidLink message={error.message} />;

  const p = preview.data;
  const invite = p.purpose === 'invite';
  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="eyebrow">{p.schoolName}</p>
      <h1 className="font-display text-2xl font-black">Hi {p.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {invite ? 'Choose a password to finish setting up your ClassPulse account.' : 'Choose a new password for your ClassPulse account.'}
      </p>
      <dl className="mt-4 border border-line bg-surface-2 px-3 py-2 text-sm rounded-control">
        <dt className="eyebrow">{p.role === 'student' ? 'Your roll number' : 'Your email'}</dt>
        <dd className="break-all font-semibold text-ink">{p.identifier}</dd>
      </dl>
      <div className="mt-6 flex flex-col gap-4">
        <Field label="New password" required error={tooShort ? `At least ${PASSWORD_MIN_LENGTH} characters` : null} hint={`At least ${PASSWORD_MIN_LENGTH} characters`}>
          {(f) => <Input {...f} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} autoFocus />}
        </Field>
        <Field label="Confirm new password" required error={mismatch ? 'Passwords do not match' : null}>
          {(f) => <Input {...f} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={pending} disabled={next.length < PASSWORD_MIN_LENGTH || next !== confirm}>
          Set password and sign in
        </Button>
      </div>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border border-line-strong bg-surface p-6 shadow-hard rounded-card sm:p-8">
        {/* useSearchParams needs a Suspense boundary so the page can be prerendered. */}
        <Suspense fallback={<LoadingBlock label="Loading…" />}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
