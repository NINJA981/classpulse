'use client';
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Eye, ListChecks, Maximize, MonitorSmartphone, Timer } from 'lucide-react';
import type { StartExamResponse, StudentExamListItem } from '@classpulse/shared';
import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Note } from '../common';
import { examRequest, getExamToken, isDeviceConflict, setExamToken } from './exam-api';

export const fullscreenSupported = () =>
  typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

/** Asks for fullscreen; must run synchronously inside a click handler (user gesture). */
export function enterFullscreen(): void {
  if (!fullscreenSupported() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen().catch(() => undefined);
}

export function leaveFullscreen(): void {
  if (typeof document !== 'undefined' && document.fullscreenElement)
    document.exitFullscreen().catch(() => undefined);
}

/** Rules, access code and Start (or Resume). */
export function ExamLobby({
  exam,
  lockedMessage,
  onStarted,
}: {
  exam: StudentExamListItem;
  lockedMessage: string | null;
  onStarted: (session: StartExamResponse) => void;
}) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const resuming = exam.state === 'in_progress';
  const canStart = exam.state === 'open' || resuming;

  const start = useMutation({
    mutationFn: () =>
      examRequest<StartExamResponse>('POST', `/student/exams/${exam.id}/start`, {
        body: code.trim() ? { accessCode: code.trim().toUpperCase() } : {},
        token: getExamToken(exam.id),
      }),
    onSuccess: (res) => {
      setExamToken(exam.id, res.attemptToken);
      onStarted(res);
    },
    onError: (err) => {
      leaveFullscreen();
      if (err instanceof ApiError && err.code === 'FORBIDDEN') setCodeError(err.message);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setCodeError(null);
    if (exam.requiresAccessCode && !code.trim() && !getExamToken(exam.id)) {
      setCodeError('Enter the access code your teacher gave you.');
      return;
    }
    // Fullscreen needs the click's user gesture, so request it before any await.
    if (exam.requireFullscreen) enterFullscreen();
    start.mutate();
  }

  const deviceBlocked = lockedMessage ?? (isDeviceConflict(start.error) ? errorMessage(start.error) : null);
  const otherError =
    start.error &&
    !isDeviceConflict(start.error) &&
    !(start.error instanceof ApiError && start.error.code === 'FORBIDDEN');

  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div>
          <p className="eyebrow mb-1">
            {exam.section.name} · {exam.teacherName}
          </p>
          <h2 className="font-display text-2xl font-black leading-tight break-words">{exam.title}</h2>
          <p className="mt-1 text-sm text-muted">
            Open {formatDateTime(exam.opensAt)} – {formatDateTime(exam.closesAt)}
          </p>
        </div>

        <section aria-labelledby="exam-rules">
          <h3 id="exam-rules" className="mb-2 text-sm font-extrabold">
            Before you start
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-ink-2">
            <li className="flex gap-2">
              <Timer className="mt-0.5 size-4 shrink-0" aria-hidden />
              You have {exam.durationMin} minutes once you start. The timer keeps running if you leave, and
              the exam is submitted automatically when time is up.
            </li>
            <li className="flex gap-2">
              <ListChecks className="mt-0.5 size-4 shrink-0" aria-hidden />
              {exam.questionCount} multiple-choice questions. Answers are saved as you go. You get one
              attempt.
            </li>
            {exam.requireFullscreen && (
              <li className="flex gap-2">
                <Maximize className="mt-0.5 size-4 shrink-0" aria-hidden />
                The exam runs in fullscreen. Leaving fullscreen pauses the screen until you return.
              </li>
            )}
            <li className="flex gap-2">
              <MonitorSmartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
              Stay on this device and this tab. Opening the exam on another device can be blocked until your
              teacher unlocks it.
            </li>
            <li className="flex gap-2">
              <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
              Integrity is monitored: switching tabs or apps, leaving fullscreen, copying, pasting and
              printing are recorded and shared with your teacher.
            </li>
          </ul>
        </section>

        {deviceBlocked && (
          <Note tone="danger" icon={<AlertTriangle className="size-4 text-danger" aria-hidden />}>
            <p role="alert" className="font-bold">
              {deviceBlocked}
            </p>
            <p className="text-ink-2">
              Once your teacher unlocks it, press {resuming ? 'Resume exam' : 'Start exam'} again here.
            </p>
          </Note>
        )}

        {exam.state === 'upcoming' && (
          <Note tone="info">This exam opens at {formatDateTime(exam.opensAt)}. Come back then.</Note>
        )}
        {exam.state === 'missed' && <Note tone="warning">This exam has closed. You did not take it.</Note>}

        {canStart && (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            {exam.requiresAccessCode && (
              <Field
                label="Access code"
                error={codeError}
                hint="Your teacher shows this code in the room."
                className="sm:max-w-xs"
              >
                {(p) => (
                  <Input
                    {...p}
                    value={code}
                    maxLength={12}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="h-12 font-mono text-lg tracking-widest uppercase"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                )}
              </Field>
            )}
            {otherError && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {errorMessage(start.error)}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={start.isPending}>
              {resuming ? 'Resume exam' : 'Start exam'}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
