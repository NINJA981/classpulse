import * as THREE from 'three';
import { SUN_DIR } from './layout';
import { palette } from './palette';
import { clamp01, lerp } from './timeline';

/**
 * The sun across the 45-minute lesson. The story's progress 0 → 5 is the rail's 00:00 → 45:00, so the
 * light really moves: the sun swings round the windows a little (it travels ~11° an hour; we take a
 * touch more so it reads), sinks slightly and warms, ending close to the dusk finale's palette.
 * Why so little: the window light frames the captions' side of the room; a big swing would wash them.
 */
const BASE = new THREE.Vector3(...SUN_DIR).normalize();
const Y = new THREE.Vector3(0, 1, 0);
/** Radians the sun turns about +Y by the end of the lesson (negative: the patches drift towards the board). */
const SWING = -0.26;
/** How much flatter (lower) the sun is by the end of the lesson. */
const SINK = 0.16;
const MORNING = new THREE.Color(palette.sun);
const LATE = new THREE.Color(palette.sunLate);

/** 0 at the start of the lesson, 1 at its end (progress 5 and beyond). */
export const lessonClock = (p: number) => clamp01(p / 5);

export function sunDirection(p: number, out: THREE.Vector3) {
  const k = lessonClock(p);
  out.copy(BASE);
  out.y *= 1 - SINK * k;
  return out.normalize().applyAxisAngle(Y, SWING * k);
}

export function sunColor(p: number, out: THREE.Color) {
  return out.copy(MORNING).lerp(LATE, lessonClock(p));
}

/** Sun intensity across the lesson (before the dusk fade): a little softer as it lowers. */
export const sunIntensity = (p: number) => lerp(3.6, 3.25, lessonClock(p));
