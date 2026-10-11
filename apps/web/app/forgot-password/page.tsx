'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button, Field, InlineError, Input, Tabs } from '@/components/ui';
import { api } from '@/lib/api';

type Mode = 'staff' | 'student';

/**
 * Self-service reset: the API always answers 204, so the confirmation never reveals
 * whether an account exists or has an email address.
 */
export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>('staff');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  const ready = mode === 'staff' ? email.trim() !== '' : rollNumber.trim() !== '' && schoolCode.trim() !== '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post(
        '/auth/forgot-password',
        mode === 'staff' ? { email: email.trim() } : { rollNumber: rollNumber.trim(), institutionCode: schoolCode.trim() },
      );
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border border-line-strong bg-surface p-6 shadow-hard rounded-card sm:p-8">
        <p className="eyebrow">ClassPulse</p>
        <h1 className="font-display text-3xl font-black">Forgot your password?</h1>

        {sent ? (
          <div className="mt-6 flex flex-col gap-4">
            <p role="status" className="flex items-start gap-2 border border-line bg-success-soft px-3 py-3 text-sm font-semibold text-success rounded-control">
              <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>If an account matches, we&apos;ve emailed a reset link.</span>
            </p>
            <p className="text-sm text-muted">
              The link works once and expires after 72 hours. No email after a few minutes? Check your spam folder, or ask your
              school administrator to reset your password — they can also do it for accounts without an email address.
            </p>
            <Button variant="secondary" onClick={() => setSent(false)}>
              Try a different account
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">We&apos;ll email you a link to choose a new password.</p>
            <div className="mt-6">
              <Tabs
                label="Account type"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setError(null);
                }}
                tabs={[
                  { value: 'staff', label: 'Staff email' },
                  { value: 'student', label: 'Student' },
                ]}
              />
            </div>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
              {mode === 'staff' ? (
                <Field label="Email" required hint="The address you sign in with">
                  {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
                </Field>
              ) : (
                <>
                  <Field label="Roll number" required hint="As given by your school, e.g. 10B-01">
                    {(p) => <Input {...p} autoComplete="username" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />}
                  </Field>
                  <Field label="School code" required hint="Ask your teacher if you don’t know it. The link goes to the email your school has on file.">
                    {(p) => (
                      <Input {...p} autoComplete="organization" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} />
                    )}
                  </Field>
                </>
              )}
              <InlineError error={error} />
              <Button type="submit" size="lg" loading={pending} disabled={!ready}>
                Email me a reset link
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
