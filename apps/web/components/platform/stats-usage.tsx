'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  AI_USAGE_KIND_LABELS,
  type PlatformStats,
  type StatsCsvSection,
  type StatsGranularity,
  type StatsRanking,
} from '@classpulse/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
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
import { downloadCsv, formatBytes, useSchoolOptions } from './ops-common';
import { StatsChart } from './stats-charts';
import { formatCompact, formatInt, formatMinutes, formatUsd, statsDay, statsKeys } from './stats-common';

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

type Preset = (typeof PRESETS)[number]['days'] | 'custom';

const CSV_SECTIONS: { value: StatsCsvSection; label: string }[] = [
  { value: 'activity', label: 'Activity by day/week' },
  { value: 'schools', label: 'Per school' },
  { value: 'ai', label: 'AI by model and kind' },
];

export function UsageView() {
  const [preset, setPreset] = useState<Preset>(30);
  const [customFrom, setCustomFrom] = useState(statsDay(-29));
  const [customTo, setCustomTo] = useState(statsDay(0));
  const [institutionId, setInstitutionId] = useState('');
  const [granularity, setGranularity] = useState<StatsGranularity>('day');
  const [csvSection, setCsvSection] = useState<StatsCsvSection>('activity');
  const schools = useSchoolOptions();

  const from = preset === 'custom' ? customFrom : statsDay(-(preset - 1));
  const to = preset === 'custom' ? customTo : statsDay(0);
  const customInvalid = preset === 'custom' && (!customFrom || !customTo || customFrom > customTo);
  const filters = { from, to, granularity, institutionId: institutionId || undefined };

  const stats = useQuery({
    queryKey: statsKeys.stats(filters),
    queryFn: () => api.get<PlatformStats>('/platform/stats', filters),
    enabled: !customInvalid,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Platform"
        title="Usage & costs"
        description="Activity across schools and AI usage, with estimated costs. Days are counted in India time."
      />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-bold text-ink-2">Date range</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.days} size="sm" variant={preset === p.days ? 'primary' : 'secondary'} aria-pressed={preset === p.days} onClick={() => setPreset(p.days)}>
                  Last {p.label}
                </Button>
              ))}
              <Button size="sm" variant={preset === 'custom' ? 'primary' : 'secondary'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>
                Custom
              </Button>
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preset === 'custom' && (
              <>
                <Field label="From" error={customInvalid ? 'Choose a start date on or before the end date.' : null}>
                  {(p) => <Input {...p} type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />}
                </Field>
                <Field label="To">{(p) => <Input {...p} type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />}</Field>
              </>
            )}
            <Field label="School">
              {(p) => (
                <Select {...p} value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                  <option value="">All schools</option>
                  {(schools.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Group by">
              {(p) => (
                <Select {...p} value={granularity} onChange={(e) => setGranularity(e.target.value as StatsGranularity)}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
            <Field label="CSV contents" className="sm:w-64">
              {(p) => (
                <Select {...p} value={csvSection} onChange={(e) => setCsvSection(e.target.value as StatsCsvSection)}>
                  {CSV_SECTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button
              variant="secondary"
              icon={<Download className="size-4" aria-hidden />}
              disabled={customInvalid}
              onClick={() => downloadCsv('/platform/stats/export.csv', { ...filters, section: csvSection })}
            >
              Download CSV
            </Button>
          </div>
        </CardBody>
      </Card>

      {stats.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <UsageBody stats={stats.data} />
      )}
    </div>
  );
}

function UsageBody({ stats }: { stats: PlatformStats }) {
  const { totals, summary, series } = stats;
  const weekly = stats.range.granularity === 'week';
  return (
    <>
      <p className="border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-ink rounded-control" role="note">
        {stats.costNote}
      </p>

      <section aria-labelledby="usage-totals" className="flex flex-col gap-3">
        <h2 id="usage-totals" className="font-display text-lg font-extrabold text-ink">
          Totals
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Schools" value={formatInt(totals.schools)} hint={`${totals.activeSchools} active · ${totals.suspendedSchools} suspended`} />
          <StatCard label="People" value={formatInt(totals.admins + totals.teachers + totals.students)} hint={`${totals.admins} admins · ${totals.teachers} teachers · ${totals.students} students`} />
          <StatCard label="Sections" value={formatInt(totals.sections)} hint={`${totals.devices} classroom devices`} />
          <StatCard label="Active users" value={formatInt(summary.activeUsers)} hint="Signed in during this range" />
          <StatCard label="Lessons" value={formatInt(summary.lessonsCreated)} hint={`${summary.lessonsPublished} published · ${formatMinutes(summary.audioMinutes)} of audio`} />
          <StatCard label="Quiz attempts" value={formatInt(summary.quizAttempts)} hint={`${summary.liveSessions} live sessions · ${summary.livePlayers} players`} />
          <StatCard label="Exams & homework" value={formatInt(summary.examAttempts + summary.submissions)} hint={`${summary.examAttempts} exam attempts · ${summary.submissions} submissions`} />
          <StatCard label="Emails" value={formatInt(summary.emailsSent)} hint={`${summary.emailsFailed} failed`} />
          <StatCard label="AI calls" value={formatInt(summary.aiCalls)} hint={`${summary.aiFailures} failed`} />
          <StatCard label="AI tokens" value={formatCompact(summary.aiInputTokens + summary.aiOutputTokens)} hint={`${formatCompact(summary.aiInputTokens)} in · ${formatCompact(summary.aiOutputTokens)} out`} />
          <StatCard label="AI audio" value={formatMinutes(summary.aiAudioMinutes)} hint="Transcribed successfully" />
          <StatCard label="Estimated AI cost" value={formatUsd(summary.aiCostUsd)} hint="Estimate (USD)" />
        </div>
      </section>

      <section aria-labelledby="usage-charts" className="flex flex-col gap-3">
        <h2 id="usage-charts" className="font-display text-lg font-extrabold text-ink">
          {weekly ? 'Week by week' : 'Day by day'}
        </h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StatsChart
            eyebrow="Activity"
            title="Active users and quiz attempts"
            data={series}
            weekly={weekly}
            format={formatInt}
            series={[
              { key: 'activeUsers', label: 'Active users', type: 'line', color: 'var(--cp-ink)', aggregate: 'max' },
              { key: 'quizAttempts', label: 'Quiz attempts', type: 'line', color: 'var(--cp-muted)', dashed: true },
              { key: 'lessonsCreated', label: 'Lessons created', type: 'bar', color: 'var(--cp-accent)' },
            ]}
          />
          <StatsChart
            eyebrow="AI"
            title="AI calls and failures"
            data={series}
            weekly={weekly}
            format={formatInt}
            series={[
              { key: 'aiCalls', label: 'Calls', type: 'bar', color: 'var(--cp-ink)' },
              { key: 'aiFailures', label: 'Failures', type: 'bar', color: 'var(--cp-danger)' },
            ]}
          />
          <StatsChart
            eyebrow="AI"
            title="AI tokens"
            data={series}
            weekly={weekly}
            format={formatCompact}
            series={[
              { key: 'aiInputTokens', label: 'Input tokens', type: 'line', color: 'var(--cp-ink)' },
              { key: 'aiOutputTokens', label: 'Output tokens', type: 'line', color: 'var(--cp-muted)', dashed: true },
            ]}
          />
          <StatsChart
            eyebrow="Audio"
            title="Audio minutes"
            data={series}
            weekly={weekly}
            format={(n) => formatMinutes(Math.round(n * 10) / 10)}
            series={[
              { key: 'audioMinutes', label: 'Recorded or uploaded', type: 'bar', color: 'var(--cp-accent)' },
              { key: 'aiAudioMinutes', label: 'Transcribed by AI', type: 'line', color: 'var(--cp-ink)' },
            ]}
          />
          <StatsChart
            eyebrow="Estimate"
            title="Estimated AI cost (USD)"
            data={series}
            weekly={weekly}
            format={formatUsd}
            series={[{ key: 'aiCostUsd', label: 'Estimated cost', type: 'bar', color: 'var(--cp-ink)' }]}
          />
          <RankingsCard byActivity={stats.rankings.byActivity} byAiCost={stats.rankings.byAiCost} />
        </div>
      </section>

      <SchoolTable stats={stats} />
      <AiTable stats={stats} />
    </>
  );
}

function RankingList({ title, items, format }: { title: string; items: StatsRanking[]; format: (n: number) => string }) {
  return (
    <div className="min-w-0">
      <h3 className="eyebrow mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing in this range.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((r, i) => (
            <li key={r.institutionId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">
                <span className="tabular-nums text-muted">{i + 1}.</span> {r.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{format(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RankingsCard({ byActivity, byAiCost }: { byActivity: StatsRanking[]; byAiCost: StatsRanking[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader eyebrow="Rankings" title="Top schools" />
      <CardBody className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <RankingList title="By activity" items={byActivity} format={formatInt} />
        <RankingList title="By estimated AI cost" items={byAiCost} format={formatUsd} />
      </CardBody>
    </Card>
  );
}

function SchoolTable({ stats }: { stats: PlatformStats }) {
  const rows = [...stats.schools].sort((a, b) => b.activity - a.activity || a.name.localeCompare(b.name));
  return (
    <Card>
      <CardHeader eyebrow="Breakdown" title="Per school" />
      <CardBody className="px-0 pb-2">
        {rows.length === 0 ? (
          <div className="px-5">
            <EmptyState title="No schools yet" description="Create a school from the Schools page to see its usage here." />
          </div>
        ) : (
          <Table aria-label="Usage per school">
            <THead>
              <TR>
                <TH>School</TH>
                <TH className="text-right">Active users</TH>
                <TH className="text-right">Lessons</TH>
                <TH className="text-right">Quiz attempts</TH>
                <TH className="text-right">Exam attempts</TH>
                <TH className="text-right">Submissions</TH>
                <TH className="text-right">AI calls</TH>
                <TH className="text-right">AI audio</TH>
                <TH className="text-right">Est. AI cost</TH>
                <TH className="text-right">Storage</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.institutionId}>
                  <TD>
                    <div className="flex min-w-40 flex-col gap-0.5">
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {s.code} · {s.teachers} teachers · {s.students} students
                        {s.status === 'suspended' && <Badge tone="warning">Suspended</Badge>}
                      </span>
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums">{formatInt(s.activeUsers)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(s.lessonsCreated)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(s.quizAttempts)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(s.examAttempts)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(s.submissions)}</TD>
                  <TD className="text-right tabular-nums">
                    {formatInt(s.aiCalls)}
                    {s.aiFailures > 0 && <span className="block text-xs text-danger">{s.aiFailures} failed</span>}
                  </TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">{formatMinutes(s.aiAudioMinutes)}</TD>
                  <TD className="text-right tabular-nums">{formatUsd(s.aiCostUsd)}</TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">{formatBytes(s.storageBytes)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function AiTable({ stats }: { stats: PlatformStats }) {
  return (
    <Card>
      <CardHeader eyebrow="Breakdown" title="AI by model and kind" />
      <CardBody className="px-0 pb-2">
        {stats.ai.length === 0 ? (
          <div className="px-5">
            <EmptyState title="No AI usage in this range" description="AI calls are recorded when lessons are transcribed, quizzes generated, or work is graded." />
          </div>
        ) : (
          <Table aria-label="AI usage by model and kind">
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Used for</TH>
                <TH className="text-right">Calls</TH>
                <TH className="text-right">Failures</TH>
                <TH className="text-right">Input tokens</TH>
                <TH className="text-right">Output tokens</TH>
                <TH className="text-right">Audio</TH>
                <TH className="text-right">Est. cost</TH>
              </TR>
            </THead>
            <TBody>
              {stats.ai.map((a) => (
                <TR key={`${a.provider}:${a.model}:${a.kind}`}>
                  <TD>
                    <div className="flex min-w-32 flex-col gap-0.5">
                      <span className="font-semibold text-ink">{a.model}</span>
                      <span className="text-xs text-muted">{a.provider}</span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">{AI_USAGE_KIND_LABELS[a.kind] ?? a.kind}</TD>
                  <TD className="text-right tabular-nums">{formatInt(a.calls)}</TD>
                  <TD className={a.failures > 0 ? 'text-right tabular-nums text-danger' : 'text-right tabular-nums'}>{formatInt(a.failures)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(a.inputTokens)}</TD>
                  <TD className="text-right tabular-nums">{formatInt(a.outputTokens)}</TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">{a.audioMinutes ? formatMinutes(a.audioMinutes) : '—'}</TD>
                  <TD className="text-right tabular-nums whitespace-nowrap">
                    {a.priced ? formatUsd(a.costUsd) : <Badge tone="warning">No price rate</Badge>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {stats.ai.some((a) => !a.priced) && (
          <p className="px-5 pt-3 text-xs text-muted">Models marked “No price rate” count as $0. Add their rates in Settings → AI price rates.</p>
        )}
      </CardBody>
    </Card>
  );
}
