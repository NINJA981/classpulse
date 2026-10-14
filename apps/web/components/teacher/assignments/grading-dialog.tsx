'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, Sparkles } from 'lucide-react';
import type { AiGradeSuggestion, Assignment, GradeSubmissionInput, RubricMark, SubmissionDetail } from '@classiq/shared';
import { Badge, Button, Dialog, ErrorState, Field, InlineError, Input, LoadingBlock, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const isImage = (mime: string) => mime === 'image/jpeg' || mime === 'image/png';
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const submissionKey = (assignmentId: string, submissionId: string) => ['assignments', assignmentId, 'submissions', submissionId];

/** Grading panel for one submission: the work, rubric marks, feedback, AI suggestion, save and return. */
export function GradingDialog({
  assignment,
  submissionId,
  studentName,
  onClose,
}: {
  assignment: Assignment;
  submissionId: string;
  studentName: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: submissionKey(assignment.id, submissionId),
    queryFn: () => api.get<SubmissionDetail>(`/assignments/${assignment.id}/submissions/${submissionId}`),
  });
  return (
    <Dialog open onClose={onClose} title={`Work by ${studentName}`} description={assignment.title} size="lg">
      {q.isPending ? (
        <LoadingBlock label="Loading submission…" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <GradingPanel key={q.data.id} assignment={assignment} detail={q.data} />
      )}
    </Dialog>
  );
}

function marksFrom(assignment: Assignment, marks: RubricMark[] | null): string[] {
  return assignment.rubric.map((r) => {
    const m = marks?.find((x) => x.criterion.trim().toLowerCase() === r.criterion.trim().toLowerCase());
    return m ? String(m.marks) : '';
  });
}

function GradingPanel({ assignment, detail }: { assignment: Assignment; detail: SubmissionDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [marks, setMarks] = useState<string[]>(() => marksFrom(assignment, detail.rubricMarks));
  const [feedback, setFeedback] = useState(detail.feedback ?? '');
  const [suggestion, setSuggestion] = useState<AiGradeSuggestion | null>(null);
  const returned = detail.status === 'returned';

  const total = assignment.rubric.reduce((sum, r, i) => sum + Math.min(r.marks, Math.max(0, Number(marks[i]) || 0)), 0);
  const maxMarks = assignment.rubric.reduce((sum, r) => sum + r.marks, 0);

  function gradeInput(): GradeSubmissionInput {
    return {
      rubricMarks: assignment.rubric.flatMap((r, i) =>
        marks[i] === '' ? [] : [{ criterion: r.criterion, marks: Math.min(r.marks, Math.max(0, Number(marks[i]) || 0)) }],
      ),
      feedback: feedback.trim(),
    };
  }

  function refresh(updated: SubmissionDetail) {
    qc.setQueryData(submissionKey(assignment.id, detail.id), updated);
    // Tracker rows and list counts.
    void qc.invalidateQueries({ queryKey: ['assignments'] });
  }

  const save = useMutation({
    mutationFn: () => api.put<SubmissionDetail>(`/assignments/${assignment.id}/submissions/${detail.id}/grade`, gradeInput()),
    onSuccess: (updated) => {
      refresh(updated);
      toast('Grade saved');
    },
  });

  const giveBack = useMutation({
    mutationFn: async () => {
      await api.put<SubmissionDetail>(`/assignments/${assignment.id}/submissions/${detail.id}/grade`, gradeInput());
      return api.post<SubmissionDetail>(`/assignments/${assignment.id}/submissions/${detail.id}/return`);
    },
    onSuccess: (updated) => {
      refresh(updated);
      toast('Returned to the student');
    },
  });

  function applySuggestion(s: AiGradeSuggestion) {
    setMarks(marksFrom(assignment, s.rubricMarks));
    setFeedback(s.feedback);
  }

  const suggest = useMutation({
    mutationFn: () => api.post<AiGradeSuggestion>(`/assignments/${assignment.id}/submissions/${detail.id}/ai-suggest`),
    onSuccess: (s) => {
      setSuggestion(s);
      // The form is only filled in, never saved. A suspicious suggestion is not even filled in.
      if (!s.injectionSuspected) applySuggestion(s);
    },
  });

  const busy = save.isPending || giveBack.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Submitted {formatDateTime(detail.submittedAt)}</span>
        {detail.isLate && <Badge tone="warning">Late</Badge>}
        {returned && <Badge tone="success">Returned {detail.returnedAt ? formatDateTime(detail.returnedAt) : ''}</Badge>}
      </div>

      <section>
        <h3 className="mb-1 text-sm font-extrabold">Answer</h3>
        {detail.text ? (
          <p className="whitespace-pre-wrap rounded-control border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed">{detail.text}</p>
        ) : (
          <p className="text-sm text-muted">No typed answer.</p>
        )}
      </section>

      {detail.files.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-extrabold">Files ({detail.files.length})</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {detail.files.map((f) => (
              <li key={f.id} className="min-w-0 rounded-control border border-line p-2">
                {isImage(f.mime) && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="mb-2 block">
                    {/* Authenticated same-origin file: a plain <img> (next/image cannot optimise it). */}
                    <img src={f.url} alt={`Photo ${f.name}`} className="max-h-72 w-full rounded-control bg-surface-2 object-contain" />
                  </a>
                )}
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-6 max-w-full items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline"
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Open {f.name}</span>
                </a>
                <span className="ml-1 text-xs text-muted">{formatSize(f.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold">Grade</h3>
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles className="size-3.5" aria-hidden />}
            loading={suggest.isPending}
            onClick={() => suggest.mutate()}
          >
            Suggest with AI
          </Button>
        </div>
        <InlineError error={suggest.error} />
        {suggestion?.injectionSuspected && (
          <div role="alert" className="flex gap-3 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-2">
              <p className="font-bold">This work may be trying to steer the AI</p>
              <p className="font-medium">
                It seems to contain instructions aimed at the grader or the AI (for example asking for full marks). The AI&apos;s marks were not
                filled in. Read the work yourself before grading.
              </p>
              {suggestion.note && <p className="font-medium">AI note: {suggestion.note}</p>}
              <div>
                <Button variant="secondary" size="sm" onClick={() => applySuggestion(suggestion)}>
                  Fill in the AI&apos;s marks anyway
                </Button>
              </div>
            </div>
          </div>
        )}
        {suggestion && !suggestion.injectionSuspected && (
          <div role="status" className="rounded-control border border-line-strong bg-accent-soft px-4 py-3 text-sm">
            <p className="font-bold">AI suggestion — review before returning</p>
            <p className="text-ink-2">The marks and feedback below were filled in by the AI. Check and edit them; nothing is sent to the student until you return the work.</p>
            {suggestion.note && <p className="mt-1 text-ink-2">Note: {suggestion.note}</p>}
          </div>
        )}

        {assignment.rubric.length === 0 ? (
          <p className="text-sm text-muted">This assignment has no rubric. Write feedback for the student.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {assignment.rubric.map((r, i) => (
              <Field key={i} label={`${r.criterion} (out of ${r.marks})`} hint={r.descriptor || undefined}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={0}
                    max={r.marks}
                    step={0.5}
                    inputMode="decimal"
                    value={marks[i] ?? ''}
                    onChange={(e) => setMarks((m) => m.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                )}
              </Field>
            ))}
            <p className="text-sm font-bold sm:col-span-2" aria-live="polite">
              Total: {total} / {maxMarks}
            </p>
          </div>
        )}

        <Field label="Feedback for the student" hint="2–5 sentences: what went well and one thing to improve.">
          {(p) => <Textarea {...p} rows={5} maxLength={5000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />}
        </Field>

        <InlineError error={save.error ?? giveBack.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" loading={save.isPending} disabled={busy} onClick={() => save.mutate()}>
            Save grade
          </Button>
          {!returned && (
            <Button loading={giveBack.isPending} disabled={busy} onClick={() => giveBack.mutate()}>
              Return to student
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
