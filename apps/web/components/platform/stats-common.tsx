'use client';
import { STATS_TIME_ZONE, type PlatformStatsQuery } from '@classiq/shared';

/** Query keys for the usage & cost statistics. */
export const statsKeys = {
  stats: (filters: Partial<PlatformStatsQuery>) => ['platform', 'stats', filters] as const,
  overview: ['platform', 'stats', 'overview'] as const,
};

const intFmt = new Intl.NumberFormat('en-IN');
const compactFmt = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const formatInt = (n: number) => intFmt.format(Math.round(n));
export const formatCompact = (n: number) => compactFmt.format(n);
export const formatMinutes = (n: number) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(n)} min`;

/** USD with enough precision for small amounts (estimates can be fractions of a cent). */
export function formatUsd(n: number): string {
  const digits = n === 0 ? 2 : Math.abs(n) < 1 ? 4 : 2;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n);
}

/** Today (YYYY-MM-DD) in the statistics time zone, shifted by `days`. */
export function statsDay(days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

/** "12 Oct" for a YYYY-MM-DD bucket. */
export const bucketLabel = (day: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
