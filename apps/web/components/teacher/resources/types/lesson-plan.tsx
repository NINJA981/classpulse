'use client';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { LessonPlanContent, LessonPlanOptions, type ResourceOptions } from '@classpulse/shared';
import { Button, Field, Input } from '@/components/ui';
import { EditableList, EditableNumber, EditableText, ViewerSection } from '../editable';
import type { OptionsFieldsProps, ViewerProps } from './index';

type Section = LessonPlanContent['sections'][number];

/** Read/edit/print view of a lesson plan. */
export function Viewer({ resource, editable, onChange, mode = 'screen' }: ViewerProps) {
  const parsed = LessonPlanContent.safeParse(resource.content);
  if (!parsed.success) return <p className="text-sm text-muted">This lesson plan has no content yet.</p>;
  const plan = parsed.data;
  const edit = editable && mode === 'screen' && onChange ? onChange : undefined;
  const set = <K extends keyof LessonPlanContent>(key: K, value: LessonPlanContent[K]) => edit?.({ ...plan, [key]: value });
  const setSection = (i: number, patch: Partial<Section>) => set('sections', plan.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const total = plan.sections.reduce((sum, s) => sum + (Number.isFinite(s.durationMin) ? s.durationMin : 0), 0);
  const isEditing = Boolean(edit);

  return (
    <div className="space-y-6 text-sm text-ink">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span>
          Level: <strong className="text-ink">{plan.level || '—'}</strong>
        </span>
        <span>
          Duration: <strong className="text-ink">{plan.durationMin} min</strong>
        </span>
      </div>

      <ViewerSection title="Overview">
        <EditableText label="Overview" multiline value={plan.overview} editable={isEditing} onChange={(v) => set('overview', v)} />
      </ViewerSection>

      <div className="grid gap-6 md:grid-cols-3 print:grid-cols-3">
        <ViewerSection title="Learning objectives">
          <EditableList label="Objective" items={plan.objectives} editable={isEditing} onChange={(v) => set('objectives', v)} />
        </ViewerSection>
        <ViewerSection title="Prerequisites">
          <EditableList label="Prerequisite" items={plan.prerequisites} editable={isEditing} onChange={(v) => set('prerequisites', v)} />
        </ViewerSection>
        <ViewerSection title="Materials">
          <EditableList label="Material" items={plan.materials} editable={isEditing} onChange={(v) => set('materials', v)} />
        </ViewerSection>
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-extrabold">Lesson flow</h3>
          <p className={clsx('text-xs', total === plan.durationMin ? 'text-muted' : 'font-bold text-danger')}>
            {total} of {plan.durationMin} minutes planned
          </p>
        </div>
        <ol className="space-y-3">
          {plan.sections.map((s, i) => (
            <li key={i} className="break-inside-avoid border border-line p-4 rounded-card">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-display text-xs font-black text-muted">{i + 1}.</span>
                <div className="min-w-48 flex-1 font-bold">
                  <EditableText label={`Stage ${i + 1} title`} value={s.title} editable={isEditing} onChange={(v) => setSection(i, { title: v })} />
                </div>
                <EditableNumber
                  label={`Stage ${i + 1} minutes`}
                  value={s.durationMin}
                  min={1}
                  suffix="min"
                  editable={isEditing}
                  onChange={(v) => setSection(i, { durationMin: v })}
                />
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove stage ${i + 1}`}
                    onClick={() => set('sections', plan.sections.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                <div>
                  <p className="eyebrow mb-1">Activity</p>
                  <EditableText label={`Stage ${i + 1} activity`} multiline value={s.activity} editable={isEditing} onChange={(v) => setSection(i, { activity: v })} />
                </div>
                <div>
                  <p className="eyebrow mb-1">Teacher notes</p>
                  <EditableText
                    label={`Stage ${i + 1} teacher notes`}
                    multiline
                    value={s.teacherNotes}
                    editable={isEditing}
                    onChange={(v) => setSection(i, { teacherNotes: v })}
                  />
                </div>
                <div>
                  <p className="eyebrow mb-1">Student task</p>
                  <EditableText
                    label={`Stage ${i + 1} student task`}
                    multiline
                    value={s.studentTask}
                    editable={isEditing}
                    onChange={(v) => setSection(i, { studentTask: v })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        {isEditing && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => set('sections', [...plan.sections, { title: 'New stage', durationMin: 5, activity: '', teacherNotes: '', studentTask: '' }])}
          >
            Add stage
          </Button>
        )}
      </section>

      <ViewerSection title="Assessment">
        <EditableList label="Assessment check" items={plan.assessment} editable={isEditing} onChange={(v) => set('assessment', v)} />
      </ViewerSection>
      <ViewerSection title="Homework">
        <EditableText label="Homework" multiline value={plan.homework} editable={isEditing} onChange={(v) => set('homework', v)} />
      </ViewerSection>
      <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
        <ViewerSection title="Support (struggling learners)">
          <EditableText
            label="Support"
            multiline
            value={plan.differentiation.support}
            editable={isEditing}
            onChange={(v) => set('differentiation', { ...plan.differentiation, support: v })}
          />
        </ViewerSection>
        <ViewerSection title="Extension (advanced learners)">
          <EditableText
            label="Extension"
            multiline
            value={plan.differentiation.extension}
            editable={isEditing}
            onChange={(v) => set('differentiation', { ...plan.differentiation, extension: v })}
          />
        </ViewerSection>
      </div>
    </div>
  );
}

/** Duration per period, number of periods and an optional teaching approach. */
export function OptionsFields({ value, onChange }: OptionsFieldsProps) {
  type Opts = Extract<ResourceOptions, { type: 'lesson_plan' }>;
  // Raw values while typing (the server validates ranges on submit).
  const o: Opts = { ...LessonPlanOptions.parse({}), ...(value as Partial<Opts> | null), type: 'lesson_plan' };
  const update = (patch: Partial<Opts>) => onChange({ ...o, ...patch });
  const num = (raw: string, fallback: number) => (raw === '' ? fallback : Math.round(Number(raw)));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Minutes per period" hint="10–600">
        {(p) => <Input {...p} type="number" min={10} max={600} value={o.durationMin} onChange={(e) => update({ durationMin: num(e.target.value, 45) })} />}
      </Field>
      <Field label="Periods" hint="1–20">
        {(p) => <Input {...p} type="number" min={1} max={20} value={o.periods} onChange={(e) => update({ periods: num(e.target.value, 1) })} />}
      </Field>
      <Field label="Teaching approach (optional)" hint="e.g. inquiry-based, flipped, activity-based">
        {(p) => <Input {...p} maxLength={200} value={o.pedagogy ?? ''} onChange={(e) => update({ pedagogy: e.target.value || undefined })} />}
      </Field>
    </div>
  );
}
