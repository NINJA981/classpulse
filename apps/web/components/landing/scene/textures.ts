/**
 * Small procedural CanvasTextures (floor tiles, sky, notice board, soft dot sprite).
 * Why: zero network requests (strict CSP) and tiny bundle cost.
 */
import * as THREE from 'three';
import { palette } from './palette';
import { mulberry32 } from './timeline';
import { HALF_D, HALF_W } from './layout';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Stone floor tiles, slightly uneven in tone, with grout lines. */
export function floorTexture(size: number) {
  const w = size;
  const h = Math.round(size * (HALF_D / HALF_W));
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = palette.floorGrout;
  ctx.fillRect(0, 0, w, h);
  const tile = w / 15;
  const rand = mulberry32(3);
  const base = new THREE.Color(palette.floorTile);
  const alt = new THREE.Color(palette.floorTileAlt);
  const col = new THREE.Color();
  for (let y = 0; y * tile < h; y++) {
    for (let x = 0; x < 15; x++) {
      col.copy(base).lerp(alt, ((x + y) % 2) * 0.6 + rand() * 0.4);
      ctx.fillStyle = `#${col.getHexString(THREE.SRGBColorSpace)}`;
      const g = Math.max(1.5, tile * 0.035);
      ctx.fillRect(x * tile + g, y * tile + g, tile - g * 2, tile - g * 2);
      // faint speckle, like terrazzo chips
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(80, 70, 60, ${0.05 + rand() * 0.07})`;
        ctx.fillRect(x * tile + rand() * tile, y * tile + rand() * tile, tile * 0.02, tile * 0.02);
      }
    }
  }
  return finish(c);
}

/** Sky seen through the windows, with a soft line of trees. */
export function skyTexture(dusk: boolean) {
  const { c, ctx } = canvas(512, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, dusk ? palette.skyDuskTop : palette.skyMorningTop);
  g.addColorStop(1, dusk ? palette.skyDuskBottom : palette.skyMorningBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  const rand = mulberry32(dusk ? 9 : 5);
  ctx.fillStyle = dusk ? palette.treeDusk : palette.treeMorning;
  ctx.globalAlpha = dusk ? 1 : 0.55;
  for (let i = 0; i < 18; i++) {
    const x = i * 30 + rand() * 20;
    const r = 26 + rand() * 30;
    ctx.beginPath();
    ctx.arc(x, 230 - rand() * 40, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(0, 225, 512, 31);
  // one coconut palm, because it is an Indian school
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(330, 256);
  ctx.quadraticCurveTo(320, 150, 345, 70);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
    ctx.beginPath();
    ctx.moveTo(345, 70);
    ctx.quadraticCurveTo(345 + Math.cos(a) * 40, 70 + Math.sin(a) * 30 - 10, 345 + Math.cos(a) * 75, 70 + Math.sin(a) * 30 + 25);
    ctx.stroke();
  }
  if (dusk) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 26; i++) ctx.fillRect(rand() * 512, rand() * 120, 1.5, 1.5);
  }
  return finish(c);
}

/** Cork notice board with pinned sheets and a timetable. */
export function noticeTexture() {
  const { c, ctx } = canvas(512, 320);
  ctx.fillStyle = palette.noticeBoard;
  ctx.fillRect(0, 0, 512, 320);
  const rand = mulberry32(17);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(60, 40, 20, ${rand() * 0.15})`;
    ctx.fillRect(rand() * 512, rand() * 320, 2, 2);
  }
  const sheets: [number, number, number, number, number][] = [
    [30, 30, 200, 260, -0.02],
    [255, 40, 110, 140, 0.04],
    [380, 30, 105, 130, -0.05],
    [260, 200, 220, 95, 0.01],
  ];
  for (const [i, [x, y, w, h, r]] of sheets.entries()) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(r);
    ctx.fillStyle = palette.notice;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(31, 42, 85, 0.45)';
    if (i === 0) {
      // timetable grid
      for (let row = 0; row < 7; row++) for (let col = 0; col < 4; col++) {
        ctx.fillRect(-w / 2 + 14 + col * 45, -h / 2 + 34 + row * 31, 36, 3);
      }
      ctx.fillRect(-w / 2 + 14, -h / 2 + 14, 120, 6);
    } else {
      for (let l = 0; l < Math.floor(h / 22); l++) ctx.fillRect(-w / 2 + 10, -h / 2 + 16 + l * 20, w - 20 - (l % 3) * 14, 3);
    }
    ctx.fillStyle = palette.redpen;
    ctx.beginPath();
    ctx.arc(0, -h / 2 + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return finish(c);
}

/** Class name plate above the board. */
export function signTexture(text: string) {
  const { c, ctx } = canvas(256, 96);
  ctx.fillStyle = palette.board2;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = palette.chalkDim;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 84);
  ctx.fillStyle = palette.chalk;
  ctx.font = '600 52px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 52);
  return finish(c);
}

/** Soft round dot for dust motes. */
export function dotTexture() {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c, false);
}

/** Soft radial backdrop behind the diorama (drawn screen-aligned by scene.background). */
export function backdropTexture(dusk: boolean) {
  const { c, ctx } = canvas(512, 512);
  const g = ctx.createRadialGradient(256, 230, 30, 256, 256, 380);
  g.addColorStop(0, dusk ? palette.backdropDuskInner : palette.backdropInner);
  g.addColorStop(1, dusk ? palette.backgroundDusk : palette.background);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return finish(c);
}

/** Classroom wall charts: a labelled plant diagram and a times-table grid. */
export function posterTexture(kind: 'plant' | 'tables') {
  const { c, ctx } = canvas(320, 420);
  ctx.fillStyle = palette.notice;
  ctx.fillRect(0, 0, 320, 420);
  ctx.strokeStyle = palette.uniform;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 304, 404);
  ctx.fillStyle = palette.uniform;
  ctx.font = '700 30px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  if (kind === 'plant') {
    ctx.fillText('Parts of a Plant', 160, 52);
    ctx.fillStyle = palette.plant;
    ctx.fillRect(156, 150, 8, 170);
    for (const [x, y, r] of [[118, 170, -0.6], [202, 200, 0.6], [120, 245, -0.5], [200, 270, 0.5]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r);
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#B9603E';
    ctx.beginPath();
    ctx.arc(160, 130, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7A5A3A';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(160, 320);
      ctx.quadraticCurveTo(160 + (i - 2.5) * 20, 350, 160 + (i - 2.5) * 34, 385);
      ctx.stroke();
    }
    ctx.fillStyle = palette.uniform;
    ctx.font = '20px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('flower', 200, 125);
    ctx.fillText('leaf', 240, 205);
    ctx.fillText('stem', 180, 305);
    ctx.fillText('root', 220, 380);
  } else {
    ctx.fillText('Tables', 160, 52);
    ctx.font = '19px Georgia, serif';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 3; col++) {
        const n = col + 2;
        ctx.fillText(`${n}×${row + 1}=${n * (row + 1)}`, 62 + col * 98, 96 + row * 32);
      }
    }
  }
  return finish(c);
}
