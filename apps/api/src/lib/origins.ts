/**
 * Same-origin checks for browser requests (CSRF guard and Socket.IO handshakes).
 *
 * The web app always calls its own origin (Caddy routes /api and /socket.io next to the pages), so a
 * browser request is accepted only when its `Origin` is the origin of the host it was sent to, and in
 * production that origin must also be one of ours (PUBLIC_ORIGIN, PLATFORM_ORIGIN). Hosts are compared
 * rather than whole origins because the scheme the API sees behind the proxies is not reliable.
 */
import { allowedOrigins, isProd } from '../config/env.js';

const normalize = (origin: string): string | null => {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
};

/** Our own origins (PUBLIC_ORIGIN, PLATFORM_ORIGIN, plus DEV_EXTRA_ORIGINS outside production). */
export const trustedOrigins: ReadonlySet<string> = new Set(
  allowedOrigins.map(normalize).filter((o): o is string => o !== null),
);

/**
 * Whether a browser `Origin` header belongs to the request's own host. `hosts` are the hosts the
 * request was addressed to (the Host header, and X-Forwarded-Host from a trusted proxy).
 */
export function isOwnOrigin(origin: string, hosts: readonly (string | undefined)[]): boolean {
  const normalized = normalize(origin);
  if (!normalized) return false; // "null" (sandboxed frames, opaque origins) and anything malformed
  const host = new URL(normalized).host.toLowerCase();
  const sameHost = hosts.some((h) => typeof h === 'string' && h.trim().toLowerCase() === host);
  if (trustedOrigins.has(normalized)) {
    // In development the API may sit behind a rewrite that changes Host (Next.js dev server); our own
    // configured origins are accepted there. In production the host must match too.
    return sameHost || !isProd;
  }
  // Outside production any true same-origin request is fine (e.g. 127.0.0.1 instead of localhost).
  return !isProd && sameHost;
}
