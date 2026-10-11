'use client';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { masteryBand, type SectionInsights } from '@classpulse/shared';
import { BAND, BLOOM_LABEL, levelsWithData } from './common';

/** Class accuracy per Bloom level (levels without answers are left out and named below the chart). */
export function BloomChart({ byBloom }: { byBloom: SectionInsights['byBloom'] }) {
  const levels = levelsWithData([byBloom]);
  const data = levels.map((b) => {
    const v = byBloom[b]!;
    return { name: BLOOM_LABEL[b], accuracy: Math.round(v), band: masteryBand(v) };
  });
  const missing = (Object.keys(BLOOM_LABEL) as (keyof typeof BLOOM_LABEL)[]).filter((b) => !levels.includes(b));
  return (
    <figure>
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Class accuracy by Bloom level: ${data.map((d) => `${d.name} ${d.accuracy}%`).join(', ') || 'no data'}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--cp-line)" />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: 'var(--cp-line-strong)' }} tick={{ fill: 'var(--cp-muted)', fontSize: 12 }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: 'var(--cp-muted)', fontSize: 12 }} />
            <ReferenceLine y={75} stroke="var(--cp-line-strong)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: 'var(--cp-surface-2)' }}
              content={({ active, payload }) => {
                const d = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                if (!d) return null;
                return (
                  <div className="border border-line-strong bg-surface p-3 text-xs shadow-pop">
                    <p className="font-bold">
                      {d.name} · {d.accuracy}% correct
                    </p>
                    <p className="mt-1 text-muted">{BAND[d.band].label}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="accuracy" maxBarSize={64} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={BAND[d.band].fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Dashed line: mastery threshold (75%).
        {missing.length > 0 && ` No questions answered yet at: ${missing.map((b) => BLOOM_LABEL[b]).join(', ')}.`}
      </figcaption>
    </figure>
  );
}
