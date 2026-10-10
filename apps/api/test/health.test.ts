import { describe, expect, it } from 'vitest';
import { anon } from './helpers.js';

describe('health', () => {
  it('reports liveness', async () => {
    const res = await anon().get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('reports readiness with dependency checks', async () => {
    const res = await anon().get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('ok');
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await anon().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
