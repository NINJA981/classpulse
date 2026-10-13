/**
 * World layout of the classroom, in metres-ish units. Floor at y = 0, the board on the back wall
 * (−z), barred windows on the right wall (+x); the front and left sides are cut away like a
 * dollhouse so the camera can look in.
 */
import { mulberry32 } from './timeline';

export const ROOM = {
  width: 9,
  depth: 8.4,
  height: 3.3,
  wall: 0.22,
  lowerBand: 1.15,
  slab: 0.42,
} as const;

export const HALF_W = ROOM.width / 2;
export const HALF_D = ROOM.depth / 2;
export const BACK_Z = -HALF_D;
export const RIGHT_X = HALF_W;

export const BOARD = { x: -0.4, y: 1.72, z: BACK_Z + 0.04, w: 3.7, h: 1.3 } as const;

export const WINDOWS = [-2.55, 0, 2.55].map((z) => ({ z, w: 1.25, h: 1.45, sill: 0.95 }));

/** Direction the sunlight travels (from outside the right wall, down into the room). */
export const SUN_DIR: [number, number, number] = [-0.62, -0.6, -0.18];

export const TEACHER_POS: [number, number, number] = [-1.15, 0, -3.25];
/** World position of the teacher's head, for sound rings and rising words. */
export const TEACHER_HEAD: [number, number, number] = [TEACHER_POS[0], 1.3, TEACHER_POS[2]];
export const TEACHER_DESK = { x: 2.35, z: -3.05, w: 1.5, d: 0.72, h: 0.78 } as const;
export const DEVICE_POS: [number, number, number] = [2.0, TEACHER_DESK.h, -2.88];

export const BENCH = {
  width: 1.12,
  deskDepth: 0.4,
  deskHeight: 0.74,
  seatHeight: 0.44,
  seatDepth: 0.3,
  gap: 0.44,
} as const;

const COLUMNS = [-2.75, 0, 2.75];
const ROWS = [-1.15, 0.05, 1.25, 2.45];

export interface BenchSpot {
  x: number;
  /** z of the seat centre; the desk is in front of it (towards −z). */
  z: number;
  row: number;
  column: number;
}

export const BENCHES: BenchSpot[] = ROWS.flatMap((z, row) => COLUMNS.map((x, column) => ({ x, z, row, column })));

export type StudentKind = 'boy' | 'girl';

export interface StudentSpec {
  index: number;
  bench: number;
  x: number;
  z: number;
  kind: StudentKind;
  skin: number;
  hair: number;
  /** 0 … 1, how well this student understood the lesson (chapter 5). */
  mastery: number;
  /** Raises a hand during the live round (chapter 4). */
  raisesHand: boolean;
  phase: number;
}

/**
 * Seats two students per bench. Indian schools usually seat boys and girls on separate benches,
 * so the kind alternates per bench rather than per seat.
 */
export function buildStudents(count: number): StudentSpec[] {
  const rand = mulberry32(42);
  const out: StudentSpec[] = [];
  // Benches fill front to back, so a smaller count still leaves the camera framings populated.
  const order = BENCHES.map((_, i) => i);
  for (const b of order) {
    const bench = BENCHES[b];
    if (!bench) continue;
    const kind: StudentKind = (bench.row + bench.column) % 2 === 0 ? 'girl' : 'boy';
    for (const side of [-1, 1]) {
      if (out.length >= count) break;
      const skillBias = bench.column === 2 && bench.row >= 2 ? -0.35 : 0;
      out.push({
        index: out.length,
        bench: b,
        x: bench.x + side * 0.28,
        z: bench.z,
        kind,
        skin: Math.floor(rand() * 8),
        hair: Math.floor(rand() * 5),
        mastery: Math.min(1, Math.max(0, 0.35 + rand() * 0.75 + skillBias)),
        raisesHand: rand() > 0.55,
        phase: rand() * 100,
      });
    }
  }
  return out;
}
