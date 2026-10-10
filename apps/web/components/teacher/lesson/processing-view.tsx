'use client';
import clsx from 'clsx';
import { AlertTriangle, Check, Loader2, Radio } from 'lucide-react';
import type { LessonDetail, LessonStatus } from '@classpulse/shared';
import { Button, Card, CardBody, InlineError } from '@/components/ui';
import { ProgressBar } from '@/components/teacher/common';

type Step = { status: LessonStatus; label: string };

// A run either transcribes the recording (upload / device / retry) or writes questions from the transcript.
const TRANSCRIBE_STEPS: Step[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'transcribing', label: 'Transcribing the recording' },
  { status: 'transcribed', label: 'Choose quiz settings' },
];
const GENERATE_STEPS: Step[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'generating', label: 'Writing questions' },
  { status: 'ready_for_review', label: 'Review the questions' },
];

const DEFAULT_PCT: Partial<Record<LessonStatus, number>> = { queued: 5, transcribing: 30, generating: 50 };

/** Shown while a job is queued / transcribing / generating. */
export function ProcessingView({ lesson }: { lesson: LessonDetail }) {
  // No API field says which kind of run is queued; a lesson with a transcript is generating questions.
  const transcribing = lesson.status === 'transcribing' || (lesson.status === 'queued' && !lesson.pendingQuiz);
  const steps = transcribing ? TRANSCRIBE_STEPS : GENERATE_STEPS;
  const current = steps.findIndex((s) => s.status === lesson.status);
  const pct = lesson.progress?.progressPct ?? DEFAULT_PCT[lesson.status] ?? 0;
  return (
    <Card aria-live="polite">
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 shrink-0 animate-spin text-muted" aria-hidden />
          <div>
            <p className="font-display text-lg font-extrabold">{transcribing ? 'Transcribing the recording…' : 'Writing your quiz…'}</p>
            <p className="text-sm text-muted">
              {transcribing
                ? 'You’ll choose the number of questions and the difficulty next.'
                : 'The new questions appear here for your review.'}{' '}
              {lesson.progress?.message ?? 'This usually takes a few minutes. You can leave this page — we’ll keep working.'}
            </p>
          </div>
        </div>
        <ProgressBar value={pct} label={transcribing ? 'Transcription progress' : 'Quiz generation progress'} />
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.status}
              className={clsx(
                'flex items-center gap-2 border px-3 py-2 text-sm font-bold rounded-control',
                i < current && 'border-line text-muted',
                i === current && 'border-line-strong bg-surface-2 text-ink',
                i > current && 'border-line text-muted',
              )}
              aria-current={i === current ? 'step' : undefined}
            >
              {i < current ? (
                <Check className="size-4 text-success" aria-hidden />
              ) : i === current ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <span className="size-4" aria-hidden />
              )}
              {s.label}
            </li>
          ))}
        </ol>
        {lesson.progress && lesson.progress.attempt > 1 && (
          <p className="text-xs text-muted">Retry attempt {lesson.progress.attempt}.</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Shown while a classroom device is still recording this lesson. */
export function RecordingNotice() {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <Radio className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-display text-lg font-extrabold">This class is being recorded</p>
          <p className="text-sm text-muted">
            A classroom device is recording this lesson. Stop it from the Record page; the recording is then transcribed
            automatically and you choose the quiz settings here.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/** Failed transcription or generation with the reason; `onRetry` re-runs transcription. */
export function FailedView({
  lesson,
  onRetry,
  retrying,
  error,
}: {
  lesson: LessonDetail;
  onRetry: (() => void) | null;
  retrying: boolean;
  error: unknown;
}) {
  return (
    <Card className="border-danger/40">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-display text-lg font-extrabold">
              {lesson.hasTranscript ? 'Quiz generation failed' : lesson.hasAudio ? 'Transcription failed' : 'Processing failed'}
            </p>
            <p className="text-sm text-danger">{lesson.failureReason ?? 'Something went wrong while processing this lesson.'}</p>
            {lesson.hasTranscript ? (
              <p className="mt-1 text-sm text-muted">The transcript is ready. Choose the quiz settings below and generate again.</p>
            ) : (
              !lesson.hasAudio && (
                <p className="mt-1 text-sm text-muted">This lesson has no audio. Upload a recording below to try again.</p>
              )
            )}
          </div>
        </div>
        <InlineError error={error} />
        {onRetry && (
          <Button onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
