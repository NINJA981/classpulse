/**
 * Tiny procedural-geometry kit: primitives placed with a transform, optionally vertex-tinted, then
 * merged. Why: static props merged per material keep the whole room at a few dozen draw calls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Vec3 = [number, number, number];

export interface Placement {
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function place<T extends THREE.BufferGeometry>(geometry: T, { pos, rot, scale }: Placement = {}): T {
  tmpEuler.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0);
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(pos?.[0] ?? 0, pos?.[1] ?? 0, pos?.[2] ?? 0);
  tmpScale.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1);
  tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
  geometry.applyMatrix4(tmpMatrix);
  return geometry;
}

/** Adds a constant per-vertex colour (hex in sRGB, stored linear) for vertexColors materials. */
export function tint<T extends THREE.BufferGeometry>(geometry: T, hex: string): T {
  const c = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = c.r;
    data[i * 3 + 1] = c.g;
    data[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geometry;
}

/** Merges geometries, normalising them to indexed position/normal/uv(/color) first. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const withColor = parts.some((g) => g.hasAttribute('color'));
  const normalised = parts.map((g) => {
    let geo = g.index ? g : g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
    }
    if (withColor && !geo.hasAttribute('color')) geo = tint(geo, '#ffffff');
    if (!geo.hasAttribute('uv')) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
    }
    return geo;
  });
  const merged = mergeGeometries(normalised, false);
  if (!merged) throw new Error('mergeGeometries failed');
  for (const g of parts) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// Primitives -----------------------------------------------------------------------------------

export const box = (w: number, h: number, d: number, p?: Placement) => place(new THREE.BoxGeometry(w, h, d), p);

export const rbox = (w: number, h: number, d: number, r: number, p?: Placement, segments = 2) =>
  place(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2)), p);

export const capsule = (radius: number, length: number, p?: Placement, cap = 4, radial = 10) =>
  place(new THREE.CapsuleGeometry(radius, length, cap, radial), p);

export const sphere = (radius: number, p?: Placement, w = 14, h = 10) =>
  place(new THREE.SphereGeometry(radius, w, h), p);

export const cylinder = (rt: number, rb: number, h: number, p?: Placement, radial = 16) =>
  place(new THREE.CylinderGeometry(rt, rb, h, radial), p);

export const torus = (r: number, tube: number, p?: Placement, arc = Math.PI * 2) =>
  place(new THREE.TorusGeometry(r, tube, 8, 24, arc), p);
