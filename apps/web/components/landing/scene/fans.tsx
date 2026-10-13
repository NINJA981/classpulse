'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { cylinder, merge, sphere, tint, type Vec3 } from './geo';
import { ROOM } from './layout';
import { palette } from './palette';
import { chapterWeight, hz, smooth } from './timeline';

/**
 * Indian classroom ceiling fans: canopy at the ceiling, a long downrod, a squat motor housing and
 * three long, tapered blades that droop slightly and carry a small twist.
 *
 * Motion: the real thing turns at ~300 rpm, which strobes badly at 60 fps. Instead the blades turn at
 * a calm "apparent" speed with a soft motion-blur trail behind each one, and the opaque blades fade
 * back as the trail fades in. Reduced motion / paused: stationary, crisp, no trail.
 *
 * Why fans fade out in the Play and Insight shots: those cameras look down past the ceiling plane,
 * where a fan would hang between the lens and the students. A cut-away diorama loses its ceiling.
 */

const CANOPY_Y = ROOM.height; // the invisible ceiling (top of the walls)
const ROD = 0.42;
const MOTOR_Y = CANOPY_Y - ROD - 0.06;
const BLADE_Y = MOTOR_Y - 0.03;
const HUB_R = 0.13;
const TIP_R = 0.6; // 1200 mm sweep, the standard Indian classroom fan
const BLADES = 3;
/** Apparent spin, rad/s (clockwise seen from above, as Indian fans turn). */
const SPIN = 4.2;

export const FAN_POSITIONS: Vec3[] = [
  [-1.4, 0, 1.0],
  [1.45, 0, 1.0],
];

/** One tapered, drooping, twisted blade along +x, as a thin two-sided strip. */
function bladeGeometry() {
  const segs = 14;
  const r0 = HUB_R - 0.02;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = r0 + (TIP_R - r0) * t;
    // narrow neck at the blade holder, full width by a quarter, rounded tip
    const width = 0.035 + 0.068 * smooth(t / 0.28) - 0.05 * smooth((t - 0.86) / 0.14);
    const droop = -0.035 * t * t;
    const twist = 0.2 - 0.12 * t; // pitch, leading edge up
    for (const side of [-1, 1]) {
      const half = (width / 2) * side;
      // the blade's trailing edge (side −1) is a touch straighter than the leading edge
      const z = half + (side < 0 ? 0.006 * t : 0);
      pos.push(r, droop + Math.sin(twist) * z, Math.cos(twist) * z);
    }
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildFan() {
  const body = merge([
    // canopy against the ceiling, downrod, coupling
    tint(cylinder(0.035, 0.07, 0.07, { pos: [0, CANOPY_Y - 0.035, 0] }, 20), palette.fanBody),
    tint(cylinder(0.013, 0.013, ROD, { pos: [0, CANOPY_Y - 0.07 - ROD / 2 + 0.02, 0] }, 10), palette.fanBody),
    tint(cylinder(0.028, 0.028, 0.04, { pos: [0, MOTOR_Y + 0.07, 0] }, 14), palette.fanBody),
  ]);
  const rotor = merge([
    // motor housing: top cover, the wide body with a trim band, the rounded bottom cap
    tint(cylinder(0.075, 0.115, 0.04, { pos: [0, MOTOR_Y + 0.035, 0] }, 28), palette.fanBody),
    tint(cylinder(0.122, 0.122, 0.045, { pos: [0, MOTOR_Y - 0.005, 0] }, 28), palette.fanBody),
    tint(cylinder(0.124, 0.124, 0.008, { pos: [0, MOTOR_Y - 0.03, 0] }, 28), palette.fanTrim),
    tint(sphere(0.1, { pos: [0, MOTOR_Y - 0.035, 0], scale: [1, 0.36, 1] }, 24, 10), palette.fanBody),
    // blade holders (the metal arms the blades bolt onto)
    ...Array.from({ length: BLADES }, (_, i) =>
      tint(
        cylinder(0.012, 0.012, 0.14, { pos: [Math.cos((i * Math.PI * 2) / BLADES) * 0.15, BLADE_Y, -Math.sin((i * Math.PI * 2) / BLADES) * 0.15], rot: [0, (i * Math.PI * 2) / BLADES, Math.PI / 2] }, 6),
        palette.fanTrim,
      ),
    ),
  ]);
  const one = bladeGeometry();
  const blades = mergeBlades(one);
  one.dispose();
  return { body, rotor, blades };
}

function mergeBlades(one: THREE.BufferGeometry) {
  const parts = Array.from({ length: BLADES }, (_, i) => {
    const g = one.clone();
    g.rotateY((i * Math.PI * 2) / BLADES);
    g.translate(0, BLADE_Y, 0);
    return g;
  });
  return merge(parts);
}

// The blur trail: a disc whose alpha is a short smear behind each blade (the disc turns with them).
const trailVertex = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHub;
  uniform float uTip;
  varying vec2 vXZ;
  const float TAU = 6.2831853;
  void main() {
    float r = length(vXZ);
    float radial = smoothstep(uHub, uHub + 0.12, r) * (1.0 - smoothstep(uTip - 0.05, uTip + 0.01, r));
    // Blades sit at 0, 120 and 240 degrees of atan(-z, x) and sweep clockwise seen from above
    // (towards smaller angles), so the smear trails at larger angles.
    float a = atan(-vXZ.y, vXZ.x);
    float d = mod(a, TAU / 3.0); // angle behind the nearest blade
    float trail = exp(-d / 0.55) * smoothstep(0.0, 0.05, d);
    gl_FragColor = vec4(uColor, uOpacity * radial * trail * (0.55 + 0.45 * r / uTip));
  }
`;

export function Fans() {
  const fs = useFrameState();
  const camera = useThree((s) => s.camera);
  const geos = useMemo(buildFan, []);
  const trailGeo = useMemo(() => new THREE.RingGeometry(HUB_R, TIP_R + 0.02, 48, 1).rotateX(-Math.PI / 2).translate(0, BLADE_Y - 0.004, 0), []);
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, transparent: true }),
      blade: new THREE.MeshStandardMaterial({ color: palette.fanBlade, roughness: 0.55, side: THREE.DoubleSide, transparent: true }),
      trail: new THREE.ShaderMaterial({
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        uniforms: {
          uColor: { value: new THREE.Color(palette.fanBlade) },
          uOpacity: { value: 0 },
          uHub: { value: HUB_R },
          uTip: { value: TIP_R },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
      trailGeo.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geos, trailGeo, mats],
  );

  const spinners = useRef<(THREE.Group | null)[]>([]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const bladeMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const angle = useRef(0);
  const world = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    // Paused / reduced motion: stationary and crisp. Capture: a frozen frame of a turning fan.
    const spinning = !fs.still || fs.capture;
    // Clip capture: the angle follows time exactly, so the loop closes on whole turns.
    if (fs.clip) angle.current = -hz(SPIN) * fs.t;
    else if (!fs.still) angle.current -= SPIN * fs.dt;
    const blur = spinning ? 1 : 0;

    // Cut away in the downward-looking Play and Insight shots.
    const show = 1 - Math.max(chapterWeight(fs.p, 4, 0.75), chapterWeight(fs.p, 5, 0.75));

    groups.current.forEach((g, i) => {
      if (!g) return;
      const pos = FAN_POSITIONS[i];
      if (!pos) return;
      // …and never let a fan hang right in front of the lens.
      world.set(pos[0], BLADE_Y, pos[2]);
      const near = smooth((camera.position.distanceTo(world) - 1.2) / 1.0);
      const o = show * near;
      g.visible = o > 0.01;
      g.userData.opacity = o;
      const spin = spinners.current[i];
      if (spin) spin.rotation.y = angle.current + i * 0.9;
      const blades = bladeMeshes.current[i];
      // Why: a crisp blade shadow from a blurred, spinning fan would read as frozen.
      if (blades) blades.castShadow = !spinning;
    });
    const o = Math.max(...groups.current.map((g) => (g?.userData.opacity as number | undefined) ?? 0));
    mats.body.opacity = o;
    mats.body.depthWrite = o > 0.98;
    mats.blade.opacity = o * (1 - 0.5 * blur);
    mats.blade.depthWrite = o > 0.98 && blur === 0;
    mats.trail.uniforms.uOpacity!.value = o * 0.45 * blur;
  });

  return (
    <>
      {FAN_POSITIONS.map((p, i) => (
        <group
          key={i}
          position={p}
          ref={(g) => {
            groups.current[i] = g;
          }}
        >
          <mesh geometry={geos.body} material={mats.body} castShadow />
          <group
            ref={(g) => {
              spinners.current[i] = g;
            }}
          >
            <mesh geometry={geos.rotor} material={mats.body} castShadow />
            <mesh
              geometry={geos.blades}
              material={mats.blade}
              ref={(m) => {
                bladeMeshes.current[i] = m;
              }}
            />
            <mesh geometry={trailGeo} material={mats.trail} renderOrder={2} />
          </group>
        </group>
      ))}
    </>
  );
}
