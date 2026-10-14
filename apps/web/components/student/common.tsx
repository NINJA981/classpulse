import clsx from 'clsx';
import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import type { StudentSection } from '@classiq/shared';
import { Badge, type BadgeTone } from '@/components/ui';
import { formatDate, formatDateTime, formatPct } from '@/lib/format';

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function scoreTone(pct: number): BadgeTone {
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export function ScoreBadge({ pct, className }: { pct: number; className?: string }) {
  return (
    <Badge tone={scoreTone(pct)} className={className}>
      {formatPct(pct)}
    </Badge>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Due-date badge: overdue / due soon (48 h) / due on date. */
export function dueInfo(dueAt: string | null, submitted: boolean, now: number): { label: string; tone: BadgeTone } {
  if (submitted) return { label: 'Submitted', tone: 'success' };
  if (!dueAt) return { label: 'No due date', tone: 'neutral' };
  const due = new Date(dueAt).getTime();
  if (due < now) return { label: 'Overdue', tone: 'danger' };
  if (due - now < 2 * DAY_MS) return { label: 'Due soon', tone: 'warning' };
  return { label: `Due ${formatDate(dueAt)}`, tone: 'info' };
}

export function DueText({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <span>No due date</span>;
  return <span>Due {formatDateTime(dueAt)}</span>;
}

/** Simple list of the student's classes. */
export function SectionsList({ sections }: { sections: StudentSection[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {sections.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-control border border-line bg-surface p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-control bg-info-soft text-ink" aria-hidden>
            <GraduationCap className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold leading-snug">{s.name}</p>
            <p className="text-sm text-muted">
              {[s.subject, s.grade && `Grade ${s.grade}`].filter(Boolean).join(' · ') || 'Class'}
            </p>
            {s.teachers.length > 0 && <p className="text-xs text-muted">Teacher: {s.teachers.join(', ')}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two-button English / local-language switch. */
export function LanguageToggle({ local, onChange }: { local: boolean; onChange: (local: boolean) => void }) {
  const item = (active: boolean) =>
    clsx(
      'min-h-11 px-3 text-sm font-bold rounded-control transition-colors',
      active ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink',
    );
  return (
    <div role="group" aria-label="Question language" className="inline-flex gap-0.5 rounded-control border border-line-strong bg-surface p-0.5">
      <button type="button" aria-pressed={!local} onClick={() => onChange(false)} className={item(!local)}>
        English
      </button>
      <button type="button" aria-pressed={local} onClick={() => onChange(true)} className={item(local)}>
        Local language
      </button>
    </div>
  );
}

/** Highlighted note box using the soft fills. */
export function Note({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'accent';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-info-soft border-line',
    success: 'bg-success-soft border-success/40',
    warning: 'bg-warning-soft border-warning/40',
    danger: 'bg-danger-soft border-danger/40',
    accent: 'bg-accent-soft border-line-strong',
  };
  return (
    <div className={clsx('flex items-start gap-3 rounded-control border px-4 py-3 text-sm', tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
