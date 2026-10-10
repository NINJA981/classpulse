'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LESSON_STATUSES } from '@classpulse/shared';
import { EmptyState } from '@/components/ui';
import { lessonStatusLabel } from './status';

interface Datum {
  status: string;
  label: string;
  count: number;
}

function toData(byStatus: Record<string, number>): Datum[] {
  const known: string[] = [...LESSON_STATUSES];
  const extra = Object.keys(byStatus).filter((k) => !known.includes(k));
  return [...known, ...extra].map((status) => ({ status, label: lessonStatusLabel(status), count: byStatus[status] ?? 0 }));
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Datum }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="border border-line-strong bg-surface px-3 py-2 text-xs shadow-hard rounded-control">
      <p className="eyebrow">{d.label}</p>
      <p className="font-display text-lg font-black tabular-nums text-ink">
        {d.count} {d.count === 1 ? 'lesson' : 'lessons'}
      </p>
    </div>
  );
}

/** Single-series bar chart of lessons per status, with an equivalent list for screen readers. */
export function LessonsByStatusChart({ byStatus }: { byStatus: Record<string, number> }) {
  const data = toData(byStatus);
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <EmptyState title="No lessons yet" description="Lessons appear here once teachers record or upload classes." />;
  }

  return (
    <figure>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--cp-line)" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--cp-line-strong)' }}
              tick={{ fill: 'var(--cp-muted)', fontSize: 11 }}
              interval={0}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--cp-muted)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--cp-surface-2)' }} content={<ChartTooltip />} />
            <Bar dataKey="count" fill="var(--cp-ink)" maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Lessons by status:
        <ul>
          {data.map((d) => (
            <li key={d.status}>
              {d.label}: {d.count}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
