'use client';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, EyeOff, XCircle } from 'lucide-react';
import type { StudentExamResult } from '@classpulse/shared';
import { Badge, ButtonLink, Card, CardBody, ErrorState, LoadingBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatPct } from '@/lib/format';
import { Note, scoreTone } from '../common';
import { OPTION_LETTERS } from '../quiz/option-button';

type Answer = NonNullable<StudentExamResult['answers']>[number];

const optionText = (a: Answer, i: number | null) =>
  i == null ? 'Not answered' : `${OPTION_LETTERS[i] ?? i + 1}. ${a.options[i] ?? ''}`;

/** The student's submitted exam: score and answer review when the teacher allows it. */
export function ExamResultView({ examId, autoSubmitted }: { examId: string; autoSubmitted?: boolean }) {
  const q = useQuery({
    queryKey: ['student', 'exams', examId, 'result'],
    queryFn: () => api.get<StudentExamResult>(`/student/exams/${examId}/result`),
  });

  if (q.isPending) return <LoadingBlock label="Loading your result…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const r = q.data;
  const auto = autoSubmitted || r.status === 'auto_submitted';
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={auto ? 'info' : 'success'}>{auto ? 'Auto-submitted' : 'Submitted'}</Badge>
            {r.submittedAt && <span className="text-sm text-muted">{formatDateTime(r.submittedAt)}</span>}
          </div>
          {auto && (
            <Note tone="info">
              Your exam was submitted automatically — the time ran out, too many warnings were recorded, or
              your teacher ended it.
            </Note>
          )}
          {r.score ? (
            <div className="flex flex-wrap items-end gap-4">
              <p
                className={clsx(
                  'font-display text-5xl font-black tabular-nums',
                  scoreTone(r.score.scorePct) === 'danger' ? 'text-danger' : 'text-ink',
                )}
              >
                {formatPct(r.score.scorePct)}
              </p>
              <p className="pb-1 text-lg font-bold">
                {r.score.correct} of {r.score.total} correct
              </p>
            </div>
          ) : r.resultsAvailableAt ? (
            <Note tone="accent" icon={<Clock className="size-4" aria-hidden />}>
              <p className="font-bold">Your answers are in.</p>
              <p className="text-ink-2">
                Results will be available after {formatDateTime(r.resultsAvailableAt)}.
              </p>
            </Note>
          ) : (
            <Note tone="accent" icon={<EyeOff className="size-4" aria-hidden />}>
              <p className="font-bold">Your answers are in.</p>
              <p className="text-ink-2">Your teacher has chosen not to share scores for this exam.</p>
            </Note>
          )}
          <ButtonLink href="/student/exams" variant="secondary" className="self-start">
            Back to exams
          </ButtonLink>
        </CardBody>
      </Card>

      {r.answers && (
        <ol className="flex flex-col gap-3" aria-label="Your answers">
          {r.answers.map((a) => (
            <li key={a.number}>
              <Card className={clsx('border-2', a.isCorrect ? 'border-success/50' : 'border-danger/50')}>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {a.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow mb-1">
                        Question {a.number} ·{' '}
                        <span className={a.isCorrect ? 'text-success' : 'text-danger'}>
                          {a.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </p>
                      <h3 className="font-bold leading-snug break-words">{a.stem}</h3>
                    </div>
                  </div>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div
                      className={clsx(
                        'rounded-control border px-3 py-2',
                        a.isCorrect ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft',
                      )}
                    >
                      <dt className="text-xs font-bold text-ink-2">Your answer</dt>
                      <dd className="font-semibold break-words">{optionText(a, a.selectedIndex)}</dd>
                    </div>
                    {!a.isCorrect && (
                      <div className="rounded-control border border-success/40 bg-success-soft px-3 py-2">
                        <dt className="text-xs font-bold text-ink-2">Correct answer</dt>
                        <dd className="font-semibold break-words">{optionText(a, a.correctIndex)}</dd>
                      </div>
                    )}
                  </dl>
                  {a.explanation && <p className="text-sm leading-relaxed text-ink-2">{a.explanation}</p>}
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
