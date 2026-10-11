'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui';

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

export interface TourStep {
  /** Stable id, used as the React key. */
  id: string;
  /**
   * `data-tour` anchor name(s). The first matching element that is actually visible gets the spotlight, so
   * list fallbacks in order (e.g. a sidebar link, then the phone menu button). With no target, or none
   * visible, the card is centred with no spotlight.
   */
  target?: string | readonly string[];
  title: string;
  /** 1–3 short sentences. A string is wrapped in a paragraph. This is the dialog's accessible description. */
  body: ReactNode;
  /** Optional controls under the body (outside the description), e.g. an "Install app" button. */
  action?: ReactNode;
}

export interface TourController {
  steps: readonly TourStep[];
  active: boolean;
  index: number;
  start: () => void;
  next: () => void;
  back: () => void;
  /** Close the tour and remember it as seen (Skip, Esc and Finish all end here). */
  close: () => void;
}

/* ========================================================================== */
/* Persistence                                                                */
/* ========================================================================== */

/** Keeps the tour from coming back in this tab even when storage is blocked. */
const seenThisSession = new Set<string>();

function hasSeen(key: string): boolean {
  if (seenThisSession.has(key)) return true;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  seenThisSession.add(key);
  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Storage blocked (private mode, policy): the in-memory flag still applies for this tab.
  }
}

/* ========================================================================== */
/* Hook                                                                       */
/* ========================================================================== */

/**
 * Tour state. `storageKey` identifies the tour and the user (e.g. `cp-tour-student-v1:<userId>`); the tour
 * counts as seen once it is finished or skipped. With `autoStart`, it opens by itself if not seen yet.
 */
export function useTour(
  storageKey: string | null,
  steps: readonly TourStep[],
  options: { autoStart?: boolean } = {},
): TourController {
  const { autoStart = false } = options;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const autoStartedFor = useRef<string | null>(null);
  const count = steps.length;

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);
  const close = useCallback(() => {
    setActive(false);
    if (storageKey) markSeen(storageKey);
  }, [storageKey]);
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(count - 1, 0))), [count]);
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!autoStart || !storageKey || count === 0) return;
    if (autoStartedFor.current === storageKey || hasSeen(storageKey)) return;
    autoStartedFor.current = storageKey;
    start();
  }, [autoStart, storageKey, count, start]);

  // Steps can shrink while open (feature switches refreshed); keep the index in range.
  const safeIndex = Math.min(index, Math.max(count - 1, 0));
  return { steps, active: active && count > 0, index: safeIndex, start, next, back, close };
}

/* ========================================================================== */
/* Provider: lets any page restart the tour ("Take the tour again")           */
/* ========================================================================== */

const TourContext = createContext<{ start: () => void } | null>(null);

export function TourProvider({
  storageKey,
  steps,
  autoStart,
  children,
}: {
  storageKey: string | null;
  steps: readonly TourStep[];
  autoStart?: boolean;
  children: ReactNode;
}) {
  const tour = useTour(storageKey, steps, { autoStart });
  const value = useMemo(() => ({ start: tour.start }), [tour.start]);
  return (
    <TourContext.Provider value={value}>
      {children}
      <Tour tour={tour} />
    </TourContext.Provider>
  );
}

/** `{ start }` for the surrounding TourProvider, or null outside one. */
export function useTourControls(): { start: () => void } | null {
  return useContext(TourContext);
}

/* ========================================================================== */
/* Overlay                                                                    */
/* ========================================================================== */

export function Tour({ tour }: { tour: TourController }) {
  if (!tour.active) return null;
  return <TourOverlay tour={tour} />;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}
interface Layout {
  spot: Box | null;
  card: { top: number; left: number };
}

const SPOT_PAD = 6;
const GAP = 12;
const MARGIN = 16;
/** Matches the card's `w-[min(24rem,calc(100%-2rem))]`. */
const CARD_MAX_W = 384;

function anchorNames(target: TourStep['target']): readonly string[] {
  if (!target) return [];
  return typeof target === 'string' ? [target] : target;
}

function isShown(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** First visible element for the step's anchors (display:none ancestors give an empty rect). */
function findAnchor(target: TourStep['target']): HTMLElement | null {
  for (const name of anchorNames(target)) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      if (isShown(el)) return el;
    }
  }
  return null;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

function computeLayout(anchor: HTMLElement | null, cardH: number): Layout {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(CARD_MAX_W, vw - MARGIN * 2);
  if (!anchor) return { spot: null, card: { top: Math.max(MARGIN, (vh - cardH) / 2), left: (vw - cardW) / 2 } };

  const r = anchor.getBoundingClientRect();
  const spot = { top: r.top - SPOT_PAD, left: r.left - SPOT_PAD, width: r.width + SPOT_PAD * 2, height: r.height + SPOT_PAD * 2 };
  const spotBottom = spot.top + spot.height;
  const spotRight = spot.left + spot.width;
  let top: number;
  let left: number;
  if (vw - spotRight - GAP - MARGIN >= cardW) {
    // Room on the right (desktop sidebar links): sit beside the anchor.
    left = spotRight + GAP;
    top = clamp(spot.top, MARGIN, vh - cardH - MARGIN);
  } else {
    left = clamp(spot.left + spot.width / 2 - cardW / 2, MARGIN, vw - cardW - MARGIN);
    if (vh - spotBottom - GAP - MARGIN >= cardH) top = spotBottom + GAP;
    else if (spot.top - GAP - MARGIN >= cardH) top = spot.top - GAP - cardH;
    else top = vh - cardH - MARGIN; // Neither fits (tall anchor on a phone): dock to the bottom.
  }
  return { spot, card: { top: Math.max(MARGIN, top), left } };
}

function sameLayout(a: Layout | null, b: Layout): boolean {
  if (!a) return false;
  const near = (x: number, y: number) => Math.abs(x - y) < 0.5;
  const spotSame =
    a.spot === null || b.spot === null
      ? a.spot === b.spot
      : near(a.spot.top, b.spot.top) &&
        near(a.spot.left, b.spot.left) &&
        near(a.spot.width, b.spot.width) &&
        near(a.spot.height, b.spot.height);
  return spotSame && near(a.card.top, b.card.top) && near(a.card.left, b.card.left);
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function TourOverlay({ tour }: { tour: TourController }) {
  const { steps, index, next, back, close } = tour;
  const step = steps[index]!;
  const count = steps.length;
  const last = index === count - 1;
  const id = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Return focus to where it was (e.g. "Take the tour again"), or to the page's main region.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const target = previous && previous.isConnected && previous !== document.body ? previous : document.getElementById('main');
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Move focus into the card on open and on every step, so screen readers announce the new step.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Esc skips, ← / → move between steps, Tab stays inside the card.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!last) next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0]!;
        const end = items[items.length - 1]!;
        const current = document.activeElement;
        const inside = current instanceof Node && card.contains(current);
        if (e.shiftKey && (!inside || current === first || current === card)) {
          e.preventDefault();
          end.focus();
        } else if (!e.shiftKey && (!inside || current === end)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    function onFocusIn(e: FocusEvent) {
      const card = cardRef.current;
      if (card && e.target instanceof Node && !card.contains(e.target)) card.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [close, next, back, last]);

  // Find the anchor, scroll it into view once, and keep the spotlight and card glued to it.
  useLayoutEffect(() => {
    let frame = 0;
    let scrolledTo: HTMLElement | null = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function measure() {
      frame = 0;
      const anchor = findAnchor(step.target);
      if (anchor && anchor !== scrolledTo) {
        scrolledTo = anchor;
        const r = anchor.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }
      const measured = computeLayout(anchor, cardRef.current?.offsetHeight ?? 0);
      setLayout((prev) => (sameLayout(prev, measured) ? prev : measured));
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    // Anchors can appear or move after data loads; a light poll catches that.
    const timer = window.setInterval(schedule, 400);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.clearInterval(timer);
    };
  }, [step]);

  const spot = layout?.spot ?? null;

  return (
    <div className="relative z-50">
      {/* Blocks the page while the tour is open; dims it when nothing is highlighted. */}
      <div aria-hidden className={clsx('fixed inset-0', !spot && 'bg-black/50')} />
      {spot && (
        <div
          aria-hidden
          data-testid="tour-spotlight"
          className="pointer-events-none fixed rounded-control shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] ring-2 ring-accent transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        tabIndex={-1}
        className={clsx(
          'fixed flex max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100%-2rem))] flex-col overflow-y-auto',
          'rounded-card border-2 border-line-strong bg-surface p-5 text-ink shadow-pop outline-none',
          !layout && 'opacity-0',
        )}
        style={layout ? { top: layout.card.top, left: layout.card.left } : undefined}
      >
        <p className="eyebrow">
          Step {index + 1} of {count}
        </p>
        <div aria-hidden className="mt-2 flex gap-1">
          {steps.map((s, i) => (
            <span key={s.id} className={clsx('h-1.5 flex-1 rounded-full', i <= index ? 'bg-ink' : 'bg-line')} />
          ))}
        </div>
        <h2 id={`${id}-title`} className="mt-3 font-display text-xl font-black leading-tight">
          {step.title}
        </h2>
        <div id={`${id}-body`} className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
          {typeof step.body === 'string' ? <p>{step.body}</p> : step.body}
        </div>
        {step.action && <div className="mt-4">{step.action}</div>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!last && (
            <Button variant="ghost" onClick={close} className="-ml-2">
              Skip tour
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <Button variant="secondary" onClick={back}>
                Back
              </Button>
            )}
            {last ? <Button onClick={close}>Finish</Button> : <Button onClick={next}>Next</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
