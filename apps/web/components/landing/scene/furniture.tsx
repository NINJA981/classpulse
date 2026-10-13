'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { box, cylinder, merge, rbox, tint } from './geo';
import { BENCH, BENCHES, TEACHER_DESK, type BenchSpot, type StudentSpec } from './layout';
import { palette } from './palette';
import { chapterWeight, mulberry32, ramp } from './timeline';

/** Static parts of one bench-desk unit (local: seat centre at z = 0, students face −z). */
function benchFrame() {
  const B = BENCH;
  const dz = -(B.gap);
  const parts: THREE.BufferGeometry[] = [];
  const legW = 0.035;
  // desk front panel + book shelf
  parts.push(tint(rbox(B.width, 0.34, 0.025, 0.008, { pos: [0, B.deskHeight - 0.2, dz - B.deskDepth / 2 + 0.02] }), palette.wood));
  parts.push(tint(box(B.width - 0.06, 0.02, 0.28, { pos: [0, B.deskHeight - 0.16, dz] }), palette.woodDark));
  // seat
  parts.push(tint(rbox(B.width, 0.05, B.seatDepth, 0.012, { pos: [0, B.seatHeight - 0.025, 0.02] }), palette.wood));
  // metal side frames joining desk and seat (the classic Indian bench-desk unit)
  for (const sx of [-1, 1]) {
    const x = sx * (B.width / 2 - 0.05);
    parts.push(tint(box(legW, B.deskHeight - 0.04, legW, { pos: [x, (B.deskHeight - 0.04) / 2, dz - B.deskDepth / 2 + 0.05] }), palette.benchFrame));
    parts.push(tint(box(legW, B.deskHeight - 0.04, legW, { pos: [x, (B.deskHeight - 0.04) / 2, dz + B.deskDepth / 2 - 0.05] }), palette.benchFrame));
    parts.push(tint(box(legW, B.seatHeight - 0.05, legW, { pos: [x, (B.seatHeight - 0.05) / 2, 0.14] }), palette.benchFrame));
    parts.push(tint(box(legW, 0.03, B.gap + B.deskDepth / 2 + 0.12, { pos: [x, 0.08, dz / 2 + 0.02] }), palette.benchFrame));
    parts.push(tint(box(legW, 0.03, B.deskDepth, { pos: [x, B.deskHeight - 0.32, dz] }), palette.benchFrame));
  }
  return merge(parts);
}

function deskTop() {
  // Why: a slight slope towards the student, like real wooden school desks.
  return rbox(BENCH.width, 0.045, BENCH.deskDepth, 0.012, { pos: [0, BENCH.deskHeight, -BENCH.gap], rot: [0.07, 0, 0] });
}

function notebook() {
  return merge([
    tint(box(0.3, 0.012, 0.2, { pos: [0, 0, 0] }), palette.notebook),
    tint(box(0.005, 0.014, 0.2, { pos: [0, 0.001, 0] }), palette.chalkDim),
    tint(box(0.13, 0.013, 0.004, { pos: [-0.07, 0.001, -0.05] }), '#9AA6B8'),
    tint(box(0.11, 0.013, 0.004, { pos: [-0.075, 0.001, -0.02] }), '#9AA6B8'),
    tint(box(0.12, 0.013, 0.004, { pos: [0.075, 0.001, -0.06] }), '#9AA6B8'),
  ]);
}

function bottle() {
  return merge([cylinder(0.035, 0.035, 0.2, { pos: [0, 0.1, 0] }, 12), cylinder(0.024, 0.024, 0.035, { pos: [0, 0.215, 0] }, 10)]);
}

const BOTTLE_COLORS = ['#B9C0C2', '#3E6B57', '#2C3A63', '#B9C0C2', '#7C4A4F'];

function schoolBag() {
  return merge([
    rbox(0.3, 0.36, 0.14, 0.05, { pos: [0, 0.18, 0] }),
    rbox(0.22, 0.14, 0.05, 0.02, { pos: [0, 0.12, -0.08] }),
  ]);
}

const BAG_COLORS = ['#2C3A63', '#5A4636', '#3E4E46', '#6B3A3E', '#3B3F4A'];

export function Benches({ students }: { students: StudentSpec[] }) {
  const fs = useFrameState();
  const geos = useMemo(() => ({ frame: benchFrame(), top: deskTop(), book: notebook(), bag: schoolBag(), bottle: bottle() }), []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const frameRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  const bookRef = useRef<THREE.InstancedMesh>(null);
  const bagRef = useRef<THREE.InstancedMesh>(null);
  const bottleRef = useRef<THREE.InstancedMesh>(null);

  // Per-bench mastery target colour (mean of the students sitting there): understood benches keep their
  // wood, struggling ones take the red pen.
  const mastery = useMemo(() => {
    const wood = new THREE.Color(palette.woodLight);
    const hi = new THREE.Color(palette.masteryHigh);
    const lo = new THREE.Color(palette.masteryLow);
    return BENCHES.map((_, i) => {
      const m = benchMastery(students, i);
      if (m === null) return { from: wood.clone(), to: wood.clone() };
      return { from: wood.clone(), to: m < STRUGGLING ? lo.clone() : hi.clone() };
    });
  }, [students]);
  const struggling = useMemo(
    () => BENCHES.filter((_, i) => {
      const m = benchMastery(students, i);
      return m !== null && m < STRUGGLING;
    }),
    [students],
  );

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const rand = mulberry32(99);
    const bagColor = new THREE.Color();
    BENCHES.forEach((b, i) => {
      m.makeTranslation(b.x, 0, b.z);
      frameRef.current?.setMatrixAt(i, m);
      topRef.current?.setMatrixAt(i, m);
      topRef.current?.setColorAt(i, mastery[i]?.from ?? bagColor);
      // a bag leaning on the aisle side of each bench
      const side = b.column === 0 ? -1 : 1;
      m.compose(
        new THREE.Vector3(b.x + side * (BENCH.width / 2 + 0.12), 0, b.z - 0.15),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.8 + Math.PI / 2, side * 0.12)),
        new THREE.Vector3(1, 1, 1),
      );
      bagRef.current?.setMatrixAt(i, m);
      bagRef.current?.setColorAt(i, bagColor.set(BAG_COLORS[Math.floor(rand() * BAG_COLORS.length)] ?? palette.uniform));
      m.makeTranslation(b.x + (rand() > 0.5 ? 0.47 : -0.47), BENCH.deskHeight + 0.01, b.z - BENCH.gap - 0.1);
      bottleRef.current?.setMatrixAt(i, m);
      bottleRef.current?.setColorAt(i, bagColor.set(BOTTLE_COLORS[i % BOTTLE_COLORS.length] ?? palette.steel));
    });
    students.forEach((s, i) => {
      m.compose(
        new THREE.Vector3(s.x, BENCH.deskHeight + 0.03, s.z - BENCH.gap + 0.04),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.07, (rand() - 0.5) * 0.4, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      bookRef.current?.setMatrixAt(i, m);
    });
    for (const r of [frameRef, topRef, bookRef, bagRef, bottleRef]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
  }, [students, mastery]);

  const tmp = useMemo(() => new THREE.Color(), []);
  const last = useRef(-1);
  useFrame(() => {
    const top = topRef.current;
    if (!top) return;
    // Why: desks tint by mastery only while the insight chapter is on screen.
    const w = Math.min(ramp(fs.p, 4.3, 4.95), 1 - ramp(fs.p, 5.25, 5.9));
    const q = Math.round(w * 60);
    if (q === last.current) return;
    last.current = q;
    mastery.forEach((c, i) => top.setColorAt(i, tmp.copy(c.from).lerp(c.to, w)));
    if (top.instanceColor) top.instanceColor.needsUpdate = true;
  });

  // Notebooks step aside for phones during the live round.
  useFrame(() => {
    if (bookRef.current) bookRef.current.visible = chapterWeight(fs.p, 4, 0.45) < 0.5;
  });

  return (
    <group>
      <instancedMesh ref={frameRef} args={[geos.frame, undefined, BENCHES.length]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[geos.top, undefined, BENCHES.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.62} />
      </instancedMesh>
      <instancedMesh ref={bookRef} args={[geos.book, undefined, Math.max(1, students.length)]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bottleRef} args={[geos.bottle, undefined, BENCHES.length]} receiveShadow>
        <meshStandardMaterial roughness={0.35} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={bagRef} args={[geos.bag, undefined, BENCHES.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <RedPenCircles benches={struggling} />
    </group>
  );
}

/** Bench mean below this = "needs help" in the insight chapter (four benches, eight students). */
export const STRUGGLING = 0.6;

function benchMastery(students: StudentSpec[], bench: number) {
  const seated = students.filter((s) => s.bench === bench);
  if (!seated.length) return null;
  return seated.reduce((a, s) => a + s.mastery, 0) / seated.length;
}

/** A quick, slightly wobbly loop with an overshoot, like a teacher circling something in red pen. */
function penLoop() {
  const rand = mulberry32(5);
  const pts: THREE.Vector3[] = [];
  const turns = 1.12;
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 * turns - 0.4;
    const r = 1 + (rand() - 0.5) * 0.06 + (i / n) * 0.06;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.86 * r, 0, Math.sin(a) * 0.62 * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.022, 5, false).scale(1, 0.35, 1);
}

/** Chapter 5: red-pen circles drawn on the floor around the benches that need help. */
function RedPenCircles({ benches }: { benches: BenchSpot[] }) {
  const fs = useFrameState();
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(penLoop, []);
  const total = geo.index?.count ?? 0;
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    benches.forEach((b, i) => {
      m.makeTranslation(b.x, 0.012, b.z - BENCH.gap / 2 + 0.05);
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [benches]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // Drawn on a beat after the desks redden; wiped before the dusk finale.
    const w = Math.min(ramp(fs.p, 4.55, 4.98), 1 - ramp(fs.p, 5.25, 5.7));
    mesh.visible = w > 0.01;
    // Why: index count in whole triangles (multiples of 3), so the stroke grows along its length.
    geo.setDrawRange(0, Math.floor((total * w) / 3) * 3);
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, Math.max(1, benches.length)]} frustumCulled={false}>
      <meshStandardMaterial color={palette.redpen} emissive={palette.redpen} emissiveIntensity={0.35} roughness={0.8} />
    </instancedMesh>
  );
}

function buildTeacherDesk() {
  const D = TEACHER_DESK;
  const parts: THREE.BufferGeometry[] = [];
  // table
  parts.push(tint(rbox(D.w, 0.05, D.d, 0.015, { pos: [0, D.h - 0.025, 0] }), palette.wood));
  parts.push(tint(rbox(0.5, D.h - 0.1, D.d - 0.06, 0.02, { pos: [D.w / 2 - 0.3, (D.h - 0.1) / 2 + 0.05, 0] }), palette.woodLight));
  for (const y of [0.22, 0.45]) parts.push(tint(box(0.12, 0.02, 0.02, { pos: [D.w / 2 - 0.3, y, D.d / 2 - 0.02] }), palette.woodDark));
  parts.push(tint(box(D.w - 0.1, 0.32, 0.02, { pos: [0, D.h - 0.22, D.d / 2 - 0.05] }), palette.woodLight));
  for (const [x, z] of [[-1, -1], [-1, 1]] as const) {
    parts.push(tint(box(0.05, D.h - 0.05, 0.05, { pos: [x * (D.w / 2 - 0.05), (D.h - 0.05) / 2, z * (D.d / 2 - 0.05)] }), palette.woodDark));
  }
  // register, notebook pile, chalk box, steel bottle
  parts.push(tint(rbox(0.3, 0.035, 0.22, 0.006, { pos: [0.35, D.h + 0.018, 0.06], rot: [0, 0.15, 0] }), palette.register));
  for (let i = 0; i < 5; i++) {
    parts.push(tint(box(0.24, 0.018, 0.17, { pos: [0.52 - i * 0.006, D.h + 0.01 + i * 0.019, -0.18], rot: [0, -0.1 + i * 0.06, 0] }), i % 2 ? palette.notebookCover : palette.notebook));
  }
  parts.push(tint(box(0.12, 0.06, 0.08, { pos: [0.08, D.h + 0.03, -0.22], rot: [0, 0.3, 0] }), palette.chalk));
  parts.push(tint(cylinder(0.04, 0.04, 0.22, { pos: [0.66, D.h + 0.11, 0.2] }, 14), palette.steel));
  parts.push(tint(cylinder(0.028, 0.028, 0.03, { pos: [0.66, D.h + 0.235, 0.2] }, 12), palette.metal));
  return merge(parts);
}

function buildChair() {
  return merge([
    tint(rbox(0.46, 0.05, 0.44, 0.015, { pos: [0, 0.47, 0] }), palette.wood),
    tint(rbox(0.46, 0.4, 0.04, 0.015, { pos: [0, 0.75, -0.22] }), palette.wood),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x = 0, z = 0]) =>
      tint(box(0.04, 0.47, 0.04, { pos: [x * 0.2, 0.235, z * 0.19] }), palette.woodDark),
    ),
  ]);
}

export function TeacherDesk() {
  const geos = useMemo(() => ({ desk: buildTeacherDesk(), chair: buildChair() }), []);
  useEffect(() => () => {
    geos.desk.dispose();
    geos.chair.dispose();
  }, [geos]);
  return (
    <group>
      <mesh geometry={geos.desk} position={[TEACHER_DESK.x, 0, TEACHER_DESK.z]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh geometry={geos.chair} position={[TEACHER_DESK.x + 0.25, 0, TEACHER_DESK.z - 0.75]} rotation={[0, 0.25, 0]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
    </group>
  );
}
