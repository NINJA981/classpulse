'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { RIGHT_X, SUN_DIR, TEACHER_HEAD, WINDOWS } from './layout';
import { palette } from './palette';
import { sunColor } from './sun';
import { chapterWeight, cps, hz, mulberry32 } from './timeline';

/** The morning sun, only for placing the motes' anchors; the shader moves them with the sun. */
const SUN = new THREE.Vector3(...SUN_DIR).normalize();
const SHAFT_LENGTH = 3.6;

// ---------------------------------------------------------------------------------------------
// Sun shafts: open prisms extruded from each window along the sun direction, additive, fading
// along their length and soft at the edges. Why: fake volumetrics cost one draw call.
// The extrusion happens in the vertex shader, so the shafts follow the sun across the lesson.
// ---------------------------------------------------------------------------------------------

function buildShafts() {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const x = RIGHT_X + 0.02;
  for (const w of WINDOWS) {
    const z0 = w.z - w.w / 2 + 0.04;
    const z1 = w.z + w.w / 2 - 0.04;
    const y0 = w.sill + 0.03;
    const y1 = w.sill + w.h - 0.03;
    const corners: [number, number][] = [
      [z0, y0],
      [z1, y0],
      [z1, y1],
      [z0, y1],
    ];
    for (let e = 0; e < 4; e++) {
      const a = corners[e];
      const b = corners[(e + 1) % 4];
      if (!a || !b) continue;
      const base = pos.length / 3;
      for (const [cz, cy, along, across] of [
        [a[0], a[1], 0, 0],
        [b[0], b[1], 0, 1],
        [a[0], a[1], 1, 0],
        [b[0], b[1], 1, 1],
      ] as const) {
        pos.push(x, cy, cz);
        uv.push(across, along);
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const shaftVertex = /* glsl */ `
  uniform vec3 uSun;
  uniform float uLength;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position + uSun * (uv.y * uLength);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const shaftFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float along = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.06, vUv.y);
    float across = smoothstep(0.0, 0.5, vUv.x) * (1.0 - smoothstep(0.5, 1.0, vUv.x));
    float a = uOpacity * along * across;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export function SunShafts() {
  const fs = useFrameState();
  const geo = useMemo(buildShafts, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color() },
          uOpacity: { value: 0.16 },
          uSun: { value: new THREE.Vector3() },
          uLength: { value: SHAFT_LENGTH },
        },
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  useFrame(() => {
    const u = mat.uniforms;
    if (u.uOpacity) u.uOpacity.value = 0.16 * (1 - fs.dusk);
    (u.uSun?.value as THREE.Vector3 | undefined)?.copy(fs.sun);
    if (u.uColor) sunColor(fs.p, u.uColor.value as THREE.Color);
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />;
}

// ---------------------------------------------------------------------------------------------
// Dust motes drifting in the light. Positions live on the GPU; time is a uniform.
// ---------------------------------------------------------------------------------------------

// position = a point in a window opening; aLen = how far into the room along the sun it floats.
const moteVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uSun;
  uniform vec4 uRate;
  uniform float uFall;
  attribute float aSeed;
  attribute float aLen;
  varying float vAlpha;
  void main() {
    vec3 p = position + uSun * aLen;
    p.y = max(0.1, p.y);
    float s = aSeed * 6.2831;
    p.x += sin(uTime * uRate.x + s) * 0.12;
    p.y += sin(uTime * uRate.y + s * 1.7) * 0.1 - mod(uTime * uFall + aSeed, 1.0) * 0.15;
    p.z += cos(uTime * uRate.z + s * 1.3) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aSeed * 0.8) / -mv.z;
    vAlpha = 0.5 + 0.5 * sin(uTime * uRate.w + s * 3.0);
  }
`;
const moteFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * uOpacity * vAlpha;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export function DustMotes() {
  const fs = useFrameState();
  const count = fs.tier === 'high' ? 220 : 80;
  const geo = useMemo(() => {
    const rand = mulberry32(12);
    const pos = new Float32Array(count * 3);
    const len = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const w = WINDOWS[i % WINDOWS.length];
      if (!w) continue;
      const l = rand() * SHAFT_LENGTH * 0.8;
      const z = w.z + (rand() - 0.5) * w.w;
      const y = w.sill + rand() * w.h;
      // Keep the anchor high enough that the morning mote still floats above the floor.
      pos[i * 3] = RIGHT_X;
      pos[i * 3 + 1] = Math.max(0.1 - SUN.y * l, y);
      pos[i * 3 + 2] = z;
      len[i] = l;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 26 },
          uColor: { value: new THREE.Color() },
          uOpacity: { value: 0.9 },
          uSun: { value: new THREE.Vector3() },
          uRate: { value: new THREE.Vector4() },
          uFall: { value: 0 },
        },
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  useFrame((state) => {
    const u = mat.uniforms;
    if (u.uTime && !fs.still) u.uTime.value = fs.t;
    if (u.uOpacity) u.uOpacity.value = 0.9 * (1 - fs.dusk);
    (u.uSun?.value as THREE.Vector3 | undefined)?.copy(fs.sun);
    if (u.uColor) sunColor(fs.p, u.uColor.value as THREE.Color);
    // Loop mode (clip capture) rounds these to whole cycles; otherwise they are the plain rates.
    (u.uRate?.value as THREE.Vector4 | undefined)?.set(hz(0.21), hz(0.17), hz(0.19), hz(0.8));
    if (u.uFall) u.uFall.value = cps(0.02);
    if (u.uSize) u.uSize.value = 26 * state.viewport.dpr;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />;
}

// ---------------------------------------------------------------------------------------------
// Sound rings: thin yellow ripples spreading from the teacher's voice (chapters 0–1).
// ---------------------------------------------------------------------------------------------

const RINGS = 4;

export function SoundRings() {
  const fs = useFrameState();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(() => new THREE.TorusGeometry(1, 0.011, 4, 96), []);
  const mats = useMemo(
    () =>
      Array.from(
        { length: RINGS },
        () =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.pulse).multiplyScalar(2.6),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [],
  );
  useEffect(() => () => {
    geo.dispose();
    mats.forEach((m) => m.dispose());
  }, [geo, mats]);

  useFrame(() => {
    const w = chapterWeight(fs.p, 0, 0.75);
    const time = fs.still && !fs.capture ? 1.3 : fs.t;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = w > 0.01;
      const u = (time * cps(0.32) + i / RINGS) % 1;
      const r = 0.25 + u * 2.7;
      m.scale.set(r, r, 1 + u * 2);
      const mat = mats[i];
      if (mat) mat.opacity = w * Math.pow(1 - u, 1.6) * Math.min(1, u * 8) * (0.6 + fs.voice * 0.4);
    });
  });

  return (
    <group position={TEACHER_HEAD}>
      {mats.map((mat, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={geo}
          material={mat}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={4}
        />
      ))}
    </group>
  );
}
