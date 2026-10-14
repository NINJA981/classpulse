/**
 * AI grading suggestion. The suggestion is stored on the submission and shown to the teacher, who reviews and
 * edits it; it is never applied as a grade by the server, and nothing reaches the student until the teacher
 * saves a grade and returns the work.
 * Only typed text and JPEG/PNG photos are sent (at most MAX_IMAGES, each at most MAX_IMAGE_BYTES).
 * Student work that looks like it addresses the grader (prompt injection) is flagged `injectionSuspected`,
 * either by the heuristics below or by the model; the teacher sees a warning and the marks are not prefilled.
 */
import { eq } from 'drizzle-orm';
import { DEFAULT_MODEL_SETTINGS, type AiGradeSuggestion, type SessionUser } from '@classiq/shared';
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

/**
 * Phrases in student work aimed at an AI grader rather than the assignment. Deliberately narrow: a match
 * only shows the teacher a warning, it never changes the marks.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|above|prior|earlier|all|any|your|the|these|those)\b[^.\n]{0,25}\b(instructions?|prompts?|rules?|rubric|directions?|guidelines?)\b/i,
  /\b(give|award|assign|grant)\b[^.\n]{0,30}\b(full|maximum|max|perfect|all( the)?|top|highest|100\s*%?)\s+(marks?|points?|scores?|grades?)\b/i,
  /\b(system prompt|system message|developer message|new instructions?|hidden instructions?|jailbreak)\b/i,
  /\b(note|message|attention|instructions?) (to|for) (the )?(ai|grader|marker|examiner|assistant|model|chatgpt|gpt|llm)\b/i,
  /\b(dear|hey|hi|hello) (ai|grader|marker|chatgpt|gpt|assistant|model|llm)\b/i,
  /\b(ai|grader|marker|assistant|model|chatgpt|gpt|llm)\s*[:,]\s*(please\s+)?(give|award|mark|grade|ignore|assign|disregard|rate)\b/i,
  /\bas an? (ai|language model)\b/i,
  /<<<|>>>|\[\/?(system|inst|assistant)\]|<\/?(system|assistant|instructions?)>|<\|im_(start|end)\|>/i,
];

/** True when the text contains instruction-like phrases addressed to an AI grader. */
export function looksLikePromptInjection(text: string | null | undefined): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/** A student file name as it may appear in prompts and AI notes: printable characters only, at most 60. */
export function safeFileName(name: string): string {
  const clean = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._()-]/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= 60) return clean || 'file';
  const dot = clean.lastIndexOf('.');
  const ext = dot > 0 && clean.length - dot <= 8 ? clean.slice(dot) : '';
  return `${clean.slice(0, 60 - ext.length - 1)}…${ext}`;
}

async function readObject(key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.read(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function suggestGrade(user: SessionUser, id: string, submissionId: string): Promise<AiGradeSuggestion> {
  const a = await getTeacherAssignment(user, id);
  const sub = await getSubmissionRow(a, submissionId);
  const files = (await filesBySubmission([sub.id])).get(sub.id) ?? [];

  const images: GradeImage[] = [];
  const skippedFiles: string[] = [];
  for (const f of files) {
    const name = safeFileName(f.originalName);
    if (!READABLE_IMAGES.has(f.mime)) skippedFiles.push(`${name} (only JPEG and PNG photos are read)`);
    else if (f.sizeBytes > MAX_IMAGE_BYTES) skippedFiles.push(`${name} (larger than 4 MB)`);
    else if (images.length >= MAX_IMAGES) skippedFiles.push(`${name} (only ${MAX_IMAGES} photos are read)`);
    else images.push({ name, mime: f.mime as GradeImage['mime'], data: await readObject(f.objectKey) });
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
  const injectionSuspected =
    Boolean(result.injectionSuspected) || looksLikePromptInjection(sub.text) || files.some((f) => looksLikePromptInjection(f.originalName));
  const suggestion: AiGradeSuggestion = {
    rubricMarks: clampToRubric(a.rubric, result.rubricMarks, false),
    feedback: result.feedback,
    note: result.note,
    model: result.model,
    createdAt: new Date().toISOString(),
    injectionSuspected,
  };
  await db.update(assignmentSubmissions).set({ aiSuggestion: suggestion }).where(eq(assignmentSubmissions.id, sub.id));
  return suggestion;
}
