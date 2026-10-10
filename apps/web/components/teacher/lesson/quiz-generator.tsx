'use client';
import { useId, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ListPlus, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import {
  MAX_QUESTIONS_PER_REQUEST,
  type GenerateLessonInput,
  type LessonDetail,
  type QuizDifficulty,
  type QuizGenerationMode,
} from '@classpulse/shared';
import { Button, Card, CardBody, CardHeader, Field, InlineError, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/teacher/common';
import { lessonKey } from './use-lesson';

const STARTED: Record<QuizGenerationMode, string> = {
  append: 'Writing more questions…',
  replace_unapproved: 'Replacing the unapproved questions…',
  replace_all: 'Generating the quiz…',
};

/** POST /lessons/:id/generate, flipping the cached lesson to `queued` so the processing view shows at once. */
export function useGenerate(lesson: LessonDetail) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: GenerateLessonInput) => api.post<{ jobId: string }>(`/lessons/${lesson.id}/generate`, input),
    onSuccess: (_res, input) => {
      const prev = qc.getQueryData<LessonDetail>(lessonKey(lesson.id));
      if (prev) qc.setQueryData<LessonDetail>(lessonKey(lesson.id), { ...prev, status: 'queued', progress: null, failureReason: null });
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
      qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
      toast(STARTED[input.mode]);
    },
  });
}

/** POST /lessons/:id/transcribe: re-runs transcription only (a failed lesson without a transcript). */
export function useTranscribe(lesson: LessonDetail) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.post<{ jobId: string }>(`/lessons/${lesson.id}/transcribe`),
    onSuccess: () => {
      const prev = qc.getQueryData<LessonDetail>(lessonKey(lesson.id));
      if (prev) qc.setQueryData<LessonDetail>(lessonKey(lesson.id), { ...prev, status: 'queued', progress: null, failureReason: null });
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
      qc.invalidateQueries({ queryKey: [...lessonKey(lesson.id), 'transcript'] });
      toast('Transcribing the recording…');
    },
  });
}

const DIFFICULTIES: { value: QuizDifficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Recall of facts and definitions from the class.' },
  { value: 'medium', label: 'Medium', hint: 'Understanding and simple application of the ideas.' },
  { value: 'hard', label: 'Hard', hint: 'Applying and connecting ideas; needs careful reasoning.' },
  { value: 'mixed', label: 'Mixed', hint: 'A spread of easy, medium and hard questions.' },
];

const ACTIONS: { mode: QuizGenerationMode; label: string; hint: string; icon: ReactNode }[] = [
  {
    mode: 'append',
    label: 'Add more questions',
    hint: 'Keeps every current question and adds new ones on points the quiz does not test yet.',
    icon: <ListPlus className="size-4" aria-hidden />,
  },
  {
    mode: 'replace_unapproved',
    label: 'Replace unapproved questions',
    hint: 'Keeps questions you approved or edited; replaces the pending and rejected ones.',
    icon: <RefreshCw className="size-4" aria-hidden />,
  },
  {
    mode: 'replace_all',
    label: 'Replace all questions',
    hint: 'Starts over: new questions, summary and assignment.',
    icon: <RotateCcw className="size-4" aria-hidden />,
  },
];

function confirmCopy(mode: QuizGenerationMode, lesson: LessonDetail) {
  const unpublish =
    lesson.status === 'published' ? ' The lesson is unpublished first; students cannot take the quiz until you publish it again.' : '';
  const replaced = lesson.questions.filter((q) => q.status !== 'approved' && !q.editedByTeacher).length;
  switch (mode) {
    case 'append':
      return {
        title: 'Unpublish and add questions?',
        description: `Your current questions stay, and the new ones need your review.${unpublish}`,
        confirmLabel: 'Unpublish and add',
        danger: false,
      };
    case 'replace_unapproved':
      return {
        title: 'Replace unapproved questions?',
        description: `Questions you approved or edited are kept. ${
          replaced === 1 ? '1 other question is' : `${replaced} other questions are`
        } replaced with new ones.${unpublish}`,
        confirmLabel: 'Replace unapproved',
        danger: true,
      };
    case 'replace_all':
      return {
        title: lesson.questions.length ? 'Replace all questions?' : 'Unpublish and generate?',
        description: `Every current question — including approved and edited ones — the summary and the assignment are replaced with a new set.${unpublish}`,
        confirmLabel: 'Replace all',
        danger: true,
      };
  }
}

/**
 * Teacher-controlled quiz generation: number of questions + difficulty, then either
 * "Generate quiz" (no questions yet) or add / replace actions on an existing quiz.
 * With questions, the card starts collapsed (except after a failure) to keep the review page clean.
 */
export function QuizGenerator({ lesson }: { lesson: LessonDetail }) {
  const id = useId();
  const generate = useGenerate(lesson);
  const hasQuestions = lesson.questions.length > 0;
  const published = lesson.status === 'published';

  const initialCount = Math.min(MAX_QUESTIONS_PER_REQUEST, Math.max(1, lesson.defaultQuestionCount || 5));
  const [open, setOpen] = useState(!hasQuestions || lesson.status === 'failed');
  const [count, setCount] = useState(String(initialCount));
  const [countError, setCountError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [confirm, setConfirm] = useState<QuizGenerationMode | null>(null);

  const needsConfirm = (mode: QuizGenerationMode) => published || (hasQuestions && mode !== 'append');

  function run(mode: QuizGenerationMode, confirmed = false) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > MAX_QUESTIONS_PER_REQUEST) {
      setCountError(`Enter a whole number from 1 to ${MAX_QUESTIONS_PER_REQUEST}`);
      setConfirm(null);
      return;
    }
    setCountError(null);
    if (!confirmed && needsConfirm(mode)) {
      generate.reset();
      setConfirm(mode);
      return;
    }
    generate.mutate(
      { questionCount: n, difficulty, mode, ...(confirmed ? { confirmRegenerate: true } : {}) },
      { onSuccess: () => setConfirm(null) },
    );
  }

  const hint = DIFFICULTIES.find((d) => d.value === difficulty)?.hint;
  const copy = confirmCopy(confirm ?? 'replace_all', lesson);

  return (
    <Card>
      <CardHeader
        eyebrow="Quiz settings"
        title={hasQuestions ? 'Change the questions' : 'Generate the quiz'}
        actions={
          hasQuestions ? (
            <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide options' : 'Change questions'}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-5">
        <p className="text-sm text-muted">
          {hasQuestions
            ? 'Add more questions, or replace the ones you do not want with newly generated ones.'
            : 'Transcript ready. Choose how many questions and the difficulty, then generate the quiz.'}
          {hasQuestions && published && ' Changing the questions unpublishes the lesson until you publish it again.'}
        </p>

        {open && (
          <div id={`${id}-form`} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Field
                label="Number of questions"
                required
                error={countError}
                hint={`1–${MAX_QUESTIONS_PER_REQUEST}${hasQuestions ? ' new questions' : ''}`}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_QUESTIONS_PER_REQUEST}
                    step={1}
                    value={count}
                    disabled={generate.isPending}
                    onChange={(e) => setCount(e.target.value)}
                  />
                )}
              </Field>

              <fieldset className="min-w-0" aria-describedby={`${id}-difficulty-hint`} disabled={generate.isPending}>
                <legend className="mb-1.5 text-xs font-bold text-ink-2">Difficulty</legend>
                <div className="flex flex-wrap gap-1.5">
                  {DIFFICULTIES.map((d) => (
                    <label
                      key={d.value}
                      className={clsx(
                        'inline-flex h-10 min-w-[5rem] flex-1 cursor-pointer items-center justify-center border border-line px-3 text-sm font-bold rounded-control',
                        'hover:bg-surface-2 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-canvas',
                        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-difficulty`}
                        value={d.value}
                        className="sr-only"
                        checked={difficulty === d.value}
                        onChange={() => setDifficulty(d.value)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
                <p id={`${id}-difficulty-hint`} className="mt-1.5 text-xs text-muted">
                  {hint}
                </p>
              </fieldset>
            </div>

            {hasQuestions ? (
              <ul className="space-y-3">
                {ACTIONS.map((a) => (
                  <li key={a.mode} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                    <Button
                      variant={a.mode === 'append' ? 'primary' : 'secondary'}
                      icon={a.icon}
                      className="w-full shrink-0 sm:w-72"
                      loading={generate.isPending && generate.variables?.mode === a.mode}
                      disabled={generate.isPending}
                      aria-describedby={`${id}-${a.mode}`}
                      onClick={() => run(a.mode)}
                    >
                      {a.label}
                    </Button>
                    <p id={`${id}-${a.mode}`} className="text-xs text-muted">
                      {a.hint}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Button icon={<Sparkles className="size-4" aria-hidden />} loading={generate.isPending} onClick={() => run('replace_all')}>
                Generate quiz
              </Button>
            )}

            {!confirm && <InlineError error={generate.error} />}
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirmLabel}
        danger={copy.danger}
        loading={generate.isPending}
        error={generate.error}
        onConfirm={() => confirm && run(confirm, true)}
      />
    </Card>
  );
}
