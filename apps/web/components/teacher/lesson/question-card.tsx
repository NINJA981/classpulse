'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Clock, Pencil, Trash2, X } from 'lucide-react';
import type { Question } from '@classpulse/shared';
import { Badge, Button, Card, InlineError, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { ConfirmDialog } from '@/components/teacher/common';
import { QuestionStatusBadge, optionLetter } from '@/components/teacher/status';
import { lessonKey } from './use-lesson';

/** One generated question with review actions. */
export function QuestionCard({
  question,
  number,
  readOnly,
  onEdit,
  onSeek,
}: {
  question: Question;
  number: number;
  readOnly: boolean;
  onEdit: () => void;
  onSeek: ((sec: number) => void) | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const review = useMutation({
    mutationFn: (kind: 'approve' | 'reject') => api.post<Question>(`/questions/${question.id}/${kind}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: lessonKey(question.lessonId) }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/questions/${question.id}`),
    onSuccess: () => {
      setConfirmDelete(false);
      toast('Question deleted');
      qc.invalidateQueries({ queryKey: lessonKey(question.lessonId) });
    },
  });

  const q = question;
  return (
    <Card className={clsx('p-5', q.status === 'rejected' && 'opacity-70')}>
      <article aria-labelledby={`q-${q.id}-stem`} className="space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-black">Q{number}</span>
          <QuestionStatusBadge status={q.status} />
          <Badge>{q.difficulty}</Badge>
          {q.topicTag && <Badge tone="info">{q.topicTag}</Badge>}
          {q.editedByTeacher && <Badge tone="accent">Edited by you</Badge>}
          {q.citationStartSec != null && onSeek && (
            <button
              type="button"
              onClick={() => onSeek(q.citationStartSec ?? 0)}
              className="ml-auto inline-flex min-h-6 items-center gap-1 text-xs font-bold underline underline-offset-4"
              aria-label={`Play the recording from ${formatDuration(q.citationStartSec)} for question ${number}`}
            >
              <Clock className="size-3.5" aria-hidden />
              {formatDuration(q.citationStartSec)}
              {q.citationEndSec != null ? `–${formatDuration(q.citationEndSec)}` : ''}
            </button>
          )}
        </header>

        <div>
          <p id={`q-${q.id}-stem`} className="font-bold leading-snug">
            {q.stem}
          </p>
          {q.stemLocal && <p className="mt-1 text-sm text-ink-2">{q.stemLocal}</p>}
        </div>

        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => {
            const correct = i === q.correctIndex;
            return (
              <li
                key={i}
                className={clsx(
                  'flex items-start gap-2 border px-3 py-2 text-sm rounded-control',
                  correct ? 'border-success bg-success-soft' : 'border-line',
                )}
              >
                <span className="font-mono text-xs font-black">{optionLetter(i)}</span>
                <span className="flex-1">
                  {opt}
                  {q.optionsLocal?.[i] && <span className="block text-xs text-muted">{q.optionsLocal[i]}</span>}
                </span>
                {correct && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-success">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Correct
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {(q.explanation || q.explanationLocal) && (
          <div className="border-l-2 border-line-strong pl-3 text-sm text-ink-2">
            <p className="eyebrow mb-1">Explanation</p>
            {q.explanation && <p>{q.explanation}</p>}
            {q.explanationLocal && <p className="mt-1 text-muted">{q.explanationLocal}</p>}
          </div>
        )}

        {!readOnly && (
          <footer className="flex flex-wrap gap-2 border-t border-line pt-4">
            {q.status !== 'approved' && (
              <Button
                size="sm"
                icon={<Check className="size-3.5" aria-hidden />}
                loading={review.isPending && review.variables === 'approve'}
                disabled={review.isPending}
                onClick={() => review.mutate('approve')}
                aria-label={`Approve question ${number}`}
              >
                Approve
              </Button>
            )}
            {q.status !== 'rejected' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<X className="size-3.5" aria-hidden />}
                loading={review.isPending && review.variables === 'reject'}
                disabled={review.isPending}
                onClick={() => review.mutate('reject')}
                aria-label={`Reject question ${number}`}
              >
                Reject
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil className="size-3.5" aria-hidden />}
              onClick={onEdit}
              aria-label={`Edit question ${number}`}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete question ${number}`}
            >
              Delete
            </Button>
          </footer>
        )}
        <InlineError error={review.error} />
      </article>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete question ${number}?`}
        description="The question is removed from this lesson. This cannot be undone."
        confirmLabel="Delete question"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
