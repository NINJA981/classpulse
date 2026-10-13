'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { box, capsule, cylinder, merge, place, rbox, sphere, tint, torus, type Vec3 } from './geo';
import { BENCH, TEACHER_POS, type StudentSpec } from './layout';
import { palette } from './palette';
import { hz, lerp, ramp, smooth, wobble } from './timeline';

// =============================================================================================
// Students — chibi/clay proportions, built from primitives, drawn as ~12 instanced meshes.
// Local space: origin on the seat surface, facing −z. Head parts are relative to the neck pivot,
// arm parts relative to the shoulder pivot, so poses are just rotations.
// =============================================================================================

const NECK: Vec3 = [0, 0.44, 0];
const SHOULDER_X = 0.168;
const SHOULDER_Y = 0.375;
const TORSO_SCALE: Vec3 = [1.08, 1, 0.86];

function capSphere(r: number, pos: Vec3, phiStart: number, phiLength: number, thetaLength: number) {
  return place(new THREE.SphereGeometry(r, 18, 9, phiStart, phiLength, 0, thetaLength), { pos });
}

function buildStudentGeometry() {
  const legs = merge([
    tint(rbox(0.28, 0.11, 0.3, 0.05, { pos: [0, 0.055, -0.13] }), palette.trousers),
    tint(rbox(0.25, 0.34, 0.1, 0.045, { pos: [0, -0.19, -0.28] }), palette.trousers),
    tint(box(0.24, 0.04, 0.095, { pos: [0, -0.37, -0.29] }), palette.shirt),
    tint(rbox(0.1, 0.06, 0.16, 0.025, { pos: [-0.065, -0.41, -0.32] }), palette.shoe),
    tint(rbox(0.1, 0.06, 0.16, 0.025, { pos: [0.065, -0.41, -0.32] }), palette.shoe),
  ]);

  const shirt = () => tint(capsule(0.135, 0.14, { pos: [0, 0.23, 0] }, 4, 14), palette.shirt);
  const torsoBoy = merge([
    shirt(),
    tint(cylinder(0.142, 0.142, 0.07, { pos: [0, 0.07, 0] }, 16), palette.trousers),
    tint(box(0.04, 0.17, 0.012, { pos: [0, 0.27, -0.118], rot: [0.12, 0, 0] }), palette.uniform),
    tint(box(0.05, 0.035, 0.02, { pos: [0, 0.37, -0.105] }), palette.uniform),
    tint(box(0.07, 0.04, 0.02, { pos: [-0.045, 0.405, -0.09], rot: [0, 0.3, 0.6] }), palette.shirt),
    tint(box(0.07, 0.04, 0.02, { pos: [0.045, 0.405, -0.09], rot: [0, -0.3, -0.6] }), palette.shirt),
  ]);
  place(torsoBoy, { scale: TORSO_SCALE });

  const torsoGirl = merge([
    shirt(),
    tint(cylinder(0.143, 0.15, 0.3, { pos: [0, 0.16, 0] }, 18), palette.pinafore),
    tint(box(0.045, 0.03, 0.27, { pos: [-0.075, 0.43, 0] }), palette.pinafore),
    tint(box(0.045, 0.03, 0.27, { pos: [0.075, 0.43, 0] }), palette.pinafore),
    tint(box(0.05, 0.14, 0.02, { pos: [-0.075, 0.36, -0.118] }), palette.pinafore),
    tint(box(0.05, 0.14, 0.02, { pos: [0.075, 0.36, -0.118] }), palette.pinafore),
    tint(sphere(0.045, { pos: [-0.04, 0.41, -0.1], scale: [1, 0.55, 0.5] }, 8, 6), palette.shirt),
    tint(sphere(0.045, { pos: [0.04, 0.41, -0.1], scale: [1, 0.55, 0.5] }, 8, 6), palette.shirt),
  ]);
  place(torsoGirl, { scale: TORSO_SCALE });

  // Head (skin via instance colour): skull, ears, nose.
  const H: Vec3 = [0, 0.185, 0];
  const head = merge([
    sphere(0.205, { pos: H }, 18, 12),
    sphere(0.046, { pos: [-0.2, 0.17, 0.0], scale: [0.5, 1, 0.8] }, 8, 6),
    sphere(0.046, { pos: [0.2, 0.17, 0.0], scale: [0.5, 1, 0.8] }, 8, 6),
    sphere(0.024, { pos: [0, 0.135, -0.202] }, 8, 6),
    cylinder(0.07, 0.07, 0.08, { pos: [0, 0.0, 0] }, 12),
  ]);

  // Face: eyes with a highlight, a small smile, rosy cheeks.
  const face = merge([
    tint(sphere(0.031, { pos: [-0.074, 0.175, -0.182], scale: [0.85, 1.15, 0.5] }, 8, 6), palette.eye),
    tint(sphere(0.031, { pos: [0.074, 0.175, -0.182], scale: [0.85, 1.15, 0.5] }, 8, 6), palette.eye),
    tint(sphere(0.009, { pos: [-0.064, 0.187, -0.197] }, 8, 6), palette.chalk),
    tint(sphere(0.009, { pos: [0.084, 0.187, -0.197] }, 8, 6), palette.chalk),
    tint(torus(0.03, 0.007, { pos: [0, 0.112, -0.19], rot: [0.25, 0, Math.PI] }, Math.PI), palette.mouth),
    tint(sphere(0.034, { pos: [-0.118, 0.118, -0.163], scale: [1, 0.6, 0.35] }, 8, 6), palette.cheek),
    tint(sphere(0.034, { pos: [0.118, 0.118, -0.163], scale: [1, 0.6, 0.35] }, 8, 6), palette.cheek),
  ]);

  // Hair (hair tone via instance colour).
  const hairBoy = merge([
    capSphere(0.213, [0, 0.2, 0.006], 0, Math.PI * 2, 1.02),
    capSphere(0.212, [0, 0.19, 0.008], 0, Math.PI, 1.78),
    sphere(0.085, { pos: [0.06, 0.36, -0.1], scale: [1.5, 0.55, 1.1], rot: [0.4, 0, -0.2] }, 12, 8),
    sphere(0.06, { pos: [-0.08, 0.33, -0.14], scale: [1.4, 0.5, 0.9], rot: [0.6, 0, 0.3] }, 10, 8),
  ]);
  const braid = (sx: number) =>
    [
      [0.15, 0.04, 0.13, 0.06],
      [0.168, -0.05, 0.155, 0.056],
      [0.178, -0.135, 0.165, 0.052],
      [0.182, -0.215, 0.165, 0.047],
    ].map(([x = 0, y = 0, z = 0, r = 0]) => sphere(r, { pos: [sx * x, y, z], scale: [1, 1.2, 1] }, 10, 8));
  const hairGirl = merge([
    capSphere(0.215, [0, 0.198, 0.004], 0, Math.PI * 2, 1.22),
    capSphere(0.214, [0, 0.19, 0.01], 0, Math.PI, 2.2),
    sphere(0.06, { pos: [0, 0.39, -0.02], scale: [1.6, 0.4, 1.8] }, 12, 8),
    ...braid(-1),
    ...braid(1),
  ]);
  const bow = (sx: number) => [
    tint(sphere(0.04, { pos: [sx * 0.182 - 0.035, -0.27, 0.17], scale: [1.2, 0.75, 0.55], rot: [0, 0, 0.5] }, 10, 8), palette.ribbon),
    tint(sphere(0.04, { pos: [sx * 0.182 + 0.035, -0.27, 0.17], scale: [1.2, 0.75, 0.55], rot: [0, 0, -0.5] }, 10, 8), palette.ribbon),
    tint(sphere(0.022, { pos: [sx * 0.182, -0.27, 0.175] }, 8, 6), palette.ribbon),
  ];
  const ribbons = merge([...bow(-1), ...bow(1)]);

  const sleeve = merge([tint(capsule(0.064, 0.05, { pos: [0, -0.04, 0] }, 3, 10), palette.sleeve)]);
  const forearm = merge([capsule(0.043, 0.19, { pos: [0, -0.19, 0] }, 3, 8), sphere(0.056, { pos: [0, -0.335, 0] }, 10, 8)]);

  const phoneBody = rbox(0.085, 0.014, 0.155, 0.006, {}, 2);
  const phoneScreen = box(0.072, 0.003, 0.132, { pos: [0, 0.0075, 0] });

  return { legs, torsoBoy, torsoGirl, head, face, hairBoy, hairGirl, ribbons, sleeve, forearm, phoneBody, phoneScreen };
}

type PartKey = keyof ReturnType<typeof buildStudentGeometry>;

// Scratch objects for per-frame matrix math (no allocations on the hot path).
const _root = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _one = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const _c2 = new THREE.Color();

function armQuat(out: THREE.Quaternion, pitch: number, yaw: number, roll: number) {
  _e.set(pitch, yaw, roll, 'YZX');
  return out.setFromEuler(_e);
}

interface Pose {
  bob: number;
  breathe: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  arms: [number, number, number][]; // [pitch, yaw, roll] for left, right
  phone: number; // 0 … 1 visibility
}

export function Students({ students }: { students: StudentSpec[] }) {
  const fs = useFrameState();
  const geos = useMemo(buildStudentGeometry, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const boys = useMemo(() => students.filter((s) => s.kind === 'boy'), [students]);
  const girls = useMemo(() => students.filter((s) => s.kind === 'girl'), [students]);
  const slot = useMemo(() => {
    const map = new Map<number, number>();
    boys.forEach((s, i) => map.set(s.index, i));
    girls.forEach((s, i) => map.set(s.index, i));
    return map;
  }, [boys, girls]);

  const refs = useRef<Partial<Record<PartKey, THREE.InstancedMesh | null>>>({});
  const set = (k: PartKey) => (m: THREE.InstancedMesh | null) => {
    refs.current[k] = m;
  };

  const skins = useMemo(() => palette.skinTones.map((h) => new THREE.Color(h)), []);
  const hairs = useMemo(() => palette.hairTones.map((h) => new THREE.Color(h)), []);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const r = refs.current;
    students.forEach((s, i) => {
      _m.makeTranslation(s.x, BENCH.seatHeight, s.z);
      r.legs?.setMatrixAt(i, _m);
      r.head?.setColorAt(i, skins[s.skin] ?? _c.set(palette.teacherSkin));
      r.forearm?.setColorAt(i * 2, skins[s.skin] ?? _c);
      r.forearm?.setColorAt(i * 2 + 1, skins[s.skin] ?? _c);
      const k = slot.get(s.index) ?? 0;
      (s.kind === 'boy' ? r.hairBoy : r.hairGirl)?.setColorAt(k, hairs[s.hair] ?? _c);
    });
    for (const m of Object.values(r)) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [students, slot, skins, hairs]);

  const pose: Pose = useMemo(
    () => ({ bob: 0, breathe: 0, headYaw: 0, headPitch: 0, headRoll: 0, arms: [[0, 0, 0], [0, 0, 0]], phone: 0 }),
    [],
  );
  const bounded = useRef(false);

  useFrame(() => {
    const r = refs.current;
    const { p, t } = fs;
    const still = fs.still;
    const wPlay = Math.min(ramp(p, 3.35, 3.95), 1 - ramp(p, 4.55, 5.0));
    const wInsight = Math.min(ramp(p, 4.4, 4.95), 1 - ramp(p, 5.3, 5.9));
    const wListen = 1 - Math.max(wPlay, wInsight);
    // Faces pick up a little warm screen-light while the phones glow.
    const glow = wPlay * 0.18;

    for (const s of students) {
      const i = s.index;
      const side = s.x - Math.round(s.x / 2.75) * 2.75 < 0 ? -1 : 1;
      const ph = s.phase;
      const tt = still ? 0 : t;

      // --- idle life
      pose.bob = still ? 0 : Math.sin(tt * hz(1.7) + ph) * 0.006;
      pose.breathe = still ? 0 : Math.sin(tt * hz(1.7) + ph) * 0.012;
      const n = still ? wobble(ph, 0.37, ph) : wobble(tt, 0.22, ph);
      const lookNeighbour = smooth((n - 0.45) / 0.3) * (still ? 0 : 1);

      // --- listening: heads follow the teacher, glancing at a neighbour now and then
      const dx = TEACHER_POS[0] - s.x;
      const dz = TEACHER_POS[2] - s.z;
      const toTeacher = THREE.MathUtils.clamp(Math.atan2(-dx, -dz), -0.55, 0.55);
      const listenYaw = lerp(toTeacher + wobble(tt, 0.4, ph + 3) * 0.08, side * 0.85, lookNeighbour);
      const listenPitch = 0.12 + wobble(tt, 0.3, ph + 5) * 0.04 - lookNeighbour * 0.1;

      // --- live round: phones out, eyes down; some hands up and waving
      const hand = s.raisesHand ? smooth((wPlay - 0.35) / 0.4) : 0;
      const playPitch = lerp(-0.42, 0.18, hand);
      const playYaw = wobble(tt, 0.5, ph) * 0.06;

      // --- insight: the ones who struggled scratch their heads
      const struggling = s.mastery < 0.5 ? 1 : 0;
      const proud = s.mastery > 0.8 ? 1 : 0;
      const insightYaw = lerp(toTeacher * 0.5, side * 0.35, struggling * 0.5);
      const insightRoll = struggling * 0.2 * (side > 0 ? -1 : 1);

      pose.headYaw = listenYaw * wListen + playYaw * wPlay + insightYaw * wInsight;
      pose.headPitch = listenPitch * wListen + playPitch * wPlay + (0.15 - struggling * 0.15 + proud * 0.08) * wInsight;
      pose.headRoll = insightRoll * wInsight + wobble(tt, 0.35, ph + 9) * 0.04;

      // arms: [pitch, yaw, roll]
      const restL: [number, number, number] = [1.45, -0.32, 0];
      const restR: [number, number, number] = [1.45, 0.32, 0];
      const phoneL: [number, number, number] = [1.62, -0.5, 0];
      const phoneR: [number, number, number] = [1.62, 0.5, 0];
      const wave = still ? 0 : Math.sin(tt * hz(6) + ph) * 0.12;
      const raised: [number, number, number] = [2.9, 0, 0.32 + wave];
      const scratchR: [number, number, number] = [2.75, 0.15, -0.12 + (still ? 0 : Math.sin(tt * hz(9) + ph) * 0.05)];
      const wP = wPlay;
      const wS = wInsight * struggling;
      for (let a = 0; a < 2; a++) {
        const rest = a === 0 ? restL : restR;
        const ph2 = a === 0 ? phoneL : phoneR;
        const target = pose.arms[a];
        if (!target) continue;
        for (let k = 0; k < 3; k++) {
          let v = lerp(rest[k] ?? 0, ph2[k] ?? 0, wP);
          if (a === 0) v = lerp(v, raised[k] ?? 0, hand);
          if (a === 1) v = lerp(v, scratchR[k] ?? 0, wS);
          target[k] = v;
        }
      }
      pose.phone = wP;

      // --- write matrices
      _root.makeTranslation(s.x, BENCH.seatHeight + pose.bob, s.z);

      const boy = s.kind === 'boy';
      const k = slot.get(i) ?? 0;
      _s.set(1, 1 + pose.breathe, 1);
      _m.compose(_v.set(0, 0, 0), _q.identity(), _s).premultiply(_root);
      (boy ? r.torsoBoy : r.torsoGirl)?.setMatrixAt(k, _m);

      _e.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_v.set(NECK[0], NECK[1] + pose.breathe * 0.4, NECK[2]), _q, _one).premultiply(_root);
      r.head?.setMatrixAt(i, _m);
      r.face?.setMatrixAt(i, _m);
      (boy ? r.hairBoy : r.hairGirl)?.setMatrixAt(k, _m);
      if (!boy) r.ribbons?.setMatrixAt(k, _m);

      for (let a = 0; a < 2; a++) {
        const [pitch = 0, yaw = 0, roll = 0] = pose.arms[a] ?? [];
        armQuat(_q2, pitch, yaw, roll);
        // Why: chibi arms are short; a raised hand stretches a little so it clears the big head.
        const stretch = a === 0 ? 1 + hand * 0.4 : 1;
        _m2.compose(_v.set(a === 0 ? -SHOULDER_X : SHOULDER_X, SHOULDER_Y + pose.breathe * 0.3, 0), _q2, _s.set(1, stretch, 1)).premultiply(_root);
        r.sleeve?.setMatrixAt(i * 2 + a, _m2);
        r.forearm?.setMatrixAt(i * 2 + a, _m2);
      }

      // phone: held over the desk, screen tilted towards the face
      const sc = Math.max(0.0001, smooth(pose.phone * 1.4));
      const oneHand = hand > 0.5;
      _e.set(0.5, oneHand ? 0.25 : 0, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(oneHand ? 0.08 : 0, 0.4, -0.34), _q, _s.set(sc, sc, sc)).premultiply(_root);
      r.phoneBody?.setMatrixAt(i, _m);
      r.phoneScreen?.setMatrixAt(i, _m);

      // warm screen-light on faces
      if (r.head) {
        _c.copy(skins[s.skin] ?? _c2).lerp(_c2.set(palette.pulse), glow);
        r.head.setColorAt(i, _c);
      }
    }

    for (const m of Object.values(r)) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
    }
    if (r.head?.instanceColor) r.head.instanceColor.needsUpdate = true;
    if (!bounded.current) {
      // Why: instanced meshes cull by a bounding sphere computed from their instances; do it once
      // after the first real pose so nothing pops out at the frame edges.
      for (const m of Object.values(r)) m?.computeBoundingSphere();
      bounded.current = true;
    }
    if (screenMat.current) screenMat.current.emissiveIntensity = 0.2 + wPlay * 7;
    if (r.phoneBody) r.phoneBody.visible = wPlay > 0.01;
    if (r.phoneScreen) r.phoneScreen.visible = wPlay > 0.01;
  });

  const nB = Math.max(1, boys.length);
  const nG = Math.max(1, girls.length);
  const n = Math.max(1, students.length);
  return (
    <group>
      <instancedMesh ref={set('legs')} args={[geos.legs, undefined, n]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={set('torsoBoy')} args={[geos.torsoBoy, undefined, nB]} count={boys.length} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={set('torsoGirl')} args={[geos.torsoGirl, undefined, nG]} count={girls.length} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={set('head')} args={[geos.head, undefined, n]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={set('face')} args={[geos.face, undefined, n]}>
        <meshStandardMaterial vertexColors roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={set('hairBoy')} args={[geos.hairBoy, undefined, nB]} count={boys.length} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={set('hairGirl')} args={[geos.hairGirl, undefined, nG]} count={girls.length} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={set('ribbons')} args={[geos.ribbons, undefined, nG]} count={girls.length} castShadow>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={set('sleeve')} args={[geos.sleeve, undefined, n * 2]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={set('forearm')} args={[geos.forearm, undefined, n * 2]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={set('phoneBody')} args={[geos.phoneBody, undefined, n]} visible={false}>
        <meshStandardMaterial color={palette.shoe} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={set('phoneScreen')} args={[geos.phoneScreen, undefined, n]} visible={false}>
        <meshStandardMaterial ref={screenMat} color={palette.pulse} emissive={palette.pulse} emissiveIntensity={0} roughness={0.3} />
      </instancedMesh>
    </group>
  );
}

// =============================================================================================
// Teacher — saree, glasses, jasmine in her bun. Four merged meshes, posed via pivots.
// Built facing −z like the students, then turned to face the class.
// =============================================================================================

function buildTeacher() {
  const sareeProfile = [
    [0.0, 0.0],
    [0.235, 0.0],
    [0.25, 0.04],
    [0.235, 0.18],
    [0.2, 0.42],
    [0.17, 0.62],
    [0.155, 0.7],
    [0.0, 0.72],
  ].map(([r = 0, y = 0]) => new THREE.Vector2(r, y));
  const skirt = new THREE.LatheGeometry(sareeProfile, 28);
  skirt.deleteAttribute('uv');
  skirt.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(skirt.getAttribute('position').count * 2), 2));

  const body = merge([
    tint(skirt, palette.saree),
    tint(torus(0.243, 0.016, { pos: [0, 0.035, 0], rot: [Math.PI / 2, 0, 0] }), palette.sareeBorder),
    tint(cylinder(0.14, 0.15, 0.08, { pos: [0, 0.71, 0] }, 18), palette.teacherSkin),
    tint(capsule(0.15, 0.1, { pos: [0, 0.86, 0], scale: [1.05, 1, 0.85] }, 8, 16), palette.blouse),
    // pallu: across the chest to the left shoulder, then down the back
    tint(box(0.2, 0.5, 0.03, { pos: [-0.02, 0.86, -0.135], rot: [0.08, 0, -0.62] }), palette.sareePallu),
    tint(box(0.022, 0.5, 0.034, { pos: [0.065, 0.9, -0.137], rot: [0.08, 0, -0.62] }), palette.sareeBorder),
    tint(box(0.2, 0.75, 0.03, { pos: [-0.09, 0.62, 0.15], rot: [-0.08, 0, 0.05] }), palette.sareePallu),
    tint(box(0.2, 0.025, 0.034, { pos: [-0.105, 0.25, 0.168], rot: [-0.08, 0, 0.05] }), palette.sareeBorder),
    tint(sphere(0.085, { pos: [-0.12, 1.0, 0.0], scale: [1, 0.55, 1.6] }, 12, 8), palette.sareePallu),
    tint(cylinder(0.055, 0.06, 0.09, { pos: [0, 1.02, 0] }, 12), palette.teacherSkin),
  ]);

  const H: Vec3 = [0, 0.2, 0];
  const jasmine = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
    return tint(sphere(0.022, { pos: [Math.cos(a) * 0.115, 0.16 - Math.sin(a) * 0.1, 0.27] }, 8, 6), palette.chalk);
  });
  const head = merge([
    tint(sphere(0.225, { pos: H }, 22, 16), palette.teacherSkin),
    tint(sphere(0.05, { pos: [-0.22, 0.18, 0], scale: [0.5, 1, 0.8] }, 10, 8), palette.teacherSkin),
    tint(sphere(0.05, { pos: [0.22, 0.18, 0], scale: [0.5, 1, 0.8] }, 10, 8), palette.teacherSkin),
    tint(sphere(0.012, { pos: [-0.228, 0.13, -0.01] }, 8, 6), palette.steel),
    tint(sphere(0.012, { pos: [0.228, 0.13, -0.01] }, 8, 6), palette.steel),
    tint(sphere(0.026, { pos: [0, 0.15, -0.222] }, 8, 6), palette.teacherSkin),
    tint(capSphere(0.236, [0, 0.215, 0.005], 0, Math.PI * 2, 1.2), palette.teacherHair),
    tint(capSphere(0.234, [0, 0.205, 0.01], 0, Math.PI, 2.0), palette.teacherHair),
    tint(sphere(0.105, { pos: [0, 0.15, 0.24] }, 16, 12), palette.teacherHair),
    ...jasmine,
    // eyes, glasses, bindi, cheeks
    tint(sphere(0.026, { pos: [-0.08, 0.19, -0.2], scale: [0.85, 1.1, 0.5] }, 8, 6), palette.eye),
    tint(sphere(0.026, { pos: [0.08, 0.19, -0.2], scale: [0.85, 1.1, 0.5] }, 8, 6), palette.eye),
    tint(torus(0.058, 0.009, { pos: [-0.08, 0.19, -0.222] }), palette.glasses),
    tint(torus(0.058, 0.009, { pos: [0.08, 0.19, -0.222] }), palette.glasses),
    tint(box(0.045, 0.01, 0.01, { pos: [0, 0.2, -0.226] }), palette.glasses),
    tint(box(0.008, 0.01, 0.2, { pos: [-0.14, 0.2, -0.12], rot: [0, 0.12, 0] }), palette.glasses),
    tint(box(0.008, 0.01, 0.2, { pos: [0.14, 0.2, -0.12], rot: [0, -0.12, 0] }), palette.glasses),
    tint(sphere(0.012, { pos: [0, 0.3, -0.205] }, 8, 6), palette.bindi),
    tint(sphere(0.034, { pos: [-0.125, 0.12, -0.18], scale: [1, 0.6, 0.35] }, 8, 6), palette.cheek),
    tint(sphere(0.034, { pos: [0.125, 0.12, -0.18], scale: [1, 0.6, 0.35] }, 8, 6), palette.cheek),
  ]);
  const mouth = merge([tint(sphere(0.03, { scale: [1, 0.5, 0.4] }, 12, 8), palette.mouth)]);

  const arm = (holding: 'chalk' | 'book') =>
    merge([
      tint(capsule(0.066, 0.06, { pos: [0, -0.04, 0] }, 6, 12), palette.blouse),
      tint(capsule(0.047, 0.24, { pos: [0, -0.21, 0] }, 6, 10), palette.teacherSkin),
      tint(torus(0.05, 0.009, { pos: [0, -0.3, 0], rot: [Math.PI / 2, 0, 0] }), '#5E8F7A'),
      tint(torus(0.05, 0.009, { pos: [0, -0.32, 0], rot: [Math.PI / 2, 0, 0] }), '#5E8F7A'),
      tint(sphere(0.06, { pos: [0, -0.375, 0] }, 12, 10), palette.teacherSkin),
      holding === 'chalk'
        ? tint(cylinder(0.012, 0.012, 0.08, { pos: [0, -0.42, -0.03], rot: [0.5, 0, 0] }, 6), palette.chalk)
        : tint(rbox(0.2, 0.26, 0.04, 0.008, { pos: [0.02, -0.42, -0.06], rot: [0.2, 0.2, 0] }), palette.uniform),
    ]);

  return { body, head, mouth, armR: arm('chalk'), armL: arm('book') };
}

export function Teacher() {
  const fs = useFrameState();
  const geos = useMemo(buildTeacher, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  useFrame(() => {
    const { p, voice } = fs;
    const t = fs.still ? 0 : fs.t;
    const g = root.current;
    if (!g || !torso.current || !head.current || !armL.current || !armR.current) return;

    // Chapter 5: she walks to the board and writes the re-teach note; at dusk she faces the class again.
    const write = Math.min(ramp(p, 4.2, 4.85), 1 - ramp(p, 5.15, 5.7));
    const reveal = ramp(p, 4.35, 5);
    const writeX = 0.15 + reveal * 0.95;
    const finale = ramp(p, 5.2, 6);
    const x = lerp(lerp(TEACHER_POS[0], writeX, write), -1.85, finale);
    const z = lerp(lerp(TEACHER_POS[2], -3.72, write), -3.15, finale);
    g.position.set(x, 0, z);
    // facing: class (+z) normally, the board (−z) while writing
    const faceClass = Math.PI - 0.3 + Math.sin(t * hz(0.35)) * 0.18;
    g.rotation.y = lerp(faceClass, 0.05, write);

    const talk = (1 - write) * (1 - finale * 0.6);
    torso.current.rotation.z = Math.sin(t * hz(0.9)) * 0.025;
    torso.current.rotation.x = -voice * 0.04 * talk;

    // head: looks over the class, glances back at the board now and then
    const glance = smooth((wobble(t, 0.25, 2) - 0.5) / 0.25) * (fs.still ? 0 : 1);
    head.current.rotation.y = lerp(wobble(t, 0.5, 1) * 0.35, 0.9, glance * talk) * (1 - write);
    head.current.rotation.x = -0.08 + voice * 0.06 * talk + write * 0.1;
    head.current.rotation.z = Math.sin(t * hz(1.1)) * 0.04;
    if (mouth.current) mouth.current.scale.set(1, 0.4 + voice * talk * 1.6, 1);

    // right arm (chalk): talking gestures → writing on the board
    const gesture = 0.55 + voice * 0.7 + Math.sin(t * hz(1.7)) * 0.25;
    const writing = 2.45 + Math.sin(t * hz(7)) * 0.05;
    const wave = Math.sin(t * hz(5)) * 0.18;
    armR.current.rotation.set(
      lerp(lerp(gesture * talk + 0.15, writing, write), 2.5, finale),
      lerp(lerp(0.25, -0.15, write), 0, finale),
      lerp(lerp(0.35 + voice * 0.2, 0.15, write), -0.55 + wave, finale),
      'YZX',
    );
    // left arm holds the textbook against her
    armL.current.rotation.set(lerp(0.95, 0.6, write), -0.4, -0.2, 'YZX');
  });

  return (
    <group ref={root} position={TEACHER_POS}>
      <group ref={torso}>
        <mesh geometry={geos.body} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.75} />
        </mesh>
        <group ref={head} position={[0, 1.04, 0]}>
          <mesh geometry={geos.head} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.55} />
          </mesh>
          <mesh ref={mouth} geometry={geos.mouth} position={[0, 0.095, -0.205]}>
            <meshStandardMaterial vertexColors roughness={0.5} />
          </mesh>
        </group>
        <group ref={armR} position={[0.19, 0.95, 0]}>
          <mesh geometry={geos.armR} castShadow>
            <meshStandardMaterial vertexColors roughness={0.65} />
          </mesh>
        </group>
        <group ref={armL} position={[-0.19, 0.95, 0]}>
          <mesh geometry={geos.armL} castShadow>
            <meshStandardMaterial vertexColors roughness={0.65} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
