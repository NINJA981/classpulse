/**
 * Static images the landing page uses, all under /public/landing (same-origin — the edge CSP allows nothing else).
 * Each group has an `available` flag so sections render a designed fallback until the files are captured
 * by scripts/capture-landing-assets.ts. Flip a flag only after its files exist.
 */

/** Poster frames rendered from the real 3D scene: shown before WebGL loads, with reduced motion, or without WebGL. */
export const POSTERS = {
  available: true,
  /** Chapter i of the story (0–5). `wide` is 16:10 for landscape screens, `tall` is 9:16 for phones. */
  chapter: (i: number, shape: 'wide' | 'tall') => `/landing/posters/chapter-${i}-${shape}.webp`,
  /** The classroom at dusk, lights on — background of the finale. */
  finale: (shape: 'wide' | 'tall') => `/landing/posters/finale-${shape}.webp`,
  /** Close-up of the classroom device (Raspberry Pi + mic), transparent background. Not captured yet. */
  deviceAvailable: false,
  device: '/landing/posters/device.webp',
} as const;

/**
 * Real screenshots of the live app (seeded demo school), captured with Playwright. WebP at 2× (admin, teacher)
 * and 3× (student); width/height are CSS pixels. Re-capture: npx tsx scripts/capture-landing-assets.ts screens
 */
export const SCREENS = {
  available: true,
  admin: { src: '/landing/screens/admin.webp', width: 1440, height: 900 },
  teacher: { src: '/landing/screens/teacher.webp', width: 1440, height: 1040 },
  student: { src: '/landing/screens/student.webp', width: 390, height: 844 },
} as const;
