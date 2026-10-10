'use client';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { DAYS, type Day, type TimetableSlot } from '@classpulse/shared';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/session-context';

const DAY_LABEL: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const JS_DAY: (Day | null)[] = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function TimetablePage() {
  const user = useSessionUser();
  const q = useQuery({ queryKey: ['teacher', 'timetable'], queryFn: () => api.get<TimetableSlot[]>('/teacher/timetable') });
  const today = JS_DAY[new Date().getDay()] ?? null;

  const header = (
    <PageHeader
      eyebrow="Teacher studio"
      title="Timetable"
      description="Your weekly schedule, including every slot of the sections you teach. Managed by your institution’s admin."
    />
  );

  if (q.isPending)
    return (
      <>
        {header}
        <LoadingBlock label="Loading timetable…" />
      </>
    );
  if (q.isError)
    return (
      <>
        {header}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );
  if (q.data.length === 0)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-8" aria-hidden />}
            title="No timetable yet"
            description="Your admin has not scheduled any classes for your sections yet."
          />
        </Card>
      </>
    );

  const slots = q.data;
  const periods = [...new Set(slots.map((s) => s.period))].sort((a, b) => a - b);
  const days = DAYS.filter((d) => d !== 'sat' || slots.some((s) => s.day === 'sat'));
  const cell = (day: Day, period: number) => slots.filter((s) => s.day === day && s.period === period);
  const timeFor = (period: number) => {
    const s = slots.find((x) => x.period === period);
    return s ? `${s.startTime}–${s.endTime}` : '';
  };

  return (
    <>
      {header}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">Weekly timetable{today ? `; today is ${DAY_LABEL[today]}` : ''}</caption>
          <thead>
            <tr>
              <th scope="col" className="eyebrow w-24 border-b border-line-strong px-3 py-2.5 text-left">
                Period
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  aria-current={d === today ? 'date' : undefined}
                  className={clsx(
                    'border-b border-line-strong px-3 py-2.5 text-left',
                    d === today ? 'bg-accent text-accent-ink' : 'eyebrow',
                  )}
                >
                  {d === today ? (
                    <span className="text-xs font-extrabold uppercase tracking-[0.16em]">{DAY_LABEL[d]} · Today</span>
                  ) : (
                    DAY_LABEL[d]
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-3 text-left align-top">
                  <span className="font-display font-black">P{p}</span>
                  <span className="block font-mono text-[11px] text-muted">{timeFor(p)}</span>
                </th>
                {days.map((d) => {
                  const items = cell(d, p);
                  return (
                    <td key={d} className={clsx('px-2 py-2 align-top', d === today && 'bg-surface-2')}>
                      {items.length === 0 ? (
                        <span className="sr-only">Free</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {items.map((s) => {
                            const mine = s.teacher?.id === user.id;
                            return (
                              <li
                                key={s.id}
                                className={clsx(
                                  'border p-2 rounded-control',
                                  mine ? 'border-line-strong bg-surface' : 'border-line bg-surface opacity-80',
                                )}
                              >
                                <p className="font-bold leading-tight">{s.subject}</p>
                                <p className="text-xs text-ink-2">{s.sectionName}</p>
                                <p className="text-[11px] text-muted">
                                  {s.startTime}–{s.endTime}
                                  {s.room ? ` · ${s.room.name}` : ''}
                                  {!mine && s.teacher ? ` · ${s.teacher.name}` : ''}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">Slots taught by colleagues in your sections are shown faded with their name.</p>
    </>
  );
}
