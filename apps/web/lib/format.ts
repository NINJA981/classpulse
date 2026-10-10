import { LANGUAGE_LABELS, type Language } from '@classpulse/shared';

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', opts).format(new Date(iso));
}

export const formatDateTime = (iso: string | null | undefined) =>
  formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return formatDate(iso);
}

/** 125 -> "2:05"; 3725 -> "1:02:05" */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null) return '—';
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const formatPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`);

export const languageLabel = (code: string) => LANGUAGE_LABELS[code as Language] ?? code;
