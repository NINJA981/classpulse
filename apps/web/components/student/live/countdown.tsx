'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Timer } from 'lucide-react';

/**
 * Remaining ms until `closesAt` (server epoch ms), corrected by the clock offset
 * (serverTime - Date.now()). Mount per question (key by questionId).
 */
export function useCountdown(closesAt: number, offset: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, closesAt - (now + offset));
}

export function CountdownBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = totalMs > 0 ? Math.min(100, (remainingMs / totalMs) * 100) : 0;
  const urgent = remainingMs > 0 && remainingMs <= 5000;
  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          'inline-flex min-w-16 items-center justify-center gap-1 rounded-control border-2 px-2 py-1 font-display text-lg font-black tabular-nums',
          urgent ? 'border-danger bg-danger-soft text-danger' : 'border-line-strong bg-surface',
        )}
      >
        <Timer className="size-4" aria-hidden />
        <span>
          {seconds}
          <span className="sr-only"> seconds left</span>
        </span>
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full border border-line-strong bg-surface" aria-hidden>
        {/* Width is a dynamic layout value, not theming. */}
        <div
          className={clsx('h-full rounded-full transition-[width] duration-200 ease-linear', urgent ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
