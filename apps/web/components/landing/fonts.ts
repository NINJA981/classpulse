import { Anek_Devanagari, Anek_Tamil, Bricolage_Grotesque } from 'next/font/google';
import localFont from 'next/font/local';

// Landing-only fonts. next/font self-hosts them (the edge CSP allows same-origin fonts only). Only Bricolage is
// preloaded; every Indian-script face downloads when its glyphs are first on screen.
export const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
  display: 'swap',
});

/*
 * Indian scripts are set in Ek Type's Anek: one variable design drawn across all ten scripts, so the page speaks
 * every language in one voice.
 *
 * Running text (Tamil codemix lines: --cp-font-indic in globals.css) and the 3D classroom's chalkboard canvas
 * (scene/chalkboard.ts reads --font-anek-tamil). Anek Tamil, weight axis only, about 51 KB for the Tamil file
 * plus 42 KB for its Latin, which the English terms in a codemix line use. Devanagari is there
 * for any Hindi line and costs nothing until one renders.
 */
export const anekTamil = Anek_Tamil({
  variable: '--font-anek-tamil',
  subsets: ['tamil'],
  display: 'swap',
  preload: false,
});
export const anekDeva = Anek_Devanagari({
  variable: '--font-anek-deva',
  subsets: ['devanagari'],
  display: 'swap',
  preload: false,
});

/*
 * The language wall (language-wall.tsx). Its ten Indian words breathe along Anek's width axis, and the full
 * width-and-weight Anek files are 200–730 KB per script (3.1 MB for the wall). So each script ships as a subset
 * of just the letters of its word(s): width axis 75–125 kept, weight fixed at 600 (font-semibold). About 43 KB
 * for all ten words. wall-fonts/subset.py builds them and checks each one shapes exactly like the full font;
 * re-run it after changing a word. (Anek is under the SIL Open Font License, which allows subsetting.)
 */
export const wallTamil = localFont({
  src: './wall-fonts/anek-tamil-wall.woff2',
  variable: '--font-wall-tamil',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallDeva = localFont({
  src: './wall-fonts/anek-devanagari-wall.woff2',
  variable: '--font-wall-deva',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallKannada = localFont({
  src: './wall-fonts/anek-kannada-wall.woff2',
  variable: '--font-wall-kannada',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallTelugu = localFont({
  src: './wall-fonts/anek-telugu-wall.woff2',
  variable: '--font-wall-telugu',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallGurmukhi = localFont({
  src: './wall-fonts/anek-gurmukhi-wall.woff2',
  variable: '--font-wall-gurmukhi',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallBangla = localFont({
  src: './wall-fonts/anek-bangla-wall.woff2',
  variable: '--font-wall-bangla',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallMalayalam = localFont({
  src: './wall-fonts/anek-malayalam-wall.woff2',
  variable: '--font-wall-malayalam',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallOdia = localFont({
  src: './wall-fonts/anek-odia-wall.woff2',
  variable: '--font-wall-odia',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});
export const wallGujarati = localFont({
  src: './wall-fonts/anek-gujarati-wall.woff2',
  variable: '--font-wall-gujarati',
  weight: '600',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

export const landingFontVars = [
  bricolage,
  anekTamil,
  anekDeva,
  wallTamil,
  wallDeva,
  wallKannada,
  wallTelugu,
  wallGurmukhi,
  wallBangla,
  wallMalayalam,
  wallOdia,
  wallGujarati,
]
  .map((f) => f.variable)
  .join(' ');
