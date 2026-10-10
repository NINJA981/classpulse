/** Test fixtures for lessons: a generated WAV tone and DB/storage seeding helpers. */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { QuizRequest, TranscriptSegment } from '@classpulse/shared';
import { db } from '../../src/db/client.js';
import { lessons, questions, quizAttemptAnswers, quizAttempts } from '../../src/db/schema/index.js';
import { storage, storageKeys } from '../../src/lib/storage.js';
import { parseGenerationOutput, promptBlocks } from '../../src/pipeline/llm.js';
import type { GenerateInput, GenerateQuestionsResult, GenerateResult, TranscribeResult } from '../../src/pipeline/types.js';

/** 16-bit PCM mono WAV containing a sine tone. */
export function makeWav(seconds = 3, sampleRate = 16000, freq = 440): Buffer {
  const samples = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 8000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export async function writeTempFile(name: string, body: Buffer | string): Promise<string> {
  const dir = path.join(storage.tmpDir, 'fixtures');
  await mkdir(dir, { recursive: true });
  const p = path.join(dir, `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${name}`);
  await writeFile(p, body);
  return p;
}

export async function insertLesson(opts: {
  institutionId: string;
  teacherId: string;
  sectionId: string;
  status?: (typeof lessons.$inferInsert)['status'];
  withAudio?: boolean;
  language?: string;
  generationAttempt?: number;
  audioExpiresAt?: Date;
  quizRequest?: QuizRequest | null;
}) {
  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: opts.institutionId,
      teacherId: opts.teacherId,
      sectionId: opts.sectionId,
      title: 'Photosynthesis',
      subject: 'Biology',
      language: opts.language ?? 'en-IN',
      status: opts.status ?? 'draft',
      generationAttempt: opts.generationAttempt ?? 0,
      quizRequest: opts.quizRequest ?? null,
    })
    .returning();
  if (!opts.withAudio) return lesson!;
  const key = storageKeys.lessonAudio(lesson!.id);
  const stat = await storage.put(key, makeWav(3));
  const [updated] = await db
    .update(lessons)
    .set({
      audioObjectKey: key,
      audioMimeType: 'audio/wav',
      audioSizeBytes: stat.size,
      durationSec: 3,
      sourceType: 'upload',
      audioExpiresAt: opts.audioExpiresAt ?? new Date(Date.now() + 86400_000),
    })
    .where(eq(lessons.id, lesson!.id))
    .returning();
  return updated!;
}

export async function insertQuestions(lessonId: string, n: number, status: 'draft' | 'approved' | 'rejected' = 'draft') {
  return db
    .insert(questions)
    .values(
      Array.from({ length: n }, (_, i) => ({
        lessonId,
        position: i + 1,
        stem: `Question ${i + 1}?`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: i % 4,
        difficulty: 'medium' as const,
        topicTag: `Topic ${i + 1}`,
        status,
      })),
    )
    .returning();
}

/** Insert a graded attempt with answers (selected indices per question, null = skipped). */
export async function insertAttempt(
  lessonId: string,
  studentId: string,
  qs: { id: string; position: number; stem: string; options: string[]; correctIndex: number }[],
  selected: (number | null)[],
  submittedAt = new Date(),
) {
  const correct = qs.filter((q, i) => selected[i] === q.correctIndex).length;
  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      lessonId,
      studentId,
      idempotencyKey: crypto.randomUUID(),
      correct,
      total: qs.length,
      scorePct: Math.round((correct / qs.length) * 1000) / 10,
      submittedAt,
    })
    .returning();
  await db.insert(quizAttemptAnswers).values(
    qs.map((q, i) => ({
      attemptId: attempt!.id,
      questionId: q.id,
      position: q.position,
      stemSnapshot: q.stem,
      optionsSnapshot: q.options,
      correctIndexSnapshot: q.correctIndex,
      selectedIndex: selected[i] ?? null,
      isCorrect: selected[i] === q.correctIndex,
    })),
  );
  return attempt!;
}

/* ----------------------------------------------------------------------------
 * Mock providers
 * ------------------------------------------------------------------------- */

export const MOCK_SEGMENTS: TranscriptSegment[] = [
  { startSec: 0, endSec: 14.2, text: 'Today we study photosynthesis, the process plants use to make food from light.' },
  { startSec: 14.2, endSec: 29.8, text: 'Chlorophyll in the chloroplasts absorbs mostly red and blue light.' },
  { startSec: 29.8, endSec: 44.5, text: 'Carbon dioxide and water become glucose, and oxygen is released.' },
];

export function mockTranscription(): TranscribeResult {
  return {
    transcript: MOCK_SEGMENTS.map((s) => s.text).join(' '),
    segments: MOCK_SEGMENTS,
    meta: { provider: 'sarvam', model: 'saaras:v3', approximateTimestamps: false, demoFallback: false },
  };
}

/** Raw model JSON (as OpenAI would return it). `citedSegments` index into the prompt blocks. */
export function rawModelOutput(n: number, opts: { twoCorrect?: boolean; cited?: number[] } = {}) {
  return {
    summary: 'The lesson explained photosynthesis.',
    keyTakeaways: ['Plants make glucose', 'Chlorophyll absorbs light', 'Oxygen is released'],
    questions: Array.from({ length: n }, (_, i) => ({
      stem: `Which statement about photosynthesis is true? (${i + 1})`,
      options: [
        { text: 'Oxygen is released', isCorrect: true },
        { text: 'Nitrogen is released', isCorrect: !!opts.twoCorrect },
        { text: 'Glucose is consumed', isCorrect: false },
        { text: 'It needs darkness', isCorrect: false },
      ],
      explanation: 'The lecture says oxygen is released.',
      difficulty: 'easy',
      topicTag: 'Products',
      citedSegments: opts.cited ?? [2],
    })),
    assignment: {
      title: 'Leaf experiment',
      prompt: 'Describe how to show that leaves release oxygen.',
      rubric: [{ criterion: 'Method', marks: 5, descriptor: 'Clear steps' }],
      estimatedMinutes: 30,
    },
  };
}

/** Generator that runs the REAL validation + citation mapping over canned model output. */
export async function mockGenerate(input: GenerateInput): Promise<GenerateResult> {
  const blocks = promptBlocks(input.segments);
  const parsed = parseGenerationOutput(rawModelOutput(input.questionsPerLesson), {
    questionCount: input.questionsPerLesson,
    blocks,
    local: false,
    difficulty: input.difficulty,
  });
  if (!parsed.ok) throw new Error(parsed.issues.join('; '));
  return { ...parsed.value, meta: { provider: 'openai', model: input.model, demoFallback: false } };
}

/** Questions-only generator over canned output; new stems never repeat `existingStems`. */
export async function mockGenerateQuestions(input: GenerateInput): Promise<GenerateQuestionsResult> {
  const blocks = promptBlocks(input.segments);
  const raw = rawModelOutput(input.existingStems.length + input.questionsPerLesson);
  raw.questions = raw.questions.slice(input.existingStems.length);
  const parsed = parseGenerationOutput(raw, { questionCount: input.questionsPerLesson, blocks, local: false, difficulty: input.difficulty });
  if (!parsed.ok) throw new Error(parsed.issues.join('; '));
  return { questions: parsed.value.questions, meta: { provider: 'openai', model: input.model, demoFallback: false } };
}
