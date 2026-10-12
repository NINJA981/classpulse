/**
 * Same-origin rules as they apply in production (two hosts: the school site and the platform
 * console). The config module is mocked so only the origin helpers and the guard see production.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type * as EnvModule from '../src/config/env.js';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return {
    ...actual,
    isProd: true,
    allowedOrigins: ['https://school.example.in', 'https://ops.example.in'],
  };
});

// The setup file already loaded the real config: load fresh copies that see the mock.
vi.resetModules();
const { isOwnOrigin } = await import('../src/lib/origins.js');
const { sameOriginGuard } = await import('../src/middleware/csrf.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

describe('isOwnOrigin (production)', () => {
  it('accepts only our own origin for the host the request was sent to', () => {
    expect(isOwnOrigin('https://school.example.in', ['school.example.in'])).toBe(true);
    expect(isOwnOrigin('https://ops.example.in', ['ops.example.in'])).toBe(true);
    // A script on the school site calling the platform console (same-site, different origin).
    expect(isOwnOrigin('https://school.example.in', ['ops.example.in'])).toBe(false);
    expect(isOwnOrigin('https://ops.example.in', ['school.example.in'])).toBe(false);
    // Another subdomain, plain http, or an unknown origin that merely matches its own Host.
    expect(isOwnOrigin('https://other.example.in', ['school.example.in'])).toBe(false);
    expect(isOwnOrigin('http://school.example.in', ['school.example.in'])).toBe(false);
    expect(isOwnOrigin('https://evil.example', ['evil.example'])).toBe(false);
  });
});

describe('same-origin guard (production)', () => {
  const app = express();
  app.use(sameOriginGuard());
  app.post('/api/platform/schools/:id/reactivate', (_req, res) => void res.status(204).end());
  app.use(errorHandler);

  it('blocks the school site from posting to the console, allows the console itself', async () => {
    const cross = await request(app)
      .post('/api/platform/schools/1/reactivate')
      .set('Host', 'ops.example.in')
      .set('Origin', 'https://school.example.in');
    expect(cross.status).toBe(403);
    expect(cross.body.error).toEqual({ code: 'FORBIDDEN', message: 'Cross-site request blocked' });

    const own = await request(app)
      .post('/api/platform/schools/1/reactivate')
      .set('Host', 'ops.example.in')
      .set('Origin', 'https://ops.example.in');
    expect(own.status).toBe(204);
  });
});
