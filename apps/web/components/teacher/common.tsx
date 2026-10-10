'use client';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { Section } from '@classpulse/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, InlineError } from '@/components/ui';
import { api } from '@/lib/api';

/** Confirmation modal for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  error,
  danger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  error?: unknown;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Keep as is
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {description && <p className="text-ink-2">{description}</p>}
        {children}
        <InlineError error={error} />
      </div>
    </Dialog>
  );
}

/** Accessible determinate progress bar. Width is data-driven, colours are tokens. */
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={clsx('h-3 w-full overflow-hidden border border-line-strong bg-surface-2 rounded-control', className)}
    >
      <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The teacher's own sections (shared by several pages). */
export function useTeacherSections() {
  return useQuery({ queryKey: ['teacher', 'sections'], queryFn: () => api.get<Section[]>('/teacher/sections') });
}
