/**
 * Lesson generation job: STT (Sarvam) -> LLM (OpenAI) -> questions/assignment.
 * Signatures are part of the frozen contract used by lessonWorker.ts.
 *
 * Every write is guarded by `generation_attempt`, so a stale job (superseded by
 * a regenerate) can never overwrite newer state. There is no fake content: on
 * failure the job throws and, after the final attempt, the lesson is `failed`.
 */
import { and, eq, inArray } from 'drizzle-orm';
import {
  DEFAULT_MODEL_SETTINGS,
  LESSON_PROCESSING_STATUSES,
  type Language,
  type LessonProgress,
  type LessonStatus,
  type TranscriptSegment,
} from '@classpulse/shared';
import { db } from '../db/client.js';
import { assignments, lessons, modelSettings, questions, type PipelineMeta } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import { queueLessonGeneration } from '../modules/lessons/audio.js';
import { GENERIC_FAILURE_MESSAGE, PipelineError, isPipelineError } from '../pipeline/errors.js';
import { providers } from '../pipeline/providers.js';
import { notifyUser } from '../realtime/notify.js';
import { isLessonJobLive, type LessonJobData } from './queue.js';

export interface LessonJobContext {
  attemptNumber: number;
  maxAttempts: number;
}

type LessonRow = typeof lessons.$inferSelect;

const guard = (data: LessonJobData) => and(eq(lessons.id, data.lessonId), eq(lessons.generationAttempt, data.attempt));

function pushProgress(lesson: Pick<LessonRow, 'id' | 'teacherId'>, data: LessonJobData, status: LessonStatus, progressPct: number, message: string) {
  const payload: LessonProgress = { lessonId: lesson.id, status, progressPct, message, attempt: data.attempt };
  notifyUser(lesson.teacherId, 'lesson:progress', payload);
}

/** Update status/progress if this job is still current. Returns false when the job is stale. */
async function advance(
  lesson: LessonRow,
  data: LessonJobData,
  status: LessonStatus,
  progressPct: number,
  message: string,
  extra: Partial<typeof lessons.$inferInsert> = {},
): Promise<boolean> {
  const rows = await db
    .update(lessons)
    .set({ status, progressPct, progressMessage: message, ...extra })
    .where(and(guard(data), inArray(lessons.status, [...LESSON_PROCESSING_STATUSES])))
    .returning({ id: lessons.id });
  if (!rows.length) return false;
  pushProgress(lesson, data, status, progressPct, message);
  return true;
}

/** Run STT + LLM generation for a lesson. Must throw on failure (so the attempt is retried). */
export async function processLessonJob(data: LessonJobData, ctx: LessonJobContext): Promise<void> {
  const log = logger.child({ lessonId: data.lessonId, generation: data.attempt, try: ctx.attemptNumber });
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, data.lessonId) });
  if (!lesson || lesson.generationAttempt !== data.attempt) {
    log.info('Skipping stale or deleted lesson job');
    return;
  }
  if (!LESSON_PROCESSING_STATUSES.includes(lesson.status)) {
    log.info({ status: lesson.status }, 'Lesson is not awaiting processing; skipping job');
    return;
  }
  if (!lesson.audioObjectKey) {
    throw new PipelineError('Lesson has no audio', { retryable: false, userMessage: 'The lesson has no audio to process.' });
  }

  const settings = (await db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, lesson.institutionId) })) ?? DEFAULT_MODEL_SETTINGS;
  const language = lesson.language as Language;
  const timings: Record<string, number> = {};
  const meta: PipelineMeta = { ...(lesson.pipelineMeta ?? {}) };

  // 1. Transcribe — reuse a transcript of this exact audio object (saves STT cost on regenerate / retry).
  let segments: TranscriptSegment[];
  const reusable =
    !!lesson.transcript && !!lesson.transcriptSegments?.length && meta.transcriptAudioKey === lesson.audioObjectKey && !meta.sttDemo;
  if (reusable) {
    segments = lesson.transcriptSegments!;
    if (!(await advance(lesson, data, 'generating', 60, 'Writing questions'))) return;
    log.info('Reusing stored transcript for this audio');
  } else {
    if (!(await advance(lesson, data, 'transcribing', 10, 'Transcribing the recording'))) return;
    if (!(await storage.stat(lesson.audioObjectKey))) {
      throw new PipelineError('Audio object missing from storage', {
        retryable: false,
        userMessage: 'The lesson audio is no longer available. Upload it again.',
      });
    }
    const started = Date.now();
    const stt = await providers.transcribe({
      audioPath: storage.localPath(lesson.audioObjectKey),
      language,
      durationSec: lesson.durationSec ?? 0,
      model: settings.sttModel,
    });
    timings.sttMs = Date.now() - started;
    segments = stt.segments;
    Object.assign(meta, {
      sttProvider: stt.meta.provider,
      sttModel: stt.meta.model,
      approximateTimestamps: stt.meta.approximateTimestamps,
      sttDemo: stt.meta.demoFallback,
      transcriptAudioKey: lesson.audioObjectKey,
    });
    if (stt.meta.demoFallback) meta.demoFallback = true;
    const saved = await advance(lesson, data, 'generating', 60, 'Writing questions', {
      transcript: stt.transcript,
      transcriptSegments: stt.segments,
      pipelineMeta: meta,
    });
    if (!saved) return;
  }

  // 2. Generate questions, summary and assignment
  const started = Date.now();
  const gen = await providers.generate({
    title: lesson.title,
    subject: lesson.subject,
    language,
    segments,
    questionsPerLesson: settings.questionsPerLesson,
    bilingual: settings.bilingual,
    model: settings.llmModel,
  });
  timings.llmMs = Date.now() - started;
  if (gen.questions.length !== settings.questionsPerLesson) {
    throw new PipelineError('Generator returned the wrong number of questions', { retryable: false, userMessage: GENERIC_FAILURE_MESSAGE });
  }

  // 3. Persist atomically (only if this job is still current)
  const finalMeta: PipelineMeta = {
    ...meta,
    llmProvider: gen.meta.provider,
    llmModel: gen.meta.model,
    llmRepaired: gen.meta.repaired ?? false,
    demoFallback: !!(meta.sttDemo || gen.meta.demoFallback),
    timingsMs: timings,
    completedAt: new Date().toISOString(),
  };
  const committed = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(guard(data), eq(lessons.status, 'generating')))
      .for('update');
    if (!current) return false;
    await tx.delete(questions).where(eq(questions.lessonId, lesson.id));
    await tx.insert(questions).values(
      gen.questions.map((q, i) => ({
        lessonId: lesson.id,
        position: i + 1,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: q.options,
        optionsLocal: q.optionsLocal,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        explanationLocal: q.explanationLocal,
        difficulty: q.difficulty,
        topicTag: q.topicTag,
        citationStartSec: q.citationStartSec,
        citationEndSec: q.citationEndSec,
        status: 'draft' as const,
        editedByTeacher: false,
      })),
    );
    const assignment = {
      title: gen.assignment.title,
      prompt: gen.assignment.prompt,
      rubric: gen.assignment.rubric,
      estimatedMinutes: gen.assignment.estimatedMinutes,
      status: 'draft' as const,
    };
    await tx
      .insert(assignments)
      .values({ lessonId: lesson.id, ...assignment })
      .onConflictDoUpdate({ target: assignments.lessonId, set: assignment });
    await tx
      .update(lessons)
      .set({
        summary: gen.summary,
        keyTakeaways: gen.keyTakeaways,
        pipelineMeta: finalMeta,
        status: 'ready_for_review',
        progressPct: 100,
        progressMessage: 'Ready for review',
        failureReason: null,
        remedial: null,
      })
      .where(eq(lessons.id, lesson.id));
    return true;
  });
  if (!committed) {
    log.info('Lesson changed during generation; discarding stale result');
    return;
  }
  pushProgress(lesson, data, 'ready_for_review', 100, 'Ready for review');
  log.info({ questions: gen.questions.length, timings, demo: finalMeta.demoFallback }, 'Lesson generation complete');
}

/** Called once after the final attempt fails: mark the lesson `failed` with a sanitized reason. */
export async function markLessonJobFailed(data: LessonJobData, err: Error): Promise<void> {
  const reason = isPipelineError(err) ? err.userMessage : GENERIC_FAILURE_MESSAGE;
  logger.error({ lessonId: data.lessonId, generation: data.attempt, err: err.message }, 'Lesson generation failed');
  try {
    const [row] = await db
      .update(lessons)
      .set({ status: 'failed', failureReason: reason.slice(0, 500), progressMessage: null })
      .where(and(guard(data), inArray(lessons.status, [...LESSON_PROCESSING_STATUSES])))
      .returning({ id: lessons.id, teacherId: lessons.teacherId, progressPct: lessons.progressPct });
    if (row) pushProgress(row, data, 'failed', row.progressPct, reason);
  } catch (dbErr) {
    logger.error({ err: dbErr, lessonId: data.lessonId }, 'Could not mark lesson as failed');
  }
}

/** On worker startup: re-enqueue or fail lessons stuck in queued/transcribing/generating with no live job. */
export async function recoverStuckLessons(): Promise<void> {
  const stuck = await db
    .select({ id: lessons.id, attempt: lessons.generationAttempt, audioObjectKey: lessons.audioObjectKey })
    .from(lessons)
    .where(inArray(lessons.status, [...LESSON_PROCESSING_STATUSES]));
  for (const lesson of stuck) {
    try {
      if (await isLessonJobLive({ lessonId: lesson.id, attempt: lesson.attempt })) continue;
      if (!lesson.audioObjectKey) {
        await markLessonJobFailed({ lessonId: lesson.id, attempt: lesson.attempt }, new PipelineError('No audio', {
          retryable: false,
          userMessage: 'The lesson audio is missing. Upload it again.',
        }));
        continue;
      }
      await queueLessonGeneration(lesson.id);
      logger.warn({ lessonId: lesson.id }, 'Re-queued lesson stuck in processing');
    } catch (err) {
      logger.error({ err, lessonId: lesson.id }, 'Failed to recover stuck lesson');
    }
  }
}

/** Whether an error should be retried (network/5xx/timeouts) or fail immediately (bad audio, config). */
export function isRetryable(err: unknown): boolean {
  if (isPipelineError(err)) return err.retryable;
  return true;
}
