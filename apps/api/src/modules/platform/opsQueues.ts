/**
 * BullMQ queue inspection and recovery for the platform console. Only the allowlisted queues
 * (OPS_QUEUE_NAMES) are reachable, and job data is summarised without message bodies.
 */
import { Queue, type Job } from 'bullmq';
import type { FailedJob, OpsQueueCounts, OpsQueueName } from '@classpulse/shared';
import { invalidState, notFound } from '../../lib/errors.js';
import { getRedis } from '../../lib/redis.js';

const queues = new Map<OpsQueueName, Queue>();

/** A read/admin handle on a queue, or null when Redis is not configured. */
export function opsQueue(name: OpsQueueName): Queue | null {
  const connection = getRedis();
  if (!connection) return null;
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection });
    queues.set(name, q);
  }
  return q;
}

export async function closeOpsQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => undefined)));
  queues.clear();
}

export async function queueCounts(name: OpsQueueName): Promise<OpsQueueCounts | null> {
  const q = opsQueue(name);
  if (!q) return null;
  const c = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'prioritized', 'waiting-children');
  return {
    waiting: (c.waiting ?? 0) + (c.prioritized ?? 0) + (c['waiting-children'] ?? 0),
    active: c.active ?? 0,
    delayed: c.delayed ?? 0,
    failed: c.failed ?? 0,
    completed: c.completed ?? 0,
  };
}

const iso = (ms: number | undefined | null) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null);

/** Job data without anything sensitive: email jobs only reveal their kind. */
function summarise(name: OpsQueueName, data: unknown): FailedJob['summary'] {
  const d = (data ?? {}) as Record<string, unknown>;
  if (name === 'email') return { kind: typeof d.kind === 'string' ? d.kind.slice(0, 60) : null };
  if (name === 'resources') {
    return {
      resourceId: typeof d.resourceId === 'string' ? d.resourceId : null,
      attempt: typeof d.attempt === 'number' ? d.attempt : null,
    };
  }
  return {
    lessonId: typeof d.lessonId === 'string' ? d.lessonId : null,
    attempt: typeof d.attempt === 'number' ? d.attempt : null,
  };
}

function toFailedJob(name: OpsQueueName, job: Job): FailedJob {
  const reason = (job.failedReason ?? '').split('\n')[0]!.slice(0, 300);
  return {
    id: String(job.id ?? ''),
    name: job.name,
    failedReason: reason || 'Unknown error',
    attemptsMade: job.attemptsMade,
    createdAt: iso(job.timestamp),
    processedAt: iso(job.processedOn),
    finishedAt: iso(job.finishedOn),
    summary: summarise(name, job.data),
  };
}

export async function failedJobs(name: OpsQueueName, limit: number): Promise<FailedJob[]> {
  const q = opsQueue(name);
  if (!q) return [];
  const jobs = await q.getFailed(0, limit - 1);
  return jobs.filter(Boolean).map((j) => toFailedJob(name, j));
}

function requireQueue(name: OpsQueueName): Queue {
  const q = opsQueue(name);
  if (!q) throw notFound('Queue (Redis is not configured)');
  return q;
}

async function requireJob(name: OpsQueueName, id: string): Promise<Job> {
  const job = await requireQueue(name).getJob(id);
  if (!job) throw notFound('Job');
  return job;
}

export async function retryJob(name: OpsQueueName, id: string): Promise<void> {
  const job = await requireJob(name, id);
  if (!(await job.isFailed())) throw invalidState('Only failed jobs can be retried');
  await job.retry('failed');
}

export async function removeJob(name: OpsQueueName, id: string): Promise<void> {
  const job = await requireJob(name, id);
  if (await job.isActive()) throw invalidState('A running job cannot be removed');
  await job.remove();
}

/** Moves every failed job back to waiting. Returns how many were failed before. */
export async function retryAllFailed(name: OpsQueueName): Promise<number> {
  const q = requireQueue(name);
  const before = (await q.getJobCounts('failed')).failed ?? 0;
  await q.retryJobs({ state: 'failed', count: 1000 });
  return before;
}
