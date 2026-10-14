'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MAX_SUBMISSION_FILES, type Assignment, type AssignmentInput, type LatePolicy, type RubricItem } from '@classiq/shared';
import { Button, Checkbox, Field, InlineError, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fromLocalInput, toLocalInput } from '@/components/teacher/status';

const MAX_RUBRIC = 20;

interface RubricRow {
  criterion: string;
  marks: string;
  descriptor: string;
}

const toRow = (r: RubricItem): RubricRow => ({ criterion: r.criterion, marks: String(r.marks), descriptor: r.descriptor });

export const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  allow_late: 'Allow late (flagged)',
  closed: 'Close at due date',
};

/**
 * Assignment fields shared by the lesson page, the "New assignment" dialog and the assignment page:
 * title, instructions, rubric, time, due date, late policy, file uploads and reminders.
 * `children` render above the fields (e.g. class and lesson pickers).
 */
export function AssignmentForm({
  initial,
  onSubmit,
  pending,
  error,
  submitLabel,
  disabled,
  children,
}: {
  initial: Assignment | null;
  onSubmit: (input: AssignmentInput) => void;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [rubric, setRubric] = useState<RubricRow[]>(initial?.rubric.map(toRow) ?? []);
  const [minutes, setMinutes] = useState(initial?.estimatedMinutes != null ? String(initial.estimatedMinutes) : '');
  const [due, setDue] = useState(toLocalInput(initial?.dueAt));
  const [latePolicy, setLatePolicy] = useState<LatePolicy>(initial?.latePolicy ?? 'allow_late');
  const [allowFiles, setAllowFiles] = useState(initial?.allowFiles ?? true);
  const [maxFiles, setMaxFiles] = useState(String(initial?.maxFiles ?? 5));
  const [reminders, setReminders] = useState(initial?.reminders ?? true);

  const fe = error instanceof ApiError ? error.fieldErrors : {};
  const totalMarks = rubric.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);

  function update(i: number, patch: Partial<RubricRow>) {
    setRubric((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      prompt: prompt.trim(),
      rubric: rubric
        .filter((r) => r.criterion.trim())
        .map((r) => ({ criterion: r.criterion.trim(), marks: Math.max(0, Math.round(Number(r.marks) || 0)), descriptor: r.descriptor.trim() })),
      estimatedMinutes: minutes ? Math.round(Number(minutes)) : null,
      dueAt: fromLocalInput(due),
      latePolicy,
      allowFiles,
      maxFiles: Math.min(MAX_SUBMISSION_FILES, Math.max(1, Math.round(Number(maxFiles) || 1))),
      reminders,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {children}
      <Field label="Assignment title" required error={fe.title}>
        {(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="Instructions" required error={fe.prompt} hint="What should students do?">
        {(p) => <Textarea {...p} rows={4} maxLength={5000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-bold text-ink-2">
          Rubric{rubric.length > 0 ? ` · ${totalMarks} marks in total` : ''}
        </legend>
        {rubric.length === 0 && <p className="text-sm text-muted">No rubric rows. Add criteria to explain how you will mark it.</p>}
        {rubric.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-control border border-line p-3 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
            <Field label={`Criterion ${i + 1}`} error={fe[`rubric.${i}.criterion`]}>
              {(p) => <Input {...p} value={r.criterion} maxLength={200} onChange={(e) => update(i, { criterion: e.target.value })} />}
            </Field>
            <Field label={`Marks for criterion ${i + 1}`} error={fe[`rubric.${i}.marks`]}>
              {(p) => (
                <Input {...p} type="number" min={0} max={100} inputMode="numeric" value={r.marks} onChange={(e) => update(i, { marks: e.target.value })} />
              )}
            </Field>
            <Button
              variant="ghost"
              size="md"
              className="self-end"
              aria-label={`Remove criterion ${i + 1}`}
              onClick={() => setRubric((rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
            <Field label={`Descriptor for criterion ${i + 1}`} error={fe[`rubric.${i}.descriptor`]} className="sm:col-span-3">
              {(p) => (
                <Input
                  {...p}
                  value={r.descriptor}
                  maxLength={1000}
                  placeholder="What earns full marks"
                  onChange={(e) => update(i, { descriptor: e.target.value })}
                />
              )}
            </Field>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="size-3.5" aria-hidden />}
          disabled={rubric.length >= MAX_RUBRIC}
          onClick={() => setRubric((rows) => [...rows, { criterion: '', marks: '5', descriptor: '' }])}
        >
          Add criterion
        </Button>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Estimated minutes" error={fe.estimatedMinutes}>
          {(p) => <Input {...p} type="number" min={1} max={600} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
        </Field>
        <Field label="Due date" error={fe.dueAt} hint="Optional.">
          {(p) => <Input {...p} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
        <Field
          label="Late submissions"
          error={fe.latePolicy}
          hint={latePolicy === 'allow_late' ? 'Work handed in after the due date is accepted and marked late.' : 'Students cannot submit after the due date.'}
        >
          {(p) => (
            <Select {...p} value={latePolicy} onChange={(e) => setLatePolicy(e.target.value as LatePolicy)}>
              {(Object.keys(LATE_POLICY_LABEL) as LatePolicy[]).map((v) => (
                <option key={v} value={v}>
                  {LATE_POLICY_LABEL[v]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Maximum files per student" error={fe.maxFiles} hint={`1 to ${MAX_SUBMISSION_FILES}`}>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={1}
              max={MAX_SUBMISSION_FILES}
              inputMode="numeric"
              disabled={!allowFiles}
              value={maxFiles}
              onChange={(e) => setMaxFiles(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-3">
        <Checkbox
          label="Allow file uploads (photos of written work, PDF, Word)"
          checked={allowFiles}
          onChange={(e) => setAllowFiles(e.target.checked)}
        />
        <Checkbox
          label="Email reminders 24 hours before the due date"
          checked={reminders}
          onChange={(e) => setReminders(e.target.checked)}
        />
      </div>

      <InlineError error={error && Object.keys(fe).length === 0 ? error : null} />
      <Button type="submit" loading={pending} disabled={disabled || !title.trim() || !prompt.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
