'use client';
/**
 * Platform sign-in: password → authenticator code (or a recovery code). The first sign-in enrols
 * an authenticator app (QR code + setup key), then shows the recovery codes once; an account with
 * an issued password changes it before entering the console.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Copy } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  type PlatformAdmin,
  type PlatformEnrollResponse,
  type PlatformLoginResponse,
  type PlatformSessionResponse,
  type TotpEnrolment,
} from '@classpulse/shared';
import { Button, Checkbox, Field, InlineError, Input, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

type Step =
  | { kind: 'loading' }
  | { kind: 'password' }
  | { kind: 'enrol'; challengeToken: string; enrolment: TotpEnrolment }
  | { kind: 'code'; challengeToken: string; recovery: boolean }
  | { kind: 'recovery-codes'; codes: string[]; admin: PlatformAdmin }
  | { kind: 'change-password' };

/** Into the console (full navigation: the console layout must run again). */
const enterConsole = () => window.location.assign('/platform');

function Panel({ eyebrow = 'ClassPulse platform', title, description, children }: { eyebrow?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full max-w-md border border-line bg-surface p-6 rounded-card shadow-pop sm:p-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display text-2xl font-black">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, run, setError };
}

function QrImage({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { margin: 2, width: 200, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uri]);
  if (!src) return <Skeleton className="size-[200px]" />;
  // White quiet zone so phone cameras read it on the dark theme.
  return <img src={src} alt="QR code for your authenticator app" width={200} height={200} className="size-[200px] rounded-control bg-white" />;
}

const groupKey = (s: string) => s.replace(/(.{4})/g, '$1 ').trim();

function PasswordStep({ onNext }: { onNext: (res: PlatformLoginResponse) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, error, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => onNext(await api.post<PlatformLoginResponse>('/platform/auth/login', { email, password })));
  };
  return (
    <Panel title="Platform sign in" description="For ClassPulse operators only. School staff and students sign in on their school’s address.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" required>
          {(p) => <Input {...p} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" required>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={pending} disabled={!email || !password}>
          Continue
        </Button>
      </form>
    </Panel>
  );
}

function EnrolStep({ step, onDone, restart }: { step: Extract<Step, { kind: 'enrol' }>; onDone: (res: PlatformEnrollResponse) => void; restart: () => void }) {
  const [code, setCode] = useState('');
  const { pending, error, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => onDone(await api.post<PlatformEnrollResponse>('/platform/auth/enroll', { challengeToken: step.challengeToken, code })));
  };
  const expired = error instanceof ApiError && error.code === 'UNAUTHENTICATED' && /too long/.test(error.message);
  return (
    <Panel
      title="Set up two-factor sign-in"
      description="Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code it shows."
    >
      <div className="flex flex-col items-center gap-3">
        <QrImage uri={step.enrolment.otpauthUri} />
        <div className="w-full text-center">
          <p className="eyebrow">Setup key</p>
          <p className="mt-1 break-all font-mono text-sm font-bold" aria-label="Setup key">
            {groupKey(step.enrolment.secret)}
          </p>
          <p className="mt-1 text-xs text-muted">Can’t scan? Add the account manually with this key (time-based).</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Authenticator code" required>
          {(p) => (
            <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
          )}
        </Field>
        <InlineError error={error} />
        {expired ? (
          <Button size="lg" onClick={restart}>
            Start again
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={pending} disabled={code.replace(/\s/g, '').length !== 6}>
            Verify and continue
          </Button>
        )}
      </form>
    </Panel>
  );
}

function CodeStep({
  step,
  onDone,
  toggle,
  restart,
}: {
  step: Extract<Step, { kind: 'code' }>;
  onDone: (res: PlatformSessionResponse) => void;
  toggle: () => void;
  restart: () => void;
}) {
  const [value, setValue] = useState('');
  const { pending, error, run, setError } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = step.recovery ? { challengeToken: step.challengeToken, recoveryCode: value } : { challengeToken: step.challengeToken, code: value };
    void run(async () => onDone(await api.post<PlatformSessionResponse>('/platform/auth/verify', body)));
  };
  const expired = error instanceof ApiError && error.code === 'UNAUTHENTICATED' && /too long/.test(error.message);
  return (
    <Panel
      title={step.recovery ? 'Use a recovery code' : 'Enter your authenticator code'}
      description={
        step.recovery
          ? 'Each recovery code works once. Generate new ones in Settings afterwards.'
          : 'Open your authenticator app and enter the 6-digit code for ClassPulse.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {step.recovery ? (
          <Field label="Recovery code" required hint="Looks like abcd-2345">
            {(p) => <Input {...p} autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} />}
          </Field>
        ) : (
          <Field label="Authenticator code" required>
            {(p) => (
              <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </Field>
        )}
        <InlineError error={error} />
        {expired ? (
          <Button size="lg" onClick={restart}>
            Start again
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={pending} disabled={!value.trim()}>
            Verify
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setValue('');
            setError(null);
            toggle();
          }}
        >
          {step.recovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
        </Button>
      </form>
    </Panel>
  );
}

function RecoveryCodesStep({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(codes.join('\n')).catch(() => undefined);
    setCopied(true);
  };
  return (
    <Panel
      title="Save your recovery codes"
      description="If you lose your phone, each of these codes signs you in once. They are shown only now — store them somewhere safe (a password manager or printed copy)."
    >
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 border border-line bg-surface-2 p-4 font-mono text-sm font-bold rounded-control">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-3">
        <Button variant="secondary" size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <Checkbox label="I’ve saved these codes" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <Button size="lg" disabled={!saved} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </Panel>
  );
}

function ChangePasswordStep() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const { pending, error, run } = useSubmit();
  const mismatch = confirm.length > 0 && next !== confirm;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return;
    void run(async () => {
      await api.post<PlatformSessionResponse>('/platform/auth/change-password', { currentPassword: current, newPassword: next });
      enterConsole();
    });
  };
  return (
    <Panel title="Choose a new password" description="Replace the one-time password you were given before continuing.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
          Change password
        </Button>
      </form>
    </Panel>
  );
}

export function PlatformLogin() {
  const [step, setStep] = useState<Step>({ kind: 'loading' });

  // Already signed in? Continue (or finish the password change).
  useEffect(() => {
    api
      .get<PlatformSessionResponse>('/platform/auth/me')
      .then(({ admin }) => (admin.mustChangePassword ? setStep({ kind: 'change-password' }) : enterConsole()))
      .catch(() => setStep({ kind: 'password' }));
  }, []);

  const afterSignIn = (admin: PlatformAdmin) => (admin.mustChangePassword ? setStep({ kind: 'change-password' }) : enterConsole());
  const restart = () => setStep({ kind: 'password' });

  let content: ReactNode;
  switch (step.kind) {
    case 'loading':
      content = <Skeleton className="h-80 w-full max-w-md" />;
      break;
    case 'password':
      content = (
        <PasswordStep
          onNext={(res) =>
            setStep(
              res.enrolment
                ? { kind: 'enrol', challengeToken: res.challengeToken, enrolment: res.enrolment }
                : { kind: 'code', challengeToken: res.challengeToken, recovery: false },
            )
          }
        />
      );
      break;
    case 'enrol':
      content = (
        <EnrolStep step={step} restart={restart} onDone={(res) => setStep({ kind: 'recovery-codes', codes: res.recoveryCodes, admin: res.admin })} />
      );
      break;
    case 'code':
      content = (
        <CodeStep
          key={String(step.recovery)}
          step={step}
          restart={restart}
          toggle={() => setStep({ ...step, recovery: !step.recovery })}
          onDone={(res) => afterSignIn(res.admin)}
        />
      );
      break;
    case 'recovery-codes':
      content = <RecoveryCodesStep codes={step.codes} onContinue={() => afterSignIn(step.admin)} />;
      break;
    case 'change-password':
      content = <ChangePasswordStep />;
      break;
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      {content}
    </main>
  );
}
