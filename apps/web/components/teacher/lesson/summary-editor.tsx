'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { LessonDetail, UpdateLessonInput } from '@classpulse/shared';
import { Button, Card, CardBody, CardHeader, Field, InlineError, Input, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { lessonKey } from './use-lesson';

const MAX_TAKEAWAYS = 10;

/** Lesson summary and key takeaways, editable via PATCH /lessons/:id. */
export function SummaryEditor({ lesson, readOnly }: { lesson: LessonDetail; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const empty = !lesson.summary && lesson.keyTakeaways.length === 0;

  return (
    <Card>
      <CardHeader
        eyebrow="Overview"
        title="Summary & key takeaways"
        actions={
          !editing && !readOnly ? (
            <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
              Edit summary
            </Button>
          ) : null
        }
      />
      <CardBody>
        {editing ? (
          <SummaryForm lesson={lesson} onDone={() => setEditing(false)} />
        ) : empty ? (
          <p className="text-sm text-muted">
            No summary yet. It is generated with the quiz{readOnly ? '' : ', or you can write one yourself'}.
          </p>
        ) : (
          <div className="space-y-4">
            {lesson.summary && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{lesson.summary}</p>}
            {lesson.keyTakeaways.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                {lesson.keyTakeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SummaryForm({ lesson, onDone }: { lesson: LessonDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [summary, setSummary] = useState(lesson.summary ?? '');
  const [takeaways, setTakeaways] = useState<string[]>(lesson.keyTakeaways.length ? lesson.keyTakeaways : ['']);

  const save = useMutation({
    mutationFn: (input: UpdateLessonInput) => api.patch<LessonDetail>(`/lessons/${lesson.id}`, input),
    onSuccess: (l) => {
      qc.setQueryData(lessonKey(lesson.id), l);
      toast('Summary saved');
      onDone();
    },
  });
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {};

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ summary: summary.trim(), keyTakeaways: takeaways.map((t) => t.trim()).filter(Boolean) });
      }}
    >
      <Field label="Summary" error={fe.summary} hint="Students see this with the quiz.">
        {(p) => <Textarea {...p} rows={5} maxLength={5000} value={summary} onChange={(e) => setSummary(e.target.value)} />}
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-bold text-ink-2">Key takeaways</legend>
        {takeaways.map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <Field label={`Takeaway ${i + 1}`} error={fe[`keyTakeaways.${i}`]} className="flex-1">
              {(p) => (
                <Input
                  {...p}
                  value={t}
                  maxLength={500}
                  onChange={(e) => setTakeaways((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              className="mt-6"
              aria-label={`Remove takeaway ${i + 1}`}
              onClick={() => setTakeaways((xs) => xs.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="size-3.5" aria-hidden />}
          disabled={takeaways.length >= MAX_TAKEAWAYS}
          onClick={() => setTakeaways((xs) => [...xs, ''])}
        >
          Add takeaway
        </Button>
      </fieldset>
      <InlineError error={save.error && Object.keys(fe).length === 0 ? save.error : null} />
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          Save summary
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
