'use client';
import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QUESTION_OPTION_COUNT,
  type Difficulty,
  type Question,
  type QuestionInput,
} from '@classpulse/shared';
import { Button, Checkbox, Dialog, Field, InlineError, Input, Select, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { optionLetter } from '@/components/teacher/status';
import { lessonKey } from './use-lesson';

const blankOptions = () => Array.from({ length: QUESTION_OPTION_COUNT }, () => '');

/** Create or edit a question (PATCH /questions/:id or POST /lessons/:id/questions). */
export function QuestionEditorDialog({
  open,
  onClose,
  lessonId,
  question,
  localLanguageLabel,
}: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  /** null = new question. */
  question: Question | null;
  /** Label of the lesson language when it is not English (enables translation fields). */
  localLanguageLabel: string | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const formId = useId();

  const save = useMutation({
    mutationFn: (input: QuestionInput) =>
      question
        ? api.patch<Question>(`/questions/${question.id}`, input)
        : api.post<Question>(`/lessons/${lessonId}/questions`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lessonKey(lessonId) });
      toast(question ? 'Question updated' : 'Question added');
      onClose();
    },
  });

  function close() {
    save.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title={question ? `Edit question ${question.position}` : 'Add a question'}
      description={question ? 'Saving marks this question as edited by you.' : 'New questions are added as approved.'}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {question ? 'Save question' : 'Add question'}
          </Button>
        </>
      }
    >
      <QuestionForm
        formId={formId}
        question={question}
        localLanguageLabel={localLanguageLabel}
        error={save.error}
        onSubmit={(input) => save.mutate(input)}
      />
    </Dialog>
  );
}

function QuestionForm({
  formId,
  question,
  localLanguageLabel,
  error,
  onSubmit,
}: {
  formId: string;
  question: Question | null;
  localLanguageLabel: string | null;
  error: unknown;
  onSubmit: (input: QuestionInput) => void;
}) {
  const [stem, setStem] = useState(question?.stem ?? '');
  const [options, setOptions] = useState<string[]>(question?.options.slice(0, QUESTION_OPTION_COUNT) ?? blankOptions());
  const [correctIndex, setCorrectIndex] = useState(question?.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'medium');
  const [topicTag, setTopicTag] = useState(question?.topicTag ?? '');

  const hasLocal = Boolean(question?.stemLocal || question?.optionsLocal || question?.explanationLocal);
  const [showLocal, setShowLocal] = useState(hasLocal);
  const [stemLocal, setStemLocal] = useState(question?.stemLocal ?? '');
  const [optionsLocal, setOptionsLocal] = useState<string[]>(question?.optionsLocal?.slice(0, QUESTION_OPTION_COUNT) ?? blankOptions());
  const [explanationLocal, setExplanationLocal] = useState(question?.explanationLocal ?? '');

  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const fe = { ...(error instanceof ApiError ? error.fieldErrors : {}), ...localErrors };
  const localLabel = localLanguageLabel ?? 'Local language';

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!stem.trim()) errs.stem = 'Enter the question';
    options.forEach((o, i) => {
      if (!o.trim()) errs[`options.${i}`] = `Enter option ${optionLetter(i)}`;
    });
    setLocalErrors(errs);
    if (Object.keys(errs).length) return;

    const useLocal = showLocal;
    const anyLocalOption = optionsLocal.some((o) => o.trim());
    onSubmit({
      stem: stem.trim(),
      options: options.map((o) => o.trim()),
      correctIndex,
      explanation: explanation.trim() || null,
      difficulty,
      topicTag: topicTag.trim() || null,
      stemLocal: useLocal ? stemLocal.trim() || null : (question?.stemLocal ?? null),
      optionsLocal: useLocal ? (anyLocalOption ? optionsLocal.map((o) => o.trim()) : null) : (question?.optionsLocal ?? null),
      explanationLocal: useLocal ? explanationLocal.trim() || null : (question?.explanationLocal ?? null),
      citationStartSec: question?.citationStartSec ?? null,
      citationEndSec: question?.citationEndSec ?? null,
    });
  }

  const otherErrors = error && !(error instanceof ApiError && Object.keys(error.fieldErrors).length) ? error : null;

  return (
    <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Question" required error={fe.stem}>
        {(p) => <Textarea {...p} rows={3} maxLength={1000} value={stem} onChange={(e) => setStem(e.target.value)} />}
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-bold text-ink-2">Options — select the correct answer</legend>
        {options.map((opt, i) => (
          <div key={i} className="flex items-start gap-3">
            <label className="mt-7 inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold">
              <input
                type="radio"
                name={`${formId}-correct`}
                className="size-4 accent-[var(--cp-ink)]"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                aria-label={`Option ${optionLetter(i)} is correct`}
              />
              Correct
            </label>
            <Field label={`Option ${optionLetter(i)}`} required error={fe[`options.${i}`]} className="flex-1">
              {(p) => (
                <Input
                  {...p}
                  value={opt}
                  maxLength={300}
                  onChange={(e) => setOptions((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              )}
            </Field>
          </div>
        ))}
        {fe.correctIndex && <p className="text-xs font-semibold text-danger">{fe.correctIndex}</p>}
      </fieldset>

      <Field label="Explanation" hint="Shown to students after they answer." error={fe.explanation}>
        {(p) => (
          <Textarea {...p} rows={3} maxLength={2000} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Difficulty" error={fe.difficulty}>
          {(p) => (
            <Select {...p} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          )}
        </Field>
        <Field label="Topic" error={fe.topicTag}>
          {(p) => <Input {...p} value={topicTag} maxLength={120} onChange={(e) => setTopicTag(e.target.value)} />}
        </Field>
      </div>

      {(hasLocal || localLanguageLabel) && (
        <div className="space-y-4 border-t border-line pt-4">
          {!hasLocal && (
            <Checkbox
              label={`Add a ${localLabel} translation`}
              checked={showLocal}
              onChange={(e) => setShowLocal(e.target.checked)}
            />
          )}
          {showLocal && (
            <>
              <Field label={`Question (${localLabel})`} error={fe.stemLocal}>
                {(p) => (
                  <Textarea {...p} rows={2} maxLength={1000} value={stemLocal} onChange={(e) => setStemLocal(e.target.value)} />
                )}
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {optionsLocal.map((opt, i) => (
                  <Field key={i} label={`Option ${optionLetter(i)} (${localLabel})`} error={fe[`optionsLocal.${i}`]}>
                    {(p) => (
                      <Input
                        {...p}
                        value={opt}
                        maxLength={300}
                        onChange={(e) => setOptionsLocal((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <Field label={`Explanation (${localLabel})`} error={fe.explanationLocal}>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    maxLength={2000}
                    value={explanationLocal}
                    onChange={(e) => setExplanationLocal(e.target.value)}
                  />
                )}
              </Field>
            </>
          )}
        </div>
      )}

      <InlineError error={otherErrors} />
    </form>
  );
}
