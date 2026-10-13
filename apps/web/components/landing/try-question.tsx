'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CODEMIX_LINE, DEMO_QUESTION } from './story/chapters';
import { ChalkTray } from './chalk-writing';
import boardStyles from './finale.module.css';
import { fill, fillNodes } from './i18n/format';
import { useLandingCopy } from './i18n/copy-context';
import { ctaClassName } from './landing-buttons';

const DURATION = 20;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

type Phase = 'idle' | 'playing' | 'correct' | 'wrong' | 'timeout';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The page's one hands-on moment: answer the question the demo lesson produced, on a student's phone.
 * Nothing moves until the visitor presses Start.
 */
export function TryQuestion() {
  const { tryQuestion: copy } = useLandingCopy();
  return (
    <section id="try" aria-labelledby="try-title" className="relative overflow-hidden bg-canvas py-20 text-uniform md:py-28">
      <div className="landing-container grid items-center gap-10 sm:gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2
            id="try-title"
            className="max-w-[14ch] font-display text-display-l [&:lang(hi)]:max-w-[16ch] [&:lang(ta)]:max-w-[22ch] font-extrabold text-balance [font-variation-settings:'wdth'_96,'opsz'_72]"
          >
            {copy.title}
          </h2>
          <p className="mt-6 max-w-[38ch] text-lede text-ink-2 [&:lang(ta)]:max-w-[46ch]">
            {fillNodes(copy.intro, {
              time: <span className="font-mono text-[0.9em] tabular-nums">{DEMO_QUESTION.timestamp}</span>,
            })}
          </p>

          <figure className="mt-8 max-w-md sm:mt-10 rounded-card border-2 border-uniform bg-chalk p-5 sm:p-6">
            <figcaption className="flex items-center justify-between gap-4 text-sm font-semibold">
              {copy.saidLabel}
              <span className="inline-flex h-6 items-center rounded-card bg-uniform px-2 font-mono text-[0.8125rem] font-normal text-pulse tabular-nums">
                {DEMO_QUESTION.timestamp}
              </span>
            </figcaption>
            <blockquote lang="ta" className="mt-4 font-indic text-[1.1875rem] leading-relaxed">
              {CODEMIX_LINE.map((w, i) => (
                <span key={i}>
                  {w.english ? (
                    <span lang="en" className="bg-[linear-gradient(transparent_62%,var(--cp-pulse)_62%)]">
                      {w.text}
                    </span>
                  ) : (
                    w.text
                  )}
                  {CODEMIX_LINE[i + 1]?.text.startsWith('-') ? '' : ' '}
                </span>
              ))}
            </blockquote>
            <p className="mt-2 text-sm text-muted">{copy.codemixTranslation}</p>
            <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-2">{copy.wroteNote}</p>
          </figure>
        </div>

        <div className="relative lg:col-span-7">
          {/* The classroom's chalkboard behind the phone: framed, dusty, with a ledge, like the finale's. */}
          <div
            aria-hidden
            className={clsx(
              boardStyles.board,
              boardStyles.slate,
              'absolute inset-x-[-0.5rem] top-[12%] bottom-[12%] sm:inset-x-[8%] lg:inset-x-[2%]',
            )}
          >
            <div className="absolute inset-x-[-10px] top-full">
              <ChalkTray contained={false} />
            </div>
          </div>
          <Phone />
        </div>
      </div>
    </section>
  );
}

function Phone() {
  const { tryQuestion: copy } = useLandingCopy();
  const explanation = fill(copy.explanation, { time: DEMO_QUESTION.timestamp });
  const [phase, setPhase] = useState<Phase>('idle');
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(DURATION);
  const [message, setMessage] = useState('');
  // WCAG 2.2.1: a visitor can turn the time limit off before starting.
  const [untimed, setUntimed] = useState(false);

  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealTimer = useRef(0);
  const focusAfter = useRef<'prompt' | 'start' | null>(null);

  const answered = phase === 'correct' || phase === 'wrong' || phase === 'timeout';

  // Move focus to what just appeared (after the DOM has it).
  useEffect(() => {
    if (focusAfter.current === 'prompt') promptRef.current?.focus();
    if (focusAfter.current === 'start') startRef.current?.focus();
    focusAfter.current = null;
  }, [phase]);

  // Countdown — only while playing, and only if timed.
  useEffect(() => {
    if (phase !== 'playing' || untimed) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, DURATION - (performance.now() - t0) / 1000);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        setPhase('timeout');
        setRevealed(true);
        setMessage(fill(copy.announce.timesUp, { answer: DEMO_QUESTION.options[DEMO_QUESTION.answer], explanation }));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, untimed, copy, explanation]);

  useEffect(() => () => window.clearTimeout(revealTimer.current), []);

  const start = () => {
    focusAfter.current = 'prompt';
    setRemaining(DURATION);
    setPhase('playing');
    setMessage(
      untimed
        ? fill(copy.announce.startUntimed, { prompt: copy.prompt })
        : fill(copy.announce.startTimed, { seconds: DURATION, prompt: copy.prompt }),
    );
  };

  const reset = () => {
    window.clearTimeout(revealTimer.current);
    focusAfter.current = 'start';
    setPhase('idle');
    setChoice(null);
    setRevealed(false);
    setRemaining(DURATION);
    setMessage('');
  };

  const answer = (i: number) => {
    if (phase !== 'playing') return;
    setChoice(i);
    const right = DEMO_QUESTION.options[DEMO_QUESTION.answer];
    if (i === DEMO_QUESTION.answer) {
      setPhase('correct');
      setRevealed(true);
      setMessage(fill(copy.announce.correct, { answer: right, explanation }));
      const btn = optionRefs.current[i];
      if (btn && !prefersReduced()) burst(btn);
    } else {
      setPhase('wrong');
      setMessage(fill(copy.announce.wrong, { choice: DEMO_QUESTION.options[i] ?? '', answer: right, explanation }));
      revealTimer.current = window.setTimeout(() => setRevealed(true), prefersReduced() ? 0 : 480);
    }
  };

  // Chalk-dust burst from the chosen option, drawn on a canvas over the screen.
  const burst = useCallback((origin: HTMLElement) => {
    const canvas = canvasRef.current;
    const screen = screenRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !screen || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = screen.getBoundingClientRect();
    canvas.width = box.width * dpr;
    canvas.height = box.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const o = origin.getBoundingClientRect();
    const ox = o.left - box.left + o.width * 0.5;
    const oy = o.top - box.top + o.height * 0.5;
    const css = getComputedStyle(screen);
    const colors = ['--cp-pulse', '--cp-uniform', '--cp-board-2', '--cp-pulse'].map((v) => css.getPropertyValue(v).trim());
    const parts = Array.from({ length: 46 }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 1.6 + Math.random() * 5.2;
      return {
        x: ox + (Math.random() - 0.5) * o.width * 0.7,
        y: oy + (Math.random() - 0.5) * o.height * 0.4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2.2,
        r: Math.random() * Math.PI,
        size: 1.5 + Math.random() * 3,
        life: 0,
        max: 42 + Math.random() * 30,
        color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? 'currentColor',
      };
    });
    const step = () => {
      ctx.clearRect(0, 0, box.width, box.height);
      let alive = 0;
      for (const p of parts) {
        if (p.life >= p.max) continue;
        alive++;
        p.life++;
        p.vx *= 0.95;
        p.vy = p.vy * 0.95 + 0.16;
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.12;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, box.width, box.height);
    };
    requestAnimationFrame(step);
  }, []);

  const seconds = Math.ceil(remaining);

  return (
    <div data-demo-phone className="relative mx-auto w-full max-w-[21.5rem]">
      <div className="rounded-[2.75rem] bg-uniform p-[11px] shadow-[18px_22px_0_-4px_color-mix(in_oklab,var(--cp-uniform)_22%,transparent)]">
        <div
          ref={screenRef}
          className="relative flex min-h-[34rem] flex-col sm:min-h-[39rem] overflow-hidden rounded-[2.15rem] bg-chalk text-uniform"
        >
          {/* status bar + camera */}
          <div aria-hidden className="flex h-11 shrink-0 items-center justify-center">
            <span className="h-[22px] w-[86px] rounded-full bg-uniform" />
          </div>

          {/* app bar */}
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="/icons/icon.svg" alt="" width={24} height={24} className="size-6 rounded-[6px]" />
              <span className="text-sm font-semibold">{copy.appBar}</span>
            </div>
            <span className="font-mono text-xs text-muted tabular-nums">{copy.questionCount}</span>
          </div>

          <div className="flex flex-1 flex-col px-5 pt-5 pb-6">
            {phase === 'idle' ? (
              <div className="flex flex-1 flex-col">
                <p className="text-sm font-semibold text-muted">{copy.topic}</p>
                <p className="mt-3 font-display text-[2.375rem] leading-[1] font-extrabold tracking-[-0.025em] [font-variation-settings:'wdth'_90] [&:lang(ta)]:text-[1.875rem]">
                  {copy.readyTitle[0]}
                  <br />
                  {copy.readyTitle[1]}
                </p>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">{copy.readyBody}</p>
                <div className="mt-5 flex flex-1 items-center justify-center sm:mt-8" aria-hidden>
                  <div className="relative grid size-28 place-items-center sm:size-36">
                    <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90">
                      <circle cx="28" cy="28" r={RING_R + 2} fill="var(--cp-pulse)" stroke="var(--cp-uniform)" strokeWidth="1.5" />
                      <circle cx="28" cy="28" r={RING_R - 3} fill="none" stroke="var(--cp-uniform)" strokeWidth="0.5" strokeDasharray="0.6 2.2" />
                    </svg>
                    {/* relative: paint above the absolutely positioned dial */}
                    <span className="relative text-center">
                      {untimed ? (
                        <span className="block font-display text-2xl leading-tight font-bold [&:lang(ta)]:text-lg">
                          {copy.noLimitShort[0]}
                          <br />
                          {copy.noLimitShort[1]}
                        </span>
                      ) : (
                        <>
                          <span className="block font-mono text-4xl font-semibold tabular-nums">{DURATION}</span>
                          <span className="text-xs font-medium">{copy.seconds}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="pt-4">
                  <label className="relative mb-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 border-y border-line text-sm font-semibold">
                    {copy.noTimeLimit}
                    <input
                      type="checkbox"
                      role="switch"
                      checked={untimed}
                      onChange={(e) => setUntimed(e.target.checked)}
                      className="peer absolute size-px opacity-0"
                    />
                    <span
                      aria-hidden
                      className={clsx(
                        'relative h-6 w-11 shrink-0 rounded-card border-2 border-uniform bg-chalk transition-colors duration-200 ease-snap',
                        'after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-[1px] after:bg-uniform after:transition-transform after:duration-200 after:ease-snap',
                        'peer-checked:bg-uniform peer-checked:after:translate-x-5 peer-checked:after:bg-pulse',
                        'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-uniform peer-focus-visible:outline-solid',
                      )}
                    />
                  </label>
                  <button ref={startRef} type="button" onClick={start} className={clsx(ctaClassName('primary'), 'w-full')}>
                    {copy.start}
                  </button>
                  <p className="mt-3 text-center text-xs text-muted">{untimed ? copy.untimedHint : copy.timedHint}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-4">
                  <Ring
                    remaining={remaining}
                    seconds={seconds}
                    done={answered}
                    untimed={untimed}
                    noLimit={copy.noLimitShort}
                    secondsLeft={copy.secondsLeft}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{copy.questionNumber}</p>
                    <p className="text-xs text-muted">
                      {fillNodes(copy.fromLesson, {
                        time: <span className="font-mono tabular-nums">{DEMO_QUESTION.timestamp}</span>,
                      })}
                    </p>
                  </div>
                </div>

                <div ref={promptRef} tabIndex={-1} className="mt-5 rounded-card focus:outline-none">
                  <p lang="ta" className="font-indic text-[1.1875rem] leading-snug font-semibold">
                    {DEMO_QUESTION.promptTa}
                  </p>
                  {/* The quiz itself, as the app shows it: the lesson's language, then English. */}
                  <p lang="en" className="mt-1.5 text-[0.9375rem] text-ink-2">
                    {DEMO_QUESTION.promptEn}
                  </p>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {DEMO_QUESTION.options.map((opt, i) => {
                    const isAnswer = i === DEMO_QUESTION.answer;
                    const isChoice = choice === i;
                    const showRight = revealed && isAnswer;
                    const showWrong = phase === 'wrong' && isChoice;
                    return (
                      <li key={opt}>
                        <button
                          ref={(el) => {
                            optionRefs.current[i] = el;
                          }}
                          type="button"
                          aria-disabled={answered || undefined}
                          onClick={() => answer(i)}
                          className={clsx(
                            'flex min-h-[3.25rem] w-full items-center gap-3 rounded-card border-2 px-3.5 text-left text-[1rem] font-semibold',
                            'transition-[background-color,border-color,color,opacity,transform] duration-200 ease-snap focus-visible:outline-uniform',
                            !answered && 'border-uniform bg-chalk hover:bg-wall active:translate-y-px',
                            showRight && 'border-uniform bg-pulse',
                            showWrong && 'border-redpen bg-chalk text-uniform',
                            answered && !showRight && !showWrong && 'border-line bg-chalk text-muted',
                            answered && 'cursor-default',
                          )}
                        >
                          <span
                            aria-hidden
                            className={clsx(
                              'grid size-7 shrink-0 place-items-center rounded-card border font-mono text-xs',
                              showRight ? 'border-uniform bg-uniform text-pulse' : 'border-current',
                            )}
                          >
                            {LETTERS[i]}
                          </span>
                          <span lang="en" className="relative">
                            {opt}
                            {showWrong ? <Strike /> : null}
                          </span>
                          <span className="ml-auto text-xs font-semibold">
                            {showRight ? (
                              <span className="inline-flex items-center gap-1">
                                <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                                  <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {isChoice ? copy.yourAnswer : copy.answer}
                              </span>
                            ) : showWrong ? (
                              <span className="text-redpen">{copy.yourAnswer}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {answered ? (
                  <div className="mt-auto pt-5">
                    <div className="rounded-card bg-uniform p-4 text-chalk">
                      <p className="font-display text-lg font-bold">
                        {phase === 'correct' ? copy.correct : phase === 'wrong' ? copy.notQuite : copy.timesUp}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-chalk-dim">{explanation}</p>
                    </div>
                    <button type="button" onClick={reset} className={clsx(ctaClassName('secondary', 'onLight', 'md'), 'mt-3 w-full')}>
                      {copy.tryAgain}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
          <p role="status" aria-live="polite" className="sr-only">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function Ring({
  remaining,
  seconds,
  done,
  untimed,
  noLimit,
  secondsLeft,
}: {
  remaining: number;
  seconds: number;
  done: boolean;
  untimed: boolean;
  noLimit: readonly [string, string];
  secondsLeft: string;
}) {
  if (untimed) {
    return (
      <span className="grid size-14 shrink-0 place-items-center rounded-full border-[5px] border-line text-center text-[10px] leading-tight font-semibold">
        <span>
          {noLimit[0]}
          <br />
          {noLimit[1]}
        </span>
      </span>
    );
  }
  const offset = RING_C * (1 - remaining / DURATION);
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={RING_R} fill={done ? 'none' : 'var(--cp-pulse)'} stroke="var(--cp-line)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={RING_R}
          fill="none"
          stroke="var(--cp-uniform)"
          strokeWidth="5"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold tabular-nums">
        <span className="sr-only">{secondsLeft}</span>
        {seconds}
      </span>
    </div>
  );
}

/** Hand-drawn red-pen strike through a wrong answer. */
function Strike() {
  const draw = useCallback((path: SVGPathElement | null) => {
    if (!path || prefersReduced() || typeof path.animate !== 'function') return;
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 380,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'backwards',
    });
  }, []);
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className="pointer-events-none absolute top-1/2 -left-1.5 h-5 w-[calc(100%+0.75rem)] -translate-y-1/2 overflow-visible"
    >
      <path
        ref={draw}
        d="M2 13 C 18 9, 34 12, 50 9 S 82 10, 98 6"
        fill="none"
        stroke="var(--cp-redpen)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={0}
      />
    </svg>
  );
}
