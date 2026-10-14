'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, ClipboardCheck, Mic, Sparkles, Users } from 'lucide-react';
import { LESSON_STATUSES, type TeacherDashboard } from '@classiq/shared';
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { LessonStatusBadge, lessonStatusLabel } from '@/components/teacher/status';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSessionUser } from '@/lib/session-context';

export default function TeacherDashboardPage() {
  const user = useSessionUser();
  const q = useQuery({ queryKey: ['teacher', 'dashboard'], queryFn: () => api.get<TeacherDashboard>('/teacher/dashboard') });

  const header = (
    <PageHeader
      eyebrow="Teacher studio"
      title={`Hello, ${user.name.split(' ')[0]}`}
      description="Record a class, review the AI-generated quiz, and run it live."
      actions={
        <ButtonLink href="/teacher/record" icon={<Mic className="size-4" aria-hidden />}>
          Record a class
        </ButtonLink>
      }
    />
  );

  if (q.isPending)
    return (
      <>
        {header}
        <LoadingBlock label="Loading your dashboard…" />
      </>
    );
  if (q.isError)
    return (
      <>
        {header}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const d = q.data;
  const totalLessons = Object.values(d.lessonsByStatus).reduce((a, b) => a + b, 0);
  const statusRows = LESSON_STATUSES.filter((s) => (d.lessonsByStatus[s] ?? 0) > 0);
  // Transcribed lessons wait for the teacher to choose the quiz settings and generate.
  const readyForQuiz = d.lessonsByStatus.transcribed ?? 0;

  return (
    <>
      {header}

      {readyForQuiz > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="size-6 shrink-0" aria-hidden />
            <div>
              <p className="font-display text-base font-extrabold">
                {readyForQuiz} {readyForQuiz === 1 ? 'lesson is' : 'lessons are'} ready for a quiz
              </p>
              <p className="text-sm text-muted">The transcript is ready. Choose the number of questions and the difficulty, then generate the quiz.</p>
            </div>
          </div>
          <ButtonLink href="/teacher/lessons?status=transcribed">Generate quizzes</ButtonLink>
        </Card>
      )}

      {d.needsReview > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="size-6 shrink-0" aria-hidden />
            <div>
              <p className="font-display text-base font-extrabold">
                {d.needsReview} {d.needsReview === 1 ? 'lesson needs' : 'lessons need'} your review
              </p>
              <p className="text-sm text-muted">Approve the generated questions, then publish the quiz to your students.</p>
            </div>
          </div>
          <ButtonLink href="/teacher/lessons?status=ready_for_review">Review lessons</ButtonLink>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="My sections" value={d.sections.length} icon={<Users className="size-4" aria-hidden />} />
        <StatCard
          label="Students"
          value={d.sections.reduce((a, s) => a + s.studentCount, 0)}
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard label="Lessons" value={totalLessons} icon={<BookOpen className="size-4" aria-hidden />} />
        <StatCard
          label="Needs review"
          value={d.needsReview}
          icon={<ClipboardCheck className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Today"
            title="Today’s classes"
            actions={
              <Link href="/teacher/timetable" className="inline-flex min-h-6 items-center text-xs font-bold underline underline-offset-4">
                Full timetable
              </Link>
            }
          />
          <CardBody>
            {d.todaySlots.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-8" aria-hidden />}
                title="No classes scheduled today"
                description="Your timetable is managed by your institution’s admin."
              />
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {d.todaySlots.map((s, i) => (
                  <li key={`${s.sectionName}-${s.startTime}-${i}`} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-bold">{s.subject}</p>
                      <p className="text-sm text-muted">
                        {s.sectionName}
                        {s.room ? ` · ${s.room}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold tabular-nums">
                      {s.startTime}–{s.endTime}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Pipeline" title="Lessons by status" />
          <CardBody>
            {statusRows.length === 0 ? (
              <EmptyState
                title="No lessons yet"
                description="Record or upload your first class to generate a quiz."
                action={<ButtonLink href="/teacher/record">Record or upload</ButtonLink>}
              />
            ) : (
              <ul className="space-y-2">
                {statusRows.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/teacher/lessons?status=${s}`}
                      className="flex items-center justify-between gap-3 px-2 py-1.5 hover:bg-surface-2 rounded-control"
                    >
                      <LessonStatusBadge status={s} />
                      <span className="font-display text-lg font-black tabular-nums" aria-label={`${lessonStatusLabel(s)}: ${d.lessonsByStatus[s]}`}>
                        {d.lessonsByStatus[s]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Recent"
            title="Recent lessons"
            actions={
              <Link href="/teacher/lessons" className="inline-flex min-h-6 items-center text-xs font-bold underline underline-offset-4">
                All lessons
              </Link>
            }
          />
          <CardBody>
            {d.recentLessons.length === 0 ? (
              <EmptyState
                title="No lessons yet"
                description="Lessons appear here once you record or upload a class."
                action={<ButtonLink href="/teacher/record">Record or upload</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {d.recentLessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/teacher/lessons/${l.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-surface-2/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">{l.title}</p>
                        <p className="text-xs text-muted">{formatDate(l.createdAt)}</p>
                      </div>
                      <LessonStatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Classes"
            title="My sections"
            actions={
              <Link href="/teacher/classes" className="inline-flex min-h-6 items-center text-xs font-bold underline underline-offset-4">
                Details
              </Link>
            }
          />
          <CardBody>
            {d.sections.length === 0 ? (
              <EmptyState
                title="No sections assigned"
                description="Ask your institution’s admin to assign you to a section."
              />
            ) : (
              <ul className="space-y-2">
                {d.sections.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/teacher/lessons?sectionId=${s.id}`}
                      className="flex items-center justify-between gap-3 px-2 py-1.5 hover:bg-surface-2 rounded-control"
                    >
                      <span className="truncate font-bold">{s.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {s.studentCount} {s.studentCount === 1 ? 'student' : 'students'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

