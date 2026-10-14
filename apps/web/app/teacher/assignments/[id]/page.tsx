'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Assignment, AssignmentInput } from '@classiq/shared';
import { Button, Card, CardBody, ErrorState, InlineError, LoadingBlock, PageHeader, Tabs, useToast } from '@/components/ui';
import { AssignmentForm, LATE_POLICY_LABEL } from '@/components/teacher/assignments/assignment-form';
import { AssignmentStatusBadge } from '@/components/teacher/assignments/status';
import { SubmissionsPanel } from '@/components/teacher/assignments/submissions-panel';
import { ConfirmDialog, useTeacherSections } from '@/components/teacher/common';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type Tab = 'details' | 'submissions';

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['assignments', id], queryFn: () => api.get<Assignment>(`/assignments/${id}`) });

  if (q.isPending) return <LoadingBlock label="Loading assignment…" />;
  if (q.isError)
    return (
      <>
        <PageHeader title="Assignment" back={{ href: '/teacher/assignments', label: 'Assignments' }} />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </>
    );
  return <AssignmentWorkspace assignment={q.data} />;
}

function AssignmentWorkspace({ assignment: a }: { assignment: Assignment }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const sections = useTeacherSections();
  const [tab, setTab] = useState<Tab>(a.status === 'draft' ? 'details' : 'submissions');
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);
  const sectionName = sections.data?.find((s) => s.id === a.sectionId)?.name;

  const onSaved = (updated: Assignment) => {
    qc.setQueryData(['assignments', a.id], updated);
    void qc.invalidateQueries({ queryKey: ['assignments'] });
  };

  const save = useMutation({
    mutationFn: (input: AssignmentInput) => api.patch<Assignment>(`/assignments/${a.id}`, input),
    onSuccess: (updated) => {
      onSaved(updated);
      toast('Assignment saved');
    },
  });
  const publish = useMutation({
    mutationFn: () => api.post<Assignment>(`/assignments/${a.id}/publish`),
    onSuccess: (updated) => {
      onSaved(updated);
      toast(a.status === 'closed' ? 'Assignment re-opened' : 'Assignment published');
    },
  });
  const close = useMutation({
    mutationFn: () => api.post<Assignment>(`/assignments/${a.id}/close`),
    onSuccess: (updated) => {
      setConfirm(null);
      onSaved(updated);
      toast('Assignment closed');
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/assignments/${a.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast('Assignment deleted');
      router.push('/teacher/assignments');
    },
  });

  return (
    <>
      <PageHeader
        back={{ href: '/teacher/assignments', label: 'Assignments' }}
        eyebrow={[sectionName, a.lessonId ? 'Lesson assignment' : 'Standalone'].filter(Boolean).join(' · ')}
        title={a.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AssignmentStatusBadge status={a.status} />
            <span>{a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}</span>
            <span>{LATE_POLICY_LABEL[a.latePolicy]}</span>
            {a.lessonId && (
              <Link href={`/teacher/lessons/${a.lessonId}`} className="inline-flex min-h-6 items-center font-bold underline underline-offset-4">
                Open lesson
              </Link>
            )}
          </span>
        }
        actions={
          <>
            {a.status === 'draft' && (
              <Button variant="ghost" onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            )}
            {a.status === 'published' ? (
              <Button variant="secondary" onClick={() => setConfirm('close')}>
                Close submissions
              </Button>
            ) : (
              <Button loading={publish.isPending} onClick={() => publish.mutate()}>
                {a.status === 'closed' ? 'Re-open' : 'Publish'}
              </Button>
            )}
          </>
        }
      />
      {publish.error != null && (
        <div className="mb-4">
          <InlineError error={publish.error} />
        </div>
      )}

      <Tabs<Tab>
        label="Assignment sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'details', label: 'Details' },
          { value: 'submissions', label: 'Submissions' },
        ]}
      />
      <div role="tabpanel" aria-label={tab === 'details' ? 'Details' : 'Submissions'} className="mt-4">
        {tab === 'details' ? (
          <Card>
            <CardBody>
              <AssignmentForm key={a.id} initial={a} onSubmit={(input) => save.mutate(input)} pending={save.isPending} error={save.error} submitLabel="Save changes" />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <SubmissionsPanel assignment={a} />
            </CardBody>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'close'}
        onClose={() => setConfirm(null)}
        title="Close submissions?"
        description="Students can no longer hand in or change work. You can still grade and return it, and re-open the assignment later."
        confirmLabel="Close submissions"
        onConfirm={() => close.mutate()}
        loading={close.isPending}
        error={close.error}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this assignment?"
        description="This cannot be undone."
        confirmLabel="Delete assignment"
        danger
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        error={remove.error}
      />
    </>
  );
}
