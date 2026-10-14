'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import type { ExamSummary } from '@classiq/shared';
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { ExamStatusBadge, windowText } from '@/components/teacher/exams/exam-ui';
import { api } from '@/lib/api';

export default function ExamsPage() {
  const q = useQuery({ queryKey: ['exams'], queryFn: () => api.get<ExamSummary[]>('/exams') });

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Exams"
        description="Secure, timed exams built from your approved lesson questions. Every student gets their own paper."
        actions={
          <ButtonLink href="/teacher/exams/new" icon={<Plus className="size-4" aria-hidden />}>
            New exam
          </ButtonLink>
        }
      />
      <Card>
        {q.isPending ? (
          <LoadingBlock label="Loading exams…" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title="No exams yet"
            description="Create an exam, pick questions from your lessons, then publish it for a time window."
            action={<ButtonLink href="/teacher/exams/new">New exam</ButtonLink>}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Exam</TH>
                <TH>Status</TH>
                <TH>Window</TH>
                <TH className="text-right">Started</TH>
                <TH className="text-right">Submitted</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {q.data.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link
                      href={`/teacher/exams/${e.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {e.section.name} · {e.durationMin} min · {e.questionsPerStudent} of {e.poolSize}{' '}
                      questions
                    </p>
                  </TD>
                  <TD>
                    <ExamStatusBadge status={e.status} />
                  </TD>
                  <TD className="min-w-56 text-xs text-ink-2">{windowText(e.opensAt, e.closesAt)}</TD>
                  <TD className="text-right tabular-nums">
                    {e.started}
                    <span className="text-muted">/{e.enrolled}</span>
                  </TD>
                  <TD className="text-right tabular-nums">{e.submitted}</TD>
                  <TD>
                    {e.status !== 'draft' && (
                      <div className="flex justify-end gap-3 text-sm font-bold">
                        <Link
                          href={`/teacher/exams/${e.id}/monitor`}
                          className="inline-flex min-h-6 items-center underline-offset-4 hover:underline"
                        >
                          Monitor<span className="sr-only"> {e.title}</span>
                        </Link>
                        <Link
                          href={`/teacher/exams/${e.id}/results`}
                          className="inline-flex min-h-6 items-center underline-offset-4 hover:underline"
                        >
                          Results<span className="sr-only"> {e.title}</span>
                        </Link>
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
