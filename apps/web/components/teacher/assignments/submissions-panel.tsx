'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import type { Assignment, ReturnSubmissionsResult, SubmissionTrackerRow } from '@classpulse/shared';
import { Button, EmptyState, ErrorState, LoadingBlock, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { GradingDialog } from './grading-dialog';
import { marksText, TrackerBadge } from './status';

/** Every enrolled student with their submission state; opens the grading panel. */
export function SubmissionsPanel({ assignment }: { assignment: Assignment }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<SubmissionTrackerRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const q = useQuery({
    queryKey: ['assignments', assignment.id, 'submissions'],
    queryFn: () => api.get<SubmissionTrackerRow[]>(`/assignments/${assignment.id}/submissions`),
  });

  const returnAll = useMutation({
    mutationFn: () => api.post<ReturnSubmissionsResult>(`/assignments/${assignment.id}/return-all`),
    onSuccess: (r) => {
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast(r.returned === 1 ? '1 submission returned' : `${r.returned} submissions returned`);
    },
  });

  if (q.isPending) return <LoadingBlock label="Loading submissions…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const rows = q.data;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-8" aria-hidden />}
        title="No students in this class yet"
        description="Students appear here once they join the class."
      />
    );
  }

  const count = (s: SubmissionTrackerRow['status']) => rows.filter((r) => r.status === s).length;
  const gradedWaiting = rows.filter((r) => r.gradedAt && r.status !== 'returned' && r.status !== 'missing').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rows.length - count('missing')} of {rows.length} handed in · {count('late')} late · {count('returned')} returned · {count('missing')} missing
        </p>
        <Button variant="secondary" disabled={gradedWaiting === 0} onClick={() => setConfirming(true)}>
          Return all graded{gradedWaiting > 0 ? ` (${gradedWaiting})` : ''}
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Status</TH>
            <TH>Handed in</TH>
            <TH className="text-right">Files</TH>
            <TH className="text-right">Marks</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.student.id}>
              <TD className="min-w-40">
                <p className="font-bold">{r.student.name}</p>
                {r.student.rollNumber && <p className="text-xs text-muted">Roll {r.student.rollNumber}</p>}
              </TD>
              <TD>
                <TrackerBadge status={r.status} />
              </TD>
              <TD className="whitespace-nowrap text-muted">{r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</TD>
              <TD className="text-right tabular-nums">{r.fileCount}</TD>
              <TD className="whitespace-nowrap text-right tabular-nums">{r.submissionId ? marksText(r.totalMarks, r.maxMarks) : '—'}</TD>
              <TD className="text-right">
                {r.submissionId && (
                  <Button
                    size="sm"
                    variant={r.status === 'returned' ? 'ghost' : 'secondary'}
                    onClick={() => setOpen(r)}
                    aria-label={`${r.status === 'returned' ? 'View' : 'Grade'} work by ${r.student.name}`}
                  >
                    {r.status === 'returned' ? 'View' : 'Grade'}
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {open?.submissionId && (
        <GradingDialog assignment={assignment} submissionId={open.submissionId} studentName={open.student.name} onClose={() => setOpen(null)} />
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Return all graded work?"
        description={`${gradedWaiting} graded submission${gradedWaiting === 1 ? '' : 's'} will be returned. Students then see their marks and feedback and can no longer change their work.`}
        confirmLabel="Return graded work"
        onConfirm={() => returnAll.mutate()}
        loading={returnAll.isPending}
        error={returnAll.error}
      />
    </div>
  );
}
