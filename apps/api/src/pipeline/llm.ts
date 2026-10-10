/**
 * Question/summary/assignment generation with OpenAI Chat Completions (via fetch)
 * using Structured Outputs (`response_format: json_schema`, strict). Output is
 * validated again with zod — 4 options, exactly one correct option, citations
 * that point at real transcript blocks. Each question is validated on its own:
 * invalid ones are dropped, extras trimmed, and a short quiz is topped up with
 * follow-up requests. Invalid summary/assignment output gets ONE repair
 * round-trip. Nothing is ever defaulted (no "correctIndex 0", no canned questions).
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  Difficulty,
  LANGUAGE_LABELS,
  type Language,
  type QuizDifficulty,
  type RemedialPlan,
  type TranscriptSegment,
} from '@classpulse/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { PipelineError } from './errors.js';
import { fetchStep, readJson, type RetryPolicy } from './http.js';
import { coalesceSegments, formatClock } from './segments.js';
import type { GenerateInput, GenerateQuestionsResult, GenerateResult, GeneratedQuestion, RemedialInput } from './types.js';

const LLM_FAILED = 'Question generation failed. Please try again in a few minutes.';
const LLM_AUTH = 'The AI service rejected our credentials. Ask your administrator to check the OpenAI API key.';
const LLM_INVALID = 'The AI returned an invalid quiz twice. Please try generating again.';
const LLM_TOO_FEW = 'The AI could only write a few valid questions for this recording. Try again, or add questions yourself.';
const LLM_NOTHING_NEW = 'The AI found no new points to ask about in this recording. Edit or write questions yourself.';
/** A quiz is kept if at least this many valid questions came back (or all requested, if fewer). */
const MIN_QUESTIONS = 3;
/** Follow-up requests for the questions still missing after the first answer. */
const TOP_UP_ROUNDS = 2;

/** Retry policy for LLM HTTP calls (mutable for tests). */
export const llmRetryPolicy: RetryPolicy = { attempts: 3, baseDelayMs: 2_000, maxDelayMs: 20_000 };

/** Max transcript characters sent to the model (≈ 2.5 h of speech); later blocks are dropped with a warning. */
const MAX_PROMPT_CHARS = 150_000;

const languageName = (lang: Language) => LANGUAGE_LABELS[lang] ?? lang;

export const wantsLocal = (language: Language, bilingual: boolean) => bilingual && language !== 'en-IN';

/* ----------------------------------------------------------------------------
 * JSON schemas (OpenAI strict mode: every property required, no extras)
 * ------------------------------------------------------------------------- */

type JsonSchema = Record<string, unknown>;

const str: JsonSchema = { type: 'string' };
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: JsonSchema): JsonSchema => ({ type: 'array', items });

function questionJsonSchema(local: boolean): JsonSchema {
  const question: Record<string, JsonSchema> = {
    stem: str,
    options: arr(obj({ text: str, isCorrect: { type: 'boolean' } })),
    explanation: str,
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    topicTag: str,
    citedSegments: arr({ type: 'integer' }),
  };
  if (local) {
    question.stemLocal = str;
    question.optionsLocal = arr(str);
    question.explanationLocal = str;
  }
  return obj(question);
}

export function generationJsonSchema(local: boolean): JsonSchema {
  return obj({
    summary: str,
    keyTakeaways: arr(str),
    questions: arr(questionJsonSchema(local)),
    assignment: obj({
      title: str,
      prompt: str,
      rubric: arr(obj({ criterion: str, marks: { type: 'integer' }, descriptor: str })),
      estimatedMinutes: { type: 'integer' },
    }),
  });
}

/* ----------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

const OptionOut = z.object({ text: z.string().trim().min(1).max(300), isCorrect: z.boolean() });

function questionOutSchema(blockCount: number, local: boolean) {
  return z
    .object({
      stem: z.string().trim().min(1).max(1000),
      options: z.array(OptionOut).length(4, 'each question needs exactly 4 options'),
      explanation: z.string().trim().min(1).max(2000),
      difficulty: Difficulty,
      topicTag: z.string().trim().max(120),
      citedSegments: z.array(z.number().int()).min(1, 'cite at least one transcript block').max(12),
      stemLocal: z.string().trim().max(1000).optional(),
      optionsLocal: z.array(z.string().trim().max(300)).optional(),
      explanationLocal: z.string().trim().max(2000).optional(),
    })
    .superRefine((q, ctx) => {
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct !== 1) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: `exactly one option must be correct (found ${correct})` });
      }
      const texts = q.options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be distinct' });
      }
      for (const idx of q.citedSegments) {
        if (idx < 0 || idx >= blockCount) {
          ctx.addIssue({ code: 'custom', path: ['citedSegments'], message: `block ${idx} does not exist (0-${blockCount - 1})` });
        }
      }
      if (local) {
        if (!q.stemLocal) ctx.addIssue({ code: 'custom', path: ['stemLocal'], message: 'required' });
        if (!q.explanationLocal) ctx.addIssue({ code: 'custom', path: ['explanationLocal'], message: 'required' });
        if (q.optionsLocal?.length !== 4 || q.optionsLocal.some((o) => !o)) {
          ctx.addIssue({ code: 'custom', path: ['optionsLocal'], message: 'exactly 4 non-empty translated options' });
        }
      }
    });
}

type QuestionOut = z.infer<ReturnType<typeof questionOutSchema>>;

function generationOutputSchema() {
  return z.object({
    summary: z.string().trim().min(1).max(5000),
    keyTakeaways: z.array(z.string().trim().min(1).max(500)).min(3).max(6),
    questions: z.array(z.unknown()).min(1, 'at least one question is required'),
    assignment: z.object({
      title: z.string().trim().min(1).max(200),
      prompt: z.string().trim().min(1).max(5000),
      rubric: z
        .array(
          z.object({
            criterion: z.string().trim().min(1).max(200),
            marks: z.number().int().min(0).max(100),
            descriptor: z.string().trim().max(1000),
          }),
        )
        .min(1)
        .max(20),
      estimatedMinutes: z.number().int().min(1).max(600),
    }),
  });
}

type GenerationOutput = z.infer<ReturnType<typeof generationOutputSchema>>;

function permutation(n: number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  return p;
}

/**
 * The first run of adjacent cited blocks. Models sometimes cite blocks from opposite ends of the lecture;
 * spanning all of them would give the teacher a 20-minute "citation" to replay.
 */
function citedRun(indices: number[]): number[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  let end = 0;
  while (end + 1 < sorted.length && sorted[end + 1]! - sorted[end]! <= 1) end++;
  return sorted.slice(0, end + 1);
}

type ParseCtx = { questionCount: number; blocks: TranscriptSegment[]; local: boolean; difficulty?: QuizDifficulty };

const normStem = (stem: string) => stem.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Validate candidate questions one by one. Invalid ones and repeats of `seen` stems are dropped (with the
 * reason, for logs and the repair prompt); `seen` is updated with the accepted stems.
 */
function validQuestions(raw: unknown[], ctx: ParseCtx, seen: Set<string>): { valid: QuestionOut[]; issues: string[] } {
  const schema = questionOutSchema(ctx.blocks.length, ctx.local);
  const valid: QuestionOut[] = [];
  const issues: string[] = [];
  raw.forEach((candidate, i) => {
    const r = schema.safeParse(candidate);
    if (!r.success) {
      issues.push(...r.error.issues.slice(0, 3).map((x) => `questions.${i}.${x.path.join('.')}: ${x.message}`));
      return;
    }
    const key = normStem(r.data.stem);
    if (seen.has(key)) {
      issues.push(`questions.${i}: duplicate question`);
      return;
    }
    seen.add(key);
    valid.push(r.data);
  });
  return { valid, issues };
}

/** Map a validated question; options are shuffled so the correct answer position is uniformly distributed. */
function toGeneratedQuestion(q: QuestionOut, ctx: ParseCtx): GeneratedQuestion {
  const order = permutation(4);
  const cited = citedRun(q.citedSegments).map((i) => ctx.blocks[i]!);
  return {
    stem: q.stem,
    stemLocal: ctx.local ? (q.stemLocal ?? null) : null,
    options: order.map((i) => q.options[i]!.text),
    optionsLocal: ctx.local && q.optionsLocal ? order.map((i) => q.optionsLocal![i]!) : null,
    correctIndex: order.findIndex((i) => q.options[i]!.isCorrect),
    explanation: q.explanation,
    explanationLocal: ctx.local ? (q.explanationLocal ?? null) : null,
    // A fixed difficulty asked for by the teacher wins over the model's own label.
    difficulty: ctx.difficulty && ctx.difficulty !== 'mixed' ? ctx.difficulty : q.difficulty,
    topicTag: q.topicTag || null,
    citationStartSec: Math.min(...cited.map((b) => b.startSec)),
    citationEndSec: Math.max(...cited.map((b) => b.endSec)),
  };
}

/**
 * Validate raw model output. The envelope (summary, takeaways, assignment) must be valid and at least one
 * question must survive validation; extra questions are trimmed to `questionCount`, and `missing` says how
 * many are still needed. `issues` lists what was dropped.
 */
export function parseGenerationOutput(
  raw: unknown,
  ctx: ParseCtx,
  seen: Set<string> = new Set(),
): { ok: true; value: Omit<GenerateResult, 'meta'>; missing: number; issues: string[] } | { ok: false; issues: string[] } {
  const parsed = generationOutputSchema().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const out: GenerationOutput = parsed.data;
  const { valid, issues } = validQuestions(out.questions, ctx, seen);
  if (!valid.length) return { ok: false, issues: issues.length ? issues.slice(0, 20) : ['questions: none were valid'] };
  const kept = valid.slice(0, ctx.questionCount);
  return {
    ok: true,
    missing: ctx.questionCount - kept.length,
    issues,
    value: {
      summary: out.summary,
      keyTakeaways: out.keyTakeaways,
      questions: kept.map((q) => toGeneratedQuestion(q, ctx)),
      assignment: {
        title: out.assignment.title,
        prompt: out.assignment.prompt,
        rubric: out.assignment.rubric,
        estimatedMinutes: out.assignment.estimatedMinutes,
      },
    },
  };
}

/* ----------------------------------------------------------------------------
 * Chat Completions transport
 * ------------------------------------------------------------------------- */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  content: string | null;
  refusal: string | null;
  truncated: boolean;
}

function requireKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new PipelineError('OPENAI_API_KEY is not set', { retryable: false, userMessage: 'Question generation is not configured' });
  }
  return env.OPENAI_API_KEY;
}

async function chat(model: string, messages: ChatMessage[], schemaName: string, schema: JsonSchema, maxTokens: number): Promise<ChatResult> {
  const apiKey = requireKey();
  const res = await fetchStep(
    `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
        max_completion_tokens: maxTokens,
      }),
    },
    { step: 'openai:chat', timeoutMs: 240_000, userMessage: LLM_FAILED, authUserMessage: LLM_AUTH, policy: llmRetryPolicy },
  );
  const body = (await readJson(res, 'openai:chat', LLM_FAILED)) as {
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  };
  const choice = body.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    refusal: choice?.message?.refusal ?? null,
    truncated: choice?.finish_reason === 'length',
  };
}

function parseJsonContent(result: ChatResult): { ok: true; value: unknown } | { ok: false; issue: string } {
  if (result.refusal) {
    throw new PipelineError('Model refused the request', {
      retryable: false,
      userMessage: 'The AI declined to generate questions for this lesson.',
    });
  }
  if (result.truncated) return { ok: false, issue: 'output was truncated; keep it shorter' };
  if (!result.content) return { ok: false, issue: 'empty response' };
  try {
    return { ok: true, value: JSON.parse(result.content) as unknown };
  } catch {
    return { ok: false, issue: 'response was not valid JSON' };
  }
}

/* ----------------------------------------------------------------------------
 * Lesson generation
 * ------------------------------------------------------------------------- */

/** Transcript blocks the model cites by index (also used to map citations back to times). */
export function promptBlocks(segments: TranscriptSegment[]): TranscriptSegment[] {
  const blocks = coalesceSegments(segments);
  const out: TranscriptSegment[] = [];
  let chars = 0;
  for (const b of blocks) {
    chars += b.text.length + 24;
    if (chars > MAX_PROMPT_CHARS) {
      logger.warn({ kept: out.length, total: blocks.length }, 'Transcript truncated for the LLM prompt');
      break;
    }
    out.push(b);
  }
  return out;
}

const DIFFICULTY_PROMPT: Record<QuizDifficulty, string> = {
  easy: 'Every question is easy (difficulty "easy"): direct recall of a fact or definition stated in the lecture.',
  medium: 'Every question is medium (difficulty "medium"): understanding or applying an idea from the lecture to a simple case.',
  hard: 'Every question is hard (difficulty "hard"): analysis, multi-step reasoning, or comparing ideas from the lecture.',
  mixed: '',
};

/** Mixed quizzes get explicit counts; "mix them" alone tends to produce no hard questions at all. */
function difficultyPrompt(difficulty: QuizDifficulty, count: number): string {
  if (difficulty !== 'mixed') return DIFFICULTY_PROMPT[difficulty];
  const easy = Math.ceil(count / 3);
  const medium = Math.ceil((count - easy) / 2);
  const hard = count - easy - medium;
  return (
    `Difficulties: ${easy} easy (recall of facts/definitions), ${medium} medium (understanding/application)` +
    (hard ? ` and ${hard} hard (analysis, multi-step reasoning, comparing ideas).` : '.')
  );
}

function generationMessages(input: GenerateInput, blocks: TranscriptSegment[], local: boolean): ChatMessage[] {
  const langName = languageName(input.language);
  const system = [
    'You are an experienced school teacher who writes fair, rigorous formative assessments from recorded classroom lectures.',
    'Use ONLY facts that are stated or clearly demonstrated in the transcript. Never invent content that the lecture did not cover.',
    `The lecture language is ${langName}; classroom speech often mixes it with English terms. The transcript may contain speech-recognition errors; interpret them sensibly.`,
    'The transcript is given as numbered blocks: "[index] (start-end) text".',
    '',
    'Produce:',
    '- summary: 2-4 sentences in English describing what the lecture taught.',
    '- keyTakeaways: 3 to 6 short English bullet points.',
    `- questions: ${input.questionsPerLesson} multiple-choice questions in English, each on a different point of the lecture. Each has exactly 4 options, exactly ONE option with isCorrect=true, plausible distractors, no "all/none of the above".`,
    `  explanation says why the correct answer is right, referring to the lecture. ${difficultyPrompt(input.difficulty, input.questionsPerLesson)}`,
    '  topicTag is a 1-4 word sub-topic name. citedSegments lists the block indices that contain the evidence for the answer.',
    local
      ? `  Also give natural ${langName} translations: stemLocal, optionsLocal (same order as options), explanationLocal. Write them the way the teacher speaks in class: keep subject terms (for example mean, median, JDBC, inheritance) in English, in Latin script, exactly as they appear in the transcript, and translate only the surrounding sentence.`
      : '',
    '- assignment: a short take-home task in English that applies the lecture (title, prompt, a rubric of 2-5 criteria with integer marks and a descriptor, estimatedMinutes).',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const transcript = blocks.map((b, i) => `[${i}] (${formatClock(b.startSec)}-${formatClock(b.endSec)}) ${b.text}`).join('\n');
  const existing = input.existingStems.length
    ? `\n\nThe quiz already has these questions; do not repeat them or test the same points:\n${input.existingStems.map((q) => `- ${q}`).join('\n')}`
    : '';
  const user = `Lesson title: ${input.title}\nSubject: ${input.subject}${existing}\n\nTranscript:\n${transcript}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function generateWithOpenAI(input: GenerateInput): Promise<GenerateResult> {
  requireKey();
  const blocks = promptBlocks(input.segments);
  if (!blocks.length) {
    throw new PipelineError('No transcript to generate from', {
      retryable: false,
      userMessage: 'The transcript is empty, so no questions could be generated.',
    });
  }
  const local = wantsLocal(input.language, input.bilingual);
  const schema = generationJsonSchema(local);
  const maxTokens = Math.min(16_000, 2_500 + input.questionsPerLesson * (local ? 900 : 500));
  const messages = generationMessages(input, blocks, local);
  const ctx = { questionCount: input.questionsPerLesson, blocks, local, difficulty: input.difficulty };

  const seen = new Set(input.existingStems.map(normStem));
  let issues: string[] = [];
  for (let round = 1; round <= 2; round++) {
    const result = await chat(input.model, messages, 'lesson_quiz', schema, maxTokens);
    const json = parseJsonContent(result);
    if (json.ok) {
      const parsed = parseGenerationOutput(json.value, ctx, seen);
      if (parsed.ok) {
        if (parsed.issues.length) logger.warn({ round, dropped: parsed.issues }, 'Dropped invalid questions from LLM output');
        const questions = await topUpQuestions(input, blocks, local, parsed.value.questions, seen);
        if (questions.length < Math.min(MIN_QUESTIONS, input.questionsPerLesson)) {
          throw new PipelineError(`Only ${questions.length} valid questions`, { retryable: false, userMessage: LLM_TOO_FEW });
        }
        if (questions.length < input.questionsPerLesson) {
          logger.warn({ requested: input.questionsPerLesson, generated: questions.length }, 'Lesson quiz is shorter than requested');
        }
        return {
          ...parsed.value,
          questions,
          meta: {
            provider: 'openai',
            model: input.model,
            demoFallback: false,
            repaired: round > 1,
            questionsRequested: input.questionsPerLesson,
          },
        };
      }
      issues = parsed.issues;
    } else {
      issues = [json.issue];
    }
    logger.warn({ round, issues }, 'LLM output failed validation');
    if (round === 1) {
      messages.push({ role: 'assistant', content: result.content ?? '' });
      messages.push({
        role: 'user',
        content: `Your JSON did not meet the requirements:\n- ${issues.join('\n- ')}\nReturn the complete corrected JSON.`,
      });
    }
  }
  throw new PipelineError(`LLM output invalid after repair: ${issues.join('; ')}`, { retryable: false, userMessage: LLM_INVALID });
}

/**
 * Ask for the questions still missing, on points not covered yet. Models often return fewer than asked for
 * long quizzes, and a short lecture may simply not support more, so this stops after TOP_UP_ROUNDS.
 */
async function topUpQuestions(
  input: GenerateInput,
  blocks: TranscriptSegment[],
  local: boolean,
  questions: GeneratedQuestion[],
  seen: Set<string>,
  rounds = TOP_UP_ROUNDS,
): Promise<GeneratedQuestion[]> {
  const ctx = { questionCount: input.questionsPerLesson, blocks, local, difficulty: input.difficulty };
  const out = [...questions];
  const schema = obj({ questions: arr(questionJsonSchema(local)) });
  for (let round = 1; round <= rounds && out.length < input.questionsPerLesson; round++) {
    const want = input.questionsPerLesson - out.length;
    const messages = generationMessages({ ...input, questionsPerLesson: want, existingStems: [] }, blocks, local);
    const existing = [...input.existingStems, ...out.map((q) => q.stem)];
    messages.push({
      role: 'user',
      content:
        (existing.length ? `These questions already exist:\n${existing.map((q) => `- ${q}`).join('\n')}\n\n` : '') +
        `Write ${want} ${existing.length ? 'MORE ' : ''}questions following the same rules` +
        (existing.length ? ', each on a point of the lecture that the existing questions do not test. ' : '. ') +
        'Return JSON with only a "questions" array.',
    });
    const maxTokens = Math.min(16_000, 1_000 + want * (local ? 900 : 500));
    const json = parseJsonContent(await chat(input.model, messages, 'lesson_quiz_more', schema, maxTokens));
    const raw = json.ok && json.value && typeof json.value === 'object' ? (json.value as { questions?: unknown }).questions : null;
    if (!Array.isArray(raw)) {
      logger.warn({ round, issue: json.ok ? 'no questions array' : json.issue }, 'Question top-up returned nothing usable');
      continue;
    }
    const { valid, issues } = validQuestions(raw, ctx, seen);
    if (issues.length) logger.warn({ round, dropped: issues }, 'Dropped invalid top-up questions');
    out.push(...valid.slice(0, want).map((q) => toGeneratedQuestion(q, ctx)));
    if (!valid.length) break; // nothing more the lecture supports
  }
  return out;
}

/**
 * Questions only, for adding to a quiz or replacing its unapproved questions: the summary and assignment
 * stay as they are. New questions avoid the points `existingStems` already test.
 */
export async function generateQuestionsWithOpenAI(input: GenerateInput): Promise<GenerateQuestionsResult> {
  requireKey();
  const blocks = promptBlocks(input.segments);
  if (!blocks.length) {
    throw new PipelineError('No transcript to generate from', {
      retryable: false,
      userMessage: 'The transcript is empty, so no questions could be generated.',
    });
  }
  const local = wantsLocal(input.language, input.bilingual);
  const seen = new Set(input.existingStems.map(normStem));
  const questions = await topUpQuestions(input, blocks, local, [], seen, TOP_UP_ROUNDS + 1);
  if (!questions.length) throw new PipelineError('No new valid questions', { retryable: false, userMessage: LLM_NOTHING_NEW });
  if (questions.length < input.questionsPerLesson) {
    logger.warn({ requested: input.questionsPerLesson, generated: questions.length }, 'Fewer new questions than requested');
  }
  return { questions, meta: { provider: 'openai', model: input.model, demoFallback: false, questionsRequested: input.questionsPerLesson } };
}

/* ----------------------------------------------------------------------------
 * Remedial plan (teacher-triggered, cached on the lesson)
 * ------------------------------------------------------------------------- */

const RemedialOut = z.object({
  summary: z.string().trim().min(1).max(3000),
  actions: z
    .array(z.object({ topic: z.string().trim().min(1).max(200), recommendation: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(8),
});

const remedialSchema = obj({ summary: str, actions: arr(obj({ topic: str, recommendation: str })) });

export async function generateRemedialPlan(input: RemedialInput): Promise<RemedialPlan> {
  requireKey();
  const a = input.analytics;
  const lines = a.questions.map((q) => {
    const dist = q.optionDistribution.map((n, i) => `${String.fromCharCode(65 + i)}=${n}`).join(' ');
    return `Q${q.position} [${q.topicTag ?? 'general'}] accuracy ${q.accuracyPct}% (${q.band}); answers ${dist}; "${q.stem}"`;
  });
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are an instructional coach. Given quiz results for a lesson, write a short remedial teaching plan for the teacher in English. ' +
        'Focus on the weakest topics first, name likely misconceptions suggested by the wrong-answer patterns, and give concrete, classroom-ready actions (max 6). ' +
        'Do not invent data beyond what is given.',
    },
    {
      role: 'user',
      content:
        `Lesson: ${input.title}\nSubject: ${input.subject}\nLanguage of instruction: ${languageName(input.language)}\n` +
        `Students attempted: ${a.studentsAttempted} of ${a.enrolledStudents}; average score ${a.averageScorePct ?? 'n/a'}%\n\nPer-question results:\n${lines.join('\n')}`,
    },
  ];

  let issue = '';
  for (let round = 1; round <= 2; round++) {
    const result = await chat(input.model, messages, 'remedial_plan', remedialSchema, 2_500);
    const json = parseJsonContent(result);
    if (json.ok) {
      const parsed = RemedialOut.safeParse(json.value);
      if (parsed.success) return { generatedAt: new Date().toISOString(), ...parsed.data };
      issue = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    } else {
      issue = json.issue;
    }
    if (round === 1) {
      messages.push({ role: 'assistant', content: result.content ?? '' });
      messages.push({ role: 'user', content: `Your JSON was invalid: ${issue}. Return the complete corrected JSON.` });
    }
  }
  throw new PipelineError(`Remedial output invalid: ${issue}`, {
    retryable: false,
    userMessage: 'The AI returned an invalid plan. Please try again.',
  });
}
