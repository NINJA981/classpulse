/**
 * Lesson-generation job producer.
 *
 * Production: BullMQ on Redis, consumed by the separate worker process.
 * Dev/test without Redis: jobs run in-process via the runner registered by
 * `startLessonWorker()` (see lessonWorker.ts), with the same retry semantics.
 */
import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { getRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export const LESSON_QUEUE = 'lesson-generation';
export const LESSON_JOB_ATTEMPTS = 3;
export const LESSON_JOB_BACKOFF_MS = 15_000;

export interface LessonJobData {
  lessonId: string;
  /** lessons.generation_attempt at enqueue time — makes the BullMQ job id unique per (re)generation. */
  attempt: number;
}

type InProcessRunner = (data: LessonJobData) => void;

let queue: Queue<LessonJobData> | null = null;
let inProcessRunner: InProcessRunner | null = null;

export function setInProcessRunner(runner: InProcessRunner): void {
  inProcessRunner = runner;
}

function getQueue(): Queue<LessonJobData> | null {
  const connection = getRedis();
  if (!connection) return null;
  queue ??= new Queue<LessonJobData>(LESSON_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: LESSON_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: LESSON_JOB_BACKOFF_MS },
      removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return queue;
}

export async function enqueueLessonGeneration(data: LessonJobData): Promise<string> {
  const jobId = `lesson:${data.lessonId}:${data.attempt}`;
  const q = getQueue();
  if (q) {
    await q.add('generate', data, { jobId });
  } else if (inProcessRunner) {
    inProcessRunner(data);
  } else {
    throw new Error('No job runner available: set REDIS_URL or start the in-process worker');
  }
  logger.info({ jobId, mode: q ? 'bullmq' : 'in-process' }, 'Lesson generation enqueued');
  return jobId;
}

/** Whether a job for this lesson is currently waiting/active (used for stuck-lesson recovery). */
export async function isLessonJobLive(data: LessonJobData): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  const job = await q.getJob(`lesson:${data.lessonId}:${data.attempt}`);
  if (!job) return false;
  const state = await job.getState();
  return ['waiting', 'active', 'delayed', 'waiting-children', 'prioritized'].includes(state);
}

export async function queueHealthy(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return !env.REDIS_URL;
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeQueue(): Promise<void> {
  await queue?.close().catch(() => undefined);
  queue = null;
}
