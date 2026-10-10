'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Clock, Send } from 'lucide-react';
import type { StudentAssignment, SubmitAssignmentInput } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, Field, InlineError, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { dueInfo, DueText, Note } from '../common';

const MAX_LENGTH = 20000;

export function AssignmentCard({ assignment, now }: { assignment: StudentAssignment; now: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(assignment.submission?.text ?? '');
  const due = dueInfo(assignment.dueAt, Boolean(assignment.submission), now);
  const pastDue = assignment.dueAt != null && new Date(assignment.dueAt).getTime() < now;
  const totalMarks = assignment.rubric.reduce((sum, r) => sum + r.marks, 0);
  const panelId = `assignment-${assignment.id}`;

  const submit = useMutation({
    mutationFn: (body: SubmitAssignmentInput) => api.post<StudentAssignment>(`/student/assignments/${assignment.id}/submission`, body),
    onSuccess: (updated) => {
      qc.setQueryData<StudentAssignment[]>(['student', 'assignments'], (list) => list?.map((a) => (a.id === updated.id ? updated : a)));
      void qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
      setText(updated.submission?.text ?? text);
      toast(assignment.submission ? 'Submission updated' : 'Assignment submitted');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || submit.isPending) return;
    submit.mutate({ text: text.trim() });
  }

  const fieldError = submit.error instanceof ApiError ? submit.error.fieldErrors.text : undefined;
  const unchanged = assignment.submission != null && text.trim() === assignment.submission.text.trim();

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={due.tone}>{due.label}</Badge>
            {assignment.estimatedMinutes != null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Clock className="size-3.5" aria-hidden /> ~{assignment.estimatedMinutes} min
              </span>
            )}
          </div>
          <p className="font-display text-lg font-extrabold leading-snug">{assignment.title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {assignment.lessonTitle} · {assignment.sectionName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            <DueText dueAt={assignment.dueAt} />
          </p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center" aria-hidden>
          {open ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </span>
        <span className="sr-only">{open ? 'Hide details' : 'Show details'}</span>
      </button>

      {open && (
        <CardBody id={panelId} className="flex flex-col gap-4 border-t border-line">
          <section>
            <h3 className="mb-1 text-sm font-extrabold">Task</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{assignment.prompt}</p>
          </section>

          {assignment.rubric.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-extrabold">
                How it’s marked <span className="font-semibold text-muted">({totalMarks} marks)</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {assignment.rubric.map((r, i) => (
                  <li key={i} className="rounded-control border border-line bg-surface-2 px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-bold">{r.criterion}</span>
                      <span className="shrink-0 font-display font-black tabular-nums">{r.marks}</span>
                    </div>
                    {r.descriptor && <p className="mt-0.5 text-ink-2">{r.descriptor}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {assignment.submission && (
            <Note tone="success">
              <p className="font-bold">Submitted {formatDateTime(assignment.submission.submittedAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-2">{assignment.submission.text}</p>
            </Note>
          )}

          {pastDue && (
            <Note tone="warning">
              <p className="font-semibold">The due date has passed. Your teacher may no longer accept changes.</p>
            </Note>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <Field
              label="Your answer"
              error={fieldError}
              hint={assignment.submission ? 'Submitting again replaces your previous answer.' : `${text.length} / ${MAX_LENGTH} characters`}
            >
              {(p) => (
                <Textarea
                  {...p}
                  rows={8}
                  value={text}
                  maxLength={MAX_LENGTH}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (submit.isError) submit.reset();
                  }}
                  className="text-base"
                />
              )}
            </Field>
            {!fieldError && <InlineError error={submit.error} />}
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto sm:self-end"
              loading={submit.isPending}
              disabled={!text.trim() || unchanged}
              icon={<Send className="size-5" aria-hidden />}
            >
              Submit assignment
            </Button>
          </form>
        </CardBody>
      )}
    </Card>
  );
}
