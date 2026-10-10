'use client';
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ListChecks, Sparkles } from 'lucide-react';
import type { StudentQuiz } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, InlineError } from '@/components/ui';
import { LanguageToggle, Note } from '../common';
import { OptionButton, OptionGroup } from './option-button';

export type QuizAnswers = Record<string, number | null>;

const DIFFICULTY_TONE = { easy: 'success', medium: 'warning', hard: 'danger' } as const;

export function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  return <Badge tone={DIFFICULTY_TONE[difficulty]}>{difficulty}</Badge>;
}

/** Intro card: title, summary, takeaways, question count and Start. */
export function QuizIntro({ quiz, onStart }: { quiz: StudentQuiz; onStart: () => void }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div>
          <p className="eyebrow mb-1">{quiz.subject}</p>
          <h2 className="font-display text-2xl font-black leading-tight">{quiz.title}</h2>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2">
            <ListChecks className="size-4" aria-hidden />
            {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
          </p>
        </div>
        {quiz.summary && (
          <section>
            <h3 className="mb-1 text-sm font-extrabold">Lesson summary</h3>
            <p className="text-sm leading-relaxed text-ink-2">{quiz.summary}</p>
          </section>
        )}
        {quiz.keyTakeaways.length > 0 && (
          <section className="rounded-control border border-line bg-accent-soft p-4">
            <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-extrabold">
              <Sparkles className="size-4" aria-hidden /> Key takeaways
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-2">
              {quiz.keyTakeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}
        <Button size="lg" className="w-full" onClick={onStart} icon={<ArrowRight className="size-5" aria-hidden />}>
          Start quiz
        </Button>
      </CardBody>
    </Card>
  );
}

/** One question per screen, then a review screen with Submit. */
export function QuizPlayer({
  quiz,
  submitting,
  submitError,
  onSubmit,
}: {
  quiz: StudentQuiz;
  submitting: boolean;
  submitError: unknown;
  onSubmit: (answers: QuizAnswers) => void;
}) {
  const questions = quiz.questions;
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [local, setLocal] = useState(false);

  const hasLocal = questions.some((q) => q.stemLocal || q.optionsLocal);
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => answers[q.id] == null);
  const answeredCount = questions.length - unanswered.length;

  function goTo(i: number) {
    setReviewing(false);
    setIndex(i);
  }

  if (reviewing) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-5">
          <div>
            <p className="eyebrow mb-1">Review</p>
            <h2 className="font-display text-2xl font-black">Ready to submit?</h2>
            <p className="mt-1 text-sm text-muted">
              You answered {answeredCount} of {questions.length} questions.
            </p>
          </div>

          {unanswered.length > 0 ? (
            <Note tone="warning" icon={<AlertTriangle className="size-4 text-warning" aria-hidden />}>
              <p className="font-bold">
                {unanswered.length} unanswered {unanswered.length === 1 ? 'question' : 'questions'}
              </p>
              <p className="text-ink-2">Unanswered questions count as incorrect. Tap one to answer it.</p>
            </Note>
          ) : (
            <Note tone="success" icon={<CheckCircle2 className="size-4 text-success" aria-hidden />}>
              <p className="font-bold">All questions answered. Nice work!</p>
            </Note>
          )}

          {unanswered.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Unanswered questions">
              {unanswered.map(({ q, i }) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-left text-sm hover:border-line-strong"
                  >
                    <span className="font-display font-black">Q{i + 1}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-ink-2">{q.stem}</span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <InlineError error={submitError} />

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => goTo(questions.length - 1)}
              disabled={submitting}
              icon={<ArrowLeft className="size-5" aria-hidden />}
            >
              Back to questions
            </Button>
            <Button size="lg" className="w-full sm:flex-1" loading={submitting} onClick={() => onSubmit(answers)}>
              Submit quiz
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const q = questions[index];
  if (!q) return null;
  const stem = local && q.stemLocal ? q.stemLocal : q.stem;
  const selected = answers[q.id] ?? null;
  const isLast = index === questions.length - 1;
  const progress = ((index + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold" aria-live="polite">
            Question {index + 1} of {questions.length}
          </p>
          {hasLocal && <LanguageToggle local={local} onChange={setLocal} />}
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={index + 1}
          className="h-2.5 w-full overflow-hidden rounded-full border border-line bg-surface"
        >
          {/* Width is a dynamic layout value, not theming. */}
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <DifficultyBadge difficulty={q.difficulty} />
            <h2 id={`q-${q.id}`} className="font-display text-xl font-extrabold leading-snug">
              {stem}
            </h2>
          </div>
          <OptionGroup label={`Answer options for question ${index + 1}`}>
            {q.options.map((opt, i) => {
              const text = local && q.optionsLocal?.[i] ? q.optionsLocal[i]! : opt;
              return (
                <OptionButton
                  key={i}
                  index={i}
                  text={text}
                  checked={selected === i}
                  onSelect={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                />
              );
            })}
          </OptionGroup>
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          icon={<ArrowLeft className="size-5" aria-hidden />}
        >
          Back
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => (isLast ? setReviewing(true) : setIndex((i) => i + 1))}
          aria-describedby={isLast ? 'quiz-next-hint' : undefined}
        >
          Next <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
      {isLast && (
        <p id="quiz-next-hint" className="text-center text-xs text-muted">
          Last question — next you can review your answers and submit.
        </p>
      )}
    </div>
  );
}
