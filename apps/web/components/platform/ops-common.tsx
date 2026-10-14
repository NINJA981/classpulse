'use client';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OpsStatus, PlatformSchool } from '@classiq/shared';
import { Badge, Button, Dialog, Field, InlineError, Input, StatusDot } from '@/components/ui';
import { api } from '@/lib/api';

/** Query keys for the ops pages. */
export const opsKeys = {
  health: ['platform', 'ops', 'health'] as const,
  history: (hours: number) => ['platform', 'ops', 'health-history', hours] as const,
  failed: (queue: string) => ['platform', 'ops', 'failed', queue] as const,
  logs: (filters: object) => ['platform', 'ops', 'logs', filters] as const,
  audit: (filters: object) => ['platform', 'ops', 'audit', filters] as const,
  app: ['platform', 'ops', 'app'] as const,
  deployments: ['platform', 'ops', 'deployments'] as const,
  deploymentLogs: (id: string) => ['platform', 'ops', 'deployment-logs', id] as const,
  schools: ['platform', 'schools', 'options'] as const,
};

export const STATUS_LABEL: Record<OpsStatus, string> = { ok: 'Healthy', degraded: 'Degraded', down: 'Down', unknown: 'Unknown' };

export function statusTone(s: OpsStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  return s === 'ok' ? 'success' : s === 'degraded' ? 'warning' : s === 'down' ? 'danger' : 'neutral';
}

export function OpsStatusDot({ status }: { status: OpsStatus }) {
  return <StatusDot tone={statusTone(status)} label={STATUS_LABEL[status]} />;
}

export function OpsStatusBadge({ status, children }: { status: OpsStatus; children?: ReactNode }) {
  const tone = statusTone(status);
  return <Badge tone={tone === 'neutral' ? 'neutral' : tone}>{children ?? STATUS_LABEL[status]}</Badge>;
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatAge(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min`;
  return `${Math.floor(sec / 86400)} d ${Math.floor((sec % 86400) / 3600)} h`;
}

/** Same-origin download of a CSV export with the current filters. */
export function downloadCsv(path: string, query: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  window.location.assign(`/api${path}${s ? `?${s}` : ''}`);
}

/** School options for filters. Tolerates the schools endpoint being unavailable (empty list). */
export function useSchoolOptions() {
  return useQuery({
    queryKey: opsKeys.schools,
    queryFn: async () => {
      try {
        const data = await api.get<PlatformSchool[] | { items: PlatformSchool[] }>('/platform/schools');
        const list = Array.isArray(data) ? data : (data?.items ?? []);
        return list.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        return [] as { id: string; name: string }[];
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Convert a `<input type="datetime-local">` value to an ISO timestamp (or undefined). */
export function localToIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface TypedConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  word: string;
  actionLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: unknown;
}

/** Dialog that only enables its action once the user types the exact confirmation word. */
export function TypedConfirmDialog(props: TypedConfirmProps) {
  // Remount on open/close so the typed word never carries over to the next confirmation.
  return <TypedConfirm key={props.open ? 'open' : 'closed'} {...props} />;
}

function TypedConfirm({
  open,
  onClose,
  title,
  description,
  word,
  actionLabel,
  onConfirm,
  pending,
  error,
}: TypedConfirmProps) {
  const [typed, setTyped] = useState('');
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" disabled={typed !== word} loading={pending} onClick={onConfirm}>
            {actionLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed === word) onConfirm();
        }}
      >
        <Field label={`Type ${word} to confirm`}>
          {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}
        </Field>
        <InlineError error={error} />
      </form>
    </Dialog>
  );
}
