'use client';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StatsBucket } from '@classiq/shared';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { bucketLabel } from './stats-common';

type NumericKey = { [K in keyof StatsBucket]: StatsBucket[K] extends number ? K : never }[keyof StatsBucket];

export interface StatsSeries {
  key: NumericKey;
  label: string;
  type: 'line' | 'bar';
  /** A design-token colour, e.g. var(--cp-ink). */
  color: string;
  dashed?: boolean;
  /** How the caption summarises the range: a total (default) or the highest value (e.g. daily active users). */
  aggregate?: 'sum' | 'max';
}

function ChartTooltip({
  active,
  payload,
  series,
  format,
  weekly,
}: {
  active?: boolean;
  payload?: readonly { payload?: StatsBucket }[];
  series: StatsSeries[];
  format: (n: number) => string;
  weekly: boolean;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="border border-line-strong bg-surface px-3 py-2 text-xs shadow-hard rounded-control">
      <p className="eyebrow">{weekly ? `Week of ${bucketLabel(d.bucket)}` : bucketLabel(d.bucket)}</p>
      {series.map((s) => (
        <p key={s.key} className="text-ink-2">
          {s.label}: <span className="font-semibold text-ink">{format(d[s.key])}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * One time-series chart (lines and/or bars) with a text legend and a screen-reader summary.
 * The chart itself is hidden from assistive tech; the totals in the caption carry the information.
 */
export function StatsChart({
  title,
  eyebrow,
  data,
  series,
  format = (n) => String(n),
  weekly = false,
}: {
  title: string;
  eyebrow?: string;
  data: StatsBucket[];
  series: StatsSeries[];
  format?: (n: number) => string;
  weekly?: boolean;
}) {
  const totals = series.map((s) => ({
    ...s,
    total: s.aggregate === 'max' ? data.reduce((n, b) => Math.max(n, b[s.key]), 0) : data.reduce((n, b) => n + b[s.key], 0),
  }));
  return (
    <Card className="min-w-0">
      <CardHeader eyebrow={eyebrow} title={title} />
      <CardBody>
        <figure>
          <div className="h-56 w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--cp-line)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v: string) => bucketLabel(v)}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--cp-line-strong)' }}
                  tick={{ fill: 'var(--cp-muted)', fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v: number) => format(v)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--cp-muted)', fontSize: 11 }}
                  width={64}
                />
                <Tooltip content={<ChartTooltip series={series} format={format} weekly={weekly} />} cursor={{ fill: 'var(--cp-surface-2)' }} />
                {series.map((s) =>
                  s.type === 'bar' ? (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} isAnimationActive={false} maxBarSize={28} />
                  ) : (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      strokeDasharray={s.dashed ? '4 3' : undefined}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {totals.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <svg width="16" height="8" aria-hidden className="shrink-0">
                  {s.type === 'bar' ? (
                    <rect width="16" height="8" fill={s.color} />
                  ) : (
                    <line x1="0" y1="4" x2="16" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
                  )}
                </svg>
                {s.label}: <span className="font-semibold text-ink">{format(s.total)}</span>{' '}
                {s.aggregate === 'max' ? `at most per ${weekly ? 'week' : 'day'}` : 'in total'}
              </span>
            ))}
          </figcaption>
        </figure>
      </CardBody>
    </Card>
  );
}
