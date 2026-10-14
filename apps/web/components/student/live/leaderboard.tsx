import clsx from 'clsx';
import { Medal } from 'lucide-react';
import type { LeaderboardEntry } from '@classiq/shared';

/** Top N entries, plus the current student's row if they're outside the top N. */
export function Leaderboard({ entries, meId, top = 5 }: { entries: LeaderboardEntry[]; meId: string; top?: number }) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const shown = sorted.slice(0, top);
  const me = sorted.find((e) => e.studentId === meId);
  const rows = me && !shown.includes(me) ? [...shown, me] : shown;

  return (
    <ol className="flex flex-col gap-2" aria-label="Leaderboard">
      {rows.map((e, i) => {
        const isMe = e.studentId === meId;
        const gap = i > 0 && rows[i - 1] && e.rank - rows[i - 1]!.rank > 1;
        return (
          <li
            key={e.participantId}
            aria-current={isMe ? 'true' : undefined}
            className={clsx(
              'flex min-h-12 items-center gap-3 rounded-control border px-3 py-2',
              isMe ? 'border-line-strong bg-accent text-accent-ink shadow-hard' : 'border-line bg-surface',
              gap && 'mt-3',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface font-display text-sm font-black text-ink">
              {e.rank <= 3 ? <Medal className="size-4" aria-label={`Rank ${e.rank}`} /> : e.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">
              {e.name}
              {isMe && <span className="ml-1 text-xs font-extrabold">(you)</span>}
            </span>
            <span className="font-display font-black tabular-nums">{e.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Top-3 podium for the end screen. */
export function Podium({ entries, meId }: { entries: LeaderboardEntry[]; meId: string }) {
  const top = [...entries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  if (top.length === 0) return null;
  // Visual order: 2nd, 1st, 3rd.
  const order = [top[1], top[0], top[2]].filter((e): e is LeaderboardEntry => Boolean(e));
  const height = (rank: number) => (rank === 1 ? 'h-28' : rank === 2 ? 'h-20' : 'h-14');
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Podium">
      {order.map((e) => (
        <li key={e.participantId} className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className={clsx('w-full truncate text-sm font-bold', e.studentId === meId && 'underline underline-offset-4')}>
            {e.name}
            {e.studentId === meId && <span className="sr-only"> (you)</span>}
          </span>
          <span className="text-xs font-semibold text-muted tabular-nums">{e.score} pts</span>
          <span
            className={clsx(
              'grid w-full place-items-center rounded-t-control border-2 border-line-strong font-display text-2xl font-black',
              height(e.rank),
              e.rank === 1 ? 'bg-accent' : e.rank === 2 ? 'bg-info-soft' : 'bg-warning-soft',
            )}
          >
            {e.rank}
          </span>
        </li>
      ))}
    </ol>
  );
}
