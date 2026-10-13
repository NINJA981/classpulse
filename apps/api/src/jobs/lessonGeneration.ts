/**
 * Lesson processing job: STT (Sarvam/Whisper), then — only when the teacher has
 * asked for a quiz (`lessons.quiz_request`) — LLM (OpenAI) questions/assignment.
 * Without a request the lesson ends `transcribed`, waiting for the teacher's
 * number of questions and difficulty. Signatures are part of the frozen contract
 * used by lessonWorker.ts.
 *
 * Every write is guarded by `generation_attempt`, so a stale job (superseded by
 * a regenerate) can never overwrite newer state. There is no fake content: on
 * failure the job throws and, after the final attempt, the lesson is `failed`.
 */
import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
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
import { AI_AUDIO_LIMIT_MESSAGE } from '../lib/aiUsage.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { storage } from '../lib/storage.js';
import { queueLessonGeneration } from '../modules/lessons/audio.js';
import { GENERIC_FAILURE_MESSAGE, PipelineError, isPipelineError } from '../pipeline/errors.js';
import { providers } from '../pipeline/providers.js';
import { notifyUser } from '../realtime/notify.js';
import { notifyLessonFailed, notifyLessonReady, notifyLessonTranscribed } from './lessonNotify.js';
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
  const request = lesson.quizRequest;
  if (reusable) {
    segments = lesson.transcriptSegments!;
    if (!request) {
      await finishTranscribed(lesson, data, {});
      return;
    }
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
    // The STT clients need a file path: the stored file itself (local) or a temp download (S3).
    const audioKey = lesson.audioObjectKey;
    const stt = await storage.withLocalFile(audioKey, (audioPath) =>
      providers.transcribe({
        provider: settings.sttProvider === 'openai' ? 'openai' : 'sarvam',
        audioPath,
        language,
        durationSec: lesson.durationSec ?? 0,
        model: settings.sttModel,
        usage: { institutionId: lesson.institutionId, lessonId: lesson.id, kind: 'stt' },
      }),
    );
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
    const transcriptFields = { transcript: stt.transcript, transcriptSegments: stt.segments, pipelineMeta: { ...meta, timingsMs: timings } };
    if (!request) {
      await finishTranscribed(lesson, data, transcriptFields);
      log.info({ timings }, 'Transcription complete; waiting for the teacher to generate the quiz');
      return;
    }
    const saved = await advance(lesson, data, 'generating', 60, 'Writing questions', transcriptFields);
    if (!saved) return;
  }

  // 2. Generate what the teacher asked for. Questions they keep (append / replace_unapproved) are sent as
  //    context so the new ones test other points; a fresh quiz also gets the summary and assignment.
  const existing = await db
    .select({ id: questions.id, stem: questions.stem, status: questions.status, editedByTeacher: questions.editedByTeacher })
    .from(questions)
    .where(eq(questions.lessonId, lesson.id))
    .orderBy(asc(questions.position));
  const keep =
    request.mode === 'append'
      ? existing
      : request.mode === 'replace_unapproved'
        ? existing.filter((q) => q.status === 'approved' || q.editedByTeacher)
        : [];
  const full = request.mode === 'replace_all' || !lesson.summary;
  const genInput = {
    title: lesson.title,
    subject: lesson.subject,
    language,
    segments,
    questionsPerLesson: request.questionCount,
    difficulty: request.difficulty,
    existingStems: keep.map((q) => q.stem),
    bilingual: settings.bilingual,
    model: settings.llmModel,
    usage: { institutionId: lesson.institutionId, lessonId: lesson.id, kind: full ? ('quiz' as const) : ('questions' as const) },
  };
  const started = Date.now();
  const gen = full ? await providers.generate(genInput) : { ...(await providers.generateQuestions(genInput)), summary: null };
  timings.llmMs = Date.now() - started;

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
    const keepIds = keep.map((q) => q.id);
    await tx
      .delete(questions)
      .where(keepIds.length ? and(eq(questions.lessonId, lesson.id), notInArray(questions.id, keepIds)) : eq(questions.lessonId, lesson.id));
    for (const [i, id] of keepIds.entries()) {
      await tx.update(questions).set({ position: i + 1 }).where(eq(questions.id, id));
    }
    await tx.insert(questions).values(
      gen.questions.map((q, i) => ({
        lessonId: lesson.id,
        position: keepIds.length + i + 1,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: q.options,
        optionsLocal: q.optionsLocal,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        explanationLocal: q.explanationLocal,
        difficulty: q.difficulty,
        topicTag: q.topicTag,
        bloomLevel: q.bloomLevel ?? null,
        competency: q.competency ?? null,
        citationStartSec: q.citationStartSec,
        citationEndSec: q.citationEndSec,
        status: 'draft' as const,
        editedByTeacher: false,
      })),
    );
    if (gen.summary !== null) {
      const assignment = {
        title: gen.assignment.title,
        prompt: gen.assignment.prompt,
        rubric: gen.assignment.rubric,
        estimatedMinutes: gen.assignment.estimatedMinutes,
        status: 'draft' as const,
      };
      // The lesson's AI-drafted ("primary") assignment. Starting over replaces it; otherwise a teacher-edited one
      // is kept. Extra assignments the teacher added to the lesson are never touched.
      const upsert = tx
        .insert(assignments)
        .values({ lessonId: lesson.id, sectionId: lesson.sectionId, teacherId: lesson.teacherId, isPrimary: true, ...assignment });
      const primary = sql`${assignments.isPrimary}`;
      await (request.mode === 'replace_all'
        ? upsert.onConflictDoUpdate({ target: assignments.lessonId, targetWhere: primary, set: assignment })
        : upsert.onConflictDoNothing({ target: assignments.lessonId, where: primary }));
    }
    await tx
      .update(lessons)
      .set({
        ...(gen.summary !== null ? { summary: gen.summary, keyTakeaways: gen.keyTakeaways } : {}),
        pipelineMeta: finalMeta,
        status: 'ready_for_review',
        progressPct: 100,
        progressMessage: 'Ready for review',
        failureReason: null,
        quizRequest: null,
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
  notifyLessonReady(lesson, gen.questions.length, keep.length > 0);
  log.info(
    { questions: gen.questions.length, kept: keep.length, mode: request.mode, timings, demo: finalMeta.demoFallback },
    'Lesson generation complete',
  );
}

/** Transcription-only run: the lesson waits for the teacher's quiz settings. */
async function finishTranscribed(lesson: LessonRow, data: LessonJobData, extra: Partial<typeof lessons.$inferInsert>): Promise<void> {
  const message = 'Transcript ready. Choose the number of questions and the difficulty.';
  const rows = await db
    .update(lessons)
    .set({ status: 'transcribed', progressPct: 100, progressMessage: message, failureReason: null, quizRequest: null, ...extra })
    .where(and(guard(data), inArray(lessons.status, [...LESSON_PROCESSING_STATUSES])))
    .returning({ id: lessons.id });
  if (!rows.length) return;
  pushProgress(lesson, data, 'transcribed', 100, message);
  notifyLessonTranscribed(lesson);
}

/** Called once after the final attempt fails: mark the lesson `failed` with a sanitized reason. */
export async function markLessonJobFailed(data: LessonJobData, err: Error): Promise<void> {
  const reason = isPipelineError(err) ? err.userMessage : GENERIC_FAILURE_MESSAGE;
  logger.error({ lessonId: data.lessonId, generation: data.attempt, err: err.message }, 'Lesson generation failed');
  try {
    const [row] = await db
      .update(lessons)
      .set({ status: 'failed', failureReason: reason.slice(0, 500), progressMessage: null, quizRequest: null })
      .where(and(guard(data), inArray(lessons.status, [...LESSON_PROCESSING_STATUSES])))
      .returning({
        id: lessons.id,
        title: lessons.title,
        teacherId: lessons.teacherId,
        institutionId: lessons.institutionId,
        generationAttempt: lessons.generationAttempt,
        progressPct: lessons.progressPct,
      });
    if (row) {
      pushProgress(row, data, 'failed', row.progressPct, reason);
      // Only the call that actually moved the lesson to `failed` notifies: a stale or repeated call updates nothing.
      notifyLessonFailed(row, reason);
    }
  } catch (dbErr) {
    logger.error({ err: dbErr, lessonId: data.lessonId }, 'Could not mark lesson as failed');
  }
}

/** On worker startup: re-enqueue or fail lessons stuck in queued/transcribing/generating with no live job. */
export async function recoverStuckLessons(): Promise<void> {
  const stuck = await db
    .select({ id: lessons.id, attempt: lessons.generationAttempt, audioObjectKey: lessons.audioObjectKey, quizRequest: lessons.quizRequest })
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
      try {
        await queueLessonGeneration(lesson.id, lesson.quizRequest ?? null);
      } catch (err) {
        // The school ran out of monthly AI minutes since the lesson was queued: fail it visibly.
        if (err instanceof AppError && err.message === AI_AUDIO_LIMIT_MESSAGE) {
          await markLessonJobFailed(
            { lessonId: lesson.id, attempt: lesson.attempt },
            new PipelineError('AI audio limit reached', { retryable: false, userMessage: AI_AUDIO_LIMIT_MESSAGE }),
          );
          continue;
        }
        throw err;
      }
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
