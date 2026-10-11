'use client';
/**
 * Widgets for the platform overview page (placed by the overview owner):
 *   <OverviewKpis />    KPI tiles from GET /api/platform/stats/overview
 *   <AiCostBySchool />  this month's estimated AI cost per school
 * Both share one cached query, so rendering both costs a single request.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { PlatformOverviewStats } from '@classpulse/shared';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInt, formatUsd, statsKeys } from './stats-common';

function useOverviewStats() {
  return useQuery({
    queryKey: statsKeys.overview,
    queryFn: () => api.get<PlatformOverviewStats>('/platform/stats/overview'),
    refetchInterval: 60_000,
  });
}

export function OverviewKpis() {
  const q = useOverviewStats();
  if (q.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data;
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Schools" value={formatInt(o.schools)} hint={`${o.activeSchools} active · ${o.suspendedSchools} suspended`} />
      <StatCard label="Active users today" value={formatInt(o.activeUsersToday)} hint="Signed in since midnight (India time)" />
      <StatCard label="Lessons this week" value={formatInt(o.lessonsThisWeek)} hint="Created since Monday" />
      <StatCard label="AI cost this month" value={formatUsd(o.aiCostThisMonthUsd)} hint="Estimate — check your provider invoices" />
      <StatCard
        label="Failed AI calls (24 h)"
        value={<span className={o.aiFailures24h > 0 ? 'text-danger' : undefined}>{formatInt(o.aiFailures24h)}</span>}
        hint="Speech-to-text and AI generation"
      />
      <StatCard
        label="Failed emails (24 h)"
        value={<span className={o.emailsFailed24h > 0 ? 'text-danger' : undefined}>{formatInt(o.emailsFailed24h)}</span>}
        hint="Invites, resets and reminders"
      />
    </section>
  );
}

export function AiCostBySchool() {
  const q = useOverviewStats();
  return (
    <Card className="min-w-0">
      <CardHeader
        eyebrow="This month"
        title="AI cost by school"
        actions={
          <Link href="/platform/usage" className="inline-flex min-h-6 items-center text-xs font-bold text-muted underline-offset-2 hover:text-ink hover:underline">
            Usage & costs
          </Link>
        }
      />
      <CardBody className="flex flex-col gap-3">
        {q.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.aiCostBySchool.length === 0 ? (
          <EmptyState title="No AI cost yet this month" description="Costs appear once schools transcribe lessons or generate quizzes." />
        ) : (
          <>
            <ul className="flex flex-col gap-3" aria-label="Estimated AI cost per school this month">
              {q.data.aiCostBySchool.map((s) => {
                const max = q.data.aiCostBySchool[0]!.value || 1;
                return (
                  <li key={s.institutionId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink">{s.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">{formatUsd(s.value)}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-2 rounded-control" aria-hidden>
                      <div className="h-2 bg-ink rounded-control" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">{q.data.costNote}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
