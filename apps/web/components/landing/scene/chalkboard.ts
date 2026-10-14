/**
 * The chalkboard is a CanvasTexture. Lesson notes are always there; in chapter 5 "Re-teach: light
 * reaction" is written in with a stroke-reveal tied to progress; at dusk (finale) the board is wiped
 * clean. Why blank: the DOM finale writes "Book a demo" in chalk over this board in its poster, so the
 * scene must not write it too.
 * Why a 2D canvas: crisp handwriting at any distance, no font atlas/worker (CSP-safe), and the
 * reveal is just a clipped redraw.
 */
import * as THREE from 'three';
import { DEMO_QUESTION } from '../story/chapters';
import { palette } from './palette';
import { mulberry32 } from './timeline';

const CHALK_FONT = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Neue", "Comic Sans MS", cursive';

interface Stroke {
  layer: HTMLCanvasElement;
  /** Horizontal extent the reveal sweeps across. */
  x0: number;
  x1: number;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { c, ctx };
}

/** Knocks tiny holes out of chalk strokes so they read as chalk, not vector text. */
function chalkGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, density = 1) {
  const rand = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const dots = Math.floor(w * h * 0.0045 * density);
  for (let i = 0; i < dots; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.4 + rand() * 1.5;
    ctx.fillRect(x, y, r * 2.2, r);
  }
  ctx.restore();
}

export class ChalkboardWriter {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly w: number;
  private readonly h: number;
  private readonly s: number;
  private base!: HTMLCanvasElement;
  private lesson!: HTMLCanvasElement;
  private finale!: HTMLCanvasElement;
  private strokes: Stroke[] = [];
  private scratch: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  private lastKey = '';
  private tamilFamily = '"Nirmala UI", "Noto Sans Tamil", sans-serif';

  constructor(width: number, scope: Element | null) {
    this.w = width;
    this.h = Math.round(width * (1.3 / 3.7));
    this.s = width / 2048;
    const { c, ctx } = makeCanvas(this.w, this.h);
    this.canvas = c;
    this.ctx = ctx;
    this.scratch = makeCanvas(this.w, this.h);
    if (scope) {
      const fam = getComputedStyle(scope).getPropertyValue('--font-anek-tamil').trim();
      if (fam) this.tamilFamily = `${fam}, ${this.tamilFamily}`;
    }
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.build();
  }

  /** Re-render the static layers (call again once web fonts have loaded). */
  build() {
    this.base = this.drawBase();
    this.lesson = this.drawLesson();
    this.finale = this.drawFinale();
    this.strokes = this.drawReteach();
    this.lastKey = '';
  }

  async loadFonts() {
    try {
      await Promise.all([
        document.fonts.load(`48px ${CHALK_FONT}`, 'Photosynthesis'),
        document.fonts.load(`48px ${this.tamilFamily}`, 'ஒளிச்சேர்க்கை'),
      ]);
    } catch {
      // Fonts are a nicety; the system fallback still reads as chalk.
    }
    this.build();
  }

  /** reveal: 0…1 of the re-teach note; dusk: 0…1 wipe to the finale board. */
  update(reveal: number, dusk: number) {
    const r = Math.round(reveal * 90) / 90;
    const d = Math.round(dusk * 24) / 24;
    const key = `${r}|${d}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const { ctx } = this;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.base, 0, 0);
    if (d < 1) {
      ctx.globalAlpha = 1 - d;
      ctx.drawImage(this.lesson, 0, 0);
      if (r > 0) this.drawReveal(r);
    }
    if (d > 0) {
      ctx.globalAlpha = d;
      ctx.drawImage(this.base, 0, 0);
      ctx.drawImage(this.finale, 0, 0);
    }
    ctx.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }

  // Layers -------------------------------------------------------------------------------------

  private drawBase() {
    const { c, ctx } = makeCanvas(this.w, this.h);
    ctx.fillStyle = palette.board;
    ctx.fillRect(0, 0, this.w, this.h);
    // Why: old eraser swirls make the board feel used, not a flat green rectangle.
    const rand = mulberry32(7);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(220, 235, 225, ${0.018 + rand() * 0.03})`;
      ctx.lineWidth = (40 + rand() * 90) * this.s;
      ctx.beginPath();
      const x = rand() * this.w;
      const y = rand() * this.h;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + (rand() - 0.5) * 500 * this.s,
        y + (rand() - 0.5) * 200 * this.s,
        x + (rand() - 0.5) * 500 * this.s,
        y + (rand() - 0.5) * 200 * this.s,
        x + (rand() - 0.5) * 600 * this.s,
        y + (rand() - 0.5) * 120 * this.s,
      );
      ctx.stroke();
    }
    return c;
  }

  private chalkStyle(ctx: CanvasRenderingContext2D, color: string = palette.chalk) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = color === palette.chalk ? 'rgba(251, 251, 247, 0.35)' : 'rgba(253, 224, 71, 0.4)';
    ctx.shadowBlur = 6 * this.s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /** Text where digits after a letter are drawn as subscripts (CO2 → CO₂). */
  private chemistry(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
    let cx = x;
    let prevLetter = false;
    for (const ch of text) {
      const isDigit = ch >= '0' && ch <= '9';
      const sub: boolean = isDigit && prevLetter;
      ctx.font = `${Math.round(sub ? size * 0.62 : size)}px ${CHALK_FONT}`;
      ctx.fillText(ch, cx, sub ? y + size * 0.22 : y);
      cx += ctx.measureText(ch).width;
      prevLetter = /[A-Za-z)]/.test(ch) || (sub && prevLetter);
    }
    return cx;
  }

  private drawLesson() {
    const { c, ctx } = makeCanvas(this.w, this.h);
    const s = this.s;
    this.chalkStyle(ctx);
    ctx.textBaseline = 'alphabetic';

    ctx.font = `${Math.round(96 * s)}px ${CHALK_FONT}`;
    ctx.fillText('Photosynthesis', 110 * s, 170 * s);
    const tw = ctx.measureText('Photosynthesis').width;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(110 * s, 200 * s);
    ctx.quadraticCurveTo(110 * s + tw / 2, 212 * s, 110 * s + tw + 10 * s, 196 * s);
    ctx.stroke();

    ctx.font = `${Math.round(58 * s)}px ${this.tamilFamily}`;
    ctx.fillText('ஒளிச்சேர்க்கை', 116 * s, 290 * s);

    this.chemistry(ctx, '6CO2 + 6H2O  →  C6H12O6 + 6O2', 110 * s, 430 * s, 62 * s);

    ctx.font = `${Math.round(48 * s)}px ${CHALK_FONT}`;
    ctx.fillText('• happens in the chloroplast', 120 * s, 530 * s);
    ctx.fillText('• needs sunlight + water + CO2', 120 * s, 600 * s);

    // A leaf with a sun, sketched in chalk.
    const lx = 1030 * s;
    const ly = 400 * s;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(lx - 150 * s, ly + 120 * s);
    ctx.bezierCurveTo(lx - 140 * s, ly - 70 * s, lx + 90 * s, ly - 140 * s, lx + 170 * s, ly - 130 * s);
    ctx.bezierCurveTo(lx + 160 * s, ly - 20 * s, lx + 40 * s, ly + 130 * s, lx - 150 * s, ly + 120 * s);
    ctx.stroke();
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.moveTo(lx - 190 * s, ly + 160 * s);
    ctx.lineTo(lx + 150 * s, ly - 115 * s);
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.18;
      const bx = lx - 150 * s + 300 * s * t;
      const by = ly + 120 * s - 240 * s * t;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 20 * s, by - 60 * s);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 60 * s, by + 12 * s);
    }
    ctx.stroke();
    // sun
    const sx = 1340 * s;
    const sy = 150 * s;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.arc(sx, sy, 48 * s, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 66 * s, sy + Math.sin(a) * 66 * s);
      ctx.lineTo(sx + Math.cos(a) * 92 * s, sy + Math.sin(a) * 92 * s);
      ctx.stroke();
    }
    // arrow from sun to leaf
    ctx.setLineDash([16 * s, 14 * s]);
    ctx.beginPath();
    ctx.moveTo(sx - 70 * s, sy + 70 * s);
    ctx.lineTo(lx + 90 * s, ly - 150 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${Math.round(40 * s)}px ${CHALK_FONT}`;
    ctx.fillText('sunlight', sx - 290 * s, sy + 40 * s);

    chalkGrain(ctx, this.w, this.h, 11);
    return c;
  }

  private drawReteach(): Stroke[] {
    const s = this.s;
    const lines: { text: string; x: number; y: number; size: number; color: string; underline?: boolean }[] = [
      { text: 'Re-teach:', x: 1440 * s, y: 330 * s, size: 72 * s, color: palette.chalk },
      { text: DEMO_QUESTION.reteach.replace(/^Re-teach:\s*/, ''), x: 1440 * s, y: 450 * s, size: 84 * s, color: palette.chalk, underline: true },
    ];
    const out: Stroke[] = [];
    // A chalk box framing the note.
    {
      const { c, ctx } = makeCanvas(this.w, this.h);
      this.chalkStyle(ctx);
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(1400 * s, 235 * s);
      ctx.lineTo(1990 * s, 228 * s);
      ctx.stroke();
      chalkGrain(ctx, this.w, this.h, 21);
      out.push({ layer: c, x0: 1400 * s, x1: 1990 * s });
    }
    for (const [i, line] of lines.entries()) {
      const { c, ctx } = makeCanvas(this.w, this.h);
      this.chalkStyle(ctx, line.color);
      ctx.font = `${Math.round(line.size)}px ${CHALK_FONT}`;
      ctx.fillText(line.text, line.x, line.y);
      const tw = ctx.measureText(line.text).width;
      chalkGrain(ctx, this.w, this.h, 31 + i);
      out.push({ layer: c, x0: line.x, x1: line.x + tw });
      if (line.underline) {
        // Why: the one yellow chalk stroke on the board — ClassIQ's pulse marking the plan.
        const u = makeCanvas(this.w, this.h);
        this.chalkStyle(u.ctx, palette.pulse);
        u.ctx.lineWidth = 10 * s;
        u.ctx.beginPath();
        u.ctx.moveTo(line.x - 6 * s, line.y + 34 * s);
        u.ctx.quadraticCurveTo(line.x + tw / 2, line.y + 50 * s, line.x + tw + 14 * s, line.y + 26 * s);
        u.ctx.stroke();
        chalkGrain(u.ctx, this.w, this.h, 41, 0.6);
        out.push({ layer: u.c, x0: line.x - 6 * s, x1: line.x + tw + 14 * s });
      }
    }
    return out;
  }

  private drawFinale() {
    // A freshly wiped board: just a few long eraser strokes over the base.
    const { c, ctx } = makeCanvas(this.w, this.h);
    const s = this.s;
    const rand = mulberry32(51);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(220, 235, 225, ${0.025 + rand() * 0.025})`;
      ctx.lineWidth = (110 + rand() * 60) * s;
      const y = (0.15 + i * 0.12 + rand() * 0.04) * this.h;
      ctx.beginPath();
      ctx.moveTo(60 * s, y);
      ctx.bezierCurveTo(this.w * 0.3, y - 30 * s, this.w * 0.6, y + 30 * s, this.w - 60 * s, y - 10 * s);
      ctx.stroke();
    }
    return c;
  }

  private drawReveal(r: number) {
    // Strokes are written one after another; each gets a share proportional to its length.
    const total = this.strokes.reduce((a, st) => a + (st.x1 - st.x0), 0);
    let remaining = r * total;
    const { c: sc, ctx: sctx } = this.scratch;
    const edge = 40 * this.s;
    for (const st of this.strokes) {
      const len = st.x1 - st.x0;
      if (remaining <= 0) break;
      const head = st.x0 + Math.min(len, remaining) + (remaining >= len ? edge : 0);
      remaining -= len;
      sctx.globalCompositeOperation = 'source-over';
      sctx.clearRect(0, 0, this.w, this.h);
      sctx.drawImage(st.layer, 0, 0);
      // Soft leading edge, like the chalk tip still moving.
      sctx.globalCompositeOperation = 'destination-in';
      const g = sctx.createLinearGradient(head - edge, 0, head, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, this.w, this.h);
      sctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(sc, 0, 0);
    }
  }
}
