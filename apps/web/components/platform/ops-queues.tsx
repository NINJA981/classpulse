'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { FailedJob, OpsQueueHealth, OpsQueueName } from '@classiq/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  EmptyState,
  ErrorState,
  InlineError,
  LoadingBlock,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { opsKeys, OpsStatusDot } from './ops-common';

type Pending = { kind: 'retry' | 'remove'; job: FailedJob } | { kind: 'retry-all' } | null;

function FailedJobsDialog({ queue, open, onClose }: { queue: OpsQueueName; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const failed = useQuery({
    queryKey: opsKeys.failed(queue),
    queryFn: () => api.get<{ items: FailedJob[] }>(`/platform/ops/queues/${queue}/failed`, { limit: 50 }),
    enabled: open,
  });

  const act = useMutation({
    mutationFn: (p: NonNullable<Pending>) =>
      p.kind === 'retry-all'
        ? api.post<{ ok: true; retried: number }>(`/platform/ops/queues/${queue}/retry-all-failed`)
        : api.post(`/platform/ops/queues/${queue}/jobs/${encodeURIComponent(p.job.id)}/${p.kind}`),
    onSuccess: (_r, p) => {
      toast(p.kind === 'retry-all' ? 'All failed jobs were moved back to the queue' : p.kind === 'retry' ? 'Job queued for retry' : 'Job removed');
      setPending(null);
      void qc.invalidateQueries({ queryKey: opsKeys.failed(queue) });
      void qc.invalidateQueries({ queryKey: opsKeys.health });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const items = failed.data?.items ?? [];
  const confirmText =
    pending?.kind === 'retry-all'
      ? `Retry every failed job in the ${queue} queue?`
      : pending?.kind === 'retry'
        ? `Retry job ${pending.job.id}?`
        : pending?.kind === 'remove'
          ? `Remove job ${pending.job.id}? It will not run again.`
          : '';

  return (
    <Dialog
      open={open}
      onClose={() => {
        setPending(null);
        onClose();
      }}
      title={`Failed jobs: ${queue}`}
      description="The newest 50 failed jobs. Job data is summarised; email contents are never shown."
      size="lg"
      footer={
        pending ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-sm font-semibold text-ink sm:mr-auto">{confirmText}</p>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant={pending.kind === 'remove' ? 'danger' : 'primary'} loading={act.isPending} onClick={() => act.mutate(pending)}>
              {pending.kind === 'remove' ? 'Remove job' : pending.kind === 'retry' ? 'Retry job' : 'Retry all'}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            icon={<RotateCcw className="size-4" aria-hidden />}
            disabled={items.length === 0}
            onClick={() => setPending({ kind: 'retry-all' })}
          >
            Retry all failed
          </Button>
        )
      }
    >
      {failed.isPending ? (
        <LoadingBlock label="Loading failed jobs…" />
      ) : failed.error ? (
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No failed jobs" description="Nothing has failed in this queue." />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Failed jobs">
          {items.map((job) => (
            <li key={job.id} className="border border-line p-3 rounded-control">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs font-bold text-ink">{job.id}</p>
                  <p className="text-xs text-muted">
                    {job.name} · {job.attemptsMade} attempt{job.attemptsMade === 1 ? '' : 's'} · failed {formatDateTime(job.finishedAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="size-3.5" aria-hidden />}
                    aria-label={`Retry job ${job.id}`}
                    onClick={() => setPending({ kind: 'retry', job })}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="size-3.5" aria-hidden />}
                    aria-label={`Remove job ${job.id}`}
                    onClick={() => setPending({ kind: 'remove', job })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-danger">{job.failedReason}</p>
              <p className="mt-1 break-all font-mono text-xs text-ink-2">
                {Object.entries(job.summary)
                  .map(([k, v]) => `${k}: ${v ?? '—'}`)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <InlineError error={act.error} />
      </div>
    </Dialog>
  );
}

/** Queue counts with a failed-jobs drawer. */
export function QueuesCard({ queues }: { queues: OpsQueueHealth[] | null }) {
  const [open, setOpen] = useState<OpsQueueName | null>(null);
  return (
    <Card>
      <CardHeader eyebrow="Background jobs" title="Queues" />
      {queues === null ? (
        <CardBody>
          <p className="text-sm text-muted">Redis is not configured, so jobs run inside the API process and there are no queues to inspect.</p>
        </CardBody>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Queue</TH>
              <TH>Status</TH>
              <TH className="text-right">Waiting</TH>
              <TH className="text-right">Active</TH>
              <TH className="text-right">Delayed</TH>
              <TH className="text-right">Failed</TH>
              <TH className="text-right">Completed</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {queues.map((q) => (
              <TR key={q.name}>
                <TD className="font-semibold">{q.name}</TD>
                <TD>
                  <OpsStatusDot status={q.status} />
                </TD>
                <TD className="text-right tabular-nums">{q.counts?.waiting ?? '—'}</TD>
                <TD className="text-right tabular-nums">{q.counts?.active ?? '—'}</TD>
                <TD className="text-right tabular-nums">{q.counts?.delayed ?? '—'}</TD>
                <TD className="text-right font-bold tabular-nums">{q.counts?.failed ?? '—'}</TD>
                <TD className="text-right tabular-nums">{q.counts?.completed ?? '—'}</TD>
                <TD className="text-right">
                  <Button variant="secondary" size="sm" aria-label={`Failed jobs in ${q.name}`} onClick={() => setOpen(q.name)}>
                    Failed jobs
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {open && <FailedJobsDialog queue={open} open onClose={() => setOpen(null)} />}
    </Card>
  );
}
