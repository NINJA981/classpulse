import clsx from 'clsx';
import type {
  ExamEventItem,
  ExamEventType,
  ExamMonitorStatus,
  ExamResultsVisibility,
  ExamStatus,
} from '@classiq/shared';
import { Badge, type BadgeTone } from '@/components/ui';
import { formatDateTime, formatDuration } from '@/lib/format';

const EXAM_STATUS: Record<ExamStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  closed: { label: 'Closed', tone: 'info' },
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const s = EXAM_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const ATTEMPT_STATUS: Record<ExamMonitorStatus, { label: string; tone: BadgeTone }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'success' },
  auto_submitted: { label: 'Auto-submitted', tone: 'info' },
};

export function AttemptStatusBadge({ status }: { status: ExamMonitorStatus }) {
  const s = ATTEMPT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ViolationBadge({ count, max }: { count: number; max?: number | null }) {
  const tone: BadgeTone = count === 0 ? 'neutral' : max && count >= max ? 'danger' : 'warning';
  return (
    <Badge tone={tone}>
      {count} {count === 1 ? 'warning' : 'warnings'}
    </Badge>
  );
}

export const RESULTS_VISIBILITY_LABEL: Record<ExamResultsVisibility, string> = {
  after_close: 'After the exam closes',
  immediately: 'Right after submitting',
  never: 'Never (teacher only)',
};

export const EVENT_LABEL: Record<ExamEventType, string> = {
  fullscreen_exit: 'Left fullscreen',
  tab_hidden: 'Switched tab or app',
  window_blur: 'Window lost focus',
  copy: 'Tried to copy',
  paste: 'Tried to paste',
  context_menu: 'Opened the context menu',
  print: 'Tried to print',
  second_device: 'Opened on a second device',
  resume: 'Opened or reloaded the exam',
};

const INFO_EVENTS: ReadonlySet<ExamEventType> = new Set(['resume', 'context_menu']);

/** "12 Oct 2026, 10:00 am → 11:30 am" style window text. */
export function windowText(opensAt: string, closesAt: string): string {
  return `${formatDateTime(opensAt)} → ${formatDateTime(closesAt)}`;
}

/** Remaining time as m:ss / h:mm:ss. */
export const clockText = (ms: number) => formatDuration(Math.ceil(Math.max(0, ms) / 1000));

/** Chronological integrity log for one attempt. */
export function IntegrityTimeline({ events, label }: { events: ExamEventItem[]; label: string }) {
  if (events.length === 0) return <p className="text-sm text-muted">No integrity events were recorded.</p>;
  return (
    <ol aria-label={label} className="flex flex-col gap-1.5 border-l-2 border-line pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative text-sm">
          <span
            aria-hidden
            className={clsx(
              'absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border border-surface',
              INFO_EVENTS.has(e.type) ? 'bg-muted' : 'bg-danger',
            )}
          />
          <span className="font-mono text-xs text-muted tabular-nums">
            {new Date(e.at).toLocaleTimeString('en-IN')}
          </span>{' '}
          <span className={clsx('font-semibold', !INFO_EVENTS.has(e.type) && 'text-danger')}>
            {EVENT_LABEL[e.type]}
          </span>
          {e.type === 'resume' && e.detail?.device === 'new' && (
            <span className="text-muted"> (new device)</span>
          )}
        </li>
      ))}
    </ol>
  );
}
