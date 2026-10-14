'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Cpu, GraduationCap, Rocket, Target, UserRound, Users } from 'lucide-react';
import type { AdminOverview } from '@classiq/shared';
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatPct } from '@/lib/format';
import { adminKeys } from '@/components/admin/queries';
import { LessonsByStatusChart } from '@/components/admin/overview/lessons-chart';
import { LessonStatusBadge } from '@/components/admin/overview/status';

const QUICK_LINKS = [
  { href: '/admin/onboarding', label: 'Onboarding checklist' },
  { href: '/admin/sections', label: 'Manage sections' },
  { href: '/admin/students', label: 'Students & CSV import' },
  { href: '/admin/timetable', label: 'Weekly timetable' },
  { href: '/admin/devices', label: 'Classroom devices' },
  { href: '/admin/settings', label: 'AI settings' },
];

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading overview">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: adminKeys.overview,
    queryFn: ({ signal }) => api.get<AdminOverview>('/admin/overview', undefined, signal),
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin console"
        title={data?.institution?.name ?? 'Overview'}
        description={data?.institution ? `School code ${data.institution.code}` : 'Your school at a glance.'}
      />
      {isPending ? (
        <OverviewSkeleton />
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : (
        <OverviewBody data={data} />
      )}
    </>
  );
}

function OverviewBody({ data }: { data: AdminOverview }) {
  const c = data.counts;
  return (
    <div className="flex flex-col gap-6">
      {!data.institution && (
        <Card className="border-line-strong shadow-hard">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow mb-1">Get started</p>
              <h2 className="font-display text-xl font-black">Set up your school</h2>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Create the school profile, then add rooms, sections, teachers and students. The onboarding checklist walks you
                through each step.
              </p>
            </div>
            <ButtonLink href="/admin/onboarding" size="lg" icon={<Rocket className="size-4" aria-hidden />}>
              Start onboarding
            </ButtonLink>
          </CardBody>
        </Card>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Teachers" value={c.teachers} icon={<GraduationCap className="size-4" aria-hidden />} />
        <StatCard label="Students" value={c.students} icon={<UserRound className="size-4" aria-hidden />} />
        <StatCard
          label="Sections"
          value={c.sections}
          hint={`${c.rooms} ${c.rooms === 1 ? 'room' : 'rooms'}`}
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard
          label="Lessons"
          value={c.lessons}
          hint={`${c.publishedLessons} published`}
          icon={<BookOpen className="size-4" aria-hidden />}
        />
        <StatCard
          label="Devices online"
          value={`${c.devicesOnline} / ${c.devicesTotal}`}
          hint={c.devicesTotal === 0 ? 'No classroom devices yet' : undefined}
          icon={<Cpu className="size-4" aria-hidden />}
        />
        <StatCard
          label="Average quiz score"
          value={formatPct(data.averageQuizScorePct)}
          hint={data.averageQuizScorePct == null ? 'No quiz attempts yet' : undefined}
          icon={<Target className="size-4" aria-hidden />}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader eyebrow="Pipeline" title="Lessons by status" />
          <CardBody>
            <LessonsByStatusChart byStatus={data.lessonsByStatus} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Shortcuts" title="Quick links" />
          <CardBody>
            <ul className="flex flex-col">
              {QUICK_LINKS.map((l) => (
                <li key={l.href} className="border-b border-line last:border-b-0">
                  <ButtonLink
                    href={l.href}
                    variant="ghost"
                    className="w-full justify-between px-2"
                    icon={<ArrowRight className="order-last size-4" aria-hidden />}
                  >
                    {l.label}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Latest activity" title="Recent lessons" />
        <CardBody className="px-0 pb-2">
          {data.recentLessons.length === 0 ? (
            <EmptyState
              title="No lessons yet"
              description="Once teachers record or upload classes, the latest lessons show up here."
              action={<ButtonLink href="/admin/teachers" variant="secondary">Manage teachers</ButtonLink>}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Lesson</TH>
                  <TH>Teacher</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                </tr>
              </THead>
              <TBody>
                {data.recentLessons.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-semibold">{l.title}</TD>
                    <TD>{l.teacherName}</TD>
                    <TD>
                      <LessonStatusBadge status={l.status} />
                    </TD>
                    <TD className="text-muted">{formatDate(l.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
