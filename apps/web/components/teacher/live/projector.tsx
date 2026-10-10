'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Maximize2, Users } from 'lucide-react';
import { Button, ErrorState, LoadingBlock } from '@/components/ui';
import { OptionDistribution } from '@/components/teacher/analytics/option-distribution';
import { Countdown, ConnectionBanner, Leaderboard, OptionTiles, Podium } from './parts';
import { useLiveHost } from './use-live-host';

function useQrDataUrl(text: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    QRCode.toDataURL(text, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);
  return url;
}

/** Read-only, large-type classroom display of a live session (joins as an extra host socket). */
export function Projector({ sessionId }: { sessionId: string }) {
  const { state } = useLiveHost(sessionId);
  const rootRef = useRef<HTMLDivElement>(null);
  const pin = state.snapshot?.pin ?? null;
  const joinUrl = pin && typeof window !== 'undefined' ? `${window.location.origin}/student/live?pin=${pin}` : null;
  const qr = useQrDataUrl(joinUrl);

  function fullscreen() {
    const el = rootRef.current;
    if (el && !document.fullscreenElement) void el.requestFullscreen().catch(() => undefined);
  }

  if (state.joinError) return <ErrorState error={new Error(state.joinError)} onRetry={() => window.location.reload()} />;
  if (!state.snapshot) return <LoadingBlock label="Connecting to the live session…" />;

  const snap = state.snapshot;
  const total = state.question?.total ?? snap.questionCount;
  const index = state.closed?.index ?? state.question?.index ?? snap.currentQuestionIndex;

  return (
    <div ref={rootRef} className="flex min-h-[80vh] flex-col gap-8 overflow-y-auto border border-line-strong bg-canvas p-6 rounded-card sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="eyebrow">Live quiz</p>
          <p className="truncate font-display text-3xl font-black">{snap.title}</p>
        </div>
        <div className="flex items-center gap-6 text-2xl font-bold">
          {index != null && state.status !== 'ended' && (
            <span className="tabular-nums">
              Q{index + 1}/{total}
            </span>
          )}
          <span className="inline-flex items-center gap-2 tabular-nums" aria-label={`${state.participantCount} students joined`}>
            <Users className="size-7" aria-hidden />
            {state.participantCount}
          </span>
          <span className="font-mono tracking-widest">PIN {snap.pin}</span>
          <Button variant="ghost" size="sm" aria-label="Full screen" onClick={fullscreen}>
            <Maximize2 className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      <ConnectionBanner connection={state.connection} />

      {state.status === 'ended' ? (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10">
          <h1 className="text-center font-display text-6xl font-black">Final results</h1>
          <Podium entries={state.finalBoard ?? state.leaderboard} size="xl" />
        </div>
      ) : state.status === 'lobby' ? (
        <div className="grid grid-cols-1 flex-1 items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold text-ink-2">Join the quiz with PIN</h1>
            <p className="font-display text-[clamp(4rem,12vw,10rem)] font-black leading-none tracking-[0.12em] tabular-nums">
              {snap.pin}
            </p>
            <p className="text-2xl text-muted">Open ClassPulse → Live quiz, or scan the code</p>
            <p className="text-3xl font-bold tabular-nums">
              {state.participantCount} {state.participantCount === 1 ? 'student' : 'students'} joined
            </p>
          </div>
          <div className="flex flex-col items-center gap-6">
            {qr ? (
              <img src={qr} alt={`QR code to join with PIN ${snap.pin}`} className="size-80 border border-line-strong bg-surface p-3" />
            ) : (
              <div className="size-80 animate-pulse bg-surface-2" aria-hidden />
            )}
            {state.participants.length > 0 && (
              <ul className="flex max-h-48 flex-wrap justify-center gap-2 overflow-hidden text-xl">
                {state.participants.map((p) => (
                  <li key={p.participantId} className="border border-line-strong bg-surface px-3 py-1 font-bold rounded-control">
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : state.status === 'question_open' && state.question ? (
        <div className="flex flex-1 flex-col gap-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <h1 className="min-w-0 flex-1 font-display text-[clamp(2rem,4vw,3.75rem)] font-black leading-tight">
              {state.question.stem}
            </h1>
            <Countdown closesAt={state.question.closesAt} offsetMs={state.offsetMs} size="xl" />
          </div>
          {/* The projector never shows the answer while the question is open. */}
          <OptionTiles options={state.question.options} size="xl" />
          <p className="text-center text-3xl font-bold tabular-nums" aria-live="polite">
            {state.answered?.questionId === state.question.questionId ? state.answered.answeredCount : 0} /{' '}
            {state.answered?.participantCount ?? state.participantCount} answered
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 flex-1 gap-10 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {state.question && (
              <h1 className="font-display text-[clamp(1.75rem,3vw,3rem)] font-black leading-tight">{state.question.stem}</h1>
            )}
            {state.closed && (
              <>
                <OptionDistribution
                  distribution={state.closed.distribution}
                  options={state.question?.options}
                  correctIndex={state.closed.correctIndex}
                  size="xl"
                />
                {state.closed.explanation && <p className="text-2xl leading-relaxed text-ink-2">{state.closed.explanation}</p>}
              </>
            )}
          </div>
          <div className="lg:col-span-2">
            <h2 className="mb-4 font-display text-4xl font-black">Leaderboard</h2>
            <Leaderboard entries={state.leaderboard} limit={5} size="xl" />
          </div>
        </div>
      )}
    </div>
  );
}
