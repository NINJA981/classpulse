import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// TODO(landing): once POSTERS.available is true (components/landing/assets.ts), consider using the hero
// poster (POSTERS.chapter(0, 'wide')) as a dimmed background behind the headline. Satori needs it as a
// data URL or absolute URL — read the .webp from public/ and convert, or render a PNG copy of it.

export const alt = 'ClassPulse: every lecture, turned into learning. For Indian schools.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHALKBOARD = '#22382F';
const CHALK = '#F4F1E8';
const PULSE = '#FDE047';

// Bricolage Grotesque ExtraBold (SIL OFL 1.1, see assets/fonts/OFL.txt). Static TTF: satori can't pick a
// weight out of a variable font. Read at build time, when this image is prerendered.
const bricolage = await readFile(join(process.cwd(), 'assets/fonts/BricolageGrotesque-ExtraBold.ttf'));

// The pulse from public/icons/icon.svg (512×512 box): flat, up, down, up, flat.
const ICON_PULSE = '92.16,286.72 189.44,286.72 230.4,168.96 281.6,378.88 322.56,240.64 353.28,286.72 419.84,286.72';

// The same beat stretched across the card: the icon's spike, scaled ×0.75, starting at x=860.
const BASE = 100;
const SPIKE_X = 860;
const SPIKE = [
  [0, 0],
  [40.96, -117.76],
  [92.16, 92.16],
  [133.12, -46.08],
  [163.84, 0],
] as const;
const WIDE_PULSE = [
  `-20,${BASE}`,
  ...SPIKE.map(([dx, dy]) => `${(SPIKE_X + dx * 0.75).toFixed(2)},${(BASE + dy * 0.75).toFixed(2)}`),
  `1220,${BASE}`,
].join(' ');

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CHALKBOARD,
          backgroundImage: 'radial-gradient(circle at 18% 22%, rgba(255,255,255,0.07), rgba(0,0,0,0) 55%)',
          color: CHALK,
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 72px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <svg width="60" height="60" viewBox="0 0 512 512">
              <rect width="512" height="512" rx="112.64" fill="#111111" />
              <polyline
                points={ICON_PULSE}
                fill="none"
                stroke={PULSE}
                strokeWidth="38.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ display: 'flex', fontSize: 30, letterSpacing: -0.3, opacity: 0.85 }}>
              ClassPulse · for Indian schools
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 52,
              fontSize: 96,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            <span>Every lecture,</span>
            <span style={{ display: 'flex', marginTop: 8 }}>
              turned into&nbsp;<span style={{ color: PULSE }}>learning.</span>
            </span>
          </div>
        </div>

        <svg width="1200" height="190" viewBox="0 0 1200 190">
          <polyline
            points={WIDE_PULSE}
            fill="none"
            stroke={PULSE}
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Bricolage Grotesque', data: bricolage, style: 'normal', weight: 800 }],
    },
  );
}
