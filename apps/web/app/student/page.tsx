'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, GraduationCap, KeyRound, ListChecks, Radio, Trophy } from 'lucide-react';
import type { StudentDashboard } from '@classpulse/shared';
import { Badge, ButtonLink, Card, CardBody, CardHeader, ErrorState, Skeleton, StatCard } from '@/components/ui';
import { dueInfo, firstName, ScoreBadge, SectionsList } from '@/components/student/common';
import { QuizCard } from '@/components/student/quiz/quiz-card';
import { api } from '@/lib/api';
import { formatDate, formatPct, formatRelative } from '@/lib/format';
import { useSessionUser } from '@/lib/session-context';

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-24 rounded-card" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}

export default function StudentHomePage() {
  const user = useSessionUser();
  const dashboard = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => api.get<StudentDashboard>('/student/dashboard'),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="eyebrow mb-1">Welcome back</p>
        <h1 className="font-display text-3xl font-black leading-tight">Hi, {firstName(user.name)}!</h1>
        <p className="mt-1 text-sm text-muted">Here’s what’s waiting for you today.</p>
      </header>

      {dashboard.isPending ? (
        <HomeSkeleton />
      ) : dashboard.isError ? (
        <Card>
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        </Card>
      ) : (
        <DashboardBody data={dashboard.data} />
      )}
    </div>
  );
}

function DashboardBody({ data }: { data: StudentDashboard }) {
  const now = Date.now();
  const noClasses = data.sections.length === 0;

  return (
    <>
      {noClasses ? (
        <Card className="bg-accent-soft">
          <CardBody className="flex flex-col items-start gap-3">
            <span className="grid size-12 place-items-center rounded-full border-2 border-line-strong bg-accent" aria-hidden>
              <KeyRound className="size-6" />
            </span>
            <h2 className="font-display text-xl font-black">Join your first class</h2>
            <p className="text-sm text-ink-2">
              Ask your teacher for the 6-character class code. Once you join, quizzes and assignments from that class will
              show up here.
            </p>
            <ButtonLink href="/student/join" size="lg" className="w-full sm:w-auto" icon={<KeyRound className="size-5" aria-hidden />}>
              Join a class
            </ButtonLink>
          </CardBody>
        </Card>
      ) : (
        <Link
          href="/student/live"
          className="flex min-h-14 items-center gap-3 rounded-card border-2 border-line-strong bg-info-soft px-4 py-3 font-bold shadow-card"
        >
          <Radio className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">Teacher started a live quiz? Enter the game PIN</span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Average score" value={formatPct(data.averageScorePct)} icon={<Trophy className="size-4" aria-hidden />} />
        <StatCard label="Quizzes to do" value={data.pendingQuizzes.length} icon={<ListChecks className="size-4" aria-hidden />} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="My classes" value={data.sections.length} icon={<GraduationCap className="size-4" aria-hidden />} />
        </div>
      </div>

      <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="pending-heading" className="font-display text-xl font-extrabold">
            Quizzes to take
          </h2>
          <Link href="/student/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">
            See all
          </Link>
        </div>
        {data.pendingQuizzes.length === 0 ? (
          <Card className="p-5 text-sm text-muted">
            {noClasses ? 'Join a class to get quizzes from your teachers.' : 'You’re all caught up. New quizzes appear after each lesson.'}
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.pendingQuizzes.slice(0, 5).map((q) => (
              <li key={q.lessonId}>
                <QuizCard quiz={q} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Progress" title="Recent scores" />
          <CardBody>
            {data.recentAttempts.length === 0 ? (
              <p className="text-sm text-muted">No quiz attempts yet. Your scores will show up here.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.recentAttempts.map((a) => (
                  <li key={`${a.lessonId}-${a.submittedAt}`}>
                    <Link
                      href={`/student/quizzes/${a.lessonId}`}
                      className="flex min-h-12 items-center gap-3 py-2 hover:text-ink"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.title}</span>
                        <span className="block text-xs text-muted">{formatRelative(a.submittedAt)}</span>
                      </span>
                      <ScoreBadge pct={a.scorePct} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Homework"
            title="Upcoming assignments"
            actions={
              <Link href="/student/assignments" className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">
                All
              </Link>
            }
          />
          <CardBody>
            {data.upcomingAssignments.length === 0 ? (
              <p className="text-sm text-muted">No assignments due. Enjoy the break!</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.upcomingAssignments.map((a) => {
                  const due = dueInfo(a.dueAt, a.submitted, now);
                  return (
                    <li key={a.id}>
                      <Link href="/student/assignments" className="flex min-h-12 items-center gap-3 py-2">
                        <ClipboardList className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{a.title}</span>
                          <span className="block text-xs text-muted">{a.dueAt ? `Due ${formatDate(a.dueAt)}` : 'No due date'}</span>
                        </span>
                        <Badge tone={due.tone}>{due.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {!noClasses && (
        <Card>
          <CardHeader
            eyebrow="Enrolled"
            title="My classes"
            actions={
              <Link href="/student/join" className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">
                Join another
              </Link>
            }
          />
          <CardBody>
            <SectionsList sections={data.sections} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
