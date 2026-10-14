'use client';
import clsx from 'clsx';
import { CheckCircle2, Clapperboard, ListChecks, RotateCcw, XCircle } from 'lucide-react';
import type { GradedAnswer, QuizAttemptResult } from '@classiq/shared';
import { Button, ButtonLink, Card, CardBody } from '@/components/ui';
import { formatDateTime, formatDuration } from '@/lib/format';
import { OPTION_LETTERS } from './option-button';
import { DifficultyBadge } from './quiz-player';

function cheer(pct: number): string {
  if (pct >= 90) return 'Outstanding! You nailed it.';
  if (pct >= 75) return 'Great job — strong understanding.';
  if (pct >= 50) return 'Good effort. Review the misses below.';
  return 'Keep going — the explanations below will help.';
}

function optionLabel(a: GradedAnswer, index: number | null): string {
  if (index == null) return 'Not answered';
  return `${OPTION_LETTERS[index] ?? index + 1}. ${a.options[index] ?? ''}`;
}

function AnswerReview({ answer, n }: { answer: GradedAnswer; n: number }) {
  const citation =
    answer.citationStartSec != null
      ? answer.citationEndSec != null && answer.citationEndSec > answer.citationStartSec
        ? `${formatDuration(answer.citationStartSec)} – ${formatDuration(answer.citationEndSec)}`
        : formatDuration(answer.citationStartSec)
      : null;

  return (
    <li>
      <Card className={clsx('border-2', answer.isCorrect ? 'border-success/50' : 'border-danger/50')}>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            {answer.isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">
                Question {n} · <span className={answer.isCorrect ? 'text-success' : 'text-danger'}>{answer.isCorrect ? 'Correct' : 'Incorrect'}</span>
              </p>
              <h3 className="font-bold leading-snug">{answer.stem}</h3>
            </div>
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div
              className={clsx(
                'rounded-control border px-3 py-2',
                answer.isCorrect ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft',
              )}
            >
              <dt className="text-xs font-bold text-ink-2">Your answer</dt>
              <dd className="font-semibold">{optionLabel(answer, answer.selectedIndex)}</dd>
            </div>
            {!answer.isCorrect && (
              <div className="rounded-control border border-success/40 bg-success-soft px-3 py-2">
                <dt className="text-xs font-bold text-ink-2">Correct answer</dt>
                <dd className="font-semibold">{optionLabel(answer, answer.correctIndex)}</dd>
              </div>
            )}
          </dl>

          {(answer.explanation || answer.explanationLocal) && (
            <div className="rounded-control bg-info-soft px-3 py-2 text-sm leading-relaxed">
              <p className="text-xs font-bold text-ink-2">Explanation</p>
              {answer.explanation && <p>{answer.explanation}</p>}
              {answer.explanationLocal && <p className="mt-1.5 text-ink-2">{answer.explanationLocal}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <DifficultyBadge difficulty={answer.difficulty} />
            {citation && (
              <span className="inline-flex items-center gap-1 font-semibold">
                <Clapperboard className="size-3.5" aria-hidden /> From the lecture at {citation}
              </span>
            )}
          </div>
        </CardBody>
      </Card>
    </li>
  );
}

export function QuizResults({ result, onRetake }: { result: QuizAttemptResult; onRetake: () => void }) {
  const pct = Math.round(result.scorePct);
  return (
    <div className="flex flex-col gap-5">
      <Card className="bg-accent-soft">
        <CardBody className="flex flex-col items-center gap-2 text-center">
          <p className="eyebrow">Your score</p>
          <p className="font-display text-6xl font-black tabular-nums" aria-label={`Score ${pct} percent`}>
            {pct}%
          </p>
          <p className="font-bold">
            {result.correct} of {result.total} correct
          </p>
          <p className="text-sm text-ink-2">{cheer(pct)}</p>
          <p className="text-xs text-muted">Submitted {formatDateTime(result.submittedAt)}</p>
          <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" onClick={onRetake} icon={<RotateCcw className="size-5" aria-hidden />}>
              Retake quiz
            </Button>
            <ButtonLink href="/student/quizzes" variant="secondary" size="lg" icon={<ListChecks className="size-5" aria-hidden />}>
              All quizzes
            </ButtonLink>
          </div>
        </CardBody>
      </Card>

      <section aria-labelledby="answers-heading" className="flex flex-col gap-3">
        <h2 id="answers-heading" className="font-display text-lg font-extrabold">
          Answers &amp; explanations
        </h2>
        <ol className="flex flex-col gap-3">
          {result.answers.map((a, i) => (
            <AnswerReview key={a.questionId} answer={a} n={i + 1} />
          ))}
        </ol>
      </section>
    </div>
  );
}
