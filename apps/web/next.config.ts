import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * In production the reverse proxy (Caddy) routes /api and /socket.io to the API,
 * so the browser always talks same-origin. In development we rewrite /api to the
 * local API so the session cookie stays same-origin there too.
 */
const apiTarget = process.env.API_INTERNAL_URL ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@classpulse/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
