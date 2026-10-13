import clsx from 'clsx';
import type { ReactNode } from 'react';
import { CODEMIX_TRANSLATION, DEMO_QUESTION } from './chapters';

/**
 * The stage before (or instead of) the 3D room: a chalkboard with the teacher's notes for each chapter,
 * drawn in chalk. The yellow pulse marks only what ClassPulse adds. Decorative — captions carry the content.
 */
export function StoryFallback({ active }: { active: number }) {
  return (
    <div aria-hidden className="absolute inset-0 bg-board">
      <BoardSurface />
      <div className="absolute inset-x-5 top-[17svh] h-[36svh] sm:inset-x-10 md:top-[13%] md:right-[9%] md:bottom-[16%] md:left-[44%] md:h-auto">
        <svg viewBox="0 0 800 520" className="size-full overflow-visible" preserveAspectRatio="xMidYMin meet">
          <defs>
            <filter id="cp-chalk" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <g filter="url(#cp-chalk)" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Panel show={active === 0}>
              <Hero />
            </Panel>
            <Panel show={active === 1}>
              <Record />
            </Panel>
            <Panel show={active === 2}>
              <Understand />
            </Panel>
            <Panel show={active === 3}>
              <Quiz />
            </Panel>
            <Panel show={active === 4}>
              <Play />
            </Panel>
            <Panel show={active === 5}>
              <Insight />
            </Panel>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Panel({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <g className={clsx('transition-opacity duration-500 ease-snap', show ? 'opacity-100' : 'opacity-0')}>{children}</g>
  );
}

/** Painted board: soft light falloff, eraser smudges and a fine grain. */
function BoardSurface() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(110% 80% at 72% 28%, var(--cp-board-2), transparent 70%),' +
            'radial-gradient(70% 55% at 12% 100%, color-mix(in oklab, var(--cp-uniform) 30%, transparent), transparent 70%)',
        }}
      />
      <svg className="absolute inset-0 size-full opacity-[0.06]" preserveAspectRatio="none" viewBox="0 0 1600 1000">
        <filter id="cp-smudge">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <g filter="url(#cp-smudge)" stroke="var(--cp-chalk)" strokeWidth="70" fill="none" strokeLinecap="round">
          <path d="M760 210 C 980 120, 1260 160, 1480 240" />
          <path d="M820 420 C 1050 380, 1250 460, 1520 400" />
          <path d="M700 700 C 930 640, 1180 720, 1420 660" />
        </g>
      </svg>
      <svg className="absolute inset-0 size-full opacity-[0.09] mix-blend-soft-light" preserveAspectRatio="none">
        <filter id="cp-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.2 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cp-grain)" />
      </svg>
    </>
  );
}

const chalk = 'var(--cp-chalk)';
const chalkDim = 'var(--cp-chalk-dim)';
const pulse = 'var(--cp-pulse)';
const display = { fontFamily: 'var(--cp-font-display)' };
const indic = { fontFamily: 'var(--cp-font-indic)' };
const mono = { fontFamily: 'var(--cp-font-mono)' };

function Hero() {
  return (
    <>
      <text x="40" y="70" fill={chalk} fontSize="46" fontWeight="600" style={display}>
        Photosynthesis
      </text>
      <path d="M40 92 C 140 86, 260 98, 372 88" stroke={chalk} strokeWidth="3" />
      <text x="40" y="132" fill={chalkDim} fontSize="22" style={display}>
        Class 8B science
      </text>
      <polyline
        points="300,300 443,300 503,194 578,383 638,259 683,300 800,300"
        stroke={pulse}
        strokeWidth="11"
      />
    </>
  );
}

function Record() {
  const bars = Array.from({ length: 30 }, (_, i) => {
    const h = 18 + Math.abs(Math.sin(i * 1.7) * 62 + Math.sin(i * 0.55) * 38);
    return { x: 300 + i * 16, h: Math.round(h) };
  });
  return (
    <>
      <text x="40" y="70" fill={chalk} fontSize="40" fontWeight="600" style={display}>
        Recording
      </text>
      <text x="246" y="70" fill={pulse} fontSize="30" style={mono}>
        12:41
      </text>
      {/* the desk device */}
      <rect x="40" y="240" width="200" height="130" rx="18" stroke={chalk} strokeWidth="4" />
      <circle cx="104" cy="305" r="34" stroke={chalk} strokeWidth="4" />
      <path d="M84 293 H124 M80 305 H128 M84 317 H124" stroke={chalk} strokeWidth="3" />
      <circle cx="206" cy="270" r="8" fill={pulse} stroke="none" />
      <path d="M70 370 L56 412 M210 370 L224 412" stroke={chalk} strokeWidth="4" />
      {bars.map((b, i) => (
        <line
          key={b.x}
          x1={b.x}
          x2={b.x}
          y1={305 - b.h / 2}
          y2={305 + b.h / 2}
          stroke={i > 21 ? pulse : chalk}
          strokeWidth="6"
        />
      ))}
    </>
  );
}

function Understand() {
  return (
    <>
      <text x="40" y="60" fill={chalkDim} fontSize="22" style={display}>
        Heard at{' '}
        <tspan fill={pulse} style={mono}>
          {DEMO_QUESTION.timestamp}
        </tspan>
      </text>
      <g fontSize="48" style={indic} fill={chalk} stroke="none">
        <text x="40" y="150">
          <tspan fill={pulse}>Photosynthesis</tspan>
          <tspan lang="ta">-ல</tspan>
        </text>
        <text x="40" y="232">
          <tspan fill={pulse}>chlorophyll</tspan>
          <tspan lang="ta"> தான் </tspan>
          <tspan fill={pulse}>sunlight</tspan>
          <tspan lang="ta">-ஐ</tspan>
        </text>
        <text x="40" y="314">
          <tspan fill={pulse}>absorb</tspan>
          <tspan lang="ta"> பண்ணுது.</tspan>
        </text>
      </g>
      <path d="M40 350 C 240 344, 460 356, 700 346" stroke={chalkDim} strokeWidth="2.5" />
      <text x="40" y="396" fill={chalkDim} fontSize="22" style={display}>
        {CODEMIX_TRANSLATION}
      </text>
    </>
  );
}

function Quiz() {
  const boxes = [
    { x: 40, y: 190 },
    { x: 420, y: 190 },
    { x: 40, y: 306 },
    { x: 420, y: 306 },
  ];
  return (
    <>
      <rect x="40" y="36" width="104" height="40" rx="6" stroke={pulse} strokeWidth="3" />
      <text x="56" y="65" fill={pulse} fontSize="24" style={mono}>
        {DEMO_QUESTION.timestamp}
      </text>
      <text x="40" y="148" fill={chalk} fontSize="34" fontWeight="600" style={display}>
        {DEMO_QUESTION.promptEn}
      </text>
      {boxes.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width="340" height="88" rx="8" stroke={chalk} strokeWidth="3" />
          <text x={b.x + 24} y={b.y + 56} fill={chalk} fontSize="30" style={display} stroke="none">
            {DEMO_QUESTION.options[i]}
          </text>
        </g>
      ))}
      {/* the answer, circled */}
      <path
        d="M30 236 C 24 180, 140 172, 300 176 C 400 180, 396 290, 300 292 C 180 296, 30 300, 34 226"
        stroke={pulse}
        strokeWidth="4"
      />
      <path d="M40 444 l 12 14 l 26 -32" stroke={chalk} strokeWidth="4" />
      <text x="92" y="456" fill={chalkDim} fontSize="22" style={display}>
        Approved by the teacher
      </text>
    </>
  );
}

function Play() {
  const phones = [0, 1, 2, 3, 4].map((i) => ({ x: 40 + i * 150, y: i % 2 ? 196 : 160 }));
  return (
    <>
      <text x="40" y="70" fill={chalk} fontSize="40" fontWeight="600" style={display}>
        Live round
      </text>
      <text x="262" y="70" fill={pulse} fontSize="30" style={mono}>
        00:20
      </text>
      {phones.map((p) => (
        <g key={p.x}>
          <rect x={p.x} y={p.y} width="116" height="214" rx="18" stroke={chalk} strokeWidth="4" />
          <rect x={p.x + 10} y={p.y + 22} width="96" height="170" rx="8" fill={pulse} stroke="none" opacity="0.92" />
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              x={p.x + 20}
              y={p.y + 88 + k * 24}
              width="76"
              height="14"
              rx="3"
              fill="var(--cp-board)"
              stroke="none"
            />
          ))}
          <rect x={p.x + 20} y={p.y + 40} width="56" height="10" rx="3" fill="var(--cp-board)" stroke="none" />
        </g>
      ))}
    </>
  );
}

function Insight() {
  const heights = [250, 214, 286, 104, 232, 268];
  const base = 420;
  return (
    <>
      <path d={`M40 ${base} H760`} stroke={chalk} strokeWidth="3" />
      {heights.map((h, i) => {
        const x = 70 + i * 116;
        const flagged = i === 3;
        return (
          <g key={i}>
            <rect
              x={x}
              y={base - h}
              width="72"
              height={h}
              rx="3"
              stroke={flagged ? pulse : chalk}
              strokeWidth={flagged ? 5 : 3}
            />
            {!flagged ? (
              <path d={`M${x + 10} ${base - h + 30} l 52 -18 M${x + 10} ${base - h + 64} l 52 -18`} stroke={chalkDim} strokeWidth="2" />
            ) : null}
            <text x={x + 18} y={base + 40} fill={chalkDim} fontSize="22" style={mono} stroke="none">
              Q{i + 1}
            </text>
          </g>
        );
      })}
      <path d="M454 300 C 450 230, 458 160, 454 104" stroke={pulse} strokeWidth="4" />
      <path d="M440 120 L 454 102 L 468 120" stroke={pulse} strokeWidth="4" />
      <text x="436" y="96" textAnchor="end" fill={pulse} fontSize="27" fontWeight="600" style={display} stroke="none">
        {DEMO_QUESTION.reteach}
      </text>
    </>
  );
}
