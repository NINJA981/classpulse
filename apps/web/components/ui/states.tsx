import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { errorMessage } from '@/lib/api';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-muted', className)} aria-label={label} role="status" />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-surface-2 rounded-control', className)} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="text-muted">{icon ?? <Inbox className="size-8" aria-hidden />}</span>
      <p className="font-display text-base font-extrabold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <p className="font-bold">Couldn’t load this</p>
      <p className="max-w-md text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-bold underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger rounded-control">
      {errorMessage(error)}
    </p>
  );
}
