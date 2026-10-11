'use client';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Clock, FileText, Paperclip, Send, X } from 'lucide-react';
import { SUBMISSION_FILE_MAX_MB, type StudentAssignment, type StudentAssignmentState } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, Field, InlineError, Textarea, useToast, type BadgeTone } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { dueInfo, DueText, Note } from '../common';
import { fileProblem, SUBMISSION_ACCEPT, uploadSubmission } from './upload';

const MAX_LENGTH = 20000;

const STATE: Record<StudentAssignmentState, { label: string; tone: BadgeTone }> = {
  todo: { label: 'To do', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'success' },
  late: { label: 'Late', tone: 'warning' },
  returned: { label: 'Returned', tone: 'accent' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function AssignmentCard({ assignment, now }: { assignment: StudentAssignment; now: number }) {
  const [open, setOpen] = useState(false);
  const state = STATE[assignment.state];
  const due = dueInfo(assignment.dueAt, assignment.submission !== null, now);
  const panelId = `assignment-${assignment.id}`;

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
            <Badge tone={state.tone}>{state.label}</Badge>
            {assignment.state === 'todo' && <Badge tone={due.tone}>{due.label}</Badge>}
            {assignment.estimatedMinutes != null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Clock className="size-3.5" aria-hidden /> ~{assignment.estimatedMinutes} min
              </span>
            )}
          </div>
          <p className="font-display text-lg font-extrabold leading-snug [overflow-wrap:anywhere]">{assignment.title}</p>
          <p className="mt-0.5 text-sm text-muted">{[assignment.lessonTitle, assignment.sectionName].filter(Boolean).join(' · ')}</p>
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
          <AssignmentDetails assignment={assignment} now={now} />
        </CardBody>
      )}
    </Card>
  );
}

function AssignmentDetails({ assignment, now }: { assignment: StudentAssignment; now: number }) {
  const sub = assignment.submission;
  const totalMarks = assignment.rubric.reduce((sum, r) => sum + r.marks, 0);
  const pastDue = assignment.dueAt != null && new Date(assignment.dueAt).getTime() < now;
  const canSubmit = assignment.state !== 'returned' && assignment.state !== 'closed' && !(pastDue && assignment.latePolicy === 'closed');

  return (
    <>
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

      {sub?.status === 'returned' && <ReturnedWork submission={sub} />}

      {sub && sub.status !== 'returned' && (
        <Note tone={sub.isLate ? 'warning' : 'success'}>
          <p className="font-bold">
            {sub.isLate ? 'Handed in late' : 'Handed in'} {formatDateTime(sub.submittedAt)}
          </p>
          <p className="mt-0.5 text-ink-2">Your teacher has not returned it yet. You can still change it.</p>
        </Note>
      )}

      {assignment.state === 'closed' && !sub && (
        <Note tone="warning">
          <p className="font-semibold">This assignment is closed. Your teacher is no longer accepting work.</p>
        </Note>
      )}
      {canSubmit && pastDue && assignment.latePolicy === 'allow_late' && (
        <Note tone="warning">
          <p className="font-semibold">The due date has passed. You can still hand in work, but it will be marked late.</p>
        </Note>
      )}
      {assignment.state !== 'closed' && assignment.state !== 'returned' && pastDue && assignment.latePolicy === 'closed' && (
        <Note tone="warning">
          <p className="font-semibold">Submissions closed at the due date.</p>
        </Note>
      )}

      {canSubmit ? (
        <SubmissionForm assignment={assignment} />
      ) : (
        sub &&
        sub.status !== 'returned' && <SubmittedWork text={sub.text} files={sub.files} />
      )}
    </>
  );
}

function SubmittedWork({ text, files }: { text: string | null; files: NonNullable<StudentAssignment['submission']>['files'] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold">Your work</h3>
      {text ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{text}</p> : <p className="text-sm text-muted">No typed answer.</p>}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id}>
              <FileLink name={f.name} url={f.url} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileLink({ name, url }: { name: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 max-w-full items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline">
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </a>
  );
}

function ReturnedWork({ submission: sub }: { submission: NonNullable<StudentAssignment['submission']> }) {
  return (
    <section className="flex flex-col gap-3 rounded-control border border-line-strong bg-accent-soft p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold">Returned by your teacher</h3>
        {sub.totalMarks != null && (
          <p className="font-display text-2xl font-black tabular-nums">
            {sub.totalMarks} <span className="text-base font-bold text-muted">/ {sub.maxMarks}</span>
          </p>
        )}
      </div>
      {sub.rubricMarks && sub.rubricMarks.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Marks per criterion">
          {sub.rubricMarks.map((m) => (
            <li key={m.criterion} className="flex justify-between gap-3">
              <span>{m.criterion}</span>
              <span className="font-bold tabular-nums">{m.marks}</span>
            </li>
          ))}
        </ul>
      )}
      {sub.feedback && (
        <div>
          <h4 className="text-xs font-bold text-ink-2">Feedback</h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{sub.feedback}</p>
        </div>
      )}
      <SubmittedWork text={sub.text} files={sub.files} />
    </section>
  );
}

function SubmissionForm({ assignment }: { assignment: StudentAssignment }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const sub = assignment.submission;
  const [text, setText] = useState(sub?.text ?? '');
  const [picked, setPicked] = useState<File[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const existing = sub?.files ?? [];
  const slots = assignment.allowFiles ? assignment.maxFiles - existing.length - picked.length : 0;

  function apply(updated: StudentAssignment) {
    qc.setQueryData<StudentAssignment[]>(['student', 'assignments'], (list) => list?.map((a) => (a.id === updated.id ? updated : a)));
    void qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
  }

  const submit = useMutation({
    mutationFn: () => uploadSubmission(assignment.id, text.trim(), picked, setProgress),
    onSuccess: (updated) => {
      apply(updated);
      setPicked([]);
      setText(updated.submission?.text ?? '');
      toast(sub ? 'Submission updated' : 'Assignment submitted');
    },
    onSettled: () => setProgress(null),
  });

  const removeFile = useMutation({
    mutationFn: (fileId: string) => api.delete<StudentAssignment>(`/student/assignments/${assignment.id}/files/${fileId}`),
    onSuccess: (updated) => {
      apply(updated);
      toast('File removed');
    },
  });

  function onPick(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const problems = files.map(fileProblem).filter((p): p is string => p !== null);
    const ok = files.filter((f) => fileProblem(f) === null);
    const room = Math.max(0, slots);
    if (ok.length > room) problems.push(`You can attach ${assignment.maxFiles} file${assignment.maxFiles === 1 ? '' : 's'} in total.`);
    setPicked((prev) => [...prev, ...ok.slice(0, room)]);
    setPickError(problems.length ? problems.join(' ') : null);
    if (fileInput.current) fileInput.current.value = '';
    if (submit.isError) submit.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submit.isPending) return;
    submit.mutate();
  }

  const hasWork = text.trim().length > 0 || existing.length + picked.length > 0;
  const unchanged = sub != null && picked.length === 0 && text.trim() === (sub.text ?? '').trim();
  const fieldError = submit.error instanceof ApiError ? submit.error.fieldErrors.text : undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label="Your answer"
        error={fieldError}
        hint={assignment.allowFiles ? 'Type your answer, attach photos or files of your work, or both.' : `${text.length} / ${MAX_LENGTH} characters`}
      >
        {(p) => (
          <Textarea
            {...p}
            rows={6}
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

      {assignment.allowFiles && (
        <section className="flex flex-col gap-2">
          {existing.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-ink-2">Files you handed in</h3>
              <ul className="flex flex-col gap-1">
                {existing.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-1.5">
                    <FileLink name={f.name} url={f.url} />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${f.name}`}
                      loading={removeFile.isPending && removeFile.variables === f.id}
                      disabled={removeFile.isPending || submit.isPending}
                      onClick={() => removeFile.mutate(f.id)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <InlineError error={removeFile.error} />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-xs font-bold text-ink-2">
              Attach files
            </label>
            <input
              ref={fileInput}
              id={inputId}
              type="file"
              multiple
              accept={SUBMISSION_ACCEPT}
              disabled={slots <= 0 || submit.isPending}
              onChange={(e) => onPick(e.target.files)}
              aria-describedby={`${inputId}-hint`}
              className="min-h-11 w-full max-w-full text-sm file:mr-3 file:min-h-10 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:font-bold file:text-ink"
            />
            <p id={`${inputId}-hint`} className="text-xs text-muted">
              PDF, photos (JPEG, PNG, HEIC) or Word files, up to {SUBMISSION_FILE_MAX_MB} MB each. {existing.length + picked.length} of {assignment.maxFiles} files used.
            </p>
            {pickError && (
              <p role="alert" className="text-xs font-semibold text-danger">
                {pickError}
              </p>
            )}
          </div>

          {picked.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Files to upload">
              {picked.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-control border border-dashed border-line-strong px-3 py-1.5 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Paperclip className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted">{formatSize(f.size)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Don't upload ${f.name}`}
                    disabled={submit.isPending}
                    onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {progress !== null && picked.length > 0 && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 w-full overflow-hidden rounded-control border border-line-strong bg-surface-2"
        >
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!fieldError && <InlineError error={submit.error} />}
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:self-end"
        loading={submit.isPending}
        disabled={!hasWork || unchanged}
        icon={<Send className="size-5" aria-hidden />}
      >
        {sub ? 'Update submission' : 'Submit assignment'}
      </Button>
    </form>
  );
}
