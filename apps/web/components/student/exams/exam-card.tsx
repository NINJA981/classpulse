'use client';
import { CalendarClock, ListChecks, Lock, Maximize, Timer } from 'lucide-react';
import type { StudentExamListItem, StudentExamState } from '@classiq/shared';
import { Badge, ButtonLink, Card, type BadgeTone } from '@/components/ui';
import { useCountdown } from '@/components/student/live/countdown';
import { formatDateTime, formatDuration } from '@/lib/format';
import { ScoreBadge } from '../common';

const STATE: Record<StudentExamState, { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'Upcoming', tone: 'info' },
  open: { label: 'Open now', tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'success' },
  missed: { label: 'Missed', tone: 'neutral' },
};

/** Time until the exam opens, ticking. */
function OpensIn({ opensAt }: { opensAt: string }) {
  const ms = useCountdown(Date.parse(opensAt), 0);
  if (ms <= 0) return <span className="font-bold">Opening now — refresh to start</span>;
  const sec = Math.ceil(ms / 1000);
  return (
    <span className="font-bold tabular-nums">
      Opens in {sec >= 86_400 ? `${Math.floor(sec / 86_400)} d` : formatDuration(sec)}
    </span>
  );
}

export function ExamCard({ exam }: { exam: StudentExamListItem }) {
  const s = STATE[exam.state];
  const href = `/student/exams/${exam.id}`;
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          {exam.result && <ScoreBadge pct={exam.result.scorePct} />}
        </div>
        <h2 className="font-display text-lg font-extrabold leading-snug break-words">{exam.title}</h2>
        <p className="text-sm text-muted">
          {exam.section.name} · {exam.teacherName}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden />
            {formatDateTime(exam.opensAt)} – {formatDateTime(exam.closesAt)}
          </li>
          <li className="inline-flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden />
            {exam.durationMin} min
          </li>
          <li className="inline-flex items-center gap-1">
            <ListChecks className="size-3.5" aria-hidden />
            {exam.questionCount} questions
          </li>
          {exam.requireFullscreen && (
            <li className="inline-flex items-center gap-1">
              <Maximize className="size-3.5" aria-hidden />
              Fullscreen
            </li>
          )}
          {exam.requiresAccessCode && (
            <li className="inline-flex items-center gap-1">
              <Lock className="size-3.5" aria-hidden />
              Access code
            </li>
          )}
        </ul>
        {exam.state === 'upcoming' && (
          <p className="mt-2 text-sm">
            <OpensIn opensAt={exam.opensAt} />
          </p>
        )}
        {exam.state === 'submitted' && exam.result && (
          <p className="mt-2 text-sm font-semibold">
            {exam.result.correct} of {exam.result.total} correct
          </p>
        )}
      </div>
      <div className="shrink-0">
        {exam.state === 'open' && (
          <ButtonLink href={href} size="lg" className="w-full sm:w-auto">
            Start<span className="sr-only"> {exam.title}</span>
          </ButtonLink>
        )}
        {exam.state === 'in_progress' && (
          <ButtonLink href={href} size="lg" className="w-full sm:w-auto">
            Resume<span className="sr-only"> {exam.title}</span>
          </ButtonLink>
        )}
        {exam.state === 'submitted' && (
          <ButtonLink href={href} variant="secondary" className="w-full sm:w-auto">
            {exam.result ? 'View result' : 'Details'}
            <span className="sr-only"> for {exam.title}</span>
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}
