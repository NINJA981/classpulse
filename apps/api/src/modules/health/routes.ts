import { Router } from 'express';
import { pingDb } from '../../db/client.js';
import { queueHealthy } from '../../jobs/queue.js';
import { storageReady } from '../../lib/storage.js';

export const healthRouter = Router();

/** Liveness: the process is up. */
healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok' });
});

/** Readiness: dependencies reachable. Returns 503 if any check fails. */
healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'fail'> = {};
  await Promise.all([
    pingDb().then(
      () => (checks.database = 'ok'),
      () => (checks.database = 'fail'),
    ),
    queueHealthy().then((ok) => (checks.redis = ok ? 'ok' : 'fail')),
    storageReady().then(
      () => (checks.storage = 'ok'),
      () => (checks.storage = 'fail'),
    ),
  ]);
  const ok = Object.values(checks).every((v) => v === 'ok');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks });
});
