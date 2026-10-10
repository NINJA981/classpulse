import type { ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'solid';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  success: 'bg-success-soft text-success border-success/40',
  warning: 'bg-warning-soft text-warning border-warning/40',
  danger: 'bg-danger-soft text-danger border-danger/40',
  info: 'bg-info-soft text-ink-2 border-line',
  accent: 'bg-accent-soft text-ink border-line-strong',
  solid: 'bg-ink text-canvas border-ink',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-control',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small status dot + label (e.g. device online/offline). */
export function StatusDot({ tone, label }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-muted' }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={clsx('size-2 rounded-full', color)} aria-hidden />
      {label}
    </span>
  );
}
