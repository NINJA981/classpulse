'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Loader2,
  Maximize,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  EXAM_VIOLATION_TYPES,
  type ExamEventResponse,
  type ExamEventType,
  type StudentExamPaper,
} from '@classiq/shared';
import { Button, Card, CardBody, InlineError } from '@/components/ui';
import { useCountdown } from '@/components/student/live/countdown';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { LanguageToggle, Note } from '../common';
import { OptionButton, OptionGroup } from '../quiz/option-button';
import { clearExamToken, examRequest, isDeviceConflict, isEnded, isNetworkError } from './exam-api';
import { enterFullscreen, fullscreenSupported, leaveFullscreen } from './exam-lobby';

type SaveState = 'idle' | 'saving' | 'saved' | 'offline';
type Ending = 'manual' | 'time_up' | 'auto' | null;
type ClientEvent = Exclude<ExamEventType, 'second_device' | 'resume'>;

const SYNC_MS = 30_000;
const EVENT_DEBOUNCE_MS = 1500;
const MAX_RETRY_MS = 15_000;

const EVENT_TEXT: Record<ClientEvent, string> = {
  fullscreen_exit: 'You left fullscreen',
  tab_hidden: 'You switched to another tab or app',
  window_blur: 'The exam window lost focus',
  copy: 'Copying is not allowed',
  paste: 'Pasting is not allowed',
  context_menu: 'The right-click menu is disabled',
  print: 'Printing is not allowed',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clock = (ms: number) => formatDuration(Math.ceil(Math.max(0, ms) / 1000));

/**
 * The exam itself: one question per screen with a navigator, server-synced
 * countdown, autosave with retries, integrity guards and submit. Rendered as a
 * full-viewport layer over the app shell.
 */
export function ExamPlayer({
  examId,
  initial,
  token,
  onFinished,
  onLocked,
}: {
  examId: string;
  initial: StudentExamPaper;
  token: string;
  onFinished: (reason: Ending) => void;
  onLocked: (message: string) => void;
}) {
  const questions = initial.questions;
  const needFullscreen = initial.requireFullscreen && fullscreenSupported();
  const [timing, setTiming] = useState(() => ({
    deadline: Date.parse(initial.deadlineAt),
    offset: initial.serverTime - Date.now(),
  }));
  const [answers, setAnswers] = useState<Record<string, number | null>>(initial.answers);
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [local, setLocal] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [violations, setViolations] = useState(initial.violationCount);
  const [warning, setWarning] = useState<string | null>(null);
  const [fsLost, setFsLost] = useState(() => needFullscreen && !document.fullscreenElement);
  const [ending, setEnding] = useState<Ending>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const remaining = useCountdown(timing.deadline, timing.offset);
  const totalMs = Math.max(1, timing.deadline - Date.parse(initial.startedAt));

  // Mutable session state shared by listeners, timers and the save loop.
  const ended = useRef(false);
  const pending = useRef(new Map<string, number | null>());
  const flushing = useRef<Promise<void> | null>(null);
  const lastEvent = useRef<Partial<Record<ClientEvent, number>>>({});
  const unsentEvents = useRef<ClientEvent[]>([]);
  const hiddenAt = useRef(0);
  const finishing = useRef(false);
  const timingRef = useRef(timing);

  /* ---------------------------------------------------------------- endings */

  function done(reason: Ending) {
    if (ended.current) return;
    ended.current = true;
    clearExamToken(examId);
    leaveFullscreen();
    onFinished(reason);
  }

  /** Server says the attempt is over or belongs to another device. Returns true when handled. */
  function handleTerminal(err: unknown): boolean {
    if (ended.current) return true;
    if (isDeviceConflict(err)) {
      ended.current = true;
      leaveFullscreen();
      onLocked(errorMessage(err));
      return true;
    }
    if (isEnded(err)) {
      done('auto');
      return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- autosave */

  async function runFlush() {
    let delay = 1000;
    while (pending.current.size && !ended.current) {
      const [qid, value] = pending.current.entries().next().value as [string, number | null];
      pending.current.delete(qid);
      setSaveState('saving');
      try {
        await examRequest('PUT', `/student/exams/${examId}/attempt/answers/${qid}`, {
          body: { selectedIndex: value },
          token,
        });
        delay = 1000;
      } catch (err) {
        if (handleTerminal(err)) return;
        if (isNetworkError(err) || (err instanceof ApiError && err.status >= 500)) {
          // Keep the newest choice for this question and retry with backoff.
          if (!pending.current.has(qid)) pending.current.set(qid, value);
          setSaveState('offline');
          await sleep(delay);
          delay = Math.min(delay * 2, MAX_RETRY_MS);
        }
      }
    }
    if (!ended.current) setSaveState(pending.current.size ? 'saving' : 'saved');
  }

  function flush(): Promise<void> {
    flushing.current ??= runFlush().finally(() => {
      flushing.current = null;
    });
    return flushing.current;
  }

  function choose(qid: string, shown: number) {
    if (ended.current) return;
    setAnswers((a) => ({ ...a, [qid]: shown }));
    pending.current.set(qid, shown);
    void flush();
  }

  /* ---------------------------------------------------------------- events */

  async function sendEvent(type: ClientEvent): Promise<boolean> {
    try {
      const res = await examRequest<ExamEventResponse>('POST', `/student/exams/${examId}/attempt/events`, {
        body: { type },
        token,
      });
      setViolations(res.violationCount);
      if (res.autoSubmitted) done('auto');
      return true;
    } catch (err) {
      if (handleTerminal(err)) return true;
      return !isNetworkError(err);
    }
  }

  async function logEvent(type: ClientEvent) {
    if (ended.current) return;
    const now = Date.now();
    if (now - (lastEvent.current[type] ?? 0) < EVENT_DEBOUNCE_MS) return;
    lastEvent.current[type] = now;
    if (EXAM_VIOLATION_TYPES.includes(type)) setWarning(EVENT_TEXT[type]);
    if (!(await sendEvent(type))) unsentEvents.current.push(type);
  }

  async function resendEvents() {
    const queue = unsentEvents.current.splice(0);
    for (const type of queue) if (!(await sendEvent(type))) unsentEvents.current.push(type);
  }

  /* ---------------------------------------------------------------- sync */

  async function sync() {
    if (ended.current) return;
    try {
      const p = await examRequest<StudentExamPaper>('GET', `/student/exams/${examId}/attempt`, { token });
      if (p.status !== 'in_progress') return done('auto');
      const next = { deadline: Date.parse(p.deadlineAt), offset: p.serverTime - Date.now() };
      timingRef.current = next;
      setTiming(next);
      setViolations(p.violationCount);
      void resendEvents();
      void flush();
    } catch (err) {
      handleTerminal(err);
    }
  }

  async function finish(reason: 'manual' | 'time_up') {
    if (ended.current || finishing.current) return;
    finishing.current = true;
    setEnding(reason);
    setSubmitError(null);
    // Give pending answers a few seconds to land (the server accepts them for a short grace period).
    await Promise.race([flush(), sleep(5000)]);
    try {
      await examRequest('POST', `/student/exams/${examId}/attempt/submit`, { token });
      done(reason);
    } catch (err) {
      if (handleTerminal(err)) return;
      setEnding(null);
      setSubmitError(err);
      if (reason === 'time_up') {
        // The timer check retries; back off so an offline device does not hammer the server.
        setReviewing(true);
        await sleep(3000);
      }
      finishing.current = false;
    }
  }

  // Latest closures for long-lived listeners and timers.
  const actions = useRef({ logEvent, sync, flush, finish });
  useEffect(() => {
    actions.current = { logEvent, sync, flush, finish };
  });

  /* ---------------------------------------------------------------- effects */

  useEffect(() => {
    const a = () => actions.current;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        void a().logEvent('tab_hidden');
      } else void a().sync();
    };
    // A tab switch fires blur too; only log blur when the page stayed visible.
    let blurTimer: number | undefined;
    const onBlur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!document.hidden && Date.now() - hiddenAt.current > 1000) void a().logEvent('window_blur');
      }, 400);
    };
    const onFullscreen = () => {
      if (!needFullscreen || ended.current) return;
      const lost = !document.fullscreenElement;
      setFsLost(lost);
      if (lost) void a().logEvent('fullscreen_exit');
    };
    const block = (type: ClientEvent) => (e: Event) => {
      e.preventDefault();
      void a().logEvent(type);
    };
    const onCopy = block('copy');
    const onPaste = block('paste');
    const onContext = block('context_menu');
    const onPrint = () => void a().logEvent('print');
    const onOnline = () => {
      void a().flush();
      void a().sync();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('beforeprint', onPrint);
    window.addEventListener('online', onOnline);

    const syncTimer = window.setInterval(() => void a().sync(), SYNC_MS);
    // Time-up check against the server-corrected clock.
    const tick = window.setInterval(() => {
      const t = timingRef.current;
      if (!ended.current && Date.now() + t.offset >= t.deadline) void a().finish('time_up');
    }, 500);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('online', onOnline);
      window.clearTimeout(blurTimer);
      window.clearInterval(syncTimer);
      window.clearInterval(tick);
    };
  }, [needFullscreen]);

  // Leaving the page (navigation) ends the session client-side; the server keeps the clock.
  useEffect(
    () => () => {
      ended.current = true;
    },
    [],
  );

  /* ---------------------------------------------------------------- render */

  const answeredCount = questions.filter((q) => answers[q.examQuestionId] != null).length;
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => answers[q.examQuestionId] == null);
  const hasLocal = questions.some((q) => q.stemLocal || q.optionsLocal);
  const urgent = remaining > 0 && remaining <= 60_000;
  const announce =
    remaining <= 60_000 ? 'One minute left' : remaining <= 5 * 60_000 ? 'Five minutes left' : '';
  const max = initial.maxViolations;

  function goTo(i: number) {
    setReviewing(false);
    setIndex(i);
  }

  const q = questions[index]!;
  const stem = local && q.stemLocal ? q.stemLocal : q.stem;
  const selected = answers[q.examQuestionId] ?? null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-extrabold">{initial.title}</h1>
          <SaveIndicator state={saveState} />
          <span
            role="timer"
            aria-label={`Time left ${clock(remaining)}`}
            className={clsx(
              'inline-flex min-w-24 items-center justify-center rounded-control border-2 px-2 py-1 font-display text-lg font-black tabular-nums',
              urgent ? 'border-danger bg-danger-soft text-danger' : 'border-line-strong bg-surface',
            )}
          >
            {clock(remaining)}
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-2" aria-hidden>
          {/* Width is a dynamic layout value, not theming. */}
          <div
            className={clsx('h-full transition-[width] duration-500', urgent ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${Math.min(100, (remaining / totalMs) * 100)}%` }}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
        {initial.requireFullscreen && !needFullscreen && (
          <Note tone="info" icon={<Maximize className="size-4" aria-hidden />}>
            This device cannot lock the screen to fullscreen. Stay on this page — leaving it is still
            recorded.
          </Note>
        )}

        {(violations > 0 || warning) && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              {warning && <p className="font-bold">{warning}. This was recorded.</p>}
              <p className="text-ink-2">
                Integrity warnings: {violations}
                {max ? ` of ${max} — the exam is submitted automatically at ${max}.` : '.'}
              </p>
            </div>
            {warning && (
              <button
                type="button"
                onClick={() => setWarning(null)}
                className="grid size-8 place-items-center rounded-control hover:bg-surface-2"
                aria-label="Dismiss warning"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}

        {reviewing ? (
          <Card>
            <CardBody className="flex flex-col gap-5">
              <div>
                <p className="eyebrow mb-1">Review</p>
                <h2 className="font-display text-2xl font-black">Ready to submit?</h2>
                <p className="mt-1 text-sm text-muted">
                  You answered {answeredCount} of {questions.length} questions. You cannot change answers
                  after submitting.
                </p>
              </div>
              {unanswered.length > 0 ? (
                <>
                  <Note tone="warning" icon={<AlertTriangle className="size-4 text-warning" aria-hidden />}>
                    <p className="font-bold">
                      {unanswered.length} unanswered {unanswered.length === 1 ? 'question' : 'questions'}
                    </p>
                    <p className="text-ink-2">Unanswered questions count as incorrect.</p>
                  </Note>
                  <ul className="flex flex-col gap-2" aria-label="Unanswered questions">
                    {unanswered.map(({ q: u, i }) => (
                      <li key={u.examQuestionId}>
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          className="flex min-h-12 w-full items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-left text-sm hover:border-line-strong"
                        >
                          <span className="font-display font-black">Q{i + 1}</span>
                          <span className="line-clamp-2 min-w-0 flex-1 text-ink-2">{u.stem}</span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Note tone="success" icon={<CheckCircle2 className="size-4 text-success" aria-hidden />}>
                  <p className="font-bold">All questions answered.</p>
                </Note>
              )}
              <InlineError error={submitError} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={Boolean(ending)}
                  onClick={() => goTo(questions.length - 1)}
                  icon={<ArrowLeft className="size-5" aria-hidden />}
                >
                  Back to questions
                </Button>
                <Button
                  size="lg"
                  className="w-full sm:flex-1"
                  loading={ending === 'manual'}
                  disabled={Boolean(ending)}
                  onClick={() => void finish('manual')}
                >
                  Submit exam
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold" aria-live="polite">
                Question {index + 1} of {questions.length}
              </p>
              {hasLocal && <LanguageToggle local={local} onChange={setLocal} />}
            </div>
            <Card>
              <CardBody className="flex flex-col gap-5">
                <h2 className="font-display text-xl font-extrabold leading-snug break-words select-none">
                  {stem}
                </h2>
                <OptionGroup label={`Answer options for question ${index + 1}`}>
                  {q.options.map((opt, i) => (
                    <OptionButton
                      key={`${q.examQuestionId}-${i}`}
                      index={i}
                      text={local && q.optionsLocal?.[i] ? q.optionsLocal[i]! : opt}
                      checked={selected === i}
                      disabled={Boolean(ending)}
                      onSelect={() => choose(q.examQuestionId, i)}
                    />
                  ))}
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
                Previous
              </Button>
              {index < questions.length - 1 ? (
                <Button size="lg" className="flex-1" onClick={() => setIndex((i) => i + 1)}>
                  Next <ArrowRight className="size-5" aria-hidden />
                </Button>
              ) : (
                <Button size="lg" className="flex-1" onClick={() => setReviewing(true)}>
                  Review and submit
                </Button>
              )}
            </div>
          </>
        )}

        <nav aria-label="Question navigator" className="rounded-card border border-line bg-surface p-4">
          <p className="mb-3 text-xs font-bold text-ink-2">
            {answeredCount} of {questions.length} answered
          </p>
          <ol className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {questions.map((nq, i) => {
              const answered = answers[nq.examQuestionId] != null;
              const current = !reviewing && i === index;
              return (
                <li key={nq.examQuestionId}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Question ${i + 1}, ${answered ? 'answered' : 'not answered'}`}
                    className={clsx(
                      'grid min-h-11 w-full place-items-center rounded-control border-2 font-display text-sm font-black',
                      current && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                      answered
                        ? 'border-line-strong bg-accent text-accent-ink'
                        : 'border-line bg-surface-2 text-ink-2',
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          {!reviewing && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setReviewing(true)}>
              Review and submit
            </Button>
          )}
        </nav>
      </main>

      {fsLost && !ending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fs-title"
          className="fixed inset-0 z-50 grid place-items-center bg-canvas p-6"
        >
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <Maximize className="size-10" aria-hidden />
            <h2 id="fs-title" className="font-display text-2xl font-black">
              Return to fullscreen to continue
            </h2>
            <p className="text-sm text-ink-2">
              Leaving fullscreen was recorded. The timer is still running.
              {max ? ` Warnings so far: ${violations} of ${max}.` : ''}
            </p>
            <Button
              size="lg"
              autoFocus
              onClick={() => enterFullscreen()}
              icon={<Maximize className="size-5" aria-hidden />}
            >
              Return to fullscreen
            </Button>
          </div>
        </div>
      )}

      {ending && ending !== 'manual' && (
        <div
          role="status"
          className="fixed inset-0 z-50 grid place-items-center bg-canvas/90 p-6 text-center"
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin" aria-hidden />
            <p className="font-display text-xl font-black">
              {ending === 'time_up' ? "Time's up — submitting your answers…" : 'Submitting…'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return <span className="sr-only" aria-live="polite" />;
  return (
    <span
      aria-live="polite"
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs font-bold',
        state === 'offline' ? 'text-danger' : 'text-muted',
      )}
    >
      {state === 'saving' && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {state === 'saved' && <CheckCircle2 className="size-3.5 text-success" aria-hidden />}
      {state === 'offline' && <CloudOff className="size-3.5" aria-hidden />}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Offline — will retry'}
    </span>
  );
}
