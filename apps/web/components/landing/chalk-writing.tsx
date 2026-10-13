'use client';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import styles from './finale.module.css';

/**
 * "Book a demo", written on the board in chalk. Single-stroke letterforms, drawn once when the board
 * comes into view. Without JS, or with reduced motion, it's simply there.
 */

// Baseline y=100, x-height y=62, ascender y=24. Each entry is one pen stroke in writing order.
const STROKES: { d: string; dur: number; gap?: number; tone?: 'pulse' }[] = [
  // B
  { d: 'M6 26 V100 M6 26 H22 C41 26 42 60 22 61 H9 M22 61 C48 61 48 100 22 100 H6', dur: 620 },
  // o o
  { d: 'M76 62 A19 19 0 0 0 76 100 A19 19 0 0 0 76 62', dur: 340 },
  { d: 'M123 62 A19 19 0 0 0 123 100 A19 19 0 0 0 123 62', dur: 340 },
  // k
  { d: 'M153 24 V100 M181 60 L155 84 M164 77 L184 100', dur: 460 },
  // a
  { d: 'M240 70 A18 19 0 1 0 240 92 M242 62 V100', dur: 440, gap: 160 },
  // d
  { d: 'M302 70 A18 19 0 1 0 302 92 M304 24 V100', dur: 480, gap: 160 },
  // e
  { d: 'M315 82 H352 A19 19 0 1 0 346 96', dur: 380 },
  // m
  { d: 'M364 62 V100 M364 76 C364 60 388 58 388 72 V100 M388 72 C388 58 412 58 412 72 V100', dur: 560 },
  // o
  { d: 'M441 62 A19 19 0 0 0 441 100 A19 19 0 0 0 441 62', dur: 340 },
  // Underline in yellow chalk.
  { d: 'M262 118 C322 109 398 107 464 112', dur: 520, gap: 120, tone: 'pulse' },
];

// Split every stroke into single subpaths so no unrevealed subpath ever shows a round-cap dot,
// then lay them end to end in time.
const TIMED = STROKES.flatMap((s) => {
  const parts = s.d.split(/(?=M)/).map((p) => p.trim());
  return parts.map((d, i) => ({
    d,
    dur: Math.round(s.dur / parts.length),
    gap: i === 0 ? s.gap : 30,
    tone: s.tone,
  }));
}).reduce<{ d: string; dur: number; delay: number; tone?: 'pulse' }[]>((acc, s) => {
  const prev = acc[acc.length - 1];
  const delay = prev ? prev.delay + prev.dur + (s.gap ?? 60) : 150;
  acc.push({ d: s.d, dur: s.dur, delay, tone: s.tone });
  return acc;
}, []);

export function ChalkWriting({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<'static' | 'armed' | 'play'>('static');
  const filterId = `chalk-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setState('armed');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('play');
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="-8 12 482 116"
      className={`${styles.writing} ${className ?? ''}`}
      data-state={state}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Chalk: punch fine holes into the stroke and rough up its edge. */}
        <filter id={filterId} x="-4%" y="-10%" width="108%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.75"
            result="grain"
          />
          <feComposite in="SourceGraphic" in2="grain" operator="in" result="speckled" />
          <feDisplacementMap
            in="speckled"
            in2="noise"
            scale="2.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {TIMED.map((s, i) => (
          <path
            key={i}
            d={s.d}
            pathLength={1}
            className={`${styles.stroke} ${s.tone === 'pulse' ? 'stroke-pulse' : 'stroke-chalk'}`}
            strokeWidth={s.tone === 'pulse' ? 5 : 6.5}
            style={{ '--dur': `${s.dur}ms`, '--delay': `${s.delay}ms` } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}

/** The wooden ledge at the foot of a chalkboard, with a few sticks of chalk (one yellow) lying on it. */
export function ChalkTray({ className, contained = true }: { className?: string; contained?: boolean }) {
  const sticks = (
    <>
      <span className="absolute -top-2 right-[18%] h-2.5 w-14 rotate-[-4deg] rounded-[2px] bg-chalk/90 sm:w-16" />
      <span className="absolute -top-2 right-[calc(18%+4.5rem)] h-2.5 w-8 rotate-[6deg] rounded-[2px] bg-chalk/70" />
      <span className="absolute -top-2 right-[calc(18%-3.5rem)] h-2.5 w-10 rotate-[2deg] rounded-[2px] bg-pulse" />
      <span className="absolute -top-3 left-[12%] hidden h-3.5 w-20 rounded-[2px] bg-uniform sm:block" />
    </>
  );
  return (
    <div aria-hidden className={clsx(styles.tray, 'relative h-5 sm:h-6', className)}>
      {contained ? <div className="landing-container relative h-full">{sticks}</div> : sticks}
    </div>
  );
}
