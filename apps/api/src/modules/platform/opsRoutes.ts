/**
 * Platform operations API: health, queues, logs, audit and deployments.
 * Mounted at /api/platform/ops behind authenticatePlatform() (applied by the mount).
 */
import { Router } from 'express';
import {
  DeploymentParams,
  FailedJobsQuery,
  HealthHistoryQuery,
  LogsQuery,
  QueueJobParams,
  QueueParams,
  RedeployInput,
  RestartInput,
} from '@classpulse/shared';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { auditRouter, sendAuditCsv } from './opsAudit.js';
import { csvFilename } from './opsCsv.js';
import * as deployments from './opsDeployments.js';
import { healthHistory, platformHealth, testProvider } from './opsHealth.js';
import { listLogs, logsCsv } from './opsLogs.js';
import { failedJobs, removeJob, retryAllFailed, retryJob } from './opsQueues.js';

export const opsRouter = Router();

const noStore = { 'Cache-Control': 'private, no-store' };

/* ------------------------------ Health ---------------------------------- */

opsRouter.get('/health', async (_req, res) => {
  res.set(noStore).json(await platformHealth());
});

opsRouter.get('/health/history', async (req, res) => {
  const { hours } = parseQuery(req, HealthHistoryQuery);
  res.set(noStore).json(await healthHistory(hours));
});

const ProviderParams = z.object({ provider: z.enum(['openai', 'sarvam']) });

opsRouter.post('/providers/:provider/test', async (req, res) => {
  const { provider } = parseParams(req, ProviderParams);
  const result = await testProvider(provider);
  await audit(req, {
    action: 'platform.provider.test',
    targetType: 'provider',
    targetId: provider,
    metadata: { ok: result.ok, httpStatus: result.httpStatus, latencyMs: result.latencyMs },
  });
  res.json(result);
});

/* ------------------------------ Queues ---------------------------------- */

opsRouter.get('/queues/:name/failed', async (req, res) => {
  const { name } = parseParams(req, QueueParams);
  const { limit } = parseQuery(req, FailedJobsQuery);
  res.set(noStore).json({ items: await failedJobs(name, limit) });
});

opsRouter.post('/queues/:name/jobs/:id/retry', async (req, res) => {
  const { name, id } = parseParams(req, QueueJobParams);
  await retryJob(name, id);
  await audit(req, { action: 'platform.queue.retry', targetType: 'job', targetId: id.slice(0, 80), metadata: { queue: name } });
  res.json({ ok: true });
});

opsRouter.post('/queues/:name/jobs/:id/remove', async (req, res) => {
  const { name, id } = parseParams(req, QueueJobParams);
  await removeJob(name, id);
  await audit(req, { action: 'platform.queue.remove', targetType: 'job', targetId: id.slice(0, 80), metadata: { queue: name } });
  res.json({ ok: true });
});

opsRouter.post('/queues/:name/retry-all-failed', async (req, res) => {
  const { name } = parseParams(req, QueueParams);
  const retried = await retryAllFailed(name);
  await audit(req, { action: 'platform.queue.retry_all', targetType: 'queue', targetId: name, metadata: { retried } });
  res.json({ ok: true, retried });
});

/* ------------------------------- Logs ----------------------------------- */

opsRouter.get('/logs', async (req, res) => {
  res.set(noStore).json(await listLogs(parseQuery(req, LogsQuery)));
});

opsRouter.get('/logs.csv', async (req, res) => {
  const csv = await logsCsv(parseQuery(req, LogsQuery));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${csvFilename('logs')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(csv);
});

/* ------------------------------- Audit ---------------------------------- */

opsRouter.get('/audit.csv', sendAuditCsv);
opsRouter.use('/audit', auditRouter);

/* ---------------------------- Deployments ------------------------------- */

opsRouter.get('/app', async (_req, res) => {
  res.set(noStore).json(await deployments.getApp());
});

opsRouter.get('/deployments', async (_req, res) => {
  res.set(noStore).json(await deployments.listDeployments());
});

opsRouter.get('/deployments/:id/logs', async (req, res) => {
  const { id } = parseParams(req, DeploymentParams);
  res.set(noStore).json(await deployments.deploymentLogs(id));
});

opsRouter.post('/redeploy', async (req, res) => {
  parseBody(req, RedeployInput);
  const result = await deployments.redeploy();
  if (result.configured) {
    await audit(req, { action: 'platform.deploy.redeploy', targetType: 'deployment', targetId: result.deploymentId ?? undefined });
  }
  res.json(result);
});

opsRouter.post('/restart', async (req, res) => {
  parseBody(req, RestartInput);
  const result = await deployments.restart();
  if (result.configured) {
    await audit(req, { action: 'platform.deploy.restart', targetType: 'deployment', targetId: result.deploymentId ?? undefined });
  }
  res.json(result);
});
