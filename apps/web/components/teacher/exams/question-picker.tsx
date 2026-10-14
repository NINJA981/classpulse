'use client';
import { useDeferredValue, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import type { Difficulty, ExamDetail, ExamPoolCandidate } from '@classiq/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  Select,
} from '@/components/ui';
import { optionLetter } from '@/components/teacher/status';
import { api } from '@/lib/api';

const DIFFICULTY_TONE = { easy: 'success', medium: 'warning', hard: 'danger' } as const;

type StepProps = { exam: ExamDetail; onBack: () => void; onSaved: (exam: ExamDetail) => void };

/** Step 2 for drafts created from a question paper: the pool is the paper's MCQs; only the count per student is set here. */
function PaperQuestionsStep({ exam, onBack, onSaved }: StepProps) {
  const [perStudent, setPerStudent] = useState(String(exam.questionsPerStudent));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.patch<ExamDetail>(`/exams/${exam.id}`, { questionsPerStudent: Number(perStudent) }),
    onSuccess: onSaved,
  });
  function submit() {
    const n = Number(perStudent);
    if (!Number.isInteger(n) || n < 1 || n > exam.poolSize)
      return setError(`Questions per student must be between 1 and ${exam.poolSize}.`);
    setError(null);
    save.mutate();
  }
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm">
          This exam uses the <strong>{exam.poolSize}</strong> multiple-choice questions from your question paper. Each student gets
          them in a shuffled order; set fewer per student to give everyone a different random subset.
        </p>
        <Field label="Questions per student" required className="sm:max-w-xs">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={exam.poolSize}
              value={perStudent}
              onChange={(e) => setPerStudent(e.target.value)}
            />
          )}
        </Field>
        <InlineError error={error ? new Error(error) : save.error} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
            Back to details
          </Button>
          <Button onClick={submit} loading={save.isPending} icon={<ArrowRight className="size-4" aria-hidden />}>
            Save and continue
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Step 2: choose approved questions from this section's lessons and how many each student gets. */
export function QuestionPicker(props: StepProps) {
  // Drafts published from a question paper already hold their questions.
  if (props.exam.questionIds.length === 0 && props.exam.poolSize > 0) return <PaperQuestionsStep {...props} />;
  return <LessonQuestionPicker {...props} />;
}

function LessonQuestionPicker({
  exam,
  onBack,
  onSaved,
}: {
  exam: ExamDetail;
  onBack: () => void;
  onSaved: (exam: ExamDetail) => void;
}) {
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [topic, setTopic] = useState('');
  const deferredTopic = useDeferredValue(topic.trim());
  const [selected, setSelected] = useState<Set<string>>(() => new Set(exam.questionIds));
  const [perStudent, setPerStudent] = useState(String(exam.questionsPerStudent));
  const [error, setError] = useState<string | null>(null);

  const poolUrl = `/exams/${exam.id}/question-pool`;
  const all = useQuery({
    queryKey: ['exams', exam.id, 'pool', {}],
    queryFn: () => api.get<ExamPoolCandidate[]>(poolUrl),
  });
  const filters = {
    lessonIds: lessonIds.join(',') || undefined,
    difficulty: difficulty || undefined,
    topic: deferredTopic || undefined,
  };
  const filtered = useQuery({
    queryKey: ['exams', exam.id, 'pool', filters],
    queryFn: () => api.get<ExamPoolCandidate[]>(poolUrl, filters),
    placeholderData: keepPreviousData,
  });

  const lessons = [...new Map((all.data ?? []).map((q) => [q.lesson.id, q.lesson])).values()];
  const available = new Set((all.data ?? []).map((q) => q.questionId));
  // Questions picked earlier that are no longer approved drop out of the selection.
  const chosen = all.data ? [...selected].filter((id) => available.has(id)) : [...selected];
  const shown = filtered.data ?? [];
  const filteredView = Boolean(filters.lessonIds || filters.difficulty || filters.topic);

  const save = useMutation({
    mutationFn: async () => {
      await api.put<ExamDetail>(`/exams/${exam.id}/questions`, { questionIds: chosen });
      return api.patch<ExamDetail>(`/exams/${exam.id}`, { questionsPerStudent: Number(perStudent) });
    },
    onSuccess: onSaved,
  });

  function toggle(id: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setMany(ids: string[], on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function submit() {
    const n = Number(perStudent);
    if (chosen.length === 0) return setError('Select at least one question.');
    if (!Number.isInteger(n) || n < 1 || n > chosen.length)
      return setError(`Questions per student must be between 1 and ${chosen.length}.`);
    setError(null);
    save.mutate();
  }

  if (all.isPending) return <LoadingBlock label="Loading approved questions…" />;
  if (all.isError) return <ErrorState error={all.error} onRetry={() => all.refetch()} />;

  if (all.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen className="size-8" aria-hidden />}
          title="No approved questions in this section"
          description={`Approve questions in your ${exam.section.name} lessons first — only approved questions can go into an exam.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                onClick={onBack}
                icon={<ArrowLeft className="size-4" aria-hidden />}
              >
                Back to details
              </Button>
              <Link
                href="/teacher/lessons"
                className="inline-flex h-10 items-center px-4 text-sm font-bold underline underline-offset-4"
              >
                Open lessons
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  const shownIds = shown.map((q) => q.questionId);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-bold text-ink-2">Lessons</legend>
            <div className="flex flex-wrap gap-2">
              {lessons.map((l) => {
                const on = lessonIds.includes(l.id);
                return (
                  <label
                    key={l.id}
                    className={clsx(
                      'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm font-semibold',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                      on
                        ? 'border-line-strong bg-accent text-accent-ink'
                        : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--cp-ink)]"
                      checked={on}
                      onChange={(e) =>
                        setLessonIds((ids) =>
                          e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id),
                        )
                      }
                    />
                    <span className="max-w-64 truncate">{l.title}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              No lesson ticked = every lesson of {exam.section.name}.
            </p>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Difficulty">
              {(p) => (
                <Select
                  {...p}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty | '')}
                >
                  <option value="">All difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              )}
            </Field>
            <Field label="Topic contains">
              {(p) => (
                <Input
                  {...p}
                  value={topic}
                  maxLength={120}
                  placeholder="e.g. Fractions"
                  onChange={(e) => setTopic(e.target.value)}
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold" aria-live="polite">
            {chosen.length} selected · {shown.length} {filteredView ? 'matching' : 'available'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!shownIds.length || allShownSelected}
              onClick={() => setMany(shownIds, true)}
            >
              Select all {filteredView ? 'shown' : ''}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!shownIds.some((id) => selected.has(id))}
              onClick={() => setMany(shownIds, false)}
            >
              Clear {filteredView ? 'shown' : 'all'}
            </Button>
          </div>
        </div>
        {filtered.isError ? (
          <ErrorState error={filtered.error} onRetry={() => filtered.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            title="No questions match these filters"
            description="Try another lesson, difficulty or topic."
          />
        ) : (
          <ul className="flex flex-col gap-2 p-4" aria-busy={filtered.isFetching}>
            {shown.map((q, i) => (
              <li key={q.questionId}>
                <label
                  className={clsx(
                    'flex cursor-pointer gap-3 rounded-control border p-3',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                    selected.has(q.questionId)
                      ? 'border-line-strong bg-accent-soft'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-[var(--cp-ink)]"
                    checked={selected.has(q.questionId)}
                    onChange={(e) => toggle(q.questionId, e.target.checked)}
                    aria-describedby={`pool-${i}-meta`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug break-words">{q.stem}</span>
                    <span
                      id={`pool-${i}-meta`}
                      className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted"
                    >
                      <Badge tone={DIFFICULTY_TONE[q.difficulty]}>{q.difficulty}</Badge>
                      {q.topicTag && <span>{q.topicTag}</span>}
                      <span>· {q.lesson.title}</span>
                      <span className="break-words">
                        · Answer {optionLetter(q.correctIndex)}: {q.options[q.correctIndex]}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field
            label="Questions per student"
            required
            hint={
              chosen.length
                ? `Each student gets a random set of this many from the ${chosen.length} selected questions.`
                : 'Select questions first.'
            }
            className="sm:max-w-xs"
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(1, chosen.length)}
                step={1}
                value={perStudent}
                onChange={(e) => setPerStudent(e.target.value)}
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <InlineError error={save.error} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
              Back
            </Button>
            <Button
              onClick={submit}
              loading={save.isPending}
              icon={<ArrowRight className="size-4" aria-hidden />}
            >
              Save questions and continue
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
