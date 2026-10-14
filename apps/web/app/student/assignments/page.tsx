'use client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import type { StudentAssignment, StudentAssignmentState } from '@classiq/shared';
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { AssignmentCard } from '@/components/student/assignments/assignment-card';
import { api } from '@/lib/api';

const STATE_ORDER: Record<StudentAssignmentState, number> = { todo: 0, late: 1, submitted: 1, returned: 2, closed: 3 };

/** To do first (soonest due first), then handed in, returned and closed. */
function sortAssignments(list: StudentAssignment[]): StudentAssignment[] {
  const due = (a: StudentAssignment) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY);
  return [...list].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || due(a) - due(b));
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
      <PageHeader eyebrow="Homework" title="Assignments" description="Tap an assignment to read the task, hand in your answer or photos of your work, and see your marks once it is returned." />
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
            description="When your teacher sets homework, it appears here."
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
