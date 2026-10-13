'use client';
import { Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrameState } from './frame-state';
import { palette } from './palette';
import { sunColor, sunIntensity } from './sun';
import { backdropTexture } from './textures';

const SUN_TARGET = new THREE.Vector3(0.3, 0, 0);
const SUN_DISTANCE = 16;

/**
 * Shadow-map refreshes per second while the room is in motion. Why: the room itself never moves, only
 * the people (small, slow idle motion) and the sun (with the scroll). Re-rendering the shadow map every
 * frame cost the most of any pass on a weak GPU; at 10–15 Hz the difference cannot be seen.
 */
const SHADOW_HZ = { high: 15, low: 10 } as const;

/**
 * Morning: a warm low sun through the barred windows (the only hard light), a soft sky fill and
 * Lightformer reflections. The sun moves and warms across the lesson (sun.ts). Dusk (finale): the sun
 * drops away, tube lights take over with warm fill.
 *
 * The shadow map is cached: it re-renders when the sun moves (the story's progress changed), at
 * SHADOW_HZ while people move, and never while the room is still (paused / reduced motion).
 */
export function Lighting() {
  const fs = useFrameState();
  const scene = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const hemiDay = useMemo(() => new THREE.Color(palette.ambientMorning), []);
  const hemiDusk = useMemo(() => new THREE.Color(palette.duskInterior), []);
  const groundDay = useMemo(() => new THREE.Color(palette.hemiGround), []);
  const groundDusk = useMemo(() => new THREE.Color(palette.duskGround), []);
  const backdrop = useMemo(() => ({ day: backdropTexture(false), dusk: backdropTexture(true) }), []);
  useEffect(() => () => {
    backdrop.day.dispose();
    backdrop.dusk.dispose();
  }, [backdrop]);

  useLayoutEffect(() => {
    const s = sun.current;
    if (!s) return;
    s.target.position.copy(SUN_TARGET);
    s.target.updateMatrixWorld();
    s.shadow.autoUpdate = false;
    s.shadow.needsUpdate = true;
    scene.background = backdrop.day;
  }, [scene, backdrop]);

  const sunStart = useMemo(() => fs.sun.clone().multiplyScalar(-SUN_DISTANCE).add(SUN_TARGET), [fs]);
  const shadowClock = useRef({ at: -Infinity, p: NaN });
  useFrame((state) => {
    const d = fs.dusk;
    const s = sun.current;
    if (s) {
      s.intensity = sunIntensity(fs.p) * (1 - d);
      sunColor(fs.p, s.color);
      const c = shadowClock.current;
      const now = state.clock.elapsedTime;
      // Capture renders every frame exactly; live, the sun only moves with the scroll.
      const sunMoved = fs.p !== c.p;
      const peopleDue = !fs.still && now - c.at >= 1 / SHADOW_HZ[fs.tier];
      if (sunMoved || peopleDue || fs.capture) {
        s.position.copy(fs.sun).multiplyScalar(-SUN_DISTANCE).add(SUN_TARGET);
        s.shadow.needsUpdate = true;
        c.at = now;
        c.p = fs.p;
      }
    }
    if (hemi.current) hemi.current.intensity = 0.85 + d * 0.55;
    // Why: dusk warmth comes from the hemisphere fill, not extra point lights — every light
    // costs every pixel, even at zero intensity, and weak GPUs feel it.
    if (hemi.current) {
      hemi.current.color.copy(hemiDay).lerp(hemiDusk, d);
      hemi.current.groundColor.copy(groundDay).lerp(groundDusk, d);
    }
    // The finale is a capture-only state, so a hard swap of the backdrop is fine.
    scene.background = d > 0.5 ? backdrop.dusk : backdrop.day;
    scene.environmentIntensity = 1.0 - d * 0.6;
  });

  // Why 1024² on the low tier: the map's memory (a 2048² depth map is 16 MB) comes out of system RAM on
  // integrated GPUs, which is what ran out on a Radeon 610M. The posters are captured on the high tier.
  return (
    <>
      <directionalLight
        ref={sun}
        position={sunStart}
        color={palette.sun}
        intensity={3.6}
        castShadow
        shadow-mapSize={fs.tier === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={fs.tier === 'high' ? 5 : 3}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={4}
        shadow-camera-far={30}
      />
      <hemisphereLight ref={hemi} color={palette.ambientMorning} groundColor={palette.hemiGround} intensity={0.55} />
      {/* Why: Lightformers give soft, warm reflections and fill with zero network requests. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#FFE6C2" position={[8, 4, 0]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#EAF3EE" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#F6F1E6" position={[-6, 3, 8]} rotation-y={Math.PI / 4} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={0.35} color="#C9B79C" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
      </Environment>
    </>
  );
}
