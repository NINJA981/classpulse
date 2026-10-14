'use client';
import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RefreshCw, Rocket, RotateCw, Settings2 } from 'lucide-react';
import type { CoolifyNotConfigured, DeployActionResult, DeployedApp, DeploymentList, DeploymentLogs, DeploymentSummary } from '@classiq/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { opsKeys, TypedConfirmDialog } from './ops-common';

type Action = 'redeploy' | 'restart';

function deployTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'finished') return 'success';
  if (status === 'failed' || status.startsWith('cancelled')) return 'danger';
  if (status === 'in_progress' || status === 'queued') return 'warning';
  return 'neutral';
}

function appTone(status: string | null): 'success' | 'danger' | 'warning' | 'neutral' {
  if (!status) return 'neutral';
  if (status.startsWith('running')) return status.includes('unhealthy') ? 'warning' : 'success';
  if (status.startsWith('exited') || status.startsWith('stopped')) return 'danger';
  return 'warning';
}

function NotConfigured({ info }: { info: CoolifyNotConfigured }) {
  return (
    <Card>
      <CardHeader eyebrow="Setup needed" title="Coolify is not connected" />
      <CardBody>
        <p className="mb-3 text-sm text-ink-2">The deployments page talks to Coolify with a least-privilege API token. To turn it on:</p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink">
          {info.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function BuildLog({ id }: { id: string }) {
  const logs = useQuery({
    queryKey: opsKeys.deploymentLogs(id),
    queryFn: () => api.get<DeploymentLogs | CoolifyNotConfigured>(`/platform/ops/deployments/${encodeURIComponent(id)}/logs`),
  });
  if (logs.isPending) return <Skeleton className="h-24 w-full" />;
  if (logs.error) return <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />;
  if (!logs.data.configured) return null;
  if (logs.data.lines.length === 0) {
    return (
      <p className="text-sm text-muted">
        No build output available. Coolify only shares build logs with API tokens that have the “read:sensitive”
        permission — open this deployment in Coolify to read its log.
      </p>
    );
  }
  return (
    <pre
      tabIndex={0}
      aria-label={`Build log for deployment ${id}`}
      className="max-h-96 overflow-auto whitespace-pre-wrap break-all bg-surface-2 p-3 font-mono text-xs text-ink-2 rounded-control"
    >
      {logs.data.lines.map((l) => l.text).join('\n')}
    </pre>
  );
}

function DeploymentRow({ d }: { d: DeploymentSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <TR>
        <TD className="whitespace-nowrap">{formatDateTime(d.createdAt)}</TD>
        <TD>
          <Badge tone={deployTone(d.status)}>{d.status.replace(/_/g, ' ')}</Badge>
        </TD>
        <TD className="font-mono text-xs">{d.commit ?? '—'}</TD>
        <TD className="max-w-64 truncate text-ink-2">{d.commitMessage ?? '—'}</TD>
        <TD className="whitespace-nowrap tabular-nums">{formatDuration(d.durationSec)}</TD>
        <TD className="text-right">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} build log for ${d.commit ?? d.id}`}
            icon={open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            onClick={() => setOpen((o) => !o)}
          >
            Build log
          </Button>
        </TD>
      </TR>
      {open && (
        <tr className="border-b border-line">
          <td colSpan={6} className="px-4 py-3">
            <BuildLog id={d.id} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function OpsDeploymentsView() {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Action | null>(null);

  const app = useQuery({
    queryKey: opsKeys.app,
    queryFn: () => api.get<DeployedApp | CoolifyNotConfigured>('/platform/ops/app'),
    refetchInterval: 30_000,
  });
  const history = useQuery({
    queryKey: opsKeys.deployments,
    queryFn: () => api.get<DeploymentList | CoolifyNotConfigured>('/platform/ops/deployments'),
    refetchInterval: (q) => (q.state.data?.configured && q.state.data.items.some((d) => d.status === 'in_progress' || d.status === 'queued') ? 5_000 : 30_000),
  });

  const act = useMutation({
    mutationFn: (a: Action) =>
      api.post<DeployActionResult | CoolifyNotConfigured>(`/platform/ops/${a}`, { confirm: a === 'redeploy' ? 'REDEPLOY' : 'RESTART' }),
    onSuccess: (r) => {
      toast(r.configured ? r.message : 'Coolify is not configured', r.configured ? 'success' : 'error');
      setConfirming(null);
      void qc.invalidateQueries({ queryKey: opsKeys.app });
      void qc.invalidateQueries({ queryKey: opsKeys.deployments });
    },
  });

  const configured = app.data?.configured !== false;
  const actions = configured ? (
    <>
      <Button variant="secondary" icon={<RotateCw className="size-4" aria-hidden />} disabled={!app.data} onClick={() => setConfirming('restart')}>
        Restart
      </Button>
      <Button icon={<Rocket className="size-4" aria-hidden />} disabled={!app.data} onClick={() => setConfirming('redeploy')}>
        Redeploy
      </Button>
    </>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Deployments" description="The running version, recent builds and server control through Coolify." actions={actions} />

      {app.isPending ? (
        <LoadingBlock label="Contacting Coolify…" />
      ) : app.error ? (
        <Card>
          <ErrorState error={app.error} onRetry={() => void app.refetch()} />
        </Card>
      ) : !app.data.configured ? (
        <NotConfigured info={app.data} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              eyebrow="Current version"
              title={app.data.name ?? 'ClassIQ'}
              actions={
                <Button variant="ghost" size="sm" aria-label="Refresh status" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => void app.refetch()}>
                  Refresh
                </Button>
              }
            />
            <CardBody>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="eyebrow">Status</dt>
                  <dd className="mt-1">
                    <Badge tone={appTone(app.data.status)}>{app.data.status ?? 'unknown'}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Deployed commit</dt>
                  <dd className="mt-1 font-mono text-sm font-bold">{app.data.currentCommit ?? '—'}</dd>
                </div>
                <div>
                  <dt className="eyebrow">This API build</dt>
                  <dd className="mt-1 font-mono text-sm font-bold">{app.data.runningVersion}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Branch · last online</dt>
                  <dd className="mt-1 text-sm">
                    {app.data.gitBranch ?? '—'} · {formatRelative(app.data.lastOnlineAt)}
                  </dd>
                </div>
              </dl>
              {app.data.fqdn && <p className="mt-4 break-all text-xs text-muted">Domains: {app.data.fqdn}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="History" title="Recent deployments" />
            {history.isPending ? (
              <LoadingBlock label="Loading deployments…" />
            ) : history.error ? (
              <ErrorState error={history.error} onRetry={() => void history.refetch()} />
            ) : !history.data.configured || history.data.items.length === 0 ? (
              <EmptyState icon={<Settings2 className="size-8" aria-hidden />} title="No deployments yet" description="Deployments started from Coolify or this page appear here." />
            ) : (
              <Table aria-label="Recent deployments">
                <THead>
                  <tr>
                    <TH>Started</TH>
                    <TH>Status</TH>
                    <TH>Commit</TH>
                    <TH>Message</TH>
                    <TH>Duration</TH>
                    <TH>
                      <span className="sr-only">Build log</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {history.data.items.map((d) => (
                    <DeploymentRow key={d.id} d={d} />
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      <TypedConfirmDialog
        open={confirming === 'redeploy'}
        onClose={() => {
          act.reset();
          setConfirming(null);
        }}
        title="Redeploy ClassIQ?"
        description="Coolify builds the latest commit and replaces the running containers. Live classes may be interrupted briefly."
        word="REDEPLOY"
        actionLabel="Redeploy now"
        pending={act.isPending}
        error={act.error}
        onConfirm={() => act.mutate('redeploy')}
      />
      <TypedConfirmDialog
        open={confirming === 'restart'}
        onClose={() => {
          act.reset();
          setConfirming(null);
        }}
        title="Restart the app?"
        description="All containers restart without rebuilding. Everyone is disconnected for a few seconds."
        word="RESTART"
        actionLabel="Restart now"
        pending={act.isPending}
        error={act.error}
        onConfirm={() => act.mutate('restart')}
      />
    </>
  );
}
