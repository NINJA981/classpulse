/**
 * Helpers shared by the resource generators: strict JSON-schema builders, the prompt preamble
 * (course, units, grounding, the teacher's request, output language) and a structured-output call
 * with zod validation, semantic checks and ONE repair round (same pattern as generateRemedialPlan).
 * Nothing is ever defaulted: invalid output after the repair round fails with a PipelineError.
 */
import type { z } from 'zod';
import { LANGUAGE_LABELS, type Language } from '@classpulse/shared';
import { env } from '../../../config/env.js';
import type { AiUsageContext } from '../../../lib/aiUsage.js';
import { PipelineError } from '../../../pipeline/errors.js';
import { chat, parseJsonContent, type ChatMessage, type JsonSchema } from '../../../pipeline/llm.js';
import type { GenerationContext } from './types.js';

/* ------------------------------ strict JSON schema builders ------------------------------ */

export const str: JsonSchema = { type: 'string' };
export const num: JsonSchema = { type: 'number' };
export const int: JsonSchema = { type: 'integer' };
export const bool: JsonSchema = { type: 'boolean' };
export const arr = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
export const enumOf = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
/** OpenAI strict mode: every property required, no extra properties. */
export const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/* ------------------------------------- prompts ------------------------------------- */

export const languageName = (lang: Language) => LANGUAGE_LABELS[lang] ?? lang;

/** Output-language rule: local language for prose, English technical terms kept in Latin script. */
export function languageInstruction(language: Language): string {
  if (language === 'en-IN') return 'Write everything in clear, simple Indian English.';
  const name = languageName(language);
  return (
    `Write all text in ${name} (in its native script), the way a teacher in India speaks in class. ` +
    `Keep English technical and subject terms (e.g. "photosynthesis", "equation", "array", "GST") in English, in Latin script — ` +
    `never translate or transliterate them.`
  );
}

/** Grounding rule shared by every generator. */
export function groundingInstruction(ctx: GenerationContext): string {
  return ctx.groundingText.trim()
    ? 'Use ONLY facts, definitions, examples and notation found in the SOURCE MATERIAL below; do not introduce content it does not support. ' +
        'If the teacher asks for something the material does not cover, keep to what the material supports.'
    : 'No source material was provided: use standard, accurate content appropriate to the course and level. Do not invent statistics, quotes or references.';
}

/** The user message: course, units, the teacher's request and the grounding text. */
export function contextMessage(ctx: GenerationContext, task: string): string {
  const lines: string[] = [];
  if (ctx.course) {
    const c = ctx.course;
    lines.push(`COURSE: ${c.title}`);
    if (c.level) lines.push(`Level: ${c.level}`);
    if (c.board) lines.push(`Board / university: ${c.board}`);
    if (c.subject) lines.push(`Subject: ${c.subject}`);
  }
  if (ctx.units.length) {
    lines.push('', 'UNITS / TOPICS IN SCOPE:');
    for (const u of ctx.units) lines.push(`- ${u.title}`);
  }
  lines.push('', `RESOURCE TITLE: ${ctx.title}`);
  lines.push('', `TASK: ${task}`);
  if (ctx.prompt.trim()) lines.push('', `THE TEACHER'S REQUEST (follow it where it does not conflict with the rules):`, ctx.prompt.trim());
  if (ctx.groundingText.trim()) lines.push('', 'SOURCE MATERIAL:', ctx.groundingText.trim());
  return lines.join('\n');
}

/* ---------------------------------- structured call ---------------------------------- */

export interface StructuredRequest<T> {
  model: string;
  messages: ChatMessage[];
  schemaName: string;
  jsonSchema: JsonSchema;
  zod: z.ZodType<T>;
  maxTokens: number;
  /** Semantic problems in otherwise well-formed output (each becomes a repair instruction). */
  check?: (value: T) => string[];
  /** Shown to the teacher when the output is still invalid after the repair round. */
  invalidMessage: string;
  /** Records the calls in ai_usage (kind 'resource'). */
  usage?: AiUsageContext;
}

/** The usage context for a generation (every chat call of a resource is recorded as kind 'resource'). */
export const resourceUsage = (ctx: GenerationContext): AiUsageContext => ({ institutionId: ctx.institutionId, kind: 'resource' });

export function requireOpenAiKey(): void {
  if (!env.OPENAI_API_KEY) {
    throw new PipelineError('OPENAI_API_KEY is not set', {
      retryable: false,
      userMessage: 'AI teaching tools are not configured. Ask your administrator to add the OpenAI API key.',
    });
  }
}

export interface StructuredResult<T> {
  value: T;
  repaired: boolean;
  /** Issues still present after the repair round (only when `acceptIssues` let the value through). */
  remainingIssues: string[];
}

/**
 * Call the model with a strict json_schema, validate with zod and `check`, and ask for ONE repair.
 * `acceptIssues(value, issues)` may accept a structurally valid value whose semantic issues remain
 * after the repair round (the caller then fixes them deterministically, e.g. renumbering).
 */
export async function generateStructured<T>(
  req: StructuredRequest<T>,
  acceptIssues?: (value: T, issues: string[]) => boolean,
): Promise<StructuredResult<T>> {
  requireOpenAiKey();
  const messages = [...req.messages];
  let issue = '';
  for (let round = 1; round <= 2; round++) {
    const result = await chat(req.model, messages, req.schemaName, req.jsonSchema, req.maxTokens, req.usage);
    const json = parseJsonContent(result, 'The AI declined to write this resource. Try rephrasing your request.');
    if (json.ok) {
      const parsed = req.zod.safeParse(json.value);
      if (parsed.success) {
        const issues = req.check?.(parsed.data) ?? [];
        if (!issues.length) return { value: parsed.data, repaired: round > 1, remainingIssues: [] };
        if (round === 2 && acceptIssues?.(parsed.data, issues)) return { value: parsed.data, repaired: true, remainingIssues: issues };
        issue = issues.slice(0, 12).join('; ');
      } else {
        issue = parsed.error.issues
          .slice(0, 12)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
      }
    } else {
      issue = json.issue;
    }
    if (round === 1) {
      messages.push({ role: 'assistant', content: result.content ?? '' });
      messages.push({ role: 'user', content: `Your JSON had problems: ${issue}. Return the complete corrected JSON.` });
    }
  }
  throw new PipelineError(`${req.schemaName} output invalid: ${issue}`, { retryable: false, userMessage: req.invalidMessage });
}

/* ------------------------------------- demo mode ------------------------------------- */

/** Development only (PIPELINE_DEMO_FALLBACK without an OpenAI key; refused in production by env validation). */
export const demoMode = () => !env.OPENAI_API_KEY && env.PIPELINE_DEMO_FALLBACK;
