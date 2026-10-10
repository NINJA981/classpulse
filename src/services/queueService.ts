import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { runGenerationJob } from './lessonGeneration.js';
import { Lesson } from '../models/Lesson.js';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisConnection: Redis | null = null;
let lessonQueue: Queue | null = null;
let lessonWorker: Worker | null = null;
let isRedisAvailable = false;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    });

    redisConnection.on('error', (err) => {
      if (!isRedisAvailable) {
        // Suppress repeated log spam if Redis is absent in local dev
      } else {
        console.warn('[Queue:Redis] Connection error:', err.message);
      }
      isRedisAvailable = false;
    });

    redisConnection.on('connect', () => {
      console.log(`[Queue:Redis] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
      isRedisAvailable = true;
    });
  }
  return redisConnection;
}

/**
 * Initializes BullMQ queue and worker if Redis is responsive.
 */
export async function initializeQueue(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.connect();
    isRedisAvailable = true;

    lessonQueue = new Queue('lesson-processing', {
      connection: redis
    });

    lessonWorker = new Worker(
      'lesson-processing',
      async (job: Job<{ lessonId: string }>) => {
        const { lessonId } = job.data;
        console.log(`[Queue:Worker] Processing job ${job.id} for lesson ${lessonId} (Attempt ${job.attemptsMade + 1})`);
        
        await job.updateProgress(10);
        await runGenerationJob(lessonId);
        await job.updateProgress(100);
      },
      {
        connection: redis,
        concurrency: 2 // Safe bounded concurrency for single VPS pilot
      }
    );

    lessonWorker.on('completed', (job) => {
      console.log(`[Queue:Worker] Job ${job.id} for lesson ${job.data.lessonId} completed successfully.`);
    });

    lessonWorker.on('failed', async (job, err) => {
      console.error(`[Queue:Worker] Job ${job?.id} failed:`, err.message);
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        await Lesson.findByIdAndUpdate(job.data.lessonId, {
          status: 'failed',
          failureReason: `Exceeded max retries (3): ${err.message}`
        }).exec();
      }
    });

    console.log('[Queue] BullMQ lesson-processing queue initialized successfully.');
    return true;
  } catch (err: any) {
    console.warn(`[Queue] Redis unavailable (${err.message}). Falling back to bounded in-memory resilient worker.`);
    isRedisAvailable = false;
    return false;
  }
}

/**
 * Fallback resilient executor when Redis is not running (e.g. dev/unit tests).
 * Executes with bounded retries (up to 3) and exponential backoff.
 */
async function fallbackExecuteWithRetry(lessonId: string, maxAttempts = 3): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`[Queue:Fallback] Running generation for lesson ${lessonId} (Attempt ${attempt}/${maxAttempts})`);
      await runGenerationJob(lessonId);
      return;
    } catch (err: any) {
      console.warn(`[Queue:Fallback] Attempt ${attempt} failed for ${lessonId}:`, err.message);
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        await Lesson.findByIdAndUpdate(lessonId, {
          status: 'failed',
          failureReason: `Generation failed after ${maxAttempts} attempts: ${err.message}`
        }).exec();
      }
    }
  }
}

/**
 * Enqueue an AI processing job for a lesson with deduplication and bounded retries.
 */
export async function enqueueLessonJob(lessonId: string): Promise<{ queued: boolean; mode: 'bullmq' | 'fallback' }> {
  // Ensure lesson status is updated to queued
  await Lesson.findByIdAndUpdate(lessonId, {
    status: 'queued',
    failureReason: undefined,
    timings: {
      startedAt: new Date(),
      elapsedSec: 0
    }
  }).exec();

  if (isRedisAvailable && lessonQueue) {
    try {
      await lessonQueue.add(
        'generate-lesson',
        { lessonId },
        {
          jobId: `lesson_${lessonId}`, // Deduplication: one active job per lesson
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );
      return { queued: true, mode: 'bullmq' };
    } catch (err: any) {
      console.warn('[Queue] Failed to add to BullMQ, falling back to local runner:', err.message);
    }
  }

  // Resilient async fallback
  void fallbackExecuteWithRetry(lessonId);
  return { queued: true, mode: 'fallback' };
}

/**
 * Inspect status of a background job.
 */
export async function getJobStatus(lessonId: string): Promise<{
  status: string;
  progress?: number;
  attemptsMade?: number;
  failureReason?: string;
}> {
  if (isRedisAvailable && lessonQueue) {
    try {
      const job = await lessonQueue.getJob(`lesson_${lessonId}`);
      if (job) {
        const state = await job.getState();
        return {
          status: state,
          progress: typeof job.progress === 'number' ? job.progress : undefined,
          attemptsMade: job.attemptsMade,
          failureReason: job.failedReason
        };
      }
    } catch (err: any) {
      console.warn('[Queue] Could not get job state from BullMQ:', err.message);
    }
  }

  // Fallback to checking Mongo Lesson status
  const lesson = await Lesson.findById(lessonId).select('status failureReason timings').lean();
  return {
    status: lesson?.status || 'unknown',
    failureReason: lesson?.failureReason
  };
}

