'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CODEMIX_LINE, CODEMIX_TRANSLATION, DEMO_QUESTION, INSIGHT } from '../story/chapters';
import { useFrameState } from './frame-state';
import { BOARD, TEACHER_HEAD } from './layout';
import { clamp01, lerp, ramp, smooth } from './timeline';

/**
 * DOM overlays pinned to points in the 3D room: crisp multilingual text with no font atlas.
 *
 * Why not drei <Html>: each <Html> mounts its own React root and unmounts it synchronously in a
 * layout-effect cleanup, which React warns about (and which can drop content in StrictMode). Here
 * the overlay markup lives in the normal React tree beside the <Canvas>, is always mounted, and an
 * in-canvas driver projects anchor points and writes transform/opacity straight to the DOM each
 * frame — no re-renders, no extra roots. Everything is aria-hidden and pointer-events:none: these
 * are decorative mirrors of the story captions.
 */

export interface OverlayRegistry {
  codemix: HTMLDivElement | null;
  codemixInner: HTMLDivElement | null;
  chips: (HTMLSpanElement | null)[];
  caption: HTMLParagraphElement | null;
  card: HTMLDivElement | null;
  cardInner: HTMLDivElement | null;
  stamp: HTMLDivElement | null;
  tick: HTMLSpanElement | null;
  board: HTMLDivElement | null;
  boardInner: HTMLDivElement | null;
  bars: (HTMLSpanElement | null)[];
  insight: HTMLDivElement | null;
  insightInner: HTMLDivElement | null;
  bloom: (HTMLSpanElement | null)[];
}

export function createOverlayRegistry(): OverlayRegistry {
  return {
    codemix: null,
    codemixInner: null,
    chips: [],
    caption: null,
    card: null,
    cardInner: null,
    stamp: null,
    tick: null,
    board: null,
    boardInner: null,
    bars: [],
    insight: null,
    insightInner: null,
    bloom: [],
  };
}

interface Chip {
  parts: { text: string; english: boolean }[];
}

function chipsFromLine(): Chip[] {
  const chips: Chip[] = [];
  for (const token of CODEMIX_LINE) {
    const english = Boolean(token.english);
    // Tamil case suffixes ("-ல", "-ஐ") stick to the English word they inflect.
    if (token.text.startsWith('-') && chips.length) {
      chips[chips.length - 1]?.parts.push({ text: token.text.slice(1), english });
    } else {
      chips.push({ parts: [{ text: token.text, english }] });
    }
  }
  return chips;
}

const CHIPS = chipsFromLine();

const LEADERS = [
  { name: 'Kavya', score: 980 },
  { name: 'Arjun', score: 940 },
  { name: 'Meenakshi', score: 905 },
  { name: 'Farhan', score: 870 },
];

const ANCHOR = 'pointer-events-none invisible absolute top-0 left-0 opacity-0 will-change-transform';

// ---------------------------------------------------------------------------------------------
// DOM layer (outside the Canvas)
// ---------------------------------------------------------------------------------------------

export function OverlayLayer({ reg }: { reg: OverlayRegistry }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      {/* Chapter 2: the codemix sentence */}
      <div
        ref={(el) => {
          reg.codemix = el;
        }}
        className={ANCHOR}
      >
        <div
          ref={(el) => {
            reg.codemixInner = el;
          }}
          className="flex w-[min(88vw,40rem)] flex-col items-center gap-3"
        >
          <div className="flex flex-wrap justify-center gap-2">
            {CHIPS.map((chip, i) => (
              <span
                key={i}
                ref={(el) => {
                  reg.chips[i] = el;
                }}
                className="inline-flex items-baseline rounded-[3px] bg-board px-3 py-1.5 text-[clamp(1rem,0.8rem+1vw,1.6rem)] leading-tight opacity-0 shadow-[0_12px_28px_-12px_rgb(0_0_0/0.6)] ring-1 ring-board-2"
              >
                {chip.parts.map((part, j) =>
                  part.english ? (
                    <span key={j} className="font-display font-semibold text-pulse [text-shadow:0_0_18px_color-mix(in_srgb,var(--cp-pulse)_55%,transparent)]">
                      {part.text}
                    </span>
                  ) : (
                    <span key={j} className="font-indic text-chalk">
                      {part.text}
                    </span>
                  ),
                )}
              </span>
            ))}
          </div>
          <p
            ref={(el) => {
              reg.caption = el;
            }}
            className="rounded-[3px] bg-board/85 px-2.5 py-1 text-xs text-chalk-dim opacity-0 sm:text-sm"
          >
            {CODEMIX_TRANSLATION}
          </p>
        </div>
      </div>

      {/* Chapter 3: the quiz card, linked to 12:41, approved by the teacher */}
      <div
        ref={(el) => {
          reg.card = el;
        }}
        className={ANCHOR}
      >
        <div
          ref={(el) => {
            reg.cardInner = el;
          }}
          className="relative w-[min(86vw,27rem)] rounded-[4px] bg-chalk p-5 text-uniform shadow-[0_30px_60px_-24px_rgb(10_20_40/0.55)] ring-1 ring-uniform/10 sm:p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-uniform/70">Question 1 of 5</span>
            <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-pulse px-2 py-0.5 font-mono text-xs font-semibold text-uniform">
              <span>▶</span> {DEMO_QUESTION.timestamp}
            </span>
          </div>
          <p className="font-indic text-[1.05rem] leading-snug font-semibold sm:text-lg">{DEMO_QUESTION.promptTa}</p>
          <p className="mt-1 text-sm text-uniform/70">{DEMO_QUESTION.promptEn}</p>
          <ol className="mt-4 grid grid-cols-2 gap-2">
            {DEMO_QUESTION.options.map((opt, i) => (
              <li
                key={opt}
                className={`flex items-center gap-2 rounded-[3px] px-2.5 py-2 text-sm ring-1 ${
                  i === DEMO_QUESTION.answer ? 'bg-pulse/25 ring-uniform/40' : 'ring-uniform/15'
                }`}
              >
                <span className="font-mono text-xs text-uniform/60">{String.fromCharCode(65 + i)}</span>
                <span className="font-medium">{opt}</span>
                {i === DEMO_QUESTION.answer ? (
                  <span
                    ref={(el) => {
                      reg.tick = el;
                    }}
                    className="ml-auto text-redpen opacity-0"
                  >
                    ✓
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <div
            ref={(el) => {
              reg.stamp = el;
            }}
            className="absolute -right-3 -bottom-4 rounded-[4px] border-2 border-redpen bg-chalk/85 px-3 py-1 font-display text-sm font-bold tracking-wide text-redpen opacity-0 sm:-right-6"
          >
            ✓ Approved
          </div>
        </div>
      </div>

      {/* Chapter 4: live leaderboard above the benches */}
      <div
        ref={(el) => {
          reg.board = el;
        }}
        className={ANCHOR}
      >
        <div
          ref={(el) => {
            reg.boardInner = el;
          }}
          className="w-[min(76vw,17rem)] rounded-[4px] bg-uniform p-4 text-chalk shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)]"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-display text-base font-semibold">Live round</span>
            <span className="font-mono text-xs text-chalk-dim">Q3 of 10</span>
          </div>
          <ol className="space-y-2">
            {LEADERS.map((l, i) => (
              <li key={l.name} className="grid grid-cols-[1.25rem_5.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                <span className="font-mono text-xs text-chalk-dim">{i + 1}</span>
                <span className="truncate">{l.name}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-chalk/10">
                  <span
                    ref={(el) => {
                      reg.bars[i] = el;
                    }}
                    className="block h-full origin-left rounded-full bg-pulse"
                    style={{ transform: 'scaleX(0)' }}
                  />
                </span>
                <span className="text-right font-mono text-xs">{l.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Chapter 5: tomorrow's plan, pinned by the board */}
      <div
        ref={(el) => {
          reg.insight = el;
        }}
        className={ANCHOR}
      >
        <div
          ref={(el) => {
            reg.insightInner = el;
          }}
          className="w-[min(84vw,19.5rem)] rounded-[4px] bg-chalk p-4 text-uniform shadow-[0_28px_56px_-22px_rgb(10_20_40/0.6)] ring-1 ring-uniform/10 sm:p-5"
        >
          <p className="text-xs font-medium text-uniform/70">Class 8B, after the photosynthesis quiz</p>
          {/* Why yellow here: the re-teach plan is ClassPulse acting, the one thing the brand colour marks. */}
          <p className="mt-1.5 font-display text-[1.0625rem] leading-snug font-bold">
            <span className="rounded-[2px] bg-pulse px-1 box-decoration-clone">Re-teach tomorrow: {INSIGHT.reteach}</span>
          </p>
          <ul className="mt-3.5 space-y-1.5">
            {INSIGHT.bloom.map((b, i) => (
              <li key={b.level} className="grid grid-cols-[5.25rem_1fr_2.25rem] items-center gap-2 text-xs">
                <span className="text-uniform/80">{b.level}</span>
                <span className="h-2 overflow-hidden rounded-[1px] bg-uniform/10">
                  <span
                    ref={(el) => {
                      reg.bloom[i] = el;
                    }}
                    className={`block h-full origin-left ${b.score < 0.5 ? 'bg-redpen' : 'bg-uniform'}`}
                    style={{ transform: 'scaleX(0)' }}
                  />
                </span>
                <span className={`text-right font-mono tabular-nums ${b.score < 0.5 ? 'font-semibold text-redpen' : 'text-uniform/80'}`}>
                  {Math.round(b.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-uniform/15 pt-2.5 text-[0.8125rem] leading-snug">
            <span className="font-semibold text-redpen">
              {INSIGHT.confusion.count} of {INSIGHT.classSize}
            </span>{' '}
            picked {INSIGHT.confusion.picked} for {INSIGHT.confusion.question}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Driver (inside the Canvas): projects anchors and animates the layer.
// ---------------------------------------------------------------------------------------------

const LINE_TOP = new THREE.Vector3(-0.4, 3.9, -2.4);
const FROM = new THREE.Vector3(...TEACHER_HEAD);
// Why: the card sits over the board's empty right half, so the lesson notes stay readable beside it.
const CARD = new THREE.Vector3(BOARD.x + 0.75, BOARD.y + 0.02, BOARD.z + 0.9);
// Why low: the play shot looks down from behind the teacher, and the fixed header covers the top 96px.
const LEADERBOARD = new THREE.Vector3(0.2, 1.75, 3.6);
// Up by the teacher's desk and the windows, so the chalked re-teach note on the board stays visible.
const PLAN = new THREE.Vector3(2.7, 2.3, BOARD.z + 1.0);

/**
 * Caption-safe rectangles for pinned overlays, in px. Landscape: the right half (captions are on the
 * left), clear of the fixed header. Portrait: the top ~45%, under the header and chapter strip
 * (captions are a bottom sheet of at most 38svh).
 */
function safeRect(w: number, h: number, captionRight: number) {
  return w >= 768
    ? // Right of the caption card (measured: at narrow desktop widths or with OS display scaling it reaches past
      // 46%), clear of the chapter rail.
      { x0: Math.max(w * 0.46, captionRight + 24), x1: w - (w >= 1024 ? 128 : 104), y0: 96, y1: h * 0.92 }
    : { x0: w * 0.04, x1: w * 0.96, y0: 128, y1: h * 0.6 };
}

/** Smallest a pinned overlay may shrink to fit beside the caption before it just centres in the space. */
const MIN_FIT_SCALE = 0.72;

/** Clamp a centre so a box of size (bw, bh) stays inside [a0, a1] (centred if it can't fit). */
function fit(c: number, size: number, a0: number, a1: number) {
  if (size >= a1 - a0) return (a0 + a1) / 2;
  return Math.min(a1 - size / 2, Math.max(a0 + size / 2, c));
}
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export function OverlayDriver({ reg }: { reg: OverlayRegistry }) {
  const fs = useFrameState();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cache = useRef(new Map<HTMLElement, string>());
  const n = useMemo(() => CHIPS.length, []);

  /** Writes styles only when they change, so idle frames touch no DOM. */
  const write = (el: HTMLElement | null, opacity: number, transform: string) => {
    if (!el) return;
    const o = opacity < 0.005 ? 0 : Math.round(opacity * 1000) / 1000;
    const key = `${o}|${transform}`;
    if (cache.current.get(el) === key) return;
    cache.current.set(el, key);
    el.style.opacity = String(o);
    el.style.transform = transform;
    el.style.visibility = o === 0 ? 'hidden' : 'visible';
  };

  const sizes = useRef(new Map<HTMLElement, { w: number; h: number; at: number }>());
  const frame = useRef(0);
  /** Layout size of an overlay, re-measured at most every 30 frames (transforms don't change it). */
  const measure = (el: HTMLElement) => {
    const hit = sizes.current.get(el);
    if (hit && frame.current - hit.at < 30) return hit;
    // scrollWidth/Height too: some overlays (the codemix chips) spill past their anchor box.
    const next = { w: Math.max(el.offsetWidth, el.scrollWidth), h: Math.max(el.offsetHeight, el.scrollHeight), at: frame.current };
    sizes.current.set(el, next);
    return next;
  };

  const captionRight = useRef({ px: 0, at: -Infinity });
  /** Right edge of the chapter caption cards (all share one column), re-measured at most every 30 frames. */
  const measureCaption = () => {
    const c = captionRight.current;
    if (frame.current - c.at < 30) return c.px;
    const card = document.querySelector<HTMLElement>('#story [data-caption-card]');
    c.px = card ? card.getBoundingClientRect().right : 0;
    c.at = frame.current;
    return c.px;
  };

  /**
   * Positions an anchor at a world point, kept inside the caption-safe rectangle. When the space beside the
   * caption is narrower than the overlay (narrow laptops, 125% display scaling), the overlay shrinks to fit
   * instead of sliding under the caption.
   */
  const pin = (el: HTMLElement | null, world: THREE.Vector3, opacity: number) => {
    if (!el) return;
    _v.copy(world).project(camera);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * size.width;
    let y = (-_v.y * 0.5 + 0.5) * size.height;
    let s = 1;
    if (opacity > 0.005) {
      const r = safeRect(size.width, size.height, size.width >= 768 ? measureCaption() : 0);
      const box = measure(el);
      const room = r.x1 - r.x0;
      if (box.w > room) s = Math.max(MIN_FIT_SCALE, room / box.w);
      x = fit(x, box.w * s, r.x0, r.x1);
      y = fit(y, box.h * s, r.y0, r.y1);
    }
    const scale = s < 0.999 ? ` scale(${s.toFixed(3)})` : '';
    write(el, behind ? 0 : opacity, `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)${scale}`);
  };

  useFrame(() => {
    frame.current += 1;
    const p = fs.p;
    // The rig moved the camera this frame; refresh its matrices before projecting.
    camera.updateMatrixWorld();

    // Chapter 2 — words rise from the teacher, then collapse into the card (2 → 3).
    const rise = ramp(p, 1.35, 2.0);
    const collapse = ramp(p, 2.35, 2.85);
    _w.copy(FROM).lerp(LINE_TOP, smooth(rise)).lerp(CARD, collapse);
    const words = Math.min(ramp(p, 1.4, 1.75), 1 - ramp(p, 2.55, 2.8));
    // Why: the chip row wraps to the room beside the caption rather than shrinking (it's text to read).
    if (reg.codemixInner && words > 0.005) {
      const r = safeRect(size.width, size.height, size.width >= 768 ? measureCaption() : 0);
      const width = `${Math.round(Math.min(640, size.width * 0.88, r.x1 - r.x0))}px`;
      if (reg.codemixInner.style.width !== width) {
        reg.codemixInner.style.width = width;
        if (reg.codemix) sizes.current.delete(reg.codemix);
      }
    }
    pin(reg.codemix, _w, words);
    write(reg.codemixInner, 1, `scale(${(lerp(0.92, 1, rise) * lerp(1, 0.55, collapse)).toFixed(3)})`);
    reg.chips.forEach((el, i) => {
      // Why: a word-by-word stagger, as if the sentence were being spoken.
      const local = smooth(clamp01((rise * (n + 2) - i) / 2.2));
      const gather = collapse * (i - (n - 1) / 2) * -28;
      write(el, local, `translate3d(${gather.toFixed(1)}px, ${((1 - local) * 26).toFixed(1)}px, 0)`);
    });
    write(reg.caption, ramp(p, 1.8, 2.05) * (1 - collapse), 'none');

    // Chapter 3 — the card settles, then the teacher's stamp lands a beat later.
    const card = Math.min(ramp(p, 2.55, 2.9), 1 - ramp(p, 3.15, 3.4));
    pin(reg.card, CARD, card);
    write(reg.cardInner, 1, `translateY(${((1 - card) * 18).toFixed(1)}px) scale(${lerp(0.94, 1, card).toFixed(3)})`);
    const stamp = ramp(p, 2.82, 3.02);
    write(reg.stamp, stamp, `rotate(-9deg) scale(${lerp(1.9, 1, stamp).toFixed(3)})`);
    write(reg.tick, stamp, 'none');

    // Chapter 4 — the leaderboard rises above the benches.
    const board = Math.min(ramp(p, 3.6, 3.95), 1 - ramp(p, 4.15, 4.4));
    pin(reg.board, LEADERBOARD, board);
    write(reg.boardInner, 1, `translateY(${((1 - board) * 30).toFixed(1)}px)`);
    const grow = ramp(p, 3.7, 4.0);
    reg.bars.forEach((el, i) => {
      write(el, 1, `scaleX(${(grow * ((LEADERS[i]?.score ?? 0) / 1000)).toFixed(3)})`);
    });

    // Chapter 5 — tomorrow's plan lands by the board as the teacher writes it up.
    const plan = Math.min(ramp(p, 4.55, 4.92), 1 - ramp(p, 5.2, 5.45));
    pin(reg.insight, PLAN, plan);
    write(reg.insightInner, 1, `translateY(${((1 - plan) * 22).toFixed(1)}px)`);
    const fill = ramp(p, 4.65, 4.98);
    reg.bloom.forEach((el, i) => {
      write(el, 1, `scaleX(${(fill * (INSIGHT.bloom[i]?.score ?? 0)).toFixed(3)})`);
    });
  });
  return null;
}
