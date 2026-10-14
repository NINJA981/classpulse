'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ExamDetail } from '@classiq/shared';
import { ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { ExamEditor } from '@/components/teacher/exams/exam-editor';
import { ExamStatusBadge } from '@/components/teacher/exams/exam-ui';
import { ExamOverview } from '@/components/teacher/exams/exam-overview';
import { api } from '@/lib/api';

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['exams', id], queryFn: () => api.get<ExamDetail>(`/exams/${id}`) });
  const back = { href: '/teacher/exams', label: 'All exams' };

  if (q.isPending)
    return (
      <>
        <PageHeader back={back} title="Exam" />
        <LoadingBlock label="Loading exam…" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader back={back} title="Exam" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const exam = q.data;
  return (
    <>
      <PageHeader
        back={back}
        eyebrow={exam.status === 'draft' ? 'Draft exam' : exam.section.name}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {exam.title} <ExamStatusBadge status={exam.status} />
          </span>
        }
      />
      {exam.status === 'draft' ? <ExamEditor key={exam.id} initial={exam} /> : <ExamOverview exam={exam} />}
    </>
  );
}
