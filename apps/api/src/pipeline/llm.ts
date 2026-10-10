/**
 * Question/summary/assignment generation with OpenAI Chat Completions (via fetch)
 * using Structured Outputs (`response_format: json_schema`, strict). Output is
 * validated again with zod — exactly N questions, 4 options, exactly one
 * correct option, citations that point at real transcript blocks. Invalid
 * output gets ONE repair round-trip, then fails. Nothing is ever defaulted
 * (no "correctIndex 0", no canned questions).
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  Difficulty,
  LANGUAGE_LABELS,
  type Language,
  type RemedialPlan,
  type TranscriptSegment,
} from '@classpulse/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { PipelineError } from './errors.js';
import { fetchStep, readJson, type RetryPolicy } from './http.js';
import { coalesceSegments, formatClock } from './segments.js';
import type { GenerateInput, GenerateResult, GeneratedQuestion, RemedialInput } from './types.js';

const LLM_FAILED = 'Question generation failed. Please try again in a few minutes.';
const LLM_AUTH = 'The AI service rejected our credentials. Ask your administrator to check the OpenAI API key.';
const LLM_INVALID = 'The AI returned an invalid quiz twice. Please try generating again.';

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

export function generationJsonSchema(local: boolean): JsonSchema {
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
  return obj({
    summary: str,
    keyTakeaways: arr(str),
    questions: arr(obj(question)),
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

function generationOutputSchema(questionCount: number, blockCount: number, local: boolean) {
  const QuestionOut = z
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

  return z.object({
    summary: z.string().trim().min(1).max(5000),
    keyTakeaways: z.array(z.string().trim().min(1).max(500)).min(3).max(6),
    questions: z.array(QuestionOut).length(questionCount, `exactly ${questionCount} questions are required`),
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
 * Validate raw model output and map it to generated questions. Options are
 * shuffled server-side so the correct answer position is uniformly distributed.
 */
export function parseGenerationOutput(
  raw: unknown,
  ctx: { questionCount: number; blocks: TranscriptSegment[]; local: boolean },
): { ok: true; value: Omit<GenerateResult, 'meta'> } | { ok: false; issues: string[] } {
  const parsed = generationOutputSchema(ctx.questionCount, ctx.blocks.length, ctx.local).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const out: GenerationOutput = parsed.data;
  const questions: GeneratedQuestion[] = out.questions.map((q) => {
    const order = permutation(4);
    const cited = q.citedSegments.map((i) => ctx.blocks[i]!);
    return {
      stem: q.stem,
      stemLocal: ctx.local ? (q.stemLocal ?? null) : null,
      options: order.map((i) => q.options[i]!.text),
      optionsLocal: ctx.local && q.optionsLocal ? order.map((i) => q.optionsLocal![i]!) : null,
      correctIndex: order.findIndex((i) => q.options[i]!.isCorrect),
      explanation: q.explanation,
      explanationLocal: ctx.local ? (q.explanationLocal ?? null) : null,
      difficulty: q.difficulty,
      topicTag: q.topicTag || null,
      citationStartSec: Math.min(...cited.map((b) => b.startSec)),
      citationEndSec: Math.max(...cited.map((b) => b.endSec)),
    };
  });
  return {
    ok: true,
    value: {
      summary: out.summary,
      keyTakeaways: out.keyTakeaways,
      questions,
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

function generationMessages(input: GenerateInput, blocks: TranscriptSegment[], local: boolean): ChatMessage[] {
  const langName = languageName(input.language);
  const system = [
    'You are an experienced school teacher who writes fair, rigorous formative assessments from recorded classroom lectures.',
    'Use ONLY facts that are stated or clearly demonstrated in the transcript. Never invent content that the lecture did not cover.',
    `The lecture language is ${langName}. The transcript may contain speech-recognition errors; interpret them sensibly.`,
    'The transcript is given as numbered blocks: "[index] (start-end) text".',
    '',
    'Produce:',
    '- summary: 2-4 sentences in English describing what the lecture taught.',
    '- keyTakeaways: 3 to 6 short English bullet points.',
    `- questions: EXACTLY ${input.questionsPerLesson} multiple-choice questions in English. Each has exactly 4 options, exactly ONE option with isCorrect=true, plausible distractors, no "all/none of the above".`,
    '  explanation says why the correct answer is right, referring to the lecture. difficulty is easy/medium/hard (mix them).',
    '  topicTag is a 1-4 word sub-topic name. citedSegments lists the block indices that contain the evidence for the answer.',
    local
      ? `  Also give natural ${langName} translations: stemLocal, optionsLocal (same order as options), explanationLocal. Keep technical terms recognisable.`
      : '',
    '- assignment: a short take-home task in English that applies the lecture (title, prompt, a rubric of 2-5 criteria with integer marks and a descriptor, estimatedMinutes).',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const transcript = blocks.map((b, i) => `[${i}] (${formatClock(b.startSec)}-${formatClock(b.endSec)}) ${b.text}`).join('\n');
  const user = `Lesson title: ${input.title}\nSubject: ${input.subject}\n\nTranscript:\n${transcript}`;
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
  const ctx = { questionCount: input.questionsPerLesson, blocks, local };

  let issues: string[] = [];
  for (let round = 1; round <= 2; round++) {
    const result = await chat(input.model, messages, 'lesson_quiz', schema, maxTokens);
    const json = parseJsonContent(result);
    if (json.ok) {
      const parsed = parseGenerationOutput(json.value, ctx);
      if (parsed.ok) {
        return { ...parsed.value, meta: { provider: 'openai', model: input.model, demoFallback: false, repaired: round > 1 } };
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
