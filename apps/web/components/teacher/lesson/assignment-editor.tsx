'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Assignment, AssignmentInput, AssignmentSummary, LessonDetail } from '@classiq/shared';
import { Button, ButtonLink, Card, CardBody, CardHeader, Dialog, useToast } from '@/components/ui';
import { AssignmentForm } from '@/components/teacher/assignments/assignment-form';
import { AssignmentStatusBadge } from '@/components/teacher/assignments/status';
import { api } from '@/lib/api';
import { lessonKey } from './use-lesson';

/**
 * The lesson's homework: its primary (AI-drafted) assignment, edited with PUT /lessons/:id/assignment,
 * plus links to any extra assignments attached to the lesson. All of them publish with the lesson.
 */
export function AssignmentEditor({ lesson }: { lesson: LessonDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const a = lesson.assignment;

  const save = useMutation({
    mutationFn: (input: AssignmentInput) => api.put<Assignment>(`/lessons/${lesson.id}/assignment`, input),
    onSuccess: (saved) => {
      const prev = qc.getQueryData<LessonDetail>(lessonKey(lesson.id));
      if (prev) qc.setQueryData<LessonDetail>(lessonKey(lesson.id), { ...prev, assignment: saved });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast('Assignment saved');
    },
  });

  const others = useQuery({
    queryKey: ['assignments', { lessonId: lesson.id }],
    queryFn: () => api.get<AssignmentSummary[]>('/assignments', { lessonId: lesson.id }),
  });
  const extra = (others.data ?? []).filter((x) => x.id !== a?.id);

  return (
    <Card>
      <CardHeader
        eyebrow="Homework"
        title="Assignment"
        actions={a ? <AssignmentStatusBadge status={a.status} /> : null}
      />
      <CardBody className="flex flex-col gap-6">
        <div>
          {a && (
            <ButtonLink href={`/teacher/assignments/${a.id}`} variant="secondary" size="sm" className="mb-4">
              Open submissions
            </ButtonLink>
          )}
          {!a && (
            <p className="mb-4 text-sm text-muted">
              No assignment yet. Add one and students in {lesson.section.name} will see it when the lesson is published.
            </p>
          )}
          <AssignmentForm
            key={a?.id ?? 'new'}
            initial={a}
            onSubmit={(input) => save.mutate(input)}
            pending={save.isPending}
            error={save.error}
            submitLabel="Save assignment"
          />
        </div>

        <section className="border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-extrabold">More assignments for this lesson</h3>
          {extra.length === 0 ? (
            <p className="mb-3 text-sm text-muted">None yet. Extra assignments are published together with the lesson.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-2">
              {extra.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
                  <Link href={`/teacher/assignments/${x.id}`} className="inline-flex min-h-6 items-center font-bold underline-offset-4 hover:underline">
                    {x.title}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {x.submitted} / {x.enrolled} handed in
                    <AssignmentStatusBadge status={x.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setAdding(true)}>
            Add another assignment
          </Button>
        </section>
      </CardBody>
      {adding && <AddAssignmentDialog lesson={lesson} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddAssignmentDialog({ lesson, onClose }: { lesson: LessonDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (input: AssignmentInput) => api.post<Assignment>(`/lessons/${lesson.id}/assignments`, input),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast('Assignment added');
      onClose();
      router.push(`/teacher/assignments/${created.id}`);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add another assignment"
      description={`Attached to “${lesson.title}”. It is published together with the lesson${lesson.status === 'published' ? ', or on its own from its page' : ''}.`}
      size="lg"
    >
      <AssignmentForm initial={null} onSubmit={(input) => create.mutate(input)} pending={create.isPending} error={create.error} submitLabel="Add assignment" />
    </Dialog>
  );
}
