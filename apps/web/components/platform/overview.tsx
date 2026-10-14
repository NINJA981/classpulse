'use client';
/**
 * Platform overview. School numbers come from GET /api/platform/schools; the KPI tiles and AI cost
 * widgets come from the statistics module (stats-overview-widgets.tsx) and the alerts from the ops
 * health aggregator.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, BellRing, Building2, GraduationCap, UserRound } from 'lucide-react';
import type { PlatformHealth, PlatformSchool } from '@classiq/shared';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { platformKeys } from './queries';
import { AiCostBySchool, OverviewKpis } from './stats-overview-widgets';
import { opsKeys } from './ops-common';

const nf = new Intl.NumberFormat('en-IN');

function SchoolTotals({ schools }: { schools: PlatformSchool[] }) {
  const sum = (k: keyof PlatformSchool['counts']) => schools.reduce((n, s) => n + s.counts[k], 0);
  const suspended = schools.filter((s) => s.status === 'suspended').length;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Schools"
        value={nf.format(schools.length)}
        hint={suspended ? `${suspended} suspended` : 'All active'}
        icon={<Building2 className="size-4" aria-hidden />}
      />
      <StatCard label="Teachers" value={nf.format(sum('teachers'))} hint={`${nf.format(sum('admins'))} admins`} icon={<GraduationCap className="size-4" aria-hidden />} />
      <StatCard label="Students" value={nf.format(sum('students'))} hint={`${nf.format(sum('lessons'))} lessons`} icon={<UserRound className="size-4" aria-hidden />} />
    </div>
  );
}

/** Alerts computed by the health aggregator (outages, failed jobs, stale backups, disk). */
function AlertsCard() {
  const health = useQuery({ queryKey: opsKeys.health, queryFn: () => api.get<PlatformHealth>('/platform/ops/health'), refetchInterval: 30_000 });
  const alerts = health.data?.alerts ?? [];
  return (
    <Card>
      <CardHeader
        eyebrow="Operations"
        title="Alerts"
        actions={
          <ButtonLink href="/platform/health" variant="secondary" size="sm">
            Open health
          </ButtonLink>
        }
      />
      <CardBody>
        {health.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : health.isError ? (
          <ErrorState error={health.error} onRetry={() => void health.refetch()} />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<BellRing className="size-7" aria-hidden />}
            title="No alerts"
            description="Component outages, failed jobs, stale backups and disk warnings appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Active alerts">
            {alerts.map((a) => (
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
  );
}

function RecentActivity({ schools }: { schools: PlatformSchool[] }) {
  const rows = [...schools].sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '')).slice(0, 6);
  return (
    <Card>
      <CardHeader eyebrow="Schools" title="Most recently active" actions={<ButtonLink href="/platform/schools" variant="secondary" size="sm">All schools</ButtonLink>} />
      <CardBody className="px-0 pb-2">
        <Table>
          <THead>
            <tr>
              <TH>School</TH>
              <TH>Status</TH>
              <TH className="text-right">Students</TH>
              <TH>Last activity</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/platform/schools/${s.id}`} className="font-bold hover:underline">
                    {s.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted">{s.code}</span>
                </TD>
                <TD>
                  <Badge tone={s.status === 'active' ? 'success' : 'danger'}>{s.status}</Badge>
                </TD>
                <TD className="text-right tabular-nums">{nf.format(s.counts.students)}</TD>
                <TD className="text-muted">{s.lastActivityAt ? formatRelative(s.lastActivityAt) : 'Never'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}

export function PlatformOverview() {
  const schools = useQuery({ queryKey: platformKeys.schoolList(''), queryFn: () => api.get<PlatformSchool[]>('/platform/schools') });

  return (
    <>
      <PageHeader eyebrow="Platform console" title="Overview" description="Every school on this installation at a glance." />
      <div className="flex flex-col gap-6">
        {schools.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : schools.isError ? (
          <Card>
            <ErrorState error={schools.error} onRetry={() => void schools.refetch()} />
          </Card>
        ) : schools.data.length === 0 ? (
          <Card>
            <EmptyState
              title="No schools yet"
              description="Create the first school and its admin account."
              action={<ButtonLink href="/platform/schools?new=1">New school</ButtonLink>}
            />
          </Card>
        ) : (
          <SchoolTotals schools={schools.data} />
        )}

        {/* Statistics module: activity and cost KPIs. */}
        <OverviewKpis />

        <div className="grid gap-6 lg:grid-cols-2">
          <AlertsCard />
          {/* Statistics module: this month's AI cost by school. */}
          <AiCostBySchool />
        </div>

        {schools.data && schools.data.length > 0 && <RecentActivity schools={schools.data} />}
      </div>
    </>
  );
}
