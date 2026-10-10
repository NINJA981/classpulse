'use client';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';
import type { AdminOverview, Institution, TimetableSlot } from '@classpulse/shared';
import { Badge, ButtonLink, Card, CardBody, CardHeader, ErrorState, LoadingBlock, PageHeader, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { adminKeys } from '@/components/admin/queries';
import { InstitutionForm } from '@/components/admin/onboarding/institution-form';

type StepState = 'done' | 'todo' | 'unknown';

interface Step {
  title: string;
  description: string;
  state: StepState;
  detail?: string;
  href: string;
  cta: string;
}

function useInstitution() {
  return useQuery({
    queryKey: adminKeys.institution,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<Institution>('/admin/institution', undefined, signal);
      } catch (err) {
        // 404 means the school profile has not been created yet.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export default function OnboardingPage() {
  const institution = useInstitution();
  const overview = useQuery({
    queryKey: adminKeys.overview,
    queryFn: ({ signal }) => api.get<AdminOverview>('/admin/overview', undefined, signal),
  });
  const sectionsCount = overview.data?.counts.sections ?? 0;
  const timetable = useQuery({
    queryKey: adminKeys.timetableAll,
    queryFn: ({ signal }) => api.get<TimetableSlot[]>('/admin/timetable', undefined, signal),
    enabled: sectionsCount > 0,
    retry: false,
  });

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Onboarding"
        description="Set up your school in seven steps. Each step links to the page where you do the work; come back here to track progress."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              eyebrow="Step 1"
              title="School profile"
              actions={institution.data ? <StateBadge state="done" /> : institution.data === null ? <StateBadge state="todo" /> : null}
            />
            <CardBody>
              {institution.isPending ? (
                <LoadingBlock label="Loading school profile…" />
              ) : institution.error ? (
                <ErrorState error={institution.error} onRetry={() => institution.refetch()} />
              ) : (
                <InstitutionForm key={institution.data?.id ?? 'new'} institution={institution.data} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Steps 2–7" title="Rooms, people, timetable and devices" />
            <CardBody className="px-0 pb-2">
              {overview.isPending ? (
                <div className="flex flex-col gap-3 px-5" role="status" aria-label="Loading checklist">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : overview.error ? (
                <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
              ) : (
                <StepList steps={buildSteps(overview.data, timetable.data, timetable.isError)} />
              )}
            </CardBody>
          </Card>
        </div>

        <Progress
          institutionDone={Boolean(institution.data)}
          steps={overview.data ? buildSteps(overview.data, timetable.data, timetable.isError) : null}
        />
      </div>
    </>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function buildSteps(o: AdminOverview, slots: TimetableSlot[] | undefined, timetableFailed: boolean): Step[] {
  const c = o.counts;
  // The overview has no timetable count; it is derived from GET /admin/timetable (no section filter).
  const timetableState: StepState =
    c.sections === 0 ? 'todo' : slots ? (slots.length > 0 ? 'done' : 'todo') : timetableFailed ? 'unknown' : 'todo';
  return [
    {
      title: 'Rooms',
      description: 'Add the physical classrooms. Sections are taught in rooms and devices are installed per room.',
      state: c.rooms > 0 ? 'done' : 'todo',
      detail: plural(c.rooms, 'room', 'rooms'),
      href: '/admin/rooms',
      cta: 'Open rooms',
    },
    {
      title: 'Sections',
      description: 'Create a section for each class cohort and pick its room.',
      state: c.sections > 0 ? 'done' : 'todo',
      detail: plural(c.sections, 'section', 'sections'),
      href: '/admin/sections',
      cta: 'Open sections',
    },
    {
      title: 'Teachers',
      description: 'Create teacher accounts and assign them to sections.',
      state: c.teachers > 0 ? 'done' : 'todo',
      detail: plural(c.teachers, 'teacher', 'teachers'),
      href: '/admin/teachers',
      cta: 'Open teachers',
    },
    {
      title: 'Students',
      description: 'Add students one by one or import a CSV roster, then enrol them in sections.',
      state: c.students > 0 ? 'done' : 'todo',
      detail: plural(c.students, 'student', 'students'),
      href: '/admin/students',
      cta: 'Open students',
    },
    {
      title: 'Timetable',
      description: 'Fill in each section’s weekly periods so teachers see their schedule.',
      state: timetableState,
      detail: slots ? plural(slots.length, 'period', 'periods') : undefined,
      href: '/admin/timetable',
      cta: 'Open timetable',
    },
    {
      title: 'Classroom devices',
      description: 'Enrol a Raspberry Pi recorder in each room so teachers can record classes.',
      state: c.devicesTotal > 0 ? 'done' : 'todo',
      detail: `${c.devicesOnline} of ${c.devicesTotal} online`,
      href: '/admin/devices',
      cta: 'Open devices',
    },
  ];
}

function StateBadge({ state }: { state: StepState }) {
  if (state === 'done') return <Badge tone="success">Done</Badge>;
  if (state === 'unknown') return <Badge>Not checked</Badge>;
  return <Badge tone="warning">To do</Badge>;
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
          <StepMarker n={i + 2} done={s.state === 'done'} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-extrabold">{s.title}</h3>
              <StateBadge state={s.state} />
              {s.detail && <span className="text-xs text-muted">{s.detail}</span>}
            </div>
            <p className="mt-0.5 text-sm text-muted">{s.description}</p>
          </div>
          <ButtonLink href={s.href} variant={s.state === 'done' ? 'secondary' : 'primary'} size="sm" icon={<ArrowRight className="order-last size-3.5" aria-hidden />}>
            {s.cta}
          </ButtonLink>
        </li>
      ))}
    </ol>
  );
}

function StepMarker({ n, done }: { n: number; done: boolean }): ReactNode {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex size-9 shrink-0 items-center justify-center border font-display text-sm font-black rounded-control',
        done ? 'border-line-strong bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink',
      )}
    >
      {done ? <Check className="size-4" /> : n}
    </span>
  );
}

function Progress({ institutionDone, steps }: { institutionDone: boolean; steps: Step[] | null }) {
  const all = [{ title: 'School profile', state: institutionDone ? 'done' : 'todo' } as const, ...(steps ?? [])];
  const done = all.filter((s) => s.state === 'done').length;
  const total = 7;
  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader eyebrow="Progress" title={`${done} of ${total} steps done`} />
      <CardBody className="flex flex-col gap-4">
        <div
          className="grid h-2 w-full grid-cols-7 gap-0.5"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={clsx('h-full', i < done ? 'bg-accent' : 'bg-surface-2')} />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {all.map((s) => (
            <li key={s.title} className="flex items-center justify-between gap-2">
              <span className={clsx(s.state === 'done' ? 'text-ink' : 'text-muted')}>{s.title}</span>
              <StateBadge state={s.state} />
            </li>
          ))}
        </ul>
        {done === total && <p className="text-sm font-semibold text-success">Your school is fully set up.</p>}
      </CardBody>
    </Card>
  );
}
