'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLIP_FPS, useFrameState } from './frame-state';
import { chapterWeight, clamp01, damp, easeInOutCubic, lerp } from './timeline';

type V3 = [number, number, number];

interface Shot {
  pos: V3;
  target: V3;
  fov: number;
  /** The shot's subject. The tilt-shift band follows it on screen, so the sharp strip is always the story. */
  focus: V3;
  /** Whole-room shot: on portrait screens it tilts more top-down so the diorama fills the height. */
  wide?: boolean;
  /** Portrait-only framing (phones). Replaces pos/target/fov; skips the automatic FOV widening unless `widen`. */
  tall?: { pos: V3; target: V3; fov: number; widen?: boolean };
  /**
   * Lens shift towards the caption-free side, 0…1 (default 1). Landscape: the focal point moves right
   * (captions sit on the left); portrait: it moves up (captions are a bottom sheet). The finale (0) is
   * framed exactly for the DOM finale, which crops its poster to the board.
   */
  shift?: number;
}

/** Caption-safe lens shift at full strength: share of the width (landscape) / height (portrait). */
const SHIFT_X = 0.15;
const SHIFT_Y = 0.13;
/** Hero video: the orbit's sway (radians) over one loop. */
const CLIP_SWAY = 0.035;

/** One camera shot per chapter (0–5) plus the dusk finale (6). */
export const SHOTS: Shot[] = [
  // hero: the whole diorama, framed so the teacher and her sound rings sit right of the headline
  {
    pos: [-13.05, 7.5, 4.2],
    target: [-1.0, 0.85, -2.3],
    fov: 35,
    wide: true,
    focus: [-0.9, 1.0, -2.4], // the teacher and the front benches
    // phones: the headline is a bottom sheet, so the whole room stays centred above it
    tall: { pos: [-11.6, 7.2, 5.9], target: [0.1, 0.6, -0.9], fov: 30, widen: true },
  },
  {
    // record: the device, with the upload stream arcing to the window
    pos: [0.85, 1.7, -0.95],
    target: [2.75, 1.05, -2.85],
    fov: 36,
    focus: [2.0, 0.86, -2.88], // the device on the desk
    tall: { pos: [0.8, 1.9, -0.75], target: [2.1, 0.98, -2.85], fov: 50 },
  },
  // understand: words above the room (they rise from the teacher)
  { pos: [-7.4, 5.6, 7.6], target: [0.2, 2.1, -1.6], fov: 34, wide: true, focus: [-1.0, 1.7, -3.1] },
  // quiz: card at the board
  { pos: [0.45, 2.15, 1.5], target: [0.05, 1.7, -4.2], fov: 34, focus: [0.05, 1.75, -4.1] },
  // play: the teacher's view of phones
  { pos: [0.2, 4.7, -4.15], target: [0.2, 0.8, 1.45], fov: 46, focus: [0.2, 0.85, 0.5] },
  // insight: tinted desks + board; the focus sits on the four red-pen benches
  { pos: [-7.2, 10.6, 6.4], target: [0.6, 0.3, -1.1], fov: 30, wide: true, focus: [0.7, 0.75, 0.95] },
  // finale: dusk (keep as is)
  { pos: [-8.0, 6.2, 10.0], target: [0.0, 1.0, -0.8], fov: 30, wide: true, shift: 0, focus: [-0.4, 1.7, -4.1] },
];

/** Each shot with its portrait framing blended in by `portrait` (0…1). Mutated in place per frame. */
const BLEND: (Required<Pick<Shot, 'pos' | 'target' | 'fov' | 'focus'>> & { wide: boolean; widen: number; shift: number })[] = SHOTS.map((s) => ({
  focus: s.focus,
  pos: [...s.pos],
  target: [...s.target],
  fov: s.fov,
  wide: Boolean(s.wide),
  widen: 1,
  shift: s.shift ?? 1,
}));

function blendShots(portrait: number) {
  SHOTS.forEach((s, i) => {
    const b = BLEND[i];
    if (!b) return;
    const t = s.tall ? portrait : 0;
    for (let k = 0; k < 3; k++) {
      b.pos[k] = lerp(s.pos[k] ?? 0, s.tall?.pos[k] ?? 0, t);
      b.target[k] = lerp(s.target[k] ?? 0, s.tall?.target[k] ?? 0, t);
    }
    b.fov = lerp(s.fov, s.tall?.fov ?? s.fov, t);
    b.widen = s.tall?.widen ? 1 : 1 - t;
  });
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t0 = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _off = new THREE.Vector3();
const _sph = new THREE.Spherical();
const _focus = new THREE.Vector3();

function sample(
  p: number,
  outPos: THREE.Vector3,
  outTarget: THREE.Vector3,
  out: { wide: number; widen: number; shift: number; focus: THREE.Vector3 },
) {
  const last = BLEND.length - 1;
  const c = Math.min(last, Math.max(0, p));
  const i = Math.min(last - 1, Math.floor(c));
  const f = easeInOutCubic(c - i);
  const s0 = BLEND[i];
  const s1 = BLEND[i + 1];
  if (!s0 || !s1) return 30;
  // Why: slerp the view direction and log-lerp the distance (instead of lerping positions), so
  // every chapter change is a crane/orbit move and the camera never dives through the room.
  outTarget.set(...s0.target).lerp(_b.set(...s1.target), f);
  out.focus.set(...s0.focus).lerp(_b.set(...s1.focus), f);
  _a.set(...s0.pos).sub(_t0.set(...s0.target));
  _b.set(...s1.pos).sub(_t1.set(...s1.target));
  const d0 = _a.length();
  const d1 = _b.length();
  _a.divideScalar(d0);
  _b.divideScalar(d1);
  const angle = Math.acos(THREE.MathUtils.clamp(_a.dot(_b), -1, 1));
  if (angle > 1e-4) {
    const sa = Math.sin(angle);
    _a.multiplyScalar(Math.sin((1 - f) * angle) / sa).addScaledVector(_b, Math.sin(f * angle) / sa);
  }
  outPos.copy(outTarget).addScaledVector(_a, d0 * Math.pow(d1 / d0, f));
  out.wide = (s0.wide ? 1 : 0) + ((s1.wide ? 1 : 0) - (s0.wide ? 1 : 0)) * f;
  out.widen = lerp(s0.widen, s1.widen, f);
  out.shift = lerp(s0.shift, s1.shift, f);
  return s0.fov + (s1.fov - s0.fov) * f;
}

export function CameraRig() {
  const fs = useFrameState();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const cur = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; fov: number; init: boolean; focusInit: boolean }>({
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
    init: false,
    focusInit: false,
  });
  const goal = useMemo(
    () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), wide: 0, widen: 1, shift: 1, focus: new THREE.Vector3() }),
    [],
  );
  const view = useRef({ x: NaN, y: NaN, w: 0, h: 0 });

  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height);
    const portrait = clamp01((1.2 - aspect) / 0.6);
    blendShots(portrait);
    let fov = sample(fs.p, goal.pos, goal.target, goal);

    // Hero: a slow orbit plus gentle pointer parallax (none in capture / reduced motion).
    const hero = Math.max(chapterWeight(fs.p, 0, 0.8), chapterWeight(fs.p, 6, 0.8) * 0.6);
    _off.copy(goal.pos).sub(goal.target);
    _sph.setFromVector3(_off);
    // Portrait: look down more steeply so the floor plan fills the tall frame.
    // …and swing towards the front so the board faces the viewer and the room's depth runs down.
    _sph.phi *= 1 - 0.28 * portrait * goal.wide;
    _sph.theta *= 1 - 0.8 * portrait * goal.wide;
    if (fs.clip) {
      // Hero video: one slow sway per loop, so the orbit is back where it started on the last frame.
      _sph.theta += Math.sin((fs.clipFrame / CLIP_FPS / fs.clip) * 2 * Math.PI) * CLIP_SWAY * hero;
    } else if (!fs.still) {
      _sph.theta += (Math.sin(fs.t * 0.07) * 0.14 + fs.pointerX * 0.07) * hero + fs.pointerX * 0.025;
      _sph.phi -= fs.pointerY * 0.035;
    }
    _off.setFromSpherical(_sph);
    goal.pos.copy(goal.target).add(_off);

    // Why: keep the horizontal framing on portrait screens by widening the vertical FOV.
    // (on portrait we accept a slight side crop rather than a tiny diorama)
    const ref = lerp(1.45, 0.92, portrait);
    if (aspect < ref) {
      const h = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * lerp(1, ref / aspect, goal.widen);
      fov = Math.min(68, THREE.MathUtils.radToDeg(2 * Math.atan(h)));
    }

    // Caption-safe zone: shift the lens (not the camera) so each shot's focal point clears the caption.
    // Why setViewOffset: a lens shift keeps the perspective of the shot, and project() — used by the
    // DOM overlays — includes it, so pinned cards stay on their anchors.
    const ox = Math.round(-SHIFT_X * size.width * goal.shift * (1 - portrait));
    const oy = Math.round(SHIFT_Y * size.height * goal.shift * portrait);
    const v = view.current;
    if (ox !== v.x || oy !== v.y || size.width !== v.w || size.height !== v.h) {
      Object.assign(v, { x: ox, y: oy, w: size.width, h: size.height });
      camera.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
    }

    const c = cur.current;
    // Capture and paused: no easing — the frame is exactly the scroll position's shot.
    if (!c.init || fs.still || fs.capture) {
      c.pos.copy(goal.pos);
      c.target.copy(goal.target);
      c.fov = fov;
      c.init = true;
    } else {
      const k = 1 - Math.exp(-4.5 * fs.dt);
      c.pos.lerp(goal.pos, k);
      c.target.lerp(goal.target, k);
      c.fov = damp(c.fov, fov, 4.5, fs.dt);
    }
    camera.position.copy(c.pos);
    camera.lookAt(c.target);
    if (Math.abs(camera.fov - c.fov) > 0.001) {
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
    }

    // Where the subject sits on screen (the projection includes the caption-safe lens shift).
    camera.updateMatrixWorld();
    const y = THREE.MathUtils.clamp(_focus.copy(goal.focus).project(camera).y * 0.5 + 0.5, 0.1, 0.9);
    fs.focusY = !c.focusInit || fs.still || fs.capture ? y : damp(fs.focusY, y, 3, fs.dt);
    c.focusInit = true;
  });
  return null;
}
