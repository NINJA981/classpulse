'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, MonitorPlay, Square } from 'lucide-react';
import type { ExamDetail } from '@classpulse/shared';
import { Button, ButtonLink, Card, CardBody, CardHeader, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { optionLetter } from '@/components/teacher/status';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { RESULTS_VISIBILITY_LABEL, windowText } from './exam-ui';

const yes = (v: boolean) => (v ? 'On' : 'Off');

/** "Close exam" with confirmation (shared by the overview and the monitor). */
export function CloseExamButton({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const close = useMutation({
    mutationFn: () => api.post<ExamDetail>(`/exams/${exam.id}/close`),
    onSuccess: (e) => {
      qc.setQueryData(['exams', e.id], e);
      void qc.invalidateQueries({ queryKey: ['exams'] });
      setOpen(false);
      toast('Exam closed');
    },
  });
  if (exam.status !== 'published') return null;
  return (
    <>
      <Button
        variant="danger"
        icon={<Square className="size-4" aria-hidden />}
        onClick={() => {
          close.reset();
          setOpen(true);
        }}
      >
        Close exam
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Close the exam now?"
        description="No one can start any more, and every student still writing is submitted and graded immediately."
        confirmLabel="Close exam"
        danger
        loading={close.isPending}
        error={close.error}
        onConfirm={() => close.mutate()}
      />
    </>
  );
}

/** Read-only view of a published or closed exam: settings and the frozen pool. */
export function ExamOverview({ exam }: { exam: ExamDetail }) {
  const settings: [string, string][] = [
    ['Section', exam.section.name],
    ['Window', windowText(exam.opensAt, exam.closesAt)],
    ['Duration', `${exam.durationMin} minutes`],
    ['Questions', `${exam.questionsPerStudent} per student from a pool of ${exam.poolSize}`],
    ['Shuffle questions / options', `${yes(exam.shuffleQuestions)} / ${yes(exam.shuffleOptions)}`],
    ['Fullscreen required', yes(exam.requireFullscreen)],
    ['Access code', exam.useAccessCode ? (exam.accessCode ?? '—') : 'Off'],
    ['One device at a time', yes(exam.singleDevice)],
    ['Auto-submit', exam.maxViolations ? `After ${exam.maxViolations} warnings` : 'Off'],
    ['Results for students', RESULTS_VISIBILITY_LABEL[exam.resultsVisibility]],
    ['Published', formatDateTime(exam.publishedAt)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/teacher/exams/${exam.id}/monitor`}
          icon={<MonitorPlay className="size-4" aria-hidden />}
        >
          Open monitor
        </ButtonLink>
        <ButtonLink
          href={`/teacher/exams/${exam.id}/results`}
          variant="secondary"
          icon={<BarChart3 className="size-4" aria-hidden />}
        >
          View results
        </ButtonLink>
        <CloseExamButton exam={exam} />
      </div>
      <Card>
        <CardHeader title="Settings" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {settings.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs font-bold text-muted">{k}</dt>
                <dd className="break-words font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {exam.instructions && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-bold text-muted">Instructions</p>
              <p className="whitespace-pre-line text-sm">{exam.instructions}</p>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader eyebrow="Frozen at publish" title={`Question pool (${exam.pool.length})`} />
        <CardBody>
          <ol className="flex flex-col gap-3">
            {exam.pool.map((q) => (
              <li key={q.id} className="rounded-control border border-line p-3 text-sm">
                <p className="font-semibold break-words">
                  {q.position}. {q.stem}
                </p>
                <ul className="mt-1 grid grid-cols-1 gap-1 text-ink-2 sm:grid-cols-2">
                  {q.options.map((o, i) => (
                    <li key={i} className={i === q.correctIndex ? 'font-bold text-success' : undefined}>
                      {optionLetter(i)}. {o}
                      {i === q.correctIndex && <span className="sr-only"> (correct answer)</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
