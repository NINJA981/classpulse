/**
 * Teaching-resource generation queue (`resources`): BullMQ on Redis, consumed by the worker process; without
 * Redis (dev/test) jobs run in-process with the same retry semantics. Two attempts per (re)generation.
 *
 * Every write is guarded by `generation_attempt`, so a stale job (superseded by a regenerate or deleted)
 * never overwrites newer state. On failure the resource is `failed` with a sanitised, user-facing reason.
 */
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { teachingResources } from '../../db/schema/index.js';
import { logger } from '../../lib/logger.js';
import { getRedis, newRedisConnection } from '../../lib/redis.js';
import { GENERIC_FAILURE_MESSAGE, isPipelineError } from '../../pipeline/errors.js';
import { generators } from './generators/index.js';
import { buildGenerationContext } from './grounding.js';
import { notifyResourceFailed, notifyResourceReady } from './notify.js';

export const RESOURCE_QUEUE = 'resources';
export const RESOURCE_JOB_ATTEMPTS = 2;
/** Mutable for tests. */
export const resourceJobTiming = { backoffMs: 15_000 };
const CONCURRENCY = 2;

export interface ResourceJobData {
  resourceId: string;
  /** teaching_resources.generation_attempt at enqueue time (unique job id per (re)generation). */
  attempt: number;
}

const jobId = (d: ResourceJobData) => `resource:${d.resourceId}:${d.attempt}`;

let queue: Queue<ResourceJobData> | null = null;
let inProcessRunner: ((data: ResourceJobData) => void) | null = null;

function getQueue(): Queue<ResourceJobData> | null {
  const connection = getRedis();
  if (!connection) return null;
  queue ??= new Queue<ResourceJobData>(RESOURCE_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: RESOURCE_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: resourceJobTiming.backoffMs },
      removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return queue;
}

export async function enqueueResourceGeneration(data: ResourceJobData): Promise<void> {
  const q = getQueue();
  if (q) await q.add('generate', data, { jobId: jobId(data) });
  else if (inProcessRunner) inProcessRunner(data);
  else throw new Error('No job runner available: set REDIS_URL or start the resource worker');
  logger.info({ jobId: jobId(data), mode: q ? 'bullmq' : 'in-process' }, 'Resource generation enqueued');
}

export async function closeResourceQueue(): Promise<void> {
  await queue?.close().catch(() => undefined);
  queue = null;
}

/* ------------------------------------------ the job ------------------------------------------ */

const guard = (d: ResourceJobData) => and(eq(teachingResources.id, d.resourceId), eq(teachingResources.generationAttempt, d.attempt));

export const isRetryable = (err: unknown) => !(isPipelineError(err) && !err.retryable);

/** Generate the resource's content. Throws on failure (so the attempt is retried). */
export async function processResourceJob(data: ResourceJobData, attemptNumber: number): Promise<void> {
  const log = logger.child({ resourceId: data.resourceId, generation: data.attempt, try: attemptNumber });
  const [resource] = await db
    .update(teachingResources)
    .set({ status: 'generating' })
    .where(and(guard(data), inArray(teachingResources.status, ['queued', 'generating'])))
    .returning();
  if (!resource) {
    log.info('Skipping stale, deleted or finished resource job');
    return;
  }
  const started = Date.now();
  const ctx = await buildGenerationContext(resource);
  const result = await generators[resource.type](ctx);
  const saved = await db
    .update(teachingResources)
    .set({
      status: 'ready',
      content: result.content,
      failureReason: null,
      aiMeta: {
        ...(result.meta ?? {}),
        model: ctx.model,
        groundingChars: ctx.groundingText.length,
        durationMs: Date.now() - started,
        generatedAt: new Date().toISOString(),
      },
    })
    .where(and(guard(data), eq(teachingResources.status, 'generating')))
    .returning({ id: teachingResources.id });
  log.info({ saved: saved.length > 0, ms: Date.now() - started }, 'Resource generated');
  // Only when this run's result was stored (a superseded or deleted resource gets no notification).
  if (saved.length) notifyResourceReady(resource);
}

/** Called once, after the final attempt failed. */
export async function markResourceJobFailed(data: ResourceJobData, err: unknown): Promise<void> {
  const reason = (isPipelineError(err) ? err.userMessage : GENERIC_FAILURE_MESSAGE).slice(0, 500);
  try {
    const [row] = await db
      .update(teachingResources)
      .set({ status: 'failed', failureReason: reason })
      .where(and(guard(data), inArray(teachingResources.status, ['queued', 'generating'])))
      .returning({
        id: teachingResources.id,
        type: teachingResources.type,
        title: teachingResources.title,
        teacherId: teachingResources.teacherId,
        institutionId: teachingResources.institutionId,
        generationAttempt: teachingResources.generationAttempt,
      });
    // Only the call that actually moved the resource to `failed` notifies.
    if (row) notifyResourceFailed(row, reason);
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'Could not mark resource failed');
  }
}

/* ------------------------------------------ workers ------------------------------------------ */

export interface ResourceWorkerHandle {
  close(): Promise<void>;
}

/** Start the consumer: BullMQ with Redis (worker process), otherwise in-process (API process, dev/test). */
export function startResourceWorker(): ResourceWorkerHandle {
  const handle = env.REDIS_URL ? startBullWorker() : startInProcessWorker();
  void recoverStuckResources().catch((err: unknown) => logger.error({ err }, 'Stuck-resource recovery failed'));
  return handle;
}

function startBullWorker(): ResourceWorkerHandle {
  const worker = new Worker<ResourceJobData>(
    RESOURCE_QUEUE,
    async (job) => {
      try {
        await processResourceJob(job.data, job.attemptsMade + 1);
      } catch (err) {
        if (!isRetryable(err)) throw Object.assign(new UnrecoverableError(err instanceof Error ? err.message : String(err)), { cause: err });
        throw err;
      }
    },
    { connection: newRedisConnection(), concurrency: CONCURRENCY },
  );
  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= RESOURCE_JOB_ATTEMPTS || err.name === 'UnrecoverableError';
    logger.warn({ jobId: job.id, attempt: job.attemptsMade, exhausted, err: err.message }, 'Resource job attempt failed');
    if (exhausted) void markResourceJobFailed(job.data, err.cause instanceof Error ? err.cause : err);
  });
  worker.on('error', (err) => logger.error({ err: err.message }, 'Resource worker error'));
  logger.info('Resource worker started (BullMQ)');
  return { close: () => worker.close() };
}

function startInProcessWorker(): ResourceWorkerHandle {
  let active = 0;
  let closed = false;
  const pending: ResourceJobData[] = [];

  const runOne = async (data: ResourceJobData) => {
    for (let attempt = 1; attempt <= RESOURCE_JOB_ATTEMPTS; attempt++) {
      try {
        await processResourceJob(data, attempt);
        return;
      } catch (err) {
        const last = attempt === RESOURCE_JOB_ATTEMPTS || !isRetryable(err);
        logger.warn({ resourceId: data.resourceId, attempt, last, err: (err as Error).message }, 'Resource job attempt failed');
        if (last) {
          await markResourceJobFailed(data, err);
          return;
        }
        await new Promise((r) => setTimeout(r, resourceJobTiming.backoffMs));
      }
    }
  };

  const pump = () => {
    while (!closed && active < CONCURRENCY && pending.length) {
      const next = pending.shift()!;
      active++;
      void runOne(next).finally(() => {
        active--;
        pump();
      });
    }
  };

  inProcessRunner = (data) => {
    pending.push(data);
    pump();
  };
  logger.info('Resource worker started (in-process, no Redis)');
  return {
    close: async () => {
      closed = true;
      inProcessRunner = null;
    },
  };
}

/** Re-queue resources left queued/generating without a live job (e.g. after a restart). */
async function recoverStuckResources(): Promise<void> {
  const stuck = await db
    .select({ id: teachingResources.id, attempt: teachingResources.generationAttempt })
    .from(teachingResources)
    .where(inArray(teachingResources.status, ['queued', 'generating']));
  const q = getQueue();
  for (const r of stuck) {
    const data = { resourceId: r.id, attempt: r.attempt };
    if (q) {
      const job = await q.getJob(jobId(data));
      const state = job ? await job.getState() : null;
      if (state && ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'].includes(state)) continue;
      if (job) await job.remove().catch(() => undefined);
    }
    await db.update(teachingResources).set({ status: 'queued' }).where(guard(data));
    await enqueueResourceGeneration(data);
  }
  if (stuck.length) logger.info({ count: stuck.length }, 'Re-queued stuck resources');
}
