'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { CourseDetail, Unit, UnitDraft, UnitInput } from '@classiq/shared';
import { Button, ButtonLink, Dialog, EmptyState, Field, InlineError, Input, Textarea, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { api, errorMessage } from '@/lib/api';

const courseKey = (id: string) => ['curriculum', 'courses', id];

/** Ordered units of a course: add, edit (with an AI-drafted summary), reorder and delete (course owner only). */
export function UnitsEditor({ course, editable }: { course: CourseDetail; editable: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: courseKey(course.id) });
    void qc.invalidateQueries({ queryKey: ['curriculum', 'courses'] });
  };
  const add = useMutation({
    mutationFn: (body: UnitInput) => api.post<Unit>(`/curriculum/courses/${course.id}/units`, body),
    onSuccess: () => {
      setTitle('');
      refresh();
    },
  });
  const reorder = useMutation({
    mutationFn: (unitIds: string[]) => api.put<CourseDetail>(`/curriculum/courses/${course.id}/units/order`, { unitIds }),
    onSuccess: (c) => qc.setQueryData(courseKey(course.id), c),
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/curriculum/units/${id}`),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
  });

  const move = (i: number, dir: -1 | 1) => {
    const ids = course.units.map((u) => u.id);
    const j = i + dir;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) add.mutate({ title: title.trim() });
  }

  return (
    <div className="space-y-4">
      {course.units.length === 0 ? (
        <EmptyState title="No units yet" description={editable ? 'Add the chapters or topics of this course below.' : 'The course owner has not added units yet.'} />
      ) : (
        <ol className="divide-y divide-line border border-line rounded-card">
          {course.units.map((u, i) => (
            <li key={u.id} className="flex flex-wrap items-start gap-3 p-3">
              <span className="w-6 pt-0.5 text-right font-display text-sm font-black tabular-nums text-muted">{u.position}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{u.title}</p>
                {u.summary ? <p className="line-clamp-2 text-xs text-muted">{u.summary}</p> : <p className="text-xs text-muted">No summary yet</p>}
                {u.objectives.length > 0 && <p className="text-xs text-muted">{u.objectives.length} objectives</p>}
              </div>
              <div className="flex items-center gap-1">
                <ButtonLink href={`/teacher/resources/new?courseId=${course.id}&unitId=${u.id}`} variant="ghost" size="sm" icon={<Sparkles className="size-4" aria-hidden />}>
                  Create resource
                </ButtonLink>
                {editable && (
                  <>
                    <Button variant="ghost" size="sm" aria-label={`Move ${u.title} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${u.title} down`}
                      disabled={i === course.units.length - 1 || reorder.isPending}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Edit ${u.title}`} onClick={() => setEditing(u)}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${u.title}`} onClick={() => setDeleting(u)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {editable && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Field label="New unit title" className="min-w-64 flex-1">
            {(p) => <Input {...p} maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Button type="submit" variant="secondary" icon={<Plus className="size-4" aria-hidden />} loading={add.isPending} disabled={!title.trim()}>
            Add unit
          </Button>
          <div className="w-full">
            <InlineError error={add.error} />
          </div>
        </form>
      )}

      {editing && <UnitDialog unit={editing} courseId={course.id} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this unit?"
        description={`“${deleting?.title ?? ''}” is removed from the course. Materials attached to it stay in your library.`}
        confirmLabel="Delete unit"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function UnitDialog({ unit, courseId, onClose }: { unit: Unit; courseId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(unit.title);
  const [summary, setSummary] = useState(unit.summary ?? '');
  const [objectives, setObjectives] = useState(unit.objectives.join('\n'));

  const draft = useMutation({
    mutationFn: () => api.post<UnitDraft>(`/curriculum/units/${unit.id}/draft-summary`),
    onSuccess: (d) => {
      setSummary(d.summary);
      setObjectives(d.objectives.join('\n'));
      toast('Draft ready — review and edit it, then save.', 'info');
    },
  });
  const save = useMutation({
    mutationFn: (body: UnitInput) => api.patch<Unit>(`/curriculum/units/${unit.id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: courseKey(courseId) });
      toast('Unit saved');
      onClose();
    },
  });

  const objectiveList = objectives
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit unit"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!title.trim() || objectiveList.length > 20}
            onClick={() => save.mutate({ title: title.trim(), summary, objectives: objectiveList })}
          >
            Save unit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          {(p) => <Input {...p} maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">The summary and objectives ground every AI resource made for this unit.</p>
          <Button variant="secondary" size="sm" icon={<Sparkles className="size-4" aria-hidden />} loading={draft.isPending} onClick={() => draft.mutate()}>
            Draft with AI
          </Button>
        </div>
        <InlineError error={draft.error} />
        <Field label="Summary" hint="What the unit covers: key concepts, skills, examples.">
          {(p) => <Textarea {...p} rows={6} maxLength={8000} value={summary} onChange={(e) => setSummary(e.target.value)} />}
        </Field>
        <Field label="Learning objectives" hint="One per line (up to 20)." error={objectiveList.length > 20 ? 'At most 20 objectives' : null}>
          {(p) => <Textarea {...p} rows={5} value={objectives} onChange={(e) => setObjectives(e.target.value)} />}
        </Field>
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}
