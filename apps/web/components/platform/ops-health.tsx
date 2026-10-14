'use client';
import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw } from 'lucide-react';
import type { OpsComponentBase, OpsProviderHealth, PlatformHealth, ProviderTestResult } from '@classiq/shared';
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { formatAge, formatBytes, opsKeys, OpsStatusDot, STATUS_LABEL } from './ops-common';
import { HealthHistoryCard } from './ops-health-history';
import { QueuesCard } from './ops-queues';

const BANNER: Record<PlatformHealth['status'], string> = {
  ok: 'border-success/40 bg-success-soft text-success',
  degraded: 'border-warning/40 bg-warning-soft text-warning',
  down: 'border-danger/40 bg-danger-soft text-danger',
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function ComponentCard({
  title,
  c,
  children,
  actions,
}: {
  title: string;
  c: OpsComponentBase;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex flex-col" aria-label={`${title}: ${STATUS_LABEL[c.status]}`} role="region">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h2 className="font-display text-base font-extrabold text-ink">{title}</h2>
        <OpsStatusDot status={c.status} />
      </div>
      <CardBody className="flex flex-1 flex-col gap-3 pt-2">
        <p className="text-sm text-ink-2">{c.detail}</p>
        {children && <dl>{children}</dl>}
        {actions && <div className="mt-auto flex flex-wrap gap-2 pt-1">{actions}</div>}
      </CardBody>
    </Card>
  );
}

function Gauge({ percent, label }: { percent: number | null; label: string }) {
  const v = percent ?? 0;
  const tone = v > 95 ? 'bg-danger' : v > 85 ? 'bg-warning' : 'bg-success';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums">{percent === null ? '—' : `${percent}%`}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="h-3 w-full overflow-hidden border border-line bg-surface-2 rounded-control"
      >
        <div className={clsx('h-full', tone)} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
      </div>
    </div>
  );
}

function ProviderCard({ p }: { p: OpsProviderHealth }) {
  const toast = useToast();
  const [result, setResult] = useState<ProviderTestResult | null>(null);
  const name = p.provider === 'openai' ? 'OpenAI' : 'Sarvam';
  const test = useMutation({
    mutationFn: () => api.post<ProviderTestResult>(`/platform/ops/providers/${p.provider}/test`),
    onSuccess: (r) => {
      setResult(r);
      toast(`${name}: ${r.message}`, r.ok ? 'success' : 'error');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  return (
    <ComponentCard
      title={`${name} provider`}
      c={p}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={<PlugZap className="size-3.5" aria-hidden />}
          loading={test.isPending}
          disabled={!p.configured}
          onClick={() => test.mutate()}
        >
          Test {name}
        </Button>
      }
    >
      <Detail label="API key">{p.configured ? 'Configured' : 'Not set'}</Detail>
      <Detail label="Last success">{formatRelative(p.lastSuccessAt)}</Detail>
      <Detail label="Last failure">
        {p.lastFailureAt ? `${formatRelative(p.lastFailureAt)}${p.lastErrorCode ? ` (${p.lastErrorCode})` : ''}` : 'none'}
      </Detail>
      <Detail label="Failures (1 h)">{p.failuresLastHour}</Detail>
      {result && (
        <p role="status" className={clsx('pt-2 text-xs font-semibold', result.ok ? 'text-success' : 'text-danger')}>
          Test: {result.message}
          {result.latencyMs !== null && ` · ${result.latencyMs} ms`}
        </p>
      )}
    </ComponentCard>
  );
}

export function OpsHealthView() {
  const health = useQuery({
    queryKey: opsKeys.health,
    queryFn: () => api.get<PlatformHealth>('/platform/ops/health'),
    refetchInterval: 15_000,
  });

  const header = (
    <PageHeader
      eyebrow="Operations"
      title="Health"
      description="Live status of every dependency. Refreshes every 15 seconds."
      actions={
        <Button
          variant="secondary"
          icon={<RefreshCw className="size-4" aria-hidden />}
          loading={health.isFetching}
          onClick={() => void health.refetch()}
        >
          Refresh now
        </Button>
      }
    />
  );

  if (health.isPending) {
    return (
      <>
        {header}
        <LoadingBlock label="Checking every component…" />
      </>
    );
  }
  if (health.error) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={health.error} onRetry={() => void health.refetch()} />
        </Card>
      </>
    );
  }

  const h = health.data;
  const statusWord: Record<PlatformHealth['status'], string> = {
    ok: 'All systems healthy',
    degraded: 'Some components need attention',
    down: 'A critical component is down',
  };

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <section
          aria-label="Overall status"
          className={clsx('flex flex-col gap-1 border px-5 py-4 rounded-card sm:flex-row sm:items-center sm:justify-between', BANNER[h.status])}
        >
          <p className="flex items-center gap-2 font-display text-lg font-extrabold">
            {h.status === 'ok' ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
            {statusWord[h.status]}
          </p>
          <p className="text-xs font-semibold">Checked {formatDateTime(h.checkedAt)}</p>
        </section>

        <Card>
          <CardHeader title="Alerts" actions={<Badge tone={h.alerts.length ? 'warning' : 'success'}>{h.alerts.length}</Badge>} />
          <CardBody>
            {h.alerts.length === 0 ? (
              <p className="text-sm text-muted">No alerts. Everything that is checked looks fine.</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Active alerts">
                {h.alerts.map((a) => (
                  <li
                    key={a.id}
                    className={clsx(
                      'flex items-start gap-2 border px-3 py-2 text-sm font-semibold rounded-control',
                      a.severity === 'critical' ? 'border-danger/40 bg-danger-soft text-danger' : 'border-warning/40 bg-warning-soft text-warning',
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="sr-only">{a.severity === 'critical' ? 'Critical: ' : 'Warning: '}</span>
                      {a.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ComponentCard title="Database" c={h.database}>
            <Detail label="Latency">{h.database.latencyMs === null ? '—' : `${h.database.latencyMs} ms`}</Detail>
            <Detail label="Size">{formatBytes(h.database.sizeBytes)}</Detail>
            <Detail label="Connections">
              {h.database.activeConnections ?? '—'} active / {h.database.totalConnections ?? '—'}
            </Detail>
          </ComponentCard>
          <ComponentCard title="Redis" c={h.redis}>
            <Detail label="Latency">{h.redis.latencyMs === null ? '—' : `${h.redis.latencyMs} ms`}</Detail>
            <Detail label="Memory used">{h.redis.usedMemoryHuman ?? '—'}</Detail>
          </ComponentCard>
          <ComponentCard title="Worker" c={h.worker}>
            <Detail label="Heartbeat">{h.worker.heartbeatAgeSec === null ? '—' : `${formatAge(h.worker.heartbeatAgeSec)} ago`}</Detail>
            <Detail label="Version">
              <span title={h.worker.version ?? undefined}>{h.worker.version ? h.worker.version.slice(0, 7) : '—'}</span>
            </Detail>
            <Detail label="Started">{formatRelative(h.worker.startedAt)}</Detail>
          </ComponentCard>
          <ComponentCard title="API process" c={h.api}>
            <Detail label="Uptime">{formatAge(h.api.uptimeSec)}</Detail>
            <Detail label="Memory (RSS)">{formatBytes(h.api.rssBytes)}</Detail>
            <Detail label="Heap used">{formatBytes(h.api.heapUsedBytes)}</Detail>
            <Detail label="Node / version">
              {h.api.nodeVersion} · <span title={h.api.version}>{h.api.version.slice(0, 7)}</span>
            </Detail>
          </ComponentCard>
          <ComponentCard title="Storage" c={h.storage}>
            <div className="pb-2">
              <Gauge percent={h.storage.usedPercent} label="Disk used" />
            </div>
            <Detail label="Free">{formatBytes(h.storage.freeBytes)}</Detail>
            <Detail label="Lesson audio">{formatBytes(h.storage.audioBytes)}</Detail>
            <Detail label="Submissions">{formatBytes(h.storage.submissionBytes)}</Detail>
          </ComponentCard>
          <ComponentCard title="Backups" c={h.backups}>
            <Detail label="Latest">{h.backups.latestFile ?? '—'}</Detail>
            <Detail label="Size">{formatBytes(h.backups.latestSizeBytes)}</Detail>
            <Detail label="Age">{h.backups.ageHours === null ? '—' : `${h.backups.ageHours} h`}</Detail>
            <Detail label="Daily / weekly kept">
              {h.backups.dailyCount} / {h.backups.weeklyCount}
            </Detail>
          </ComponentCard>
          <ComponentCard title="Email" c={h.email}>
            <Detail label="Configured">{h.email.configured ? 'Yes' : 'No'}</Detail>
            <Detail label="Sent (24 h)">{h.email.sentLast24h}</Detail>
            <Detail label="Failed (24 h)">{h.email.failedLast24h}</Detail>
            <Detail label="Invites sent / failed">
              {h.email.invitesSentLast24h} / {h.email.invitesFailedLast24h}
            </Detail>
          </ComponentCard>
          <ComponentCard title="Classroom devices" c={h.devices}>
            <Detail label="Online">{h.devices.online}</Detail>
            <Detail label="Recording">{h.devices.recording}</Detail>
            <Detail label="Offline">{h.devices.offline}</Detail>
            <Detail label="Error">{h.devices.error}</Detail>
          </ComponentCard>
          {h.providers.map((p) => (
            <ProviderCard key={p.provider} p={p} />
          ))}
        </div>

        <HealthHistoryCard />

        <QueuesCard queues={h.queues} />

        <Card>
          <CardHeader title="Largest tables" eyebrow="Database" />
          <CardBody>
            {h.database.tables.length === 0 ? (
              <p className="text-sm text-muted">Table sizes are unavailable.</p>
            ) : (
              <dl>
                {h.database.tables.map((t) => (
                  <Detail key={t.name} label={t.name}>
                    {formatBytes(t.totalBytes)} · ~{t.rows.toLocaleString('en-IN')} rows
                  </Detail>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

