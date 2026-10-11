import type { MetadataRoute } from 'next';

/** Installable web app (Chrome/Edge/Android "Install app", iOS "Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ClassPulse',
    short_name: 'ClassPulse',
    description: 'AI-assisted lectures, quizzes and live classroom engagement.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Staff canvas and ink tokens (globals.css).
    background_color: '#f6f6f3',
    theme_color: '#111111',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
