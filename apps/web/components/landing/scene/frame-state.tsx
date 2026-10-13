'use client';
import { useFrame } from '@react-three/fiber';
import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { story } from '../story/chapters';
import { sunDirection } from './sun';
import { ramp, voiceAt } from './timeline';

export type QualityTier = 'high' | 'low';

/**
 * One mutable object per scene, refreshed once per frame by <Director/> before anything else runs.
 * Why: every animated part reads the same progress/time/voice instead of each re-deriving it, and
 * nothing on the per-frame path touches React state.
 */
export interface FrameState {
  /** Story progress, 0 … 6 (6 = dusk finale). */
  p: number;
  /** Scene time in seconds (frozen in capture mode). */
  t: number;
  dt: number;
  voice: number;
  /** 0 = morning, 1 = dusk (finale). */
  dusk: number;
  pointerX: number;
  pointerY: number;
  /** True when idle motion should stop (reduced motion, the visitor's pause, or capture). */
  still: boolean;
  capture: boolean;
  tier: QualityTier;
  /** Direction the sunlight travels this frame (it moves across the lesson, see sun.ts). */
  sun: THREE.Vector3;
  /** Clip capture (the hero video): loop length in seconds, 0 otherwise. Time then advances per frame. */
  clip: number;
  /** Clip capture: the frame to render (time = CAPTURE_TIME + clipFrame / CLIP_FPS). */
  clipFrame: number;
  /** Screen height (0 bottom … 1 top) of the current shot's subject; the tilt-shift band follows it. */
  focusY: number;
}

/** Frames per second of the hero video clip. */
export const CLIP_FPS = 30;

export function createFrameState(tier: QualityTier, fixedProgress: number | undefined, clipSeconds = 0): FrameState {
  const capture = fixedProgress !== undefined;
  const p = fixedProgress ?? story.progress;
  return {
    p,
    t: CAPTURE_TIME,
    dt: 0,
    voice: voiceAt(CAPTURE_TIME),
    dusk: ramp(p, 5, 6),
    pointerX: 0,
    pointerY: 0,
    still: capture,
    capture,
    tier,
    sun: sunDirection(p, new THREE.Vector3()),
    clip: capture ? clipSeconds : 0,
    clipFrame: 0,
    focusY: 0.5,
  };
}

/** A moment where the teacher is mid-sentence, hands up, rings well spread. */
const CAPTURE_TIME = 4.15;

const FrameContext = createContext<FrameState | null>(null);
export const FrameProvider = FrameContext.Provider;

export function useFrameState(): FrameState {
  const fs = useContext(FrameContext);
  if (!fs) throw new Error('useFrameState must be used inside <FrameProvider>');
  return fs;
}

export function Director({ fixedProgress }: { fixedProgress?: number }) {
  const fs = useFrameState();
  // Why: priority −1 runs before every other useFrame, so all readers see this frame's values.
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    fs.p = fixedProgress ?? story.progress;
    if (fs.clip) {
      // Clip capture: deterministic time, full idle motion (the loop needs it), no pointer.
      fs.dt = 1 / CLIP_FPS;
      fs.t = CAPTURE_TIME + fs.clipFrame / CLIP_FPS;
      fs.still = false;
    } else {
      fs.dt = fs.capture ? 1 / 60 : dt;
      fs.still = fs.capture || story.reducedMotion || story.paused;
      // Paused: time stops too, so nothing (voice, rings, LED, chunks) keeps moving.
      if (!fs.capture && !story.paused) fs.t += dt;
    }
    fs.voice = voiceAt(fs.t);
    fs.dusk = ramp(fs.p, 5, 6);
    sunDirection(fs.p, fs.sun);
    fs.pointerX = fs.still || fs.capture ? 0 : story.pointer.x;
    fs.pointerY = fs.still || fs.capture ? 0 : story.pointer.y;
  }, -1);
  return null;
}
