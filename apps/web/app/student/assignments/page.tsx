'use client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import type { StudentAssignment } from '@classpulse/shared';
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { AssignmentCard } from '@/components/student/assignments/assignment-card';
import { api } from '@/lib/api';

/** Unsubmitted first (soonest due first), then submitted. */
function sortAssignments(list: StudentAssignment[]): StudentAssignment[] {
  const due = (a: StudentAssignment) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY);
  return [...list].sort((a, b) => Number(Boolean(a.submission)) - Number(Boolean(b.submission)) || due(a) - due(b));
}

export default function AssignmentsPage() {
  const assignments = useQuery({
    queryKey: ['student', 'assignments'],
    queryFn: () => api.get<StudentAssignment[]>('/student/assignments'),
  });
  // Captured once per data load so badges are stable within a render pass.
  const now = assignments.dataUpdatedAt || 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Homework" title="Assignments" description="Tap an assignment to read the task and submit your answer." />
      {assignments.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : assignments.isError ? (
        <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
      ) : assignments.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title="No assignments yet"
            description="When your teacher sets homework for a lesson, it appears here."
            action={
              <ButtonLink href="/student/quizzes" size="lg" variant="secondary">
                Practise with quizzes
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortAssignments(assignments.data).map((a) => (
            <li key={a.id}>
              <AssignmentCard assignment={a} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
