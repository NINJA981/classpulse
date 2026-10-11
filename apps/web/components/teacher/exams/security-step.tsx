'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Rocket } from 'lucide-react';
import type { ExamDetail, ExamResultsVisibility, UpdateExamInput } from '@classpulse/shared';
import { Button, Card, CardBody, Field, InlineError, Input, Select, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { api } from '@/lib/api';
import { RESULTS_VISIBILITY_LABEL, windowText } from './exam-ui';

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-control border border-line p-3 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-[var(--cp-ink)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Step 3: integrity settings, results visibility, then Publish (with confirmation). */
export function SecurityStep({
  exam,
  onBack,
  onSaved,
}: {
  exam: ExamDetail;
  onBack: () => void;
  onSaved: (exam: ExamDetail) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState({
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    requireFullscreen: exam.requireFullscreen,
    useAccessCode: exam.useAccessCode,
    singleDevice: exam.singleDevice,
    resultsVisibility: exam.resultsVisibility,
  });
  const [autoSubmit, setAutoSubmit] = useState(exam.maxViolations !== null);
  const [maxViolations, setMaxViolations] = useState(String(exam.maxViolations ?? 3));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set =
    <K extends keyof typeof s>(k: K) =>
    (v: (typeof s)[K]) =>
      setS((x) => ({ ...x, [k]: v }));

  function settings(): UpdateExamInput | null {
    const n = Number(maxViolations);
    if (autoSubmit && (!Number.isInteger(n) || n < 1 || n > 100)) {
      setError('Enter a number of warnings between 1 and 100.');
      return null;
    }
    setError(null);
    return { ...s, maxViolations: autoSubmit ? n : null };
  }

  const save = useMutation({
    mutationFn: (body: UpdateExamInput) => api.patch<ExamDetail>(`/exams/${exam.id}`, body),
    onSuccess: (e) => {
      onSaved(e);
      toast('Draft saved');
    },
  });

  const publish = useMutation({
    mutationFn: async (body: UpdateExamInput) => {
      await api.patch<ExamDetail>(`/exams/${exam.id}`, body);
      return api.post<ExamDetail>(`/exams/${exam.id}/publish`);
    },
    onSuccess: (e) => {
      qc.setQueryData(['exams', e.id], e);
      void qc.invalidateQueries({ queryKey: ['exams'], exact: true });
      toast('Exam published');
      router.push(`/teacher/exams/${e.id}/monitor`);
    },
  });

  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs font-bold text-ink-2">Paper</legend>
          <Toggle
            label="Shuffle question order"
            hint="Every student sees their questions in a different order."
            checked={s.shuffleQuestions}
            onChange={set('shuffleQuestions')}
          />
          <Toggle
            label="Shuffle answer options"
            hint="The A–D options are mixed for each student."
            checked={s.shuffleOptions}
            onChange={set('shuffleOptions')}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs font-bold text-ink-2">Integrity</legend>
          <Toggle
            label="Require fullscreen"
            hint="Students must stay in fullscreen. Phones that cannot go fullscreen still get warnings."
            checked={s.requireFullscreen}
            onChange={set('requireFullscreen')}
          />
          <Toggle
            label="Require an access code"
            hint="A 6-character code you read out in the room. You can change it at any time."
            checked={s.useAccessCode}
            onChange={set('useAccessCode')}
          />
          <Toggle
            label="One device at a time"
            hint="Opening the exam on a second device is blocked until you unlock it from the monitor."
            checked={s.singleDevice}
            onChange={set('singleDevice')}
          />
          <Toggle
            label="Auto-submit after too many warnings"
            hint="Switching tabs, leaving fullscreen, copying or pasting each count as a warning."
            checked={autoSubmit}
            onChange={setAutoSubmit}
          />
          {autoSubmit && (
            <Field label="Warnings before auto-submit" error={error} className="sm:max-w-xs sm:pl-8">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(e.target.value)}
                />
              )}
            </Field>
          )}
        </fieldset>

        <Field label="Show students their results" className="sm:max-w-sm">
          {(p) => (
            <Select
              {...p}
              value={s.resultsVisibility}
              onChange={(e) => set('resultsVisibility')(e.target.value as ExamResultsVisibility)}
            >
              {(Object.keys(RESULTS_VISIBILITY_LABEL) as ExamResultsVisibility[]).map((v) => (
                <option key={v} value={v}>
                  {RESULTS_VISIBILITY_LABEL[v]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <InlineError error={save.error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
            Back
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="secondary"
              loading={save.isPending}
              onClick={() => {
                const body = settings();
                if (body) save.mutate(body);
              }}
            >
              Save draft
            </Button>
            <Button
              icon={<Rocket className="size-4" aria-hidden />}
              onClick={() => {
                if (settings()) {
                  publish.reset();
                  setConfirm(true);
                }
              }}
            >
              Publish exam
            </Button>
          </div>
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Publish this exam?"
        confirmLabel="Publish"
        loading={publish.isPending}
        error={publish.error}
        onConfirm={() => {
          const body = settings();
          if (body) publish.mutate(body);
        }}
        description="Once published, the questions and settings are locked. Students can start during the window."
      >
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>{exam.section.name}</li>
          <li>{windowText(exam.opensAt, exam.closesAt)}</li>
          <li>
            {exam.durationMin} minutes · {exam.questionsPerStudent} of {exam.poolSize} questions per student
          </li>
          {s.useAccessCode && <li>An access code is generated when you publish.</li>}
        </ul>
      </ConfirmDialog>
    </Card>
  );
}
