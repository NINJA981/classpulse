/** Lesson business rules: visibility/ownership, state machine, publish, assignment, manual questions. */
import { and, count, eq, inArray, max } from 'drizzle-orm';
import type {
  Assignment,
  AssignmentInput,
  CreateLessonInput,
  GenerateLessonInput,
  LessonDetail,
  LessonSummary,
  LessonTranscript,
  ListLessonsQuery,
  Paginated,
  Question,
  QuestionInput,
  SessionUser,
  UpdateLessonInput,
} from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { assignments, lessons, questions, quizAttempts, sections, sectionTeachers } from '../../db/schema/index.js';
import { badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { storage } from '../../lib/storage.js';
import { queueLessonGeneration } from './audio.js';
import { hasLiveAudio, toAssignment, toLessonDetail, toLessonSummary, toQuestion, type LessonRow } from './mappers.js';
import {
  assertContentEditable,
  countQuestions,
  getOwnedLesson,
  getVisibleLesson,
  isBusy,
  lessonAssignment,
  lessonNames,
  lessonQuestions,
  listLessonSummaries,
  visibleLessonsWhere,
} from './repo.js';

export async function buildLessonDetail(lesson: LessonRow, dbx: DbOrTx = db): Promise<LessonDetail> {
  const [names, qs, assignment] = await Promise.all([lessonNames(lesson, dbx), lessonQuestions(lesson.id, dbx), lessonAssignment(lesson.id, dbx)]);
  return toLessonDetail({ lesson, ...names }, qs, assignment);
}

export async function listLessons(user: SessionUser, query: ListLessonsQuery): Promise<Paginated<LessonSummary>> {
  const where = and(
    visibleLessonsWhere(user),
    query.status ? eq(lessons.status, query.status) : undefined,
    query.sectionId ? eq(lessons.sectionId, query.sectionId) : undefined,
  );
  const page = await listLessonSummaries(where, query.page, query.pageSize);
  return { ...page, items: page.items.map(toLessonSummary) };
}

export async function getLesson(user: SessionUser, id: string): Promise<LessonDetail> {
  return buildLessonDetail(await getVisibleLesson(user, id));
}

export async function createLesson(user: SessionUser, input: CreateLessonInput): Promise<LessonDetail> {
  const [section] = await db
    .select({ id: sections.id, teacherId: sectionTeachers.teacherId })
    .from(sections)
    .leftJoin(sectionTeachers, and(eq(sectionTeachers.sectionId, sections.id), eq(sectionTeachers.teacherId, user.id)))
    .where(and(eq(sections.id, input.sectionId), eq(sections.institutionId, user.institutionId)));
  if (!section) throw notFound('Section');
  if (!section.teacherId) throw forbidden('You can only create lessons for sections you teach');

  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: user.institutionId,
      teacherId: user.id,
      sectionId: input.sectionId,
      title: input.title,
      subject: input.subject,
      language: input.language,
      status: 'draft',
    })
    .returning();
  return buildLessonDetail(lesson!);
}

export async function updateLesson(user: SessionUser, id: string, input: UpdateLessonInput): Promise<LessonDetail> {
  const lesson = await getOwnedLesson(user, id);
  assertContentEditable(lesson);
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (!Object.keys(patch).length) return buildLessonDetail(lesson);
  const [updated] = await db.update(lessons).set(patch).where(eq(lessons.id, id)).returning();
  return buildLessonDetail(updated!);
}

export async function deleteLesson(user: SessionUser, id: string): Promise<void> {
  const lesson = await getOwnedLesson(user, id);
  if (lesson.status !== 'draft' && lesson.status !== 'failed') {
    throw invalidState('Only draft or failed lessons can be deleted.');
  }
  const [attempts] = await db.select({ n: count() }).from(quizAttempts).where(eq(quizAttempts.lessonId, id));
  if ((attempts?.n ?? 0) > 0) throw invalidState('This lesson has quiz attempts and cannot be deleted.');
  await db.delete(lessons).where(eq(lessons.id, id));
  if (lesson.audioObjectKey) {
    await storage.delete(lesson.audioObjectKey).catch((err: Error) => logger.warn({ err: err.message, lessonId: id }, 'Failed to delete lesson audio'));
  }
}

/* ----------------------------------------------------------------------------
 * Audio
 * ------------------------------------------------------------------------- */

const AUDIO_UPLOAD_STATUSES = new Set(['draft', 'failed', 'ready_for_review']);

/** Checked before accepting an upload body, and again before attaching it. */
export async function assertCanUploadAudio(user: SessionUser, id: string): Promise<LessonRow> {
  const lesson = await getOwnedLesson(user, id);
  if (!AUDIO_UPLOAD_STATUSES.has(lesson.status)) {
    throw invalidState('Audio can only be uploaded to draft, failed or ready-for-review lessons.');
  }
  return lesson;
}

export async function getAudioObject(user: SessionUser, id: string): Promise<{ key: string; size: number; mimeType: string }> {
  const lesson = await getVisibleLesson(user, id);
  if (!hasLiveAudio(lesson)) throw notFound('Audio');
  const stat = await storage.stat(lesson.audioObjectKey!);
  if (!stat) throw notFound('Audio');
  return { key: lesson.audioObjectKey!, size: stat.size, mimeType: lesson.audioMimeType ?? 'audio/wav' };
}

export async function getTranscript(user: SessionUser, id: string): Promise<LessonTranscript> {
  const lesson = await getVisibleLesson(user, id);
  return { transcript: lesson.transcript, segments: lesson.transcriptSegments ?? [] };
}

/* ----------------------------------------------------------------------------
 * Generation / publishing
 * ------------------------------------------------------------------------- */

export async function requestGeneration(user: SessionUser, id: string, input: GenerateLessonInput): Promise<{ jobId: string }> {
  const lesson = await getOwnedLesson(user, id);
  if (isBusy(lesson.status)) throw invalidState('This lesson is already being recorded or processed.');
  if (!hasLiveAudio(lesson)) throw invalidState('Upload or record the lesson audio before generating questions.');

  const hasQuestions = (await countQuestions(id)) > 0;
  if ((hasQuestions || lesson.status === 'published') && input.confirmRegenerate !== true) {
    throw invalidState(
      lesson.status === 'published'
        ? 'This lesson is published. Regenerating will unpublish it and replace its questions — confirm to continue.'
        : 'This lesson already has questions. Regenerating will replace them — confirm to continue.',
    );
  }
  if (lesson.status === 'published') await setPublished(lesson.id, false);
  const jobId = await queueLessonGeneration(id);
  return { jobId };
}

async function setPublished(lessonId: string, published: boolean): Promise<LessonRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(lessons)
      .set(published ? { status: 'published', publishedAt: new Date() } : { status: 'ready_for_review', publishedAt: null })
      .where(eq(lessons.id, lessonId))
      .returning();
    await tx
      .update(assignments)
      .set({ status: published ? 'published' : 'draft' })
      .where(eq(assignments.lessonId, lessonId));
    return row!;
  });
}

export async function publishLesson(user: SessionUser, id: string): Promise<LessonDetail> {
  const lesson = await getOwnedLesson(user, id);
  if (lesson.status !== 'ready_for_review') throw invalidState('Only lessons that are ready for review can be published.');
  if ((await countQuestions(id, ['approved'])) === 0) throw invalidState('Approve at least one question before publishing.');
  return buildLessonDetail(await setPublished(id, true));
}

export async function unpublishLesson(user: SessionUser, id: string): Promise<LessonDetail> {
  const lesson = await getOwnedLesson(user, id);
  if (lesson.status !== 'published') throw invalidState('The lesson is not published.');
  return buildLessonDetail(await setPublished(id, false));
}

export async function upsertAssignment(user: SessionUser, id: string, input: AssignmentInput): Promise<Assignment> {
  const lesson = await getOwnedLesson(user, id);
  assertContentEditable(lesson);
  const values = {
    title: input.title,
    prompt: input.prompt,
    rubric: input.rubric,
    estimatedMinutes: input.estimatedMinutes ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
  };
  const [row] = await db
    .insert(assignments)
    .values({ lessonId: id, status: 'draft', ...values })
    .onConflictDoUpdate({ target: assignments.lessonId, set: values })
    .returning();
  return toAssignment(row!);
}

/* ----------------------------------------------------------------------------
 * Questions scoped to a lesson
 * ------------------------------------------------------------------------- */

export function assertCitationRange(start: number | null | undefined, end: number | null | undefined): void {
  if (start != null && end != null && end < start) throw badRequest('citationEndSec must not be before citationStartSec');
}

export async function addQuestion(user: SessionUser, id: string, input: QuestionInput): Promise<Question> {
  const lesson = await getOwnedLesson(user, id);
  assertContentEditable(lesson);
  assertCitationRange(input.citationStartSec, input.citationEndSec);
  return db.transaction(async (tx) => {
    // Serialize concurrent adds on the lesson row so positions stay unique.
    await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, id)).for('update');
    const [pos] = await tx.select({ max: max(questions.position) }).from(questions).where(eq(questions.lessonId, id));
    const [row] = await tx
      .insert(questions)
      .values({
        lessonId: id,
        position: (pos?.max ?? 0) + 1,
        stem: input.stem,
        stemLocal: input.stemLocal ?? null,
        options: input.options,
        optionsLocal: input.optionsLocal ?? null,
        correctIndex: input.correctIndex,
        explanation: input.explanation ?? null,
        explanationLocal: input.explanationLocal ?? null,
        difficulty: input.difficulty,
        topicTag: input.topicTag ?? null,
        citationStartSec: input.citationStartSec ?? null,
        citationEndSec: input.citationEndSec ?? null,
        status: 'approved',
        editedByTeacher: true,
      })
      .returning();
    return toQuestion(row!);
  });
}

export async function approveAllQuestions(user: SessionUser, id: string): Promise<Question[]> {
  const lesson = await getOwnedLesson(user, id);
  assertContentEditable(lesson);
  await db
    .update(questions)
    .set({ status: 'approved' })
    .where(and(eq(questions.lessonId, id), inArray(questions.status, ['draft'])));
  return (await lessonQuestions(id)).map(toQuestion);
}
