/**
 * Deploy watcher: tells the super admin who pressed Redeploy / Restart when Coolify finishes that deployment.
 *
 * - The route records a watch (who, which deployment, when) right after Coolify accepts the request.
 * - The `deploy-watch` periodic task polls Coolify every 20 s while watches exist; on a final status it sends
 *   `deploy.succeeded` / `deploy.failed` to that admin and drops the watch. No watches → no Coolify calls.
 * - A redeploy restarts the API and the worker themselves, so with Redis the watches live in a Redis hash and
 *   the restarted worker picks them up on its first tick (5 s after boot). Without Redis (dev) they are kept in
 *   memory in the API process, which also runs the periodic tasks.
 * - A watch is claimed with HDEL before notifying, so two pollers can never both report it, and it is given up
 *   (logged, no notification) after WATCH_TTL_MS.
 * - When Coolify did not return a deployment id, the newest deployment created after the request is used.
 */
import { getRedis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import * as coolify from '../../lib/coolify.js';
import { sendNotification } from '../../jobs/sendNotification.js';
import type { PeriodicTask } from '../../jobs/periodic.js';

export type DeployAction = 'redeploy' | 'restart';

export interface DeployWatch {
  /** Coolify deployment uuid; null until it can be matched (Coolify did not return one). */
  deploymentId: string | null;
  platformAdminId: string;
  action: DeployAction;
  /** ISO time the admin started it. */
  startedAt: string;
}

const REDIS_KEY = 'cp:deploy-watches';
/** Give up on a deployment that has not finished after this long. */
export const WATCH_TTL_MS = 2 * 3600_000;
export const DEPLOY_WATCH_INTERVAL_MS = 20_000;
/** Clock skew allowed when matching a deployment without an id by its creation time. */
const MATCH_SKEW_MS = 2 * 60_000;

const SUCCEEDED = new Set(['finished']);
const FAILED = new Set(['failed', 'cancelled-by-user', 'cancelled', 'error']);

/* ------------------------------------------ store ------------------------------------------ */

const memory = new Map<string, DeployWatch>();

const fieldOf = (w: DeployWatch) => `${w.platformAdminId}:${w.deploymentId ?? `pending@${w.startedAt}`}`;

async function saveWatch(w: DeployWatch, replaces?: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    if (replaces) memory.delete(replaces);
    memory.set(fieldOf(w), w);
    return;
  }
  const multi = redis.multi();
  if (replaces) multi.hdel(REDIS_KEY, replaces);
  multi.hset(REDIS_KEY, fieldOf(w), JSON.stringify(w));
  // Safety net only: entries are removed individually; the hash outlives the longest watch.
  multi.pexpire(REDIS_KEY, WATCH_TTL_MS + 3600_000);
  await multi.exec();
}

async function listWatches(): Promise<[string, DeployWatch][]> {
  const redis = getRedis();
  if (!redis) return [...memory.entries()];
  const raw = await redis.hgetall(REDIS_KEY);
  const out: [string, DeployWatch][] = [];
  for (const [field, value] of Object.entries(raw)) {
    try {
      out.push([field, JSON.parse(value) as DeployWatch]);
    } catch {
      await redis.hdel(REDIS_KEY, field);
    }
  }
  return out;
}

/** Remove a watch. True only for the caller that actually removed it (the one allowed to notify). */
async function claimWatch(field: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return memory.delete(field);
  return (await redis.hdel(REDIS_KEY, field)) === 1;
}

/** Tests only. */
export function resetDeployWatchesForTests(): void {
  memory.clear();
}

/* ----------------------------------------- record ------------------------------------------ */

/** Start watching a deployment an admin just triggered. Never throws (the deploy itself already started). */
export async function watchDeployment(input: { deploymentId: string | null; platformAdminId: string; action: DeployAction }): Promise<void> {
  try {
    await saveWatch({ ...input, startedAt: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err, deploymentId: input.deploymentId }, 'Could not record the deployment watch');
  }
}

/* ------------------------------------------ poll ------------------------------------------- */

function notifyFinished(w: DeployWatch & { deploymentId: string }, status: string): void {
  const ok = SUCCEEDED.has(status);
  const cancelled = status.startsWith('cancelled');
  const what = w.action === 'restart' ? 'restart' : 'deployment';
  sendNotification({
    recipient: { platformAdminId: w.platformAdminId },
    kind: ok ? 'deploy.succeeded' : 'deploy.failed',
    tone: ok ? 'success' : 'error',
    title: ok
      ? w.action === 'restart'
        ? 'The restart finished. The app is back up.'
        : 'The deployment finished. The new version is live.'
      : cancelled
        ? `The ${what} was cancelled.`
        : `The ${what} failed.`,
    body: ok ? null : cancelled ? 'Nothing changed. You can start it again from Deployments.' : 'The running version was kept. Open the build logs on Deployments to see why.',
    link: '/platform/deployments',
    entity: { type: 'deployment', id: w.deploymentId },
  });
}

/** Find the deployment for a watch Coolify gave no id for: the newest one created after the request. */
async function matchDeployment(cfg: coolify.CoolifyConfig, w: DeployWatch): Promise<coolify.CoolifyDeployment | null> {
  const since = Date.parse(w.startedAt) - MATCH_SKEW_MS;
  const recent = await coolify.listDeployments(cfg, 5);
  return recent.find((d) => d.createdAt !== null && Date.parse(d.createdAt) >= since) ?? null;
}

/** One polling pass. Returns the number of notifications sent. */
export async function checkDeployWatches(now = new Date()): Promise<number> {
  const watches = await listWatches();
  if (!watches.length) return 0;
  const cfg = coolify.coolifyConfig();
  let sent = 0;
  for (const [field, w] of watches) {
    if (!cfg || now.getTime() - Date.parse(w.startedAt) > WATCH_TTL_MS) {
      if (await claimWatch(field)) {
        logger.warn({ deploymentId: w.deploymentId, configured: !!cfg }, 'Stopped watching a deployment that did not finish in time');
      }
      continue;
    }
    try {
      let deploymentId = w.deploymentId;
      let status: string;
      if (deploymentId) {
        status = (await coolify.getDeploymentLogs(cfg, deploymentId, 1)).status;
      } else {
        const match = await matchDeployment(cfg, w);
        if (!match) continue;
        deploymentId = match.id;
        status = match.status;
        // Bind the id so the next tick asks for this deployment directly.
        await saveWatch({ ...w, deploymentId }, field);
      }
      if (!SUCCEEDED.has(status) && !FAILED.has(status)) continue;
      const current = deploymentId === w.deploymentId ? field : fieldOf({ ...w, deploymentId });
      if (!(await claimWatch(current))) continue;
      notifyFinished({ ...w, deploymentId }, status);
      sent++;
    } catch (err) {
      // Coolify may be unreachable for a moment (it can be restarting us); try again next tick.
      logger.warn({ err: (err as Error).message, deploymentId: w.deploymentId }, 'Could not check a deployment; will retry');
    }
  }
  return sent;
}

export const deployWatchTask: PeriodicTask = {
  name: 'deploy-watch',
  intervalMs: DEPLOY_WATCH_INTERVAL_MS,
  run: async () => {
    await checkDeployWatches();
  },
};
