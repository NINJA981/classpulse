'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import clsx from 'clsx';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  CHAPTERS,
  FINALE_STATE,
  getChapterIndex,
  getPaused,
  setLive,
  setStoryProgress,
  story,
  subscribeChapter,
  subscribeUi,
} from './chapters';
import { StoryFallback } from './story-fallback';
import { detectCapability, markLiveFailed, type Capability } from './gpu';
import { POSTERS } from '../assets';

const ClassroomScene = dynamic(() => import('../scene/classroom-scene'), { ssr: false });

// ---------------------------------------------------------------------------
// Client-only facts, read through useSyncExternalStore so SSR renders the static stage.
// ---------------------------------------------------------------------------

const noopSubscribe = () => () => {};
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const readReduced = () => window.matchMedia(REDUCED_QUERY).matches;

/** ?capture=<0…6> — poster capture mode. */
function readCapture(): number | null {
  const raw = new URLSearchParams(window.location.search).get('capture');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= FINALE_STATE ? n : null;
}

/** ?capture=0&clip=<seconds> — the hero video capture: a seamless loop rendered frame by frame. */
function readClip(): number {
  const n = Number(new URLSearchParams(window.location.search).get('clip'));
  return Number.isFinite(n) && n >= 2 && n <= 20 ? n : 0;
}

/** Hero loop video (scripts/capture-landing-assets.ts video): same-origin, H.264 + VP9, wide and tall. */
const HERO_VIDEO = {
  wide: { webm: '/landing/video/hero-wide.webm', mp4: '/landing/video/hero-wide.mp4' },
  tall: { webm: '/landing/video/hero-tall.webm', mp4: '/landing/video/hero-tall.mp4' },
} as const;

function readSaveData() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData) || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g';
}

const ENGAGE_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const;

/** True once the visitor has interacted with the page (or it opened already scrolled). */
function useEngaged() {
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (window.scrollY > 0) {
      setEngaged(true);
      return;
    }
    const engage = () => setEngaged(true);
    ENGAGE_EVENTS.forEach((e) => window.addEventListener(e, engage, { once: true, passive: true }));
    return () => ENGAGE_EVENTS.forEach((e) => window.removeEventListener(e, engage));
  }, []);
  return engaged;
}

/** Hold still around each chapter so its caption reads against a settled frame. */
function dwell(t: number) {
  const x = Math.min(1, Math.max(0, (t - 0.18) / 0.64));
  return x * x * (3 - 2 * x);
}

/** How long the live room may take to warm up before the stage gives up on it. */
const READY_TIMEOUT_MS = 12_000;

export function StoryStage() {
  const capture = useSyncExternalStore(noopSubscribe, readCapture, () => null);
  const clip = useSyncExternalStore(noopSubscribe, readClip, () => 0);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);
  const active = useSyncExternalStore(subscribeChapter, getChapterIndex, () => 0);
  const [ready, setReady] = useState(false);
  const engaged = useEngaged();
  // Why only once engaged: creating a probe WebGL context costs time (seconds on software GL).
  const [cap, setCap] = useState<Capability | null>(null);
  useEffect(() => {
    if (!engaged || reduced || capture !== null) return;
    const c = detectCapability();
    if (!c.tier) console.warn(`[landing] live room off (${c.reason}); showing the posters.`, c.renderer);
    setCap(c);
  }, [engaged, reduced, capture]);
  // Once the live room fails it stays off for this page view (and, via sessionStorage, the session).
  const [failed, setFailed] = useState(false);
  const fail = useCallback((reason: string) => {
    console.warn(`[landing] live room failed (${reason}); showing the posters.`);
    markLiveFailed(reason);
    setFailed(true);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);

  // Why: the scene costs seconds of main-thread work to build. The hero poster is a frame of the same room,
  // so show it first and start the live scene on the visitor's first interaction — and only on devices
  // that can run it (gpu.ts). On failure the canvas unmounts (freeing its GPU memory) and the posters,
  // which never left, show through.
  const tier = cap?.tier ?? null;
  const show3D = capture === null && tier !== null && !reduced && engaged && !failed;

  // Not ready in time: a GPU that slow would only stutter.
  useEffect(() => {
    if (!show3D || ready) return;
    const t = window.setTimeout(() => fail('not ready in time'), READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [show3D, ready, fail]);

  useEffect(() => {
    story.reducedMotion = reduced;
  }, [reduced]);

  // The live room is on screen: its own overlays (codemix words, quiz card) replace the caption's
  // poster-only quote and question, and the rail offers "Pause animation".
  const live = show3D && ready;
  useEffect(() => {
    setLive(live);
    const section = stageRef.current?.parentElement;
    if (section) section.dataset.live = live ? '1' : '0';
    return () => setLive(false);
  }, [live]);

  // For tests and support: what the stage is showing and why.
  useEffect(() => {
    const section = stageRef.current?.parentElement;
    if (!section || capture !== null) return;
    section.dataset.stage = failed ? 'posters-failed' : live ? 'live' : show3D ? 'loading' : 'posters';
    if (tier) section.dataset.tier = tier;
  }, [failed, live, show3D, tier, capture]);

  // Lets CSS show only the active chapter's caption (see story.tsx).
  useEffect(() => {
    const section = stageRef.current?.parentElement;
    if (section && capture === null) section.dataset.active = String(active);
  }, [active, capture]);

  // Capture mode: flag the document so CSS hides everything but the stage.
  useEffect(() => {
    if (capture === null) return;
    const root = document.documentElement;
    root.dataset.capture = '1';
    setStoryProgress(capture);
    return () => {
      delete root.dataset.capture;
      delete root.dataset.sceneReady;
    };
  }, [capture]);

  // Pointer → gentle camera parallax in the scene (mouse only; touch is for scrolling).
  useEffect(() => {
    if (reduced || capture !== null) {
      story.pointer.x = 0;
      story.pointer.y = 0;
      return;
    }
    let raf = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          story.pointer.x = x;
          story.pointer.y = y;
        });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced, capture]);

  // Scroll → story.progress. Each chapter rests (integer progress) while its caption is centred.
  useEffect(() => {
    if (capture !== null) return;
    const section = stageRef.current?.parentElement;
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const articles = Array.from(section.querySelectorAll<HTMLElement>('[data-chapter]'));
    let anchors: number[] = [];

    const measure = () => {
      const top = section.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight;
      const max = Math.max(0, section.offsetHeight - vh);
      anchors = articles.map((a, i) => {
        if (i === 0) return 0;
        const r = a.getBoundingClientRect();
        const centre = r.top + window.scrollY - top + r.height / 2 - vh / 2;
        return Math.min(max, Math.max(0, centre));
      });
    };
    const apply = (d: number) => {
      let p = 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i] ?? 0;
        const b = anchors[i + 1] ?? a;
        if (d >= b) {
          p = i + 1;
          continue;
        }
        if (d > a) p = i + dwell((d - a) / (b - a || 1));
        break;
      }
      setStoryProgress(p);
    };

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onRefresh: (self) => {
        measure();
        apply(self.scroll() - self.start);
      },
      onUpdate: (self) => apply(self.scroll() - self.start),
    });
    measure();
    apply(st.scroll() - st.start);
    return () => st.kill();
  }, [capture]);

  const onReady = useCallback(() => setReady(true), []);
  const onCaptureReady = useCallback(() => {
    document.documentElement.dataset.sceneReady = '1';
  }, []);

  if (capture !== null) {
    return (
      <div data-capture-stage className="fixed inset-0 z-[200] bg-board">
        <ClassroomScene fixedProgress={capture} clipSeconds={capture === 0 && clip ? clip : undefined} onReady={onCaptureReady} />
      </div>
    );
  }

  return (
    <div ref={stageRef} className="sticky top-0 h-svh overflow-hidden">
      {/* 1. Poster frames from the real scene, cross-faded per chapter until the live room is ready (and
          for good without WebGL / with reduced motion); until they exist, a chalkboard per chapter. */}
      {POSTERS.available ? <Posters active={active} /> : <StoryFallback active={active} />}

      {/* 1b. Before the visitor interacts: a short seamless loop of the hero, rendered from the same scene,
          over the hero poster (which stays the LCP image). Never with reduced motion or Save-Data; the
          Pause control pauses it; it fades out under the live room once that is ready. */}
      {POSTERS.available && !reduced ? <HeroLoop active={active === 0} live={live} /> : null}

      {/* 2. The live room. */}
      {show3D && tier ? (
        <div
          className={clsx(
            'absolute inset-0 transition-opacity duration-700 ease-snap',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        >
          <SceneBoundary onError={fail}>
            <ClassroomScene tier={tier} onReady={onReady} onFail={fail} />
          </SceneBoundary>
        </div>
      ) : null}

      {/* 3. Scrims keep text AA over any frame. Hero (desktop): a soft pool of board colour behind the
          headline block only, so the right half of the room (teacher, sound rings) stays clear.
          Phones: the captions are a bottom sheet, so the scrim rises from the bottom. */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-0 transition-opacity duration-500 ease-snap',
          'bg-[linear-gradient(to_top,var(--cp-board)_10%,color-mix(in_oklab,var(--cp-board)_84%,transparent)_42%,transparent_70%)]',
          'md:bg-[radial-gradient(ellipse_54%_82%_at_14%_70%,color-mix(in_oklab,var(--cp-board)_94%,transparent)_0%,color-mix(in_oklab,var(--cp-board)_90%,transparent)_50%,color-mix(in_oklab,var(--cp-board)_50%,transparent)_76%,transparent_100%),linear-gradient(to_right,color-mix(in_oklab,var(--cp-board)_50%,transparent)_0%,transparent_50%)]',
          active === 0 ? 'opacity-100' : 'opacity-0 md:opacity-25',
        )}
      />
      {/* Behind the fixed header: its chalk links need 4.5:1 over the pale walls. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--cp-board)_90%,transparent)_0%,color-mix(in_oklab,var(--cp-board)_72%,transparent)_45%,transparent)]"
      />
    </div>
  );
}

/**
 * The hero loop. Starts after the page's load event and an idle callback, so it never competes with the
 * poster or the page's own scripts; preload="none" means nothing downloads until then. Shown only once it
 * is actually playing (no black flash), only on the hero chapter, and retired once the live room is in.
 */
function HeroLoop({ active, live }: { active: boolean; live: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const paused = useSyncExternalStore(subscribeUi, getPaused, () => false);
  const [shape, setShape] = useState<'wide' | 'tall' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [retired, setRetired] = useState(false);

  // Arm after load + idle, and only when the visitor hasn't asked to save data.
  useEffect(() => {
    if (readSaveData()) return;
    let idleId = 0;
    let timer = 0;
    const arm = () => {
      const pick = () => setShape(window.matchMedia('(orientation: portrait)').matches ? 'tall' : 'wide');
      if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(pick, { timeout: 2500 });
      else timer = window.setTimeout(pick, 500);
    };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return () => {
      window.removeEventListener('load', arm);
      if (idleId) window.cancelIdleCallback(idleId);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Play only on the hero, unpaused, and until the live room has faded in over it.
  const run = shape !== null && active && !paused && !live;
  useEffect(() => {
    const v = ref.current;
    if (!v || shape === null) return;
    if (run) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [run, shape]);

  // Once the live room is in, wait for the cross-fade and drop the element (frees the decoder). If the
  // live room later fails, the loop comes back over the hero poster.
  useEffect(() => {
    const t = window.setTimeout(() => setRetired(live), live ? 900 : 0);
    return () => window.clearTimeout(t);
  }, [live]);

  if (shape === null || retired) return null;
  const src = HERO_VIDEO[shape];
  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      muted
      playsInline
      loop
      preload="none"
      poster={POSTERS.chapter(0, shape)}
      disablePictureInPicture
      disableRemotePlayback
      onPlaying={() => setPlaying(true)}
      className={clsx(
        'pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-700 ease-snap',
        playing && active && !live ? 'opacity-100' : 'opacity-0',
      )}
    >
      <source src={src.webm} type="video/webm; codecs=vp9" />
      <source src={src.mp4} type="video/mp4" />
    </video>
  );
}

/** Any render error in the live room (incl. the post-processing setup) hands the stage to the posters. */
class SceneBoundary extends Component<{ onError: (reason: string) => void; children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(`render error: ${error instanceof Error ? error.message : String(error)}`);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

function Posters({ active }: { active: number }) {
  // Why every frame stays mounted: the active one shows until the live room fades in over it.
  return (
    <div aria-hidden className="absolute inset-0">
      {CHAPTERS.map((_, i) => (
        <picture
          key={i}
          className={clsx(
            'absolute inset-0 transition-opacity duration-500 ease-snap',
            active === i ? 'opacity-100' : 'opacity-0',
          )}
        >
          <source media="(orientation: portrait)" srcSet={POSTERS.chapter(i, 'tall')} />
          <img
            src={POSTERS.chapter(i, 'wide')}
            alt=""
            className="size-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
          />
        </picture>
      ))}
    </div>
  );
}
