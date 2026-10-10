'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { Assignment, AssignmentInput, LessonDetail, RubricItem } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, CardHeader, Field, InlineError, Input, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { fromLocalInput, toLocalInput } from '@/components/teacher/status';
import { lessonKey } from './use-lesson';

const MAX_RUBRIC = 20;

interface RubricRow {
  criterion: string;
  marks: string;
  descriptor: string;
}

const toRow = (r: RubricItem): RubricRow => ({ criterion: r.criterion, marks: String(r.marks), descriptor: r.descriptor });

/** Follow-up assignment for the lesson: PUT /lessons/:id/assignment. */
export function AssignmentEditor({ lesson }: { lesson: LessonDetail }) {
  const a = lesson.assignment;
  return (
    <Card>
      <CardHeader
        eyebrow="Homework"
        title="Assignment"
        actions={a ? <Badge tone={a.status === 'published' ? 'success' : 'neutral'}>{a.status}</Badge> : null}
      />
      <CardBody>
        {!a && (
          <p className="mb-4 text-sm text-muted">
            No assignment yet. Add one and students in {lesson.section.name} will see it when the lesson is published.
          </p>
        )}
        <AssignmentForm key={a?.id ?? 'new'} lesson={lesson} assignment={a} />
      </CardBody>
    </Card>
  );
}

function AssignmentForm({ lesson, assignment }: { lesson: LessonDetail; assignment: Assignment | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [prompt, setPrompt] = useState(assignment?.prompt ?? '');
  const [rubric, setRubric] = useState<RubricRow[]>(assignment?.rubric.map(toRow) ?? []);
  const [minutes, setMinutes] = useState(assignment?.estimatedMinutes != null ? String(assignment.estimatedMinutes) : '');
  const [due, setDue] = useState(toLocalInput(assignment?.dueAt));

  const save = useMutation({
    mutationFn: (input: AssignmentInput) => api.put<Assignment>(`/lessons/${lesson.id}/assignment`, input),
    onSuccess: (saved) => {
      const prev = qc.getQueryData<LessonDetail>(lessonKey(lesson.id));
      if (prev) qc.setQueryData<LessonDetail>(lessonKey(lesson.id), { ...prev, assignment: saved });
      toast('Assignment saved');
    },
  });
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const totalMarks = rubric.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);

  function update(i: number, patch: Partial<RubricRow>) {
    setRubric((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      title: title.trim(),
      prompt: prompt.trim(),
      rubric: rubric
        .filter((r) => r.criterion.trim())
        .map((r) => ({ criterion: r.criterion.trim(), marks: Math.max(0, Math.round(Number(r.marks) || 0)), descriptor: r.descriptor.trim() })),
      estimatedMinutes: minutes ? Math.round(Number(minutes)) : null,
      dueAt: fromLocalInput(due),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
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
          <div key={i} className="grid grid-cols-1 gap-3 border border-line p-3 rounded-control sm:grid-cols-[minmax(0,1fr)_100px_auto]">
            <Field label={`Criterion ${i + 1}`} error={fe[`rubric.${i}.criterion`]}>
              {(p) => <Input {...p} value={r.criterion} maxLength={200} onChange={(e) => update(i, { criterion: e.target.value })} />}
            </Field>
            <Field label="Marks" error={fe[`rubric.${i}.marks`]}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={r.marks}
                  onChange={(e) => update(i, { marks: e.target.value })}
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              className="self-end"
              aria-label={`Remove criterion ${i + 1}`}
              onClick={() => setRubric((rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
            <Field label="Descriptor" error={fe[`rubric.${i}.descriptor`]} className="sm:col-span-3">
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
          {(p) => (
            <Input {...p} type="number" min={1} max={600} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          )}
        </Field>
        <Field label="Due date" error={fe.dueAt} hint="Optional. Submissions close at this time.">
          {(p) => <Input {...p} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
      </div>

      <InlineError error={save.error && Object.keys(fe).length === 0 ? save.error : null} />
      <Button type="submit" loading={save.isPending} disabled={!title.trim() || !prompt.trim()}>
        Save assignment
      </Button>
    </form>
  );
}
