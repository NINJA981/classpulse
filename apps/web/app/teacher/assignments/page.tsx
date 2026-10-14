'use client';
import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import type { AssignmentStatus, AssignmentSummary } from '@classiq/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { NewAssignmentDialog } from '@/components/teacher/assignments/new-assignment-dialog';
import { ASSIGNMENT_STATUS_LABEL, AssignmentStatusBadge } from '@/components/teacher/assignments/status';
import { useTeacherSections } from '@/components/teacher/common';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export default function AssignmentsPage() {
  const [creating, setCreating] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | ''>('');
  const sections = useTeacherSections();
  const filters = { sectionId: sectionId || undefined, status: status || undefined };
  const q = useQuery({
    queryKey: ['assignments', filters],
    queryFn: () => api.get<AssignmentSummary[]>('/assignments', filters),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(sectionId || status);

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Assignments"
        description="Homework for your classes: standalone or attached to a lesson. Track who has handed in work, grade it and return it."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            New assignment
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Class">
          {(p) => (
            <Select {...p} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All classes</option>
              {(sections.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | '')}>
              <option value="">All statuses</option>
              {(Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ASSIGNMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Card>
        {q.isPending ? (
          <LoadingBlock label="Loading assignments…" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title={filtered ? 'No assignments match these filters' : 'No assignments yet'}
            description={filtered ? 'Try another class or status.' : 'Create homework for a class, or add one from a lesson page.'}
            action={
              filtered ? undefined : (
                <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
                  New assignment
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Assignment</TH>
                <TH>Status</TH>
                <TH>Due</TH>
                <TH className="text-right">Handed in</TH>
                <TH className="text-right">Late</TH>
                <TH className="text-right">Returned</TH>
              </TR>
            </THead>
            <TBody>
              {q.data.map((a) => (
                <TR key={a.id}>
                  <TD className="min-w-56">
                    <Link href={`/teacher/assignments/${a.id}`} className="font-bold underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {a.section.name}
                      {a.lesson ? ` · ${a.lesson.title}` : ' · Standalone'}
                    </p>
                  </TD>
                  <TD>
                    <AssignmentStatusBadge status={a.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{a.dueAt ? formatDateTime(a.dueAt) : 'No due date'}</TD>
                  <TD className="text-right tabular-nums">
                    {a.submitted} / {a.enrolled}
                  </TD>
                  <TD className="text-right tabular-nums">{a.late}</TD>
                  <TD className="text-right tabular-nums">{a.returned}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {creating && <NewAssignmentDialog open onClose={() => setCreating(false)} defaultSectionId={sectionId || undefined} />}
    </>
  );
}
