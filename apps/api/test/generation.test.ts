import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { assignments, lessons, questions } from '../src/db/schema/index.js';
import { isRetryable, markLessonJobFailed, processLessonJob, recoverStuckLessons } from '../src/jobs/lessonGeneration.js';
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { purgeExpiredAudio } from '../src/jobs/retention.js';
import { storage } from '../src/lib/storage.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { as, createWorld } from './helpers.js';
import { insertLesson, mockGenerate, mockTranscription } from './fixtures/lessons.js';

const ctx = (attemptNumber = 1) => ({ attemptNumber, maxAttempts: 3 });

/** Emulates the worker loop: retries retryable errors, then marks failed once. */
async function runLikeWorker(data: LessonJobData) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await processLessonJob(data, ctx(attempt));
      return;
    } catch (err) {
      if (attempt === 3 || !isRetryable(err)) {
        await markLessonJobFailed(data, err as Error);
        return;
      }
    }
  }
}

let events: { userId: string; event: string; payload: unknown }[] = [];
let queued: LessonJobData[] = [];

beforeEach(() => {
  events = [];
  queued = [];
  setLocalEmitter((userId, event, payload) => events.push({ userId, event, payload }));
  setInProcessRunner((d) => queued.push(d));
  setPipelineProvidersForTests({ transcribe: async () => mockTranscription(), generate: mockGenerate });
});

afterEach(() => setPipelineProvidersForTests(null));

async function queuedLesson() {
  const w = await createWorld();
  const lesson = await insertLesson({
    institutionId: w.institution.id,
    teacherId: w.teacher.id,
    sectionId: w.section.id,
    withAudio: true,
    status: 'queued',
    generationAttempt: 1,
  });
  return { w, lesson, data: { lessonId: lesson.id, attempt: 1 } };
}

describe('processLessonJob', () => {
  it('happy path: transcript, draft questions with real citation times, assignment, ready_for_review', async () => {
    const { w, lesson, data } = await queuedLesson();
    await runLikeWorker(data);

    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('ready_for_review');
    expect(row!.progressPct).toBe(100);
    expect(row!.transcript).toContain('photosynthesis');
    expect(row!.transcriptSegments).toHaveLength(3);
    expect(row!.summary).toBe('The lesson explained photosynthesis.');
    expect(row!.pipelineMeta?.demoFallback).toBe(false);
    expect(row!.pipelineMeta?.approximateTimestamps).toBe(false);

    const qs = await db.select().from(questions).where(eq(questions.lessonId, lesson.id));
    expect(qs).toHaveLength(5); // DEFAULT_MODEL_SETTINGS.questionsPerLesson
    expect(qs.every((q) => q.status === 'draft')).toBe(true);
    expect(qs.map((q) => q.position).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const q of qs) {
      expect(q.options[q.correctIndex]).toBe('Oxygen is released');
      // cited block 2 = the third real segment
      expect(q.citationStartSec).toBe(29.8);
      expect(q.citationEndSec).toBe(44.5);
    }
    const [assignment] = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(assignment!.status).toBe('draft');

    const statuses = events.filter((e) => e.event === 'lesson:progress' && e.userId === w.teacher.id).map((e) => (e.payload as { status: string }).status);
    expect(statuses).toEqual(['transcribing', 'generating', 'ready_for_review']);

    const detail = await as(w.teacher).get(`/api/lessons/${lesson.id}`);
    expect(detail.body.status).toBe('ready_for_review');
    expect(detail.body.questions).toHaveLength(5);
    expect(detail.body.assignment.title).toBe('Leaf experiment');
    const transcript = await as(w.teacher).get(`/api/lessons/${lesson.id}/transcript`);
    expect(transcript.body.segments[1]).toEqual({ startSec: 14.2, endSec: 29.8, text: expect.any(String) });
  });

  it('STT failure (non-retryable) marks the lesson failed with a friendly reason and no questions', async () => {
    const { lesson, data } = await queuedLesson();
    let calls = 0;
    setPipelineProvidersForTests({
      transcribe: async () => {
        calls++;
        throw new PipelineError('SARVAM_API_KEY is not set', { retryable: false, userMessage: 'Speech-to-text is not configured' });
      },
      generate: mockGenerate,
    });
    await runLikeWorker(data);
    expect(calls).toBe(1);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('failed');
    expect(row!.failureReason).toBe('Speech-to-text is not configured');
    expect(row!.transcript).toBeNull();
    expect(row!.summary).toBeNull();
    expect(await db.select().from(questions).where(eq(questions.lessonId, lesson.id))).toHaveLength(0);
    const failedEvent = events.find((e) => (e.payload as { status: string }).status === 'failed');
    expect(failedEvent).toBeTruthy();
  });

  it('never stores raw upstream errors as the failure reason', async () => {
    const { lesson, data } = await queuedLesson();
    await markLessonJobFailed(data, new Error('HTTP 500 {"secret":"upstream body"}'));
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('failed');
    expect(row!.failureReason).toBe('Processing failed. Please try again.');
  });

  it('retries a transient LLM failure and succeeds on the next attempt (transcript reused)', async () => {
    const { lesson, data } = await queuedLesson();
    let sttCalls = 0;
    let llmCalls = 0;
    setPipelineProvidersForTests({
      transcribe: async () => {
        sttCalls++;
        return mockTranscription();
      },
      generate: async (input) => {
        llmCalls++;
        if (llmCalls === 1) throw new PipelineError('openai:chat failed after 3 tries (HTTP 503)', { retryable: true });
        return mockGenerate(input);
      },
    });
    await runLikeWorker(data);
    expect(llmCalls).toBe(2);
    expect(sttCalls).toBe(1);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('ready_for_review');
    expect(row!.failureReason).toBeNull();
  });

  it('ignores a stale job whose attempt was superseded', async () => {
    const { lesson } = await queuedLesson();
    await db.update(lessons).set({ generationAttempt: 2 }).where(eq(lessons.id, lesson.id));
    let called = false;
    setPipelineProvidersForTests({
      transcribe: async () => {
        called = true;
        return mockTranscription();
      },
    });
    await processLessonJob({ lessonId: lesson.id, attempt: 1 }, ctx());
    await markLessonJobFailed({ lessonId: lesson.id, attempt: 1 }, new Error('boom'));
    expect(called).toBe(false);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('queued');
  });

  it('discards results when the lesson was regenerated mid-job', async () => {
    const { lesson, data } = await queuedLesson();
    setPipelineProvidersForTests({
      transcribe: async () => mockTranscription(),
      generate: async (input) => {
        await db.update(lessons).set({ generationAttempt: 2, status: 'queued' }).where(eq(lessons.id, lesson.id));
        return mockGenerate(input);
      },
    });
    await processLessonJob(data, ctx());
    expect(await db.select().from(questions).where(eq(questions.lessonId, lesson.id))).toHaveLength(0);
  });

  it('recoverStuckLessons re-queues processing lessons without a live job', async () => {
    const { lesson } = await queuedLesson();
    await db.update(lessons).set({ status: 'transcribing' }).where(eq(lessons.id, lesson.id));
    await recoverStuckLessons();
    expect(queued).toEqual([{ lessonId: lesson.id, attempt: 2 }]);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('queued');
  });

  it('isRetryable honours PipelineError and retries unknown errors', () => {
    expect(isRetryable(new PipelineError('x', { retryable: false }))).toBe(false);
    expect(isRetryable(new PipelineError('x', { retryable: true }))).toBe(true);
    expect(isRetryable(new Error('unknown'))).toBe(true);
  });
});

describe('retention', () => {
  it('deletes expired audio objects and clears audio fields but keeps the duration', async () => {
    const w = await createWorld();
    const base = { institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, withAudio: true };
    const expired = await insertLesson({ ...base, status: 'ready_for_review', audioExpiresAt: new Date(Date.now() - 1000) });
    const fresh = await insertLesson({ ...base, status: 'ready_for_review' });
    const busy = await insertLesson({ ...base, status: 'transcribing', audioExpiresAt: new Date(Date.now() - 1000) });

    expect(await purgeExpiredAudio()).toBe(1);
    expect(await storage.stat(expired.audioObjectKey!)).toBeNull();
    expect(await storage.stat(fresh.audioObjectKey!)).not.toBeNull();
    expect(await storage.stat(busy.audioObjectKey!)).not.toBeNull();

    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, expired.id) });
    expect(row!.audioObjectKey).toBeNull();
    expect(row!.audioExpiresAt).toBeNull();
    expect(row!.durationSec).toBe(3);

    const detail = await as(w.teacher).get(`/api/lessons/${expired.id}`);
    expect(detail.body.hasAudio).toBe(false);
    expect((await as(w.teacher).get(`/api/lessons/${expired.id}/audio`)).status).toBe(404);
  });
});
