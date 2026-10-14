'use client';
import clsx from 'clsx';
import { BLOOM_LEVELS, masteryBand, type BloomLevel, type MasteryBand } from '@classiq/shared';
import { BAND, BandBadge } from '@/components/teacher/analytics/accuracy-chart';
import { BLOOM_LABEL } from '@/components/teacher/lesson/bloom';

export { BAND, BandBadge, BLOOM_LABEL, BLOOM_LEVELS };

const CELL: Record<MasteryBand, string> = {
  critical: 'bg-danger-soft text-danger',
  moderate: 'bg-warning-soft text-warning',
  mastered: 'bg-success-soft text-success',
};

/** A heatmap cell: colour by mastery band, always with the value as text (and the band for screen readers). */
export function MasteryCell({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) {
    return (
      <span className={clsx('block rounded-control px-2 py-1 text-center text-xs text-muted', className)}>
        —<span className="sr-only">no answers yet</span>
      </span>
    );
  }
  const band = masteryBand(value);
  return (
    <span className={clsx('block rounded-control px-2 py-1 text-center text-xs font-bold tabular-nums', CELL[band], className)}>
      {Math.round(value)}%<span className="sr-only">, {BAND[band].label.toLowerCase()}</span>
    </span>
  );
}

/** Bloom levels that have data in at least one of the records. */
export function levelsWithData(records: Partial<Record<BloomLevel, number | null>>[]): BloomLevel[] {
  return BLOOM_LEVELS.filter((b) => records.some((r) => r[b] != null));
}

export function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {(Object.keys(BAND) as MasteryBand[]).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <BandBadge band={b} /> {BAND[b].range}
        </span>
      ))}
      <span>— means no answers yet.</span>
    </p>
  );
}
