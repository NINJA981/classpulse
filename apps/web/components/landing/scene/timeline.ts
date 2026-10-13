/**
 * Pure helpers that turn story progress (0…6) and time into animation weights.
 * Everything here is deterministic so poster captures are repeatable.
 */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** 0 before a, 1 after b, smooth in between. */
export const ramp = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
/** 1 at the chapter, fading to 0 at ±width. Why: overlays only live inside their own chapter. */
export const chapterWeight = (p: number, chapter: number, width = 0.55) =>
  smooth(1 - Math.abs(p - chapter) / width);
/** A window that is fully on between a and b, with soft edges of size `soft`. */
export const window01 = (p: number, a: number, b: number, soft = 0.3) =>
  Math.min(ramp(p, a - soft, a), 1 - ramp(p, b, b + soft));

export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Frame-rate independent exponential damping. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Small seeded PRNG so every layout (skin tones, mastery, idle phases) is stable between loads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Loop mode (the hero video capture). Every idle oscillation snaps to a whole number of cycles per
// loop, so the last frame of the clip leads straight back into the first one.
// ---------------------------------------------------------------------------------------------

let loopSeconds = 0;

/** Clip capture only: make every oscillator periodic over `seconds` (0 turns it off). */
export function setLoopSeconds(seconds: number) {
  loopSeconds = seconds > 0 ? seconds : 0;
}

/**
 * An angular frequency (rad/s) as the scene should use it: unchanged normally; in loop mode rounded to
 * whole cycles per loop (a drift slower than half a cycle per loop holds still).
 */
export function hz(w: number) {
  if (!loopSeconds) return w;
  const step = (2 * Math.PI) / loopSeconds;
  return Math.round(w / step) * step;
}

/** Same for a rate in cycles per second (ring spreads, chunk streams). */
export const cps = (c: number) => hz(c * 2 * Math.PI) / (2 * Math.PI);

/**
 * The teacher's voice envelope (0…1): phrases with pauses, syllables inside phrases.
 * Why: the LED, the sound rings and the teacher's gestures all read this one signal, so they feel
 * physically linked.
 */
export function voiceAt(t: number) {
  const phrase = smooth((Math.sin(t * hz(0.85)) + Math.sin(t * hz(0.37) + 1.3) * 0.6 + 0.35) * 2.2);
  const syllable = Math.abs(Math.sin(t * hz(7.3)) * Math.sin(t * hz(3.1) + 1.0));
  return phrase * (0.25 + 0.75 * syllable);
}

/** Cheap smooth 1D noise in [-1, 1] over time `t`, at `rate` (1 = the base speed). */
export const wobble = (t: number, rate: number, seed: number) =>
  (Math.sin(t * hz(1.3 * rate) + seed * 12.9898) + Math.sin(t * hz(0.71 * rate) + seed * 78.233) * 0.6) / 1.6;
