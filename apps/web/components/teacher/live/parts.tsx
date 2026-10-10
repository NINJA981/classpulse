'use client';
import clsx from 'clsx';
import { Crown, Timer, WifiOff } from 'lucide-react';
import type { LeaderboardEntry } from '@classpulse/shared';
import { useNow } from '@/components/teacher/hooks';
import { optionLetter } from '@/components/teacher/status';
import { secondsLeft, type Connection } from './use-live-host';

/** Countdown to a server deadline, corrected by the snapshot clock offset. */
export function Countdown({ closesAt, offsetMs, size = 'md' }: { closesAt: number; offsetMs: number; size?: 'md' | 'xl' }) {
  const now = useNow(250);
  const left = secondsLeft(closesAt, offsetMs, now);
  return (
    <div
      role="timer"
      aria-label={`${left} seconds left`}
      className={clsx(
        'inline-flex items-center gap-2 border font-display font-black tabular-nums rounded-control',
        left <= 5 ? 'border-danger bg-danger-soft text-danger' : 'border-line-strong bg-surface text-ink',
        size === 'xl' ? 'px-6 py-3 text-6xl' : 'px-3 py-1.5 text-2xl',
      )}
    >
      <Timer className={size === 'xl' ? 'size-12' : 'size-5'} aria-hidden />
      {left}s
    </div>
  );
}

export function ConnectionBanner({ connection }: { connection: Connection }) {
  if (connection !== 'reconnecting') return null;
  return (
    <p role="status" className="flex items-center gap-2 border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-bold text-warning rounded-control">
      <WifiOff className="size-4" aria-hidden /> Connection lost — reconnecting…
    </p>
  );
}

/** Ranked list of players. */
export function Leaderboard({ entries, limit = 10, size = 'md' }: { entries: LeaderboardEntry[]; limit?: number; size?: 'md' | 'xl' }) {
  if (entries.length === 0) return <p className={clsx('text-muted', size === 'xl' ? 'text-2xl' : 'text-sm')}>No scores yet.</p>;
  const xl = size === 'xl';
  return (
    <ol className={clsx('divide-y divide-line border-y border-line', xl && 'text-3xl')}>
      {entries.slice(0, limit).map((e) => (
        <li key={e.participantId} className={clsx('flex items-center gap-4', xl ? 'py-4' : 'py-2 text-sm')}>
          <span className={clsx('w-10 shrink-0 font-display font-black tabular-nums', e.rank === 1 && 'text-ink')}>#{e.rank}</span>
          <span className="min-w-0 flex-1 truncate font-bold">{e.name}</span>
          <span className="shrink-0 text-muted tabular-nums">{e.correct} correct</span>
          <span className="w-24 shrink-0 text-right font-display font-black tabular-nums">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** Top-three podium for the end of a quiz. */
export function Podium({ entries, size = 'md' }: { entries: LeaderboardEntry[]; size?: 'md' | 'xl' }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return <p className="text-muted">Nobody answered in this session.</p>;
  // Visual order: 2nd, 1st, 3rd.
  const order = [top[1], top[0], top[2]].filter((e): e is LeaderboardEntry => Boolean(e));
  const xl = size === 'xl';
  return (
    <ol className="flex items-end justify-center gap-3" aria-label="Podium">
      {order.map((e) => (
        <li key={e.participantId} className="flex w-1/3 max-w-60 flex-col items-center text-center">
          {e.rank === 1 && <Crown className={xl ? 'size-12' : 'size-7'} aria-hidden />}
          <p className={clsx('w-full truncate font-bold', xl ? 'text-3xl' : 'text-base')}>{e.name}</p>
          <p className={clsx('tabular-nums text-muted', xl ? 'text-2xl' : 'text-sm')}>{e.score} pts</p>
          <div
            className={clsx(
              'mt-2 flex w-full items-start justify-center border border-line-strong pt-3 font-display font-black rounded-control',
              e.rank === 1 ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink',
              e.rank === 1 ? (xl ? 'h-56' : 'h-32') : e.rank === 2 ? (xl ? 'h-40' : 'h-24') : xl ? 'h-28' : 'h-16',
              xl ? 'text-5xl' : 'text-2xl',
            )}
          >
            {e.rank}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Option tiles A–D. Highlights the correct option when known. */
export function OptionTiles({
  options,
  correctIndex,
  size = 'md',
}: {
  options: string[];
  correctIndex?: number | null;
  size?: 'md' | 'xl';
}) {
  const xl = size === 'xl';
  return (
    <ol className={clsx('grid gap-3', xl ? 'grid-cols-1 gap-5 md:grid-cols-2' : 'sm:grid-cols-2')}>
      {options.map((opt, i) => {
        const correct = correctIndex === i;
        return (
          <li
            key={i}
            className={clsx(
              'flex items-center gap-4 border rounded-control',
              correct ? 'border-success bg-success-soft' : 'border-line-strong bg-surface',
              xl ? 'p-6 text-3xl' : 'p-3 text-base',
            )}
          >
            <span
              className={clsx(
                'flex shrink-0 items-center justify-center border border-line-strong font-display font-black rounded-control',
                correct ? 'bg-success text-white' : 'bg-surface-2',
                xl ? 'size-16 text-4xl' : 'size-9 text-lg',
              )}
            >
              {optionLetter(i)}
            </span>
            <span className="min-w-0 flex-1 font-bold">{opt}</span>
            {correct && <span className={clsx('shrink-0 font-bold text-success', xl ? 'text-2xl' : 'text-xs')}>Correct</span>}
          </li>
        );
      })}
    </ol>
  );
}
