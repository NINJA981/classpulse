/**
 * Lesson-generation consumer. Runs in the worker process (BullMQ) or, without
 * Redis, inside the API process with equivalent retry/backoff behaviour.
 *
 * Contract with lessonGeneration.ts:
 *   - processLessonJob() THROWS on failure so the attempt is retried.
 *   - Errors marked non-retryable (`PipelineError.retryable === false`) skip remaining attempts.
 *   - markLessonJobFailed() is called exactly once, after the final attempt fails.
 */
import { Worker, UnrecoverableError } from 'bullmq';
import { env } from '../config/env.js';
import { newRedisConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { LESSON_JOB_ATTEMPTS, LESSON_JOB_BACKOFF_MS, LESSON_QUEUE, setInProcessRunner, type LessonJobData } from './queue.js';
import { isRetryable, markLessonJobFailed, processLessonJob } from './lessonGeneration.js';

export interface LessonWorkerHandle {
  close(): Promise<void>;
}

export function startLessonWorker(): LessonWorkerHandle {
  if (env.REDIS_URL) return startBullWorker();
  return startInProcessWorker();
}

function startBullWorker(): LessonWorkerHandle {
  const worker = new Worker<LessonJobData>(
    LESSON_QUEUE,
    async (job) => {
      try {
        await processLessonJob(job.data, { attemptNumber: job.attemptsMade + 1, maxAttempts: LESSON_JOB_ATTEMPTS });
      } catch (err) {
        if (!isRetryable(err)) throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    { connection: newRedisConnection(), concurrency: env.GENERATION_CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= LESSON_JOB_ATTEMPTS || err instanceof UnrecoverableError || err.name === 'UnrecoverableError';
    logger.warn({ jobId: job.id, attempt: job.attemptsMade, exhausted, err: err.message }, 'Lesson job attempt failed');
    if (exhausted) void markLessonJobFailed(job.data, err);
  });
  worker.on('error', (err) => logger.error({ err: err.message }, 'Lesson worker error'));
  logger.info({ concurrency: env.GENERATION_CONCURRENCY }, 'Lesson worker started (BullMQ)');
  return { close: () => worker.close() };
}

function startInProcessWorker(): LessonWorkerHandle {
  let active = 0;
  const pending: LessonJobData[] = [];
  let closed = false;

  const runOne = async (data: LessonJobData) => {
    for (let attempt = 1; attempt <= LESSON_JOB_ATTEMPTS; attempt++) {
      try {
        await processLessonJob(data, { attemptNumber: attempt, maxAttempts: LESSON_JOB_ATTEMPTS });
        return;
      } catch (err) {
        const last = attempt === LESSON_JOB_ATTEMPTS || !isRetryable(err);
        logger.warn({ lessonId: data.lessonId, attempt, last, err: (err as Error).message }, 'Lesson job attempt failed');
        if (last) {
          await markLessonJobFailed(data, err as Error);
          return;
        }
        await new Promise((r) => setTimeout(r, LESSON_JOB_BACKOFF_MS * 2 ** (attempt - 1)));
      }
    }
  };

  const pump = () => {
    while (!closed && active < env.GENERATION_CONCURRENCY && pending.length) {
      const next = pending.shift()!;
      active++;
      void runOne(next).finally(() => {
        active--;
        pump();
      });
    }
  };

  setInProcessRunner((data) => {
    pending.push(data);
    pump();
  });
  logger.info('Lesson worker started (in-process, no Redis)');
  return {
    close: async () => {
      closed = true;
    },
  };
}
