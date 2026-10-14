'use client';
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, MailCheck } from 'lucide-react';
import clsx from 'clsx';
import type { EmailDelivery } from '@classiq/shared';
import { Button, Dialog, InlineError, useToast } from '@/components/ui';

/** Copies `value` to the clipboard. Icon-only unless `children` is given. */
export function CopyButton({
  value,
  label,
  children,
  size = 'sm',
  variant = 'secondary',
}: {
  value: string;
  /** Accessible name, e.g. "Copy join code". */
  label: string;
  children?: ReactNode;
  size?: 'sm' | 'md';
  variant?: 'secondary' | 'ghost' | 'primary';
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Copy failed. Select the text and copy it manually.', 'error');
    }
  }

  const icon = copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />;
  return (
    <Button
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={children ? undefined : label}
      title={label}
      icon={icon}
      className={clsx(!children && 'px-2')}
    >
      {children}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </Button>
  );
}

/** Confirmation dialog for destructive or irreversible actions. Shows the mutation error inline (e.g. a 409 message). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  error,
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: unknown;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-sm text-ink-2">{description}</div>
        <InlineError error={error} />
      </div>
    </Dialog>
  );
}

/** Warning callout (hairline border, soft fill). */
export function Callout({ tone = 'warning', title, children }: { tone?: 'warning' | 'danger' | 'info'; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === 'info' ? 'note' : 'alert'}
      className={clsx(
        'flex gap-3 border px-3 py-2.5 text-sm rounded-control',
        tone === 'warning' && 'border-warning/40 bg-warning-soft text-warning',
        tone === 'danger' && 'border-danger/40 bg-danger-soft text-danger',
        tone === 'info' && 'border-line bg-info-soft text-ink-2',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-bold">{title}</p>}
        <div className="font-medium">{children}</div>
      </div>
    </div>
  );
}

/** A secret (initial password, token) displayed in mono with a copy button. */
export function SecretValue({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <code
        aria-label={label}
        className="min-w-0 flex-1 select-all break-all border border-line-strong bg-surface-2 px-3 py-2 font-mono text-base font-bold rounded-control"
      >
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} size="md" />
    </div>
  );
}

/** Shows a generated password exactly once (and whether an invitation email went out). */
export function OneTimePasswordDialog({
  open,
  onClose,
  title,
  who,
  password,
  invite,
  email,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** e.g. "Asha Rao (asha@school.in)" */
  who: string;
  password: string | null;
  /** Set when the account was just created. */
  invite?: EmailDelivery;
  email?: string | null;
}) {
  const invited = invite === 'queued' && Boolean(email);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={`Initial password for ${who}.`}
      footer={<Button onClick={onClose}>I have saved it</Button>}
    >
      <div className="flex flex-col gap-4">
        {invited && (
          <p role="status" className="flex items-start gap-2 border border-line bg-success-soft px-3 py-2.5 text-sm font-semibold text-success rounded-control">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Invitation email sent to {email}</span>
          </p>
        )}
        {invite === 'email_disabled' && (
          <p className="text-sm text-muted">Email isn’t set up on this server, so no invitation was sent.</p>
        )}
        {password ? (
          <>
            <SecretValue value={password} label="Initial password" />
            <Callout title="This password is shown only once">
              {invited
                ? 'The email lets them choose their own password. This one-time password is a fallback in case the email doesn’t arrive — share it privately only if needed. '
                : 'Copy it now and share it privately. '}
              They will be asked to change it when they first sign in. If it is lost, reset the password again.
            </Callout>
          </>
        ) : (
          <p className="text-sm text-muted">The account was created with the password you provided.</p>
        )}
      </div>
    </Dialog>
  );
}

/** Small status-free label/value pair used in info cards. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** Triggers a client-side file download of `content`. */
export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
