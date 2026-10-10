/**
 * STUB — implemented by the API-domain workstream (pipeline + lessons).
 * Signatures are part of the frozen contract used by lessonWorker.ts.
 */
import type { LessonJobData } from './queue.js';

export interface LessonJobContext {
  attemptNumber: number;
  maxAttempts: number;
}

/** Run STT + LLM generation for a lesson. Must throw on failure (so the attempt is retried). */
export async function processLessonJob(_data: LessonJobData, _ctx: LessonJobContext): Promise<void> {
  throw new Error('processLessonJob not implemented');
}

/** Called once after the final attempt fails: mark the lesson `failed` with a sanitized reason. */
export async function markLessonJobFailed(_data: LessonJobData, _err: Error): Promise<void> {}

/** On worker startup: re-enqueue or fail lessons stuck in queued/transcribing/generating with no live job. */
export async function recoverStuckLessons(): Promise<void> {}

/** Whether an error should be retried (network/5xx/timeouts) or fail immediately (bad audio, config). */
export function isRetryable(_err: unknown): boolean {
  return true;
}
