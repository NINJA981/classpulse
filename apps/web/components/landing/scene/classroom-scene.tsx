'use client';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { SoundRings, DustMotes, SunShafts } from './atmosphere';
import { CameraRig } from './camera-rig';
import { Students, Teacher } from './characters';
import { Device, UploadChunks } from './device';
import { Effects } from './effects';
import { CLIP_FPS, Director, FrameProvider, createFrameState, useFrameState, type QualityTier } from './frame-state';
import { Benches, TeacherDesk } from './furniture';
import { buildStudents } from './layout';
import { Lighting } from './lighting';
import { OverlayDriver, OverlayLayer, createOverlayRegistry } from './overlays';
import { Room } from './room';
import { setLoopSeconds } from './timeline';
import { getPaused, subscribeProgress, subscribeUi } from '../story/chapters';

export interface ClassroomSceneProps {
  /** Called once shaders are compiled, the fonts are in and a couple of frames have rendered. */
  onReady?: () => void;
  /**
   * Called (once) when the live room can't be trusted: the WebGL context was lost, a shader failed to
   * link, or it runs too slowly. The stage then unmounts the canvas and keeps the posters.
   */
  onFail?: (reason: string) => void;
  /** Quality tier from the stage's capability check (story/gpu.ts). Capture mode defaults to 'high'. */
  tier?: QualityTier;
  /** Capture mode: render at this fixed progress (0–6) with no idle drift, for poster screenshots. */
  fixedProgress?: number;
  /**
   * Clip capture (with fixedProgress): render a seamless loop of this many seconds, one frame per call to
   * `window.__classpulseClip.step(frame)` (see scripts/capture-landing-assets.ts, `video` mode).
   */
  clipSeconds?: number;
}

/** What clip capture exposes on window for the capture script. */
export interface ClipApi {
  fps: number;
  frames: number;
  /** Renders frame `frame` of the loop; resolves once it is on screen. */
  step: (frame: number) => Promise<void>;
}

/**
 * Device pixel ratio range per tier. Why the caps: every post-processing buffer scales with DPR², and on
 * integrated GPUs that memory comes out of system RAM. Capture mode keeps the posters' 1.75.
 */
const DPR_RANGE: Record<QualityTier, [number, number]> = { high: [1, 1.5], low: [1, 1.25] };
const CAPTURE_DPR: [number, number] = [1, 1.75];

/**
 * Fires onReady once the shaders are compiled, the web fonts (incl. the chalkboard's Anek Tamil) are in,
 * and a couple of full frames have rendered, so the stage's cross-fade reveals a finished frame.
 */
function ReadySignal({ onReady, capture, warmed }: { onReady?: () => void; capture: boolean; warmed: boolean }) {
  const gl = useThree((s) => s.gl);
  const state = useRef({ fontsDone: false, fired: false, after: 0 });
  useEffect(() => {
    const s = state.current;
    const scope = gl.domElement.parentElement ?? document.documentElement;
    const tamil = getComputedStyle(scope).getPropertyValue('--font-anek-tamil').trim();
    const loads = tamil ? [document.fonts.load(`16px ${tamil}`, 'தமிழ்')] : [];
    void Promise.allSettled(loads)
      .then(() => document.fonts.ready)
      .then(() => {
        s.fontsDone = true;
      });
  }, [gl]);
  useFrame(() => {
    const s = state.current;
    if (!warmed || !s.fontsDone || s.fired) return;
    s.after += 1;
    // Why: in capture mode give the chalkboard/Html a few more frames to settle before the shot.
    if (s.after >= (capture ? 12 : 3)) {
      s.fired = true;
      onReady?.();
    }
  });
  return null;
}

/**
 * Warm-up, while the poster is still showing: one frame so every part has mounted, then compile every
 * shader (KHR_parallel_shader_compile, off the main thread where supported). Nothing is pre-rendered into
 * extra render targets — on integrated GPUs that memory is what ran out. The composer stays disabled
 * meanwhile (see <Effects enabled>).
 */
function WarmUp({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const rendered = useRef<(() => void) | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useFrame(() => {
    const resolve = rendered.current;
    rendered.current = null;
    resolve?.();
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise<void>((resolve) => {
        rendered.current = resolve;
        invalidate();
      });
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // Not fatal: the first frames compile whatever is left.
      }
      if (!cancelled) done.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, invalidate]);
  return null;
}

/**
 * Health checks on the live renderer. Any of these hands the stage back to the posters for good:
 * - the WebGL context is lost (the GPU ran out of memory, a driver reset, too many contexts);
 * - a shader fails to compile or link (three calls renderer.debug.onShaderError; see onCreated);
 * - after ready, the room renders below MIN_FPS for two measuring windows in a row, even after the
 *   PerformanceMonitor has stepped quality down.
 */
const MIN_FPS = 20;
const FPS_WINDOW_S = 3;

function HealthGuard({ fail, measure }: { fail: (reason: string) => void; measure: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      fail('webgl context lost');
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [gl, fail]);

  const fps = useRef({ time: 0, frames: 0, strikes: 0, skip: 10 });
  useEffect(() => {
    // Restart the measurement whenever it resumes (after a pause, or the stage scrolling back on screen).
    fps.current = { time: 0, frames: 0, strikes: 0, skip: 10 };
  }, [measure]);
  useFrame((_, delta) => {
    if (!measure) return;
    const f = fps.current;
    // Skip the first frames after (re)starting, and gaps where the tab or the stage was hidden.
    if (f.skip > 0) {
      f.skip -= 1;
      return;
    }
    if (delta > 1 || document.hidden) return;
    f.time += delta;
    f.frames += 1;
    if (f.time < FPS_WINDOW_S) return;
    const rate = f.frames / f.time;
    f.strikes = rate < MIN_FPS ? f.strikes + 1 : 0;
    f.time = 0;
    f.frames = 0;
    if (f.strikes >= 2) fail(`too slow (${rate.toFixed(1)} fps)`);
  });
  return null;
}

/** Clip capture: renders exactly the frame the capture script asks for, then lets it screenshot. */
function ClipDriver({ seconds }: { seconds: number }) {
  const fs = useFrameState();
  const invalidate = useThree((s) => s.invalidate);
  const pending = useRef<(() => void) | null>(null);
  useFrame(() => {
    const resolve = pending.current;
    pending.current = null;
    // The frame has been drawn; one more animation frame and it is composited.
    if (resolve) requestAnimationFrame(() => resolve());
  }, 2);
  useEffect(() => {
    const api: ClipApi = {
      fps: CLIP_FPS,
      frames: Math.round(seconds * CLIP_FPS),
      step: (frame) =>
        new Promise<void>((resolve) => {
          fs.clipFrame = frame;
          pending.current = resolve;
          invalidate();
        }),
    };
    const w = window as Window & { __classpulseClip?: ClipApi };
    w.__classpulseClip = api;
    return () => {
      delete w.__classpulseClip;
    };
  }, [fs, invalidate, seconds]);
  return null;
}

/**
 * While paused the canvas renders on demand: one frame per scroll step (the camera still follows the
 * story, which the visitor drives), nothing in between. Why: WCAG 2.2.2 — the pause has to stop the
 * motion, and a stopped loop also stops burning battery.
 */
function DemandFrames({ paused }: { paused: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!paused) return;
    // A couple of frames so the snapped camera and the overlays settle on the current position.
    invalidate(2);
    return subscribeProgress(() => invalidate(2));
  }, [paused, invalidate]);
  return null;
}

export default function ClassroomScene({ onReady, onFail, tier: tierProp, fixedProgress, clipSeconds }: ClassroomSceneProps) {
  const [tier] = useState<QualityTier>(tierProp ?? 'high');
  const capture = fixedProgress !== undefined;
  const clip = capture && clipSeconds ? clipSeconds : 0;
  const [min, max] = capture ? CAPTURE_DPR : DPR_RANGE[tier];
  const [dpr, setDpr] = useState(() => Math.min(max, Math.max(min, typeof window === 'undefined' ? 1 : window.devicePixelRatio)));
  const [visible, setVisible] = useState(true);
  // Capture mode: once the frame is ready, stop rendering so the screenshot isn't competing with the GPU.
  const [frozen, setFrozen] = useState(false);
  // Effects level can only step down at runtime (AO + MSAA off first, then DPR).
  const [fx, setFx] = useState<QualityTier>(tier);
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useMemo(() => createFrameState(tier, fixedProgress, clip), [tier, fixedProgress, clip]);
  const [warming, setWarming] = useState(true);
  const [ready, setReady] = useState(false);
  const students = useMemo(() => buildStudents(24), []);
  const overlays = useMemo(createOverlayRegistry, []);
  const paused = useSyncExternalStore(subscribeUi, getPaused, () => false);

  // Report a failure once; after that the stage unmounts us.
  const failed = useRef(false);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);
  const fail = useCallback((reason: string) => {
    if (failed.current) return;
    failed.current = true;
    failRef.current?.(reason);
  }, []);

  // Clip capture: every idle oscillation snaps to whole cycles per loop (timeline.ts).
  useEffect(() => {
    setLoopSeconds(clip);
    return () => setLoopSeconds(0);
  }, [clip]);

  // Pause rendering entirely while the stage is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el || capture) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [capture]);

  return (
    // Why: `isolation: isolate` keeps the overlay layer's stacking inside this stage, under page captions.
    <div ref={wrap} className="absolute inset-0 isolate overflow-hidden" aria-hidden>
      <Canvas
        dpr={dpr}
        frameloop={!visible ? 'never' : frozen ? (clip ? 'demand' : 'never') : paused && !capture ? 'demand' : 'always'}
        shadows="percentage"
        camera={{ fov: 30, near: 0.1, far: 80, position: [-11.2, 7.2, 6.4] }}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          // Why not 'high-performance' on the low tier: on dual-GPU laptops it can wake the discrete GPU, and
          // on single-iGPU machines it changes nothing.
          powerPreference: tier === 'high' || capture ? 'high-performance' : 'default',
          preserveDrawingBuffer: capture,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          // A shader that fails to link (e.g. the GPU is out of memory) would leave a blank stage: give up.
          gl.debug.onShaderError = (ctx, program, vs, fs) => {
            const log = (ctx.getProgramInfoLog(program) || ctx.getShaderInfoLog(fs) || ctx.getShaderInfoLog(vs) || '').trim();
            console.warn('[landing] live room: shader failed to link, showing posters.', log.slice(0, 400));
            fail('shader link error');
          };
        }}
      >
        <FrameProvider value={frame}>
          <Director fixedProgress={fixedProgress} />
          {!capture && <DemandFrames paused={paused} />}
          {!capture && <HealthGuard fail={fail} measure={ready && visible && !paused} />}
          {/* Not while paused (sparse on-demand frames would read as a slow GPU and drop quality), and not
              before ready (the warm-up's compile frames are slow on purpose). */}
          {!capture && !paused && ready && (
            <PerformanceMonitor
              onDecline={() => setFx('low')}
              onChange={({ factor }) => setDpr(Math.round((min + (max - min) * factor) * 4) / 4)}
              flipflops={3}
              onFallback={() => {
                setFx('low');
                setDpr(min);
              }}
            />
          )}
          <CameraRig />
          <Lighting />
          <Room />
          <Benches students={students} />
          <TeacherDesk />
          <Device />
          <Students students={students} />
          <Teacher />
          <SunShafts />
          <DustMotes />
          <SoundRings />
          <UploadChunks />
          <OverlayDriver reg={overlays} />
          <Effects tier={fx} enabled={!warming} />
          {warming && <WarmUp onDone={() => setWarming(false)} />}
          {clip > 0 && <ClipDriver seconds={clip} />}
          <ReadySignal
            onReady={() => {
              if (capture) setFrozen(true);
              setReady(true);
              onReady?.();
            }}
            capture={capture}
            warmed={!warming}
          />
        </FrameProvider>
      </Canvas>
      <OverlayLayer reg={overlays} />
    </div>
  );
}
