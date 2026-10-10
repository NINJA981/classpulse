import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { optionLetter } from '@/components/teacher/status';

/**
 * Horizontal bars of how many students chose each option. Bar widths are
 * data-driven inline sizes; colours come from tokens.
 */
export function OptionDistribution({
  distribution,
  options,
  correctIndex,
  size = 'md',
}: {
  distribution: number[];
  options?: string[];
  correctIndex?: number | null;
  size?: 'md' | 'xl';
}) {
  const total = distribution.reduce((a, b) => a + b, 0);
  const xl = size === 'xl';
  return (
    <ul className={clsx(xl ? 'space-y-4' : 'space-y-2')}>
      {distribution.map((count, i) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        const correct = correctIndex === i;
        return (
          <li key={i}>
            <div className={clsx('mb-1 flex items-baseline justify-between gap-3', xl ? 'text-2xl' : 'text-sm')}>
              <span className={clsx('flex min-w-0 items-center gap-2', correct && 'font-bold')}>
                <span className="font-mono font-black">{optionLetter(i)}</span>
                {options?.[i] && <span className="truncate">{options[i]}</span>}
                {correct && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-success">
                    <CheckCircle2 className={xl ? 'size-6' : 'size-4'} aria-hidden />
                    <span className={xl ? 'text-xl' : 'text-xs'}>Correct</span>
                  </span>
                )}
              </span>
              <span className="shrink-0 font-bold tabular-nums">
                {count} <span className="font-normal text-muted">({pct}%)</span>
              </span>
            </div>
            <div className={clsx('w-full overflow-hidden bg-surface-2 rounded-control', xl ? 'h-6' : 'h-2.5')} aria-hidden>
              <div className={clsx('h-full', correct ? 'bg-success' : 'bg-muted')} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
