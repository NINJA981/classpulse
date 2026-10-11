'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HealthHistory, HealthHistoryPoint } from '@classpulse/shared';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Field, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { opsKeys } from './ops-common';

const RANGES = [
  { hours: 6, label: 'Last 6 hours' },
  { hours: 24, label: 'Last 24 hours' },
  { hours: 24 * 7, label: 'Last 7 days' },
  { hours: 24 * 30, label: 'Last 30 days' },
];

const time = (iso: string, hours: number) =>
  new Intl.DateTimeFormat('en-IN', hours > 24 ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: HealthHistoryPoint }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="border border-line-strong bg-surface px-3 py-2 text-xs shadow-hard rounded-control">
      <p className="eyebrow">{formatDateTime(d.at)}</p>
      <p className="font-semibold text-ink">Status: {d.status}</p>
      <p className="text-ink-2">Database: {d.dbLatencyMs ?? '—'} ms</p>
      <p className="text-ink-2">Redis: {d.redisLatencyMs ?? '—'} ms</p>
      {d.failedJobs !== null && <p className="text-ink-2">Failed jobs: {d.failedJobs}</p>}
    </div>
  );
}

/** Uptime and latency from the 5-minute health snapshots. */
export function HealthHistoryCard() {
  const [hours, setHours] = useState(24);
  const history = useQuery({
    queryKey: opsKeys.history(hours),
    queryFn: () => api.get<HealthHistory>('/platform/ops/health/history', { hours }),
    refetchInterval: 60_000,
  });

  const points = history.data?.points ?? [];
  const bad = points.filter((p) => p.status !== 'ok').length;
  const maxDb = points.reduce((m, p) => Math.max(m, p.dbLatencyMs ?? 0), 0);

  return (
    <Card>
      <CardHeader
        eyebrow="History"
        title="Uptime and latency"
        actions={
          history.data?.uptimePercent != null ? (
            <Badge tone={history.data.uptimePercent >= 99 ? 'success' : 'warning'}>{history.data.uptimePercent}% healthy</Badge>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-4">
        <Field label="Time range" className="max-w-56">
          {(p) => (
            <Select {...p} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {RANGES.map((r) => (
                <option key={r.hours} value={r.hours}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {history.isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : points.length === 0 ? (
          <EmptyState title="No snapshots yet" description="A snapshot is stored every 5 minutes by the worker. Check back shortly." />
        ) : (
          <figure>
            <div className="h-56 w-full" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart accessibilityLayer={false} data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="var(--cp-line)" strokeDasharray="2 4" />
                  <XAxis
                    dataKey="at"
                    tickFormatter={(v: string) => time(v, hours)}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--cp-line-strong)' }}
                    tick={{ fill: 'var(--cp-muted)', fontSize: 11 }}
                    minTickGap={32}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--cp-muted)', fontSize: 11 }} unit=" ms" width={64} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="dbLatencyMs" name="Database" stroke="var(--cp-ink)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                  <Line
                    type="monotone"
                    dataKey="redisLatencyMs"
                    name="Redis"
                    stroke="var(--cp-muted)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                <span className="font-bold text-ink">—</span> Database latency
              </span>
              <span>
                <span className="font-bold text-muted">- -</span> Redis latency
              </span>
              <span className="sr-only">
                {points.length} snapshots; {bad} not fully healthy; highest database latency {maxDb} ms.
              </span>
            </figcaption>
          </figure>
        )}
      </CardBody>
    </Card>
  );
}
