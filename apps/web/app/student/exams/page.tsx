'use client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import type { StudentExamListItem, StudentExamState } from '@classiq/shared';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { ExamCard } from '@/components/student/exams/exam-card';
import { api } from '@/lib/api';

const ORDER: Record<StudentExamState, number> = {
  in_progress: 0,
  open: 1,
  upcoming: 2,
  submitted: 3,
  missed: 4,
};

export default function StudentExamsPage() {
  const exams = useQuery({
    queryKey: ['student', 'exams'],
    queryFn: () => api.get<StudentExamListItem[]>('/student/exams'),
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Assessments"
        title="Exams"
        description="Timed exams from your teachers. You get one attempt at each."
      />
      {exams.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : exams.isError ? (
        <ErrorState error={exams.error} onRetry={() => void exams.refetch()} />
      ) : exams.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title="No exams yet"
            description="When your teacher schedules an exam for your class, it shows up here with its opening time."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...exams.data]
            .sort((a, b) => ORDER[a.state] - ORDER[b.state])
            .map((e) => (
              <li key={e.id}>
                <ExamCard exam={e} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
