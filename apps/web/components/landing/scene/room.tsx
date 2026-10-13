'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ChalkboardWriter } from './chalkboard';
import { Fans } from './fans';
import { useFrameState } from './frame-state';
import { box, cylinder, merge, rbox, sphere, tint } from './geo';
import { BACK_Z, BOARD, HALF_D, HALF_W, RIGHT_X, ROOM, WINDOWS } from './layout';
import { palette } from './palette';
import { floorTexture, noticeTexture, posterTexture, signTexture, skyTexture } from './textures';
import { ramp } from './timeline';

// ---------------------------------------------------------------------------------------------
// Wall builder: a straight run of wall split into horizontal colour bands, with window holes.
// ---------------------------------------------------------------------------------------------

interface Hole {
  from: number;
  to: number;
  y0: number;
  y1: number;
}

type Axis = 'x' | 'z';

function wallRun(axis: Axis, from: number, to: number, plane: number, holes: Hole[]) {
  const t = ROOM.wall;
  const bands: { y0: number; y1: number; color: string; inset: number }[] = [
    { y0: 0, y1: 0.12, color: palette.skirting, inset: 0.012 },
    { y0: 0.12, y1: ROOM.lowerBand - 0.035, color: palette.wallLower, inset: 0 },
    { y0: ROOM.lowerBand - 0.035, y1: ROOM.lowerBand + 0.035, color: palette.wallStripe, inset: 0.008 },
    { y0: ROOM.lowerBand + 0.035, y1: ROOM.height, color: palette.wallUpper, inset: 0 },
  ];
  // Split bands at hole edges so each piece is either fully solid or fully open.
  const cuts = new Set<number>();
  for (const h of holes) {
    cuts.add(h.y0);
    cuts.add(h.y1);
  }
  const parts: THREE.BufferGeometry[] = [];
  for (const band of bands) {
    const ys = [band.y0, ...[...cuts].filter((y) => y > band.y0 && y < band.y1).sort((a, b) => a - b), band.y1];
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i] ?? 0;
      const y1 = ys[i + 1] ?? 0;
      const mid = (y0 + y1) / 2;
      const active = holes.filter((h) => mid > h.y0 && mid < h.y1).sort((a, b) => a.from - b.from);
      let cursor = from;
      const segments: [number, number][] = [];
      for (const h of active) {
        if (h.from > cursor) segments.push([cursor, h.from]);
        cursor = Math.max(cursor, h.to);
      }
      if (cursor < to) segments.push([cursor, to]);
      for (const [a, b] of segments) {
        const len = b - a;
        const c = (a + b) / 2;
        const depth = t + band.inset * 2;
        const geo =
          axis === 'x'
            ? box(len, y1 - y0, depth, { pos: [c, (y0 + y1) / 2, plane] })
            : box(depth, y1 - y0, len, { pos: [plane, (y0 + y1) / 2, c] });
        parts.push(tint(geo, band.color));
      }
    }
  }
  return parts;
}

function buildShell() {
  const parts: THREE.BufferGeometry[] = [];
  const t = ROOM.wall;
  const backPlane = BACK_Z - t / 2;
  const rightPlane = RIGHT_X + t / 2;

  // Plinth: the diorama base.
  parts.push(tint(box(ROOM.width + 0.9, ROOM.slab, ROOM.depth + 0.9, { pos: [0.1, -ROOM.slab / 2 - 0.02, 0] }), palette.plinthSide));
  parts.push(tint(box(ROOM.width + 0.96, 0.05, ROOM.depth + 0.96, { pos: [0.1, -0.035, 0] }), palette.plinthTop));
  parts.push(tint(box(ROOM.width + 0.7, 0.09, ROOM.depth + 0.7, { pos: [0.1, -ROOM.slab - 0.06, 0] }), palette.plinthSideDark));

  // Back wall (with the board) and right wall (with barred windows).
  parts.push(...wallRun('x', -HALF_W, HALF_W + t, backPlane, []));
  const holes: Hole[] = WINDOWS.map((w) => ({ from: w.z - w.w / 2, to: w.z + w.w / 2, y0: w.sill, y1: w.sill + w.h }));
  parts.push(...wallRun('z', BACK_Z, HALF_D, rightPlane, holes));

  // Cut caps on top of the walls — the "sliced dollhouse" edge.
  parts.push(tint(box(ROOM.width + t + 0.02, 0.05, t + 0.03, { pos: [t / 2, ROOM.height + 0.025, backPlane] }), palette.wallCap));
  parts.push(tint(box(t + 0.03, 0.05, ROOM.depth + t, { pos: [rightPlane, ROOM.height + 0.025, -t / 2] }), palette.wallCap));
  // Exposed wall ends at the cut.
  parts.push(tint(box(0.02, ROOM.height, t + 0.01, { pos: [-HALF_W - 0.01, ROOM.height / 2, backPlane] }), palette.wallCap));
  parts.push(tint(box(t + 0.01, ROOM.height, 0.02, { pos: [rightPlane, ROOM.height / 2, HALF_D + 0.01] }), palette.wallCap));

  // Windows: frame reveal, sill, iron bars.
  for (const w of WINDOWS) {
    const x = RIGHT_X + 0.02;
    const top = w.sill + w.h;
    const f = 0.07;
    parts.push(tint(box(t + 0.05, f, w.w + f * 2, { pos: [x + t / 2 - 0.02, top + f / 2, w.z] }), palette.windowFrame));
    parts.push(tint(box(t + 0.05, f, w.w + f * 2, { pos: [x + t / 2 - 0.02, w.sill - f / 2, w.z] }), palette.windowFrame));
    parts.push(tint(box(t + 0.05, w.h, f, { pos: [x + t / 2 - 0.02, w.sill + w.h / 2, w.z - w.w / 2 - f / 2] }), palette.windowFrame));
    parts.push(tint(box(t + 0.05, w.h, f, { pos: [x + t / 2 - 0.02, w.sill + w.h / 2, w.z + w.w / 2 + f / 2] }), palette.windowFrame));
    parts.push(tint(rbox(0.16, 0.05, w.w + 0.3, 0.015, { pos: [RIGHT_X - 0.05, w.sill - 0.02, w.z] }), palette.sill));
    // centre mullion + transom
    parts.push(tint(box(0.06, w.h, 0.06, { pos: [x + 0.1, w.sill + w.h / 2, w.z] }), palette.windowFrame));
    parts.push(tint(box(0.06, 0.05, w.w, { pos: [x + 0.1, w.sill + w.h * 0.72, w.z] }), palette.windowFrame));
    const bars = 7;
    for (let i = 1; i < bars; i++) {
      const z = w.z - w.w / 2 + (i / bars) * w.w;
      parts.push(tint(cylinder(0.014, 0.014, w.h, { pos: [x + 0.03, w.sill + w.h / 2, z] }, 6), palette.windowBar));
    }
    parts.push(tint(box(0.02, 0.025, w.w, { pos: [x + 0.03, w.sill + w.h * 0.33, w.z] }), palette.windowBar));
  }

  // Chalkboard frame + ledge with chalk and a duster.
  const bz = BACK_Z + 0.02;
  const fw = 0.08;
  parts.push(tint(box(BOARD.w + fw * 2, fw, 0.06, { pos: [BOARD.x, BOARD.y + BOARD.h / 2 + fw / 2, bz] }), palette.woodDark));
  parts.push(tint(box(fw, BOARD.h, 0.06, { pos: [BOARD.x - BOARD.w / 2 - fw / 2, BOARD.y, bz] }), palette.woodDark));
  parts.push(tint(box(fw, BOARD.h, 0.06, { pos: [BOARD.x + BOARD.w / 2 + fw / 2, BOARD.y, bz] }), palette.woodDark));
  parts.push(tint(box(BOARD.w + fw * 2, 0.05, 0.14, { pos: [BOARD.x, BOARD.y - BOARD.h / 2 - 0.025, bz + 0.05] }), palette.woodDark));
  for (const [i, dx] of [0.4, 0.48, 0.55, -1.2].entries()) {
    parts.push(tint(cylinder(0.012, 0.012, 0.08, { pos: [BOARD.x + dx, BOARD.y - BOARD.h / 2 + 0.012, bz + 0.07], rot: [0, i * 0.4, Math.PI / 2] }, 6), palette.chalk));
  }
  parts.push(tint(rbox(0.2, 0.05, 0.08, 0.02, { pos: [BOARD.x + 1.1, BOARD.y - BOARD.h / 2 + 0.025, bz + 0.07] }), palette.woodLight));
  parts.push(tint(box(0.2, 0.02, 0.08, { pos: [BOARD.x + 1.1, BOARD.y - BOARD.h / 2 + 0.06, bz + 0.07] }), palette.uniform));

  // Clock above the board.
  parts.push(tint(cylinder(0.19, 0.19, 0.04, { pos: [BOARD.x, 2.88, BACK_Z + 0.03], rot: [Math.PI / 2, 0, 0] }, 28), palette.clockRim));
  parts.push(tint(cylinder(0.165, 0.165, 0.045, { pos: [BOARD.x, 2.88, BACK_Z + 0.035], rot: [Math.PI / 2, 0, 0] }, 28), palette.clockFace));
  parts.push(tint(box(0.012, 0.1, 0.01, { pos: [BOARD.x + 0.02, 2.92, BACK_Z + 0.065], rot: [0, 0, -0.5] }), palette.clockRim));
  parts.push(tint(box(0.012, 0.13, 0.01, { pos: [BOARD.x - 0.035, 2.86, BACK_Z + 0.065], rot: [0, 0, 1.2] }), palette.clockRim));

  // Steel almirah in the corner.
  const ax = -3.75;
  parts.push(tint(rbox(0.95, 1.95, 0.5, 0.03, { pos: [ax, 0.975, BACK_Z + 0.3] }), '#7F918A'));
  parts.push(tint(box(0.008, 1.8, 0.01, { pos: [ax, 1.0, BACK_Z + 0.556] }), '#5E6E68'));
  parts.push(tint(box(0.02, 0.18, 0.03, { pos: [ax + 0.06, 1.05, BACK_Z + 0.565] }), palette.steel));
  parts.push(tint(box(0.02, 0.18, 0.03, { pos: [ax - 0.06, 1.05, BACK_Z + 0.565] }), palette.steel));

  // Potted plant + dustbin by the window corner.
  parts.push(tint(cylinder(0.17, 0.13, 0.32, { pos: [4.05, 0.16, 3.7] }), palette.pot));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(tint(sphere(0.16, { pos: [4.05 + Math.cos(a) * 0.12, 0.5 + (i % 3) * 0.1, 3.7 + Math.sin(a) * 0.12], scale: [0.8, 1.4, 0.8] }, 10, 8), palette.plant));
  }
  parts.push(tint(cylinder(0.15, 0.12, 0.34, { pos: [3.15, 0.17, BACK_Z + 0.35] }, 14), '#6F7F78'));

  // Tube light fixtures (the tubes themselves glow separately).
  for (const [x, z, alongZ] of TUBES) {
    parts.push(tint(rbox(alongZ ? 0.06 : 1.25, 0.06, alongZ ? 1.25 : 0.06, 0.02, { pos: [x, 2.74, z] }), palette.tubeFixture));
  }

  return merge(parts);
}

/** [x, z, runsAlongZ] for each tube light fixture. */
const TUBES: [number, number, boolean][] = [
  [-3.1, BACK_Z + 0.05, false],
  [2.4, BACK_Z + 0.05, false],
  [RIGHT_X - 0.05, -1.28, true],
  [RIGHT_X - 0.05, 1.28, true],
];

// ---------------------------------------------------------------------------------------------

function TubeLights() {
  const fs = useFrameState();
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const geo = useMemo(
    () => merge(TUBES.map(([x, z, alongZ]) => cylinder(0.022, 0.022, 1.12, { pos: [x + (alongZ ? -0.04 : 0), 2.7, z + (alongZ ? 0 : 0.045)], rot: alongZ ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2] }, 10))),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = fs.dusk * 5.5;
  });
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial ref={mat} color={palette.tubeOff} emissive={palette.tubeOn} emissiveIntensity={0} roughness={0.3} toneMapped />
    </mesh>
  );
}

function Sky() {
  const fs = useFrameState();
  const dusk = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => ({ day: skyTexture(false), night: skyTexture(true) }), []);
  useEffect(() => () => {
    tex.day.dispose();
    tex.night.dispose();
  }, [tex]);
  useFrame(() => {
    if (dusk.current) dusk.current.opacity = fs.dusk;
  });
  return (
    <group position={[RIGHT_X + 0.7, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[ROOM.depth, 2.0]} />
        <meshBasicMaterial map={tex.day} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[ROOM.depth, 2.0]} />
        <meshBasicMaterial ref={dusk} map={tex.night} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Chalkboard() {
  const fs = useFrameState();
  const gl = useThree((s) => s.gl);
  const writer = useMemo(
    () => new ChalkboardWriter(fs.tier === 'high' ? 2048 : 1024, gl.domElement.parentElement),
    [fs.tier, gl],
  );
  useEffect(() => {
    void writer.loadFonts();
    return () => writer.dispose();
  }, [writer]);
  useFrame(() => {
    writer.update(ramp(fs.p, 4.35, 5), fs.dusk);
  });
  return (
    <mesh position={[BOARD.x, BOARD.y, BOARD.z + 0.012]} receiveShadow>
      <planeGeometry args={[BOARD.w, BOARD.h]} />
      <meshStandardMaterial map={writer.texture} roughness={0.92} metalness={0} />
    </mesh>
  );
}

function Wallpapers() {
  const tex = useMemo(
    () => ({ notice: noticeTexture(), sign: signTexture('VIII – B'), plant: posterTexture('plant'), tables: posterTexture('tables') }),
    [],
  );
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  return (
    <>
      <mesh position={[2.75, 1.85, BACK_Z + 0.02]} receiveShadow>
        <boxGeometry args={[1.25, 0.8, 0.03]} />
        <meshStandardMaterial map={tex.notice} roughness={0.95} />
      </mesh>
      <mesh position={[BOARD.x - 1.15, 2.78, BACK_Z + 0.02]}>
        <boxGeometry args={[0.5, 0.19, 0.02]} />
        <meshStandardMaterial map={tex.sign} roughness={0.8} />
      </mesh>
      {/* Charts on the piers between the windows */}
      {([[-1.275, tex.plant, 0.03], [1.275, tex.tables, -0.025]] as const).map(([z, map, tilt]) => (
        <mesh key={z} position={[RIGHT_X - 0.012, 1.86, z]} rotation={[0, -Math.PI / 2, tilt]} receiveShadow>
          <planeGeometry args={[0.6, 0.79]} />
          <meshStandardMaterial map={map} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

export function Room() {
  const fs = useFrameState();
  const shell = useMemo(buildShell, []);
  const floor = useMemo(() => floorTexture(fs.tier === 'high' ? 1536 : 768), [fs.tier]);
  // Why: an invisible roof that only casts shadows, so sunlight enters through the windows as
  // shafts instead of flooding the open-topped diorama.
  const roof = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);
  useEffect(() => () => {
    shell.dispose();
    floor.dispose();
    roof.dispose();
  }, [shell, floor, roof]);

  return (
    <group>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial map={floor} roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0, ROOM.height + 0.02, 0]} castShadow material={roof}>
        <boxGeometry args={[ROOM.width + 2, 0.04, ROOM.depth + 2]} />
      </mesh>
      <Chalkboard />
      <Wallpapers />
      <Fans />
      <TubeLights />
      <Sky />
    </group>
  );
}
