'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { box, cylinder, merge, rbox, sphere, tint } from './geo';
import { DEVICE_POS, RIGHT_X, WINDOWS } from './layout';
import { palette } from './palette';
import { chapterWeight, cps, smooth } from './timeline';

/**
 * The ClassIQ recorder: a small board in a dark case with one pulse LED, and a USB mic on a
 * tiny stand. It is scaled up ~1.6× against the furniture. Why: at diorama scale a true-size Pi
 * would vanish; miniatures always exaggerate the hero prop.
 */
function buildDevice() {
  const caseGeo = merge([
    // two-part case: matte base, softer lid
    tint(rbox(0.21, 0.03, 0.15, 0.012, { pos: [0, 0.015, 0] }, 3), palette.deviceCase),
    tint(rbox(0.204, 0.026, 0.144, 0.012, { pos: [0, 0.04, 0] }, 3), palette.deviceLid),
    // vent slots
    ...[0, 1, 2, 3].map((i) => tint(box(0.006, 0.004, 0.07, { pos: [-0.075 + i * 0.014, 0.0535, 0.01] }), '#15181A')),
    // ports on the side
    tint(box(0.004, 0.018, 0.03, { pos: [0.106, 0.022, -0.035] }), palette.steel),
    tint(box(0.004, 0.018, 0.03, { pos: [0.106, 0.022, 0.01] }), palette.steel),
    tint(box(0.01, 0.012, 0.012, { pos: [-0.106, 0.02, 0.05] }), palette.steel),
    // rubber feet
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => tint(cylinder(0.01, 0.01, 0.006, { pos: [sx * 0.085, -0.002, sz * 0.055] }, 8), '#111'))),
  ]);
  const mic = merge([
    tint(cylinder(0.045, 0.05, 0.012, { pos: [0, 0.006, 0] }, 18), palette.micBody),
    tint(cylinder(0.007, 0.007, 0.07, { pos: [0, 0.045, 0] }, 8), palette.micBody),
    tint(cylinder(0.026, 0.024, 0.08, { pos: [0, 0.115, 0], rot: [0.25, 0, 0] }, 16), palette.micBody),
    tint(sphere(0.029, { pos: [0, 0.162, -0.012] }, 16, 12), '#3A3E42'),
  ]);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.106, 0.02, 0.05),
    new THREE.Vector3(-0.17, 0.004, 0.08),
    new THREE.Vector3(-0.22, 0.004, 0.02),
    new THREE.Vector3(-0.255, 0.006, -0.025),
  ]);
  const cable = new THREE.TubeGeometry(curve, 24, 0.0055, 6, false);
  return { caseGeo, mic, cable };
}

export function Device() {
  const fs = useFrameState();
  const geos = useMemo(buildDevice, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame(() => {
    // Why: the LED pulses with the teacher's voice — the product's heartbeat.
    const v = fs.voice;
    const lit = 1 - fs.dusk * 0.2;
    if (led.current) led.current.emissiveIntensity = (1.2 + v * 5.5) * lit;
    if (halo.current) {
      const s = 1 + v * 0.8;
      halo.current.scale.set(s, s, 1);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + v * 0.3;
    }
    if (light.current) light.current.intensity = (0.15 + v * 0.9) * (0.4 + chapterWeight(fs.p, 1, 0.9) * 0.6);
  });

  return (
    <group position={DEVICE_POS} rotation={[0, -0.35, 0]}>
      <mesh geometry={geos.caseGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Why: a ring LED reads as "listening" at a glance, even at diorama scale. */}
      <mesh position={[0.05, 0.054, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.024, 0.0045, 8, 32]} />
        <meshStandardMaterial ref={led} color={palette.pulse} emissive={palette.pulse} emissiveIntensity={2} />
      </mesh>
      <mesh ref={halo} position={[0.05, 0.0545, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.019, 24]} />
        <meshBasicMaterial color={palette.pulse} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh geometry={geos.mic} position={[-0.27, 0, -0.03]} rotation={[0, -0.6, 0]} castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} />
      </mesh>
      <mesh geometry={geos.cable}>
        <meshStandardMaterial color={palette.cable} roughness={0.6} />
      </mesh>
      <pointLight ref={light} position={[0.05, 0.12, 0]} color={palette.pulse} distance={0.9} decay={2} intensity={0.3} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Upload chunks: a short stream of audio tiles (navy chip, yellow waveform) leaves the device and
// arcs out of the nearest window. Why tiles that face the camera: a plain yellow rectangle read as a
// rendering glitch; a waveform glyph says "60 seconds of the lesson, uploading".
// ---------------------------------------------------------------------------------------------

const CHUNKS = 5;
const WAVE = [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.25];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _roll = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);

function colorize(g: THREE.BufferGeometry, hex: string, gain = 1) {
  tint(g, hex);
  const c = g.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < c.array.length; i++) (c.array as Float32Array)[i] = (c.array[i] ?? 0) * gain;
  return g;
}

function buildChunk() {
  const w = 0.15;
  const h = 0.09;
  return merge([
    colorize(rbox(w, h, 0.014, 0.022, { pos: [0, 0, 0] }, 3), palette.uniform),
    // Why gain > 1: the waveform clears the bloom threshold, so only the audio itself glows.
    ...WAVE.map((v, i) =>
      colorize(rbox(0.009, 0.055 * v + 0.008, 0.004, 0.004, { pos: [(i - (WAVE.length - 1) / 2) * 0.016, 0, 0.0085] }, 1), palette.pulse, 2.4),
    ),
  ]);
}

export function UploadChunks() {
  const fs = useFrameState();
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(buildChunk, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const win = WINDOWS[0] ?? { z: -2.55, sill: 0.95, h: 1.45 };
  const curve = useMemo(
    () =>
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(DEVICE_POS[0] + 0.05, DEVICE_POS[1] + 0.1, DEVICE_POS[2]),
        new THREE.Vector3(DEVICE_POS[0] + 0.35, DEVICE_POS[1] + 0.85, DEVICE_POS[2] + 0.05),
        new THREE.Vector3(RIGHT_X - 0.9, win.sill + win.h * 0.8, win.z + 0.05),
        new THREE.Vector3(RIGHT_X + 0.6, win.sill + win.h * 0.62, win.z),
      ),
    [win],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const w = chapterWeight(fs.p, 1, 0.75);
    m.visible = w > 0.01;
    if (!m.visible) return;
    for (let i = 0; i < CHUNKS; i++) {
      // Why: evenly spaced phases read as a steady stream of 60-second chunks.
      // Reduced motion / paused: the stream holds still (capture mode freezes time itself).
      const time = fs.still && !fs.capture ? 0.5 : fs.t;
      const u = (time * cps(0.11) + i / CHUNKS) % 1;
      curve.getPoint(u, _p);
      const appear = smooth(u / 0.1) * (1 - smooth((u - 0.86) / 0.14));
      const s = Math.max(0.0001, appear * w * (0.85 + 0.25 * smooth(u / 0.4)));
      // Face the camera, with a slight bank so the stream feels like it is flying.
      _q.copy(camera.quaternion).multiply(_roll.setFromAxisAngle(_z, -0.12 + Math.sin(u * 6 + i) * 0.06));
      _m.compose(_p, _q, _s.set(s, s, s));
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, CHUNKS]} frustumCulled={false}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}
