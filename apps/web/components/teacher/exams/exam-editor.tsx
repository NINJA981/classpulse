'use client';
import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import type { ExamDetail, ExamInput, UpdateExamInput } from '@classiq/shared';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  Field,
  InlineError,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { fromLocalInput, toLocalInput } from '@/components/teacher/status';
import { ApiError, api } from '@/lib/api';
import { QuestionPicker } from './question-picker';
import { SecurityStep } from './security-step';

type Step = 1 | 2 | 3;
const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Details & window' },
  { step: 2, label: 'Questions' },
  { step: 3, label: 'Security & publish' },
];

/** New exams start with this many questions per student; step 2 adjusts it to the selection. */
const DEFAULT_PER_STUDENT = 10;

/**
 * Three-step draft editor: details & window → question pool → security, then publish.
 * Step 1 creates the draft (the URL switches to /teacher/exams/:id without a reload).
 */
export function ExamEditor({ initial }: { initial: ExamDetail | null }) {
  const qc = useQueryClient();
  const [exam, setExam] = useState<ExamDetail | null>(initial);
  const [step, setStep] = useState<Step>(1);

  function saved(next: ExamDetail, goTo?: Step) {
    setExam(next);
    qc.setQueryData(['exams', next.id], next);
    void qc.invalidateQueries({ queryKey: ['exams'], exact: true });
    if (goTo) setStep(goTo);
  }

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Exam setup steps">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {STEPS.map((s) => {
            const done = s.step < step;
            const current = s.step === step;
            return (
              <li key={s.step}>
                <button
                  type="button"
                  disabled={!exam && s.step > 1}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => setStep(s.step)}
                  className={clsx(
                    'flex min-h-11 w-full items-center gap-3 rounded-control border px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50',
                    current
                      ? 'border-line-strong bg-accent text-accent-ink'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'grid size-7 shrink-0 place-items-center rounded-full border font-display text-xs font-black',
                      current ? 'border-line-strong bg-surface text-ink' : 'border-line bg-surface-2',
                    )}
                  >
                    {done ? <Check className="size-4" /> : s.step}
                  </span>
                  <span>
                    <span className="sr-only">Step {s.step}: </span>
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 1 && <DetailsStep exam={exam} onSaved={(e) => saved(e, 2)} />}
      {step === 2 && exam && (
        <QuestionPicker exam={exam} onBack={() => setStep(1)} onSaved={(e) => saved(e, 3)} />
      )}
      {step === 3 && exam && <SecurityStep exam={exam} onBack={() => setStep(2)} onSaved={(e) => saved(e)} />}
    </div>
  );
}

interface DetailsForm {
  title: string;
  sectionId: string;
  instructions: string;
  opensAt: string;
  closesAt: string;
  durationMin: string;
}

function validate(f: DetailsForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = 'Give the exam a title';
  if (!f.sectionId) e.sectionId = 'Choose a section';
  const opens = fromLocalInput(f.opensAt);
  const closes = fromLocalInput(f.closesAt);
  if (!opens) e.opensAt = 'Choose when the exam opens';
  if (!closes) e.closesAt = 'Choose when the exam closes';
  else if (opens && Date.parse(closes) <= Date.parse(opens))
    e.closesAt = 'The exam must close after it opens';
  const d = Number(f.durationMin);
  if (!Number.isInteger(d) || d < 1 || d > 600) e.durationMin = 'Enter 1–600 minutes';
  return e;
}

function DetailsStep({ exam, onSaved }: { exam: ExamDetail | null; onSaved: (exam: ExamDetail) => void }) {
  const sections = useTeacherSections();
  const [form, setForm] = useState<DetailsForm>(() => ({
    title: exam?.title ?? '',
    sectionId: exam?.section.id ?? '',
    instructions: exam?.instructions ?? '',
    opensAt: toLocalInput(exam?.opensAt),
    closesAt: toLocalInput(exam?.closesAt),
    durationMin: String(exam?.durationMin ?? 30),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof DetailsForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        title: form.title.trim(),
        sectionId: form.sectionId,
        instructions: form.instructions.trim(),
        opensAt: fromLocalInput(form.opensAt)!,
        closesAt: fromLocalInput(form.closesAt)!,
        durationMin: Number(form.durationMin),
      };
      if (exam) return api.patch<ExamDetail>(`/exams/${exam.id}`, fields satisfies UpdateExamInput);
      const body: ExamInput = {
        ...fields,
        questionsPerStudent: DEFAULT_PER_STUDENT,
        shuffleQuestions: true,
        shuffleOptions: true,
        requireFullscreen: true,
        useAccessCode: true,
        singleDevice: true,
        maxViolations: null,
        resultsVisibility: 'after_close',
      };
      const created = await api.post<ExamDetail>('/exams', body);
      // Keep the editor mounted but give the draft its own URL (reload-safe).
      window.history.replaceState(null, '', `/teacher/exams/${created.id}`);
      return created;
    },
    onSuccess: onSaved,
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length === 0) save.mutate();
  }

  const noSections = sections.isSuccess && sections.data.length === 0;

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Exam title" required error={errors.title} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={form.title}
                maxLength={200}
                onChange={(e) => set('title')(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Section"
            required
            error={errors.sectionId}
            hint={
              exam?.questionIds.length ? 'Changing the section clears the selected questions.' : undefined
            }
            className="sm:col-span-2"
          >
            {(p) => (
              <Select
                {...p}
                value={form.sectionId}
                disabled={sections.isPending}
                onChange={(e) => set('sectionId')(e.target.value)}
              >
                <option value="">{sections.isPending ? 'Loading sections…' : 'Choose a section'}</option>
                {(sections.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject ? `${s.name} — ${s.subject}` : s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {noSections && (
            <p className="text-sm text-muted sm:col-span-2">
              You are not assigned to any section yet. Ask your admin to add you to one.
            </p>
          )}
          <Field
            label="Instructions for students"
            hint="Shown before the exam starts."
            className="sm:col-span-2"
          >
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                maxLength={5000}
                value={form.instructions}
                onChange={(e) => set('instructions')(e.target.value)}
              />
            )}
          </Field>
          <Field label="Opens at" required error={errors.opensAt}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => set('opensAt')(e.target.value)}
              />
            )}
          </Field>
          <Field label="Closes at" required error={errors.closesAt} hint="No one can start after this time.">
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => set('closesAt')(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Duration (minutes)"
            required
            error={errors.durationMin}
            hint="Each student's timer starts when they begin, and never runs past the closing time."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                step={1}
                value={form.durationMin}
                onChange={(e) => set('durationMin')(e.target.value)}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <InlineError
              error={
                save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length
                  ? null
                  : save.error
              }
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-between">
            <ButtonLink href="/teacher/exams" variant="secondary">
              Cancel
            </ButtonLink>
            <Button
              type="submit"
              loading={save.isPending}
              icon={<ArrowRight className="size-4" aria-hidden />}
            >
              {exam ? 'Save and continue' : 'Create draft and continue'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
