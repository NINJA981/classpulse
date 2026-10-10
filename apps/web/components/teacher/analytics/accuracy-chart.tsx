'use client';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MasteryBand, QuestionAnalytics } from '@classpulse/shared';
import { Badge, type BadgeTone } from '@/components/ui';

/** Mastery band presentation; chart fills reference the design tokens (CSS variables), never raw colours. */
export const BAND: Record<MasteryBand, { label: string; tone: BadgeTone; fill: string; range: string }> = {
  critical: { label: 'Critical', tone: 'danger', fill: 'var(--cp-danger)', range: 'below 50%' },
  moderate: { label: 'Moderate', tone: 'warning', fill: 'var(--cp-warning)', range: '50–74%' },
  mastered: { label: 'Mastered', tone: 'success', fill: 'var(--cp-success)', range: '75% and above' },
};

export function BandBadge({ band }: { band: MasteryBand }) {
  return <Badge tone={BAND[band].tone}>{BAND[band].label}</Badge>;
}

/** Per-question accuracy, one bar per question coloured by mastery band. */
export function AccuracyChart({ questions }: { questions: QuestionAnalytics[] }) {
  const data = questions.map((q, i) => ({
    name: `Q${i + 1}`,
    accuracy: Math.round(q.accuracyPct),
    band: q.band,
    stem: q.stem,
    attempts: q.attempts,
  }));

  return (
    <figure>
      <div className="h-72 w-full" role="img" aria-label={`Accuracy per question: ${data.map((d) => `${d.name} ${d.accuracy}%`).join(', ')}`}>
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
                  <div className="max-w-xs border border-line-strong bg-surface p-3 text-xs shadow-pop">
                    <p className="font-bold">
                      {d.name} · {d.accuracy}% correct
                    </p>
                    <p className="mt-1 text-ink-2">{d.stem}</p>
                    <p className="mt-1 text-muted">
                      {d.attempts} {d.attempts === 1 ? 'answer' : 'answers'} · {BAND[d.band].label}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="accuracy" maxBarSize={56} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={BAND[d.band].fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(BAND) as MasteryBand[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <BandBadge band={b} /> {BAND[b].range}
          </span>
        ))}
        <span>Dashed line: mastery threshold (75%).</span>
      </figcaption>
    </figure>
  );
}
