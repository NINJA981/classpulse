/**
 * AI grading suggestion. The suggestion is stored on the submission and shown to the teacher, who reviews and
 * edits it; nothing reaches the student until the teacher saves a grade and returns the work.
 * Only typed text and JPEG/PNG photos are sent (at most MAX_IMAGES, each at most MAX_IMAGE_BYTES).
 */
import { eq } from 'drizzle-orm';
import { DEFAULT_MODEL_SETTINGS, type AiGradeSuggestion, type SessionUser } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { assignmentSubmissions, modelSettings, sections } from '../../db/schema/index.js';
import { AppError, invalidState } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { isPipelineError } from '../../pipeline/errors.js';
import { providers } from '../../pipeline/providers.js';
import type { GradeImage, GradeResult } from '../../pipeline/types.js';
import { clampToRubric, filesBySubmission, getTeacherAssignment } from './repo.js';
import { getSubmissionRow } from './service.js';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const READABLE_IMAGES = new Set(['image/jpeg', 'image/png']);

async function readObject(key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of storage.read(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function suggestGrade(user: SessionUser, id: string, submissionId: string): Promise<AiGradeSuggestion> {
  const a = await getTeacherAssignment(user, id);
  const sub = await getSubmissionRow(a, submissionId);
  const files = (await filesBySubmission([sub.id])).get(sub.id) ?? [];

  const images: GradeImage[] = [];
  const skippedFiles: string[] = [];
  for (const f of files) {
    if (!READABLE_IMAGES.has(f.mime)) skippedFiles.push(`${f.originalName} (only JPEG and PNG photos are read)`);
    else if (f.sizeBytes > MAX_IMAGE_BYTES) skippedFiles.push(`${f.originalName} (larger than 4 MB)`);
    else if (images.length >= MAX_IMAGES) skippedFiles.push(`${f.originalName} (only ${MAX_IMAGES} photos are read)`);
    else images.push({ name: f.originalName, mime: f.mime as GradeImage['mime'], data: await readObject(f.objectKey) });
  }
  if (!sub.text?.trim() && !images.length) {
    throw invalidState('The AI can only read typed answers and JPEG or PNG photos, and this submission has neither.');
  }

  const [settings] = await db
    .select({ llmModel: modelSettings.llmModel })
    .from(sections)
    .innerJoin(modelSettings, eq(modelSettings.institutionId, sections.institutionId))
    .where(eq(sections.id, a.sectionId));
  let result: GradeResult;
  try {
    result = await providers.gradeSubmission({
      title: a.title,
      prompt: a.prompt,
      rubric: a.rubric,
      text: sub.text,
      images,
      skippedFiles,
      model: settings?.llmModel ?? DEFAULT_MODEL_SETTINGS.llmModel,
      usage: { institutionId: user.institutionId, lessonId: a.lessonId ?? null, kind: 'grading' },
    });
  } catch (err) {
    if (isPipelineError(err)) throw new AppError('UPSTREAM_FAILED', err.userMessage);
    throw err;
  }
  const suggestion: AiGradeSuggestion = {
    rubricMarks: clampToRubric(a.rubric, result.rubricMarks, false),
    feedback: result.feedback,
    note: result.note,
    model: result.model,
    createdAt: new Date().toISOString(),
  };
  await db.update(assignmentSubmissions).set({ aiSuggestion: suggestion }).where(eq(assignmentSubmissions.id, sub.id));
  return suggestion;
}
