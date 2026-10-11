/**
 * Worksheet generator: teacher request + grounding → WorksheetContent (sections of items + answers).
 * Checks after the model answers (strict json_schema + zod, ONE repair round):
 * - exactly `itemCount` items, only the requested item types;
 * - MCQ: 3–6 distinct options and the answer is one of them; true/false: two options, answer is one of them;
 *   fill-in-the-blank prompts contain a blank; match items list the right-hand column in `options`;
 *   short/long/fill-blank items have no options; every item has an answer and positive marks.
 * After the repair, a worksheet with extra items is trimmed and one with a few missing items (≥ 60 %) is kept.
 * Items are renumbered 1..n across sections.
 */
import { z } from 'zod';
import type { WorksheetContent } from '@classpulse/shared';
import { PipelineError } from '../../../pipeline/errors.js';
import {
  arr,
  contextMessage,
  demoMode,
  enumOf,
  generateStructured,
  groundingInstruction,
  languageInstruction,
  num,
  obj,
  resourceUsage,
  str,
} from './common.js';
import { maxOutputTokens } from '../../../pipeline/llm.js';
import type { GenerationContext, GenerationResult, ResourceGenerator } from './types.js';

const INVALID = 'The AI returned an invalid worksheet twice. Please try generating again.';
const ITEM_TYPES = ['mcq', 'short', 'long', 'fill_blank', 'true_false', 'match'] as const;
type ItemType = (typeof ITEM_TYPES)[number];
type Item = WorksheetContent['sections'][number]['items'][number];

const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  mcq: 'multiple choice (4 options, one correct)',
  short: 'short answer (1–3 sentences)',
  long: 'long answer (a paragraph or multi-step working)',
  fill_blank: 'fill in the blank (mark the blank with "_____")',
  true_false: 'true or false',
  match: 'match the following',
};

export const worksheetJsonSchema = obj({
  instructions: str,
  sections: arr(
    obj({
      title: str,
      items: arr(obj({ number: num, type: enumOf(ITEM_TYPES), prompt: str, options: arr(str), answer: str, marks: num })),
    }),
  ),
});

const WorksheetOut = z.object({
  instructions: z.string().trim().max(2000),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        items: z
          .array(
            z.object({
              number: z.number(),
              type: z.enum(ITEM_TYPES),
              prompt: z.string().trim().min(1).max(3000),
              options: z.array(z.string().trim().min(1).max(500)).max(12),
              answer: z.string().trim().min(1).max(3000),
              marks: z.number().positive().max(50),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(10),
});

interface SheetSettings {
  itemCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  itemTypes: ItemType[];
}

function settingsOf(ctx: GenerationContext): SheetSettings {
  if (ctx.options.type === 'worksheet') {
    return { itemCount: ctx.options.itemCount, difficulty: ctx.options.difficulty, itemTypes: [...new Set(ctx.options.itemTypes)] };
  }
  return { itemCount: 10, difficulty: 'mixed', itemTypes: ['mcq', 'short', 'fill_blank'] };
}

const allItems = (w: Pick<WorksheetContent, 'sections'>) => w.sections.flatMap((s) => s.items);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Problems with one item (empty = valid). */
export function itemIssues(item: Item, allowed: readonly ItemType[]): string[] {
  const where = `item "${item.prompt.slice(0, 40)}"`;
  const issues: string[] = [];
  if (!allowed.includes(item.type)) issues.push(`${where} has type ${item.type}, which was not requested`);
  const opts = item.options.map(norm);
  switch (item.type) {
    case 'mcq':
      if (item.options.length < 3 || item.options.length > 6) issues.push(`${where}: MCQs need 4 options`);
      if (new Set(opts).size !== opts.length) issues.push(`${where}: options must be distinct`);
      if (!opts.includes(norm(item.answer))) issues.push(`${where}: answer must be the exact text of one option`);
      break;
    case 'true_false':
      if (item.options.length !== 2) issues.push(`${where}: true/false items need exactly two options (True, False)`);
      if (!opts.includes(norm(item.answer))) issues.push(`${where}: answer must be one of the two options`);
      break;
    case 'match':
      if (item.options.length < 3) issues.push(`${where}: match items list at least 3 right-hand entries in options`);
      break;
    case 'fill_blank':
      if (!/_{3,}/.test(item.prompt)) issues.push(`${where}: fill-in-the-blank prompts must contain a blank "_____"`);
      if (item.options.length) issues.push(`${where}: fill-in-the-blank items have no options`);
      break;
    default:
      if (item.options.length) issues.push(`${where}: ${item.type} items have no options`);
  }
  return issues;
}

/** Keep the first `max` items (sections that end up empty are dropped) and renumber 1..n. */
export function finalizeWorksheet(w: WorksheetContent, max: number): WorksheetContent {
  let n = 0;
  const sections = w.sections
    .map((s) => ({
      title: s.title,
      items: s.items.filter(() => n < max && ++n > 0).map((item) => ({ ...item })),
    }))
    .filter((s) => s.items.length);
  let k = 0;
  for (const s of sections) for (const item of s.items) item.number = ++k;
  return { instructions: w.instructions, sections };
}

function difficultyText(s: SheetSettings): string {
  if (s.difficulty !== 'mixed') {
    const what = { easy: 'recall and simple understanding', medium: 'understanding and application', hard: 'analysis and multi-step reasoning' };
    return `All items are ${s.difficulty} (${what[s.difficulty]}).`;
  }
  const easy = Math.round(s.itemCount * 0.35);
  const hard = Math.round(s.itemCount * 0.25);
  const medium = s.itemCount - easy - hard;
  return `Mix difficulty: about ${easy} easy (recall), ${medium} medium (application) and ${hard} hard (analysis / multi-step) items, easiest first.`;
}

function messages(ctx: GenerationContext, s: SheetSettings) {
  const system = [
    'You are an experienced teacher in India who writes clear, level-appropriate practice worksheets for any level (school classes, college courses, diplomas).',
    groundingInstruction(ctx),
    'Group items into sections by item type (e.g. "Section A: Multiple choice"), each section starting with its own numbering continuing from the previous one.',
    'Item rules:',
    '- mcq: exactly 4 plausible, distinct options; "answer" is the exact text of the correct option; never "all/none of the above".',
    '- true_false: options ["True", "False"] (in the output language) and "answer" is one of them.',
    '- fill_blank: the prompt contains "_____" where the answer goes; options [].',
    '- match: the prompt lists the left-hand items numbered 1., 2., 3. …; options are the right-hand entries in shuffled order; "answer" gives the pairs, e.g. "1-c, 2-a, 3-b".',
    '- short / long: options []; "answer" is a model answer or the key points a teacher marks against.',
    'Give every item sensible marks (e.g. 1 for MCQ/true-false/fill-blank, 2–3 for short, 5 for long).',
    '"instructions" are brief instructions for students.',
    languageInstruction(ctx.language),
    'Return JSON only, matching the schema.',
  ].join('\n');
  const types = s.itemTypes.map((t) => `${t} = ${ITEM_TYPE_LABEL[t]}`).join('; ');
  const task = `Write a worksheet with exactly ${s.itemCount} items in total, using only these item types: ${types}. ${difficultyText(s)}`;
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: contextMessage(ctx, task) },
  ];
}

export const generate: ResourceGenerator = async (ctx): Promise<GenerationResult<WorksheetContent>> => {
  const s = settingsOf(ctx);
  if (demoMode()) return { content: demoWorksheet(ctx, s), meta: { demo: true } };

  const minItems = Math.max(1, Math.ceil(s.itemCount * 0.6));
  const check = (w: WorksheetContent) => {
    const items = allItems(w);
    const issues = items.flatMap((item) => itemIssues(item, s.itemTypes));
    if (items.length !== s.itemCount) issues.push(`there are ${items.length} items but exactly ${s.itemCount} are required`);
    return issues;
  };
  // After the repair: accept if only the item count is off (trimmed / kept when at least 60 % are there).
  const countOnly = (w: WorksheetContent, issues: string[]) =>
    issues.every((i) => /items but exactly/.test(i)) && allItems(w).length >= minItems;

  const result = await generateStructured(
    {
      model: ctx.model,
      messages: messages(ctx, s),
      schemaName: 'worksheet',
      jsonSchema: worksheetJsonSchema,
      zod: WorksheetOut,
      maxTokens: Math.min(maxOutputTokens(ctx.model), 2_000 + s.itemCount * 350),
      check,
      invalidMessage: INVALID,
      usage: resourceUsage(ctx),
    },
    countOnly,
  );
  const content = finalizeWorksheet(result.value, s.itemCount);
  if (!allItems(content).length) throw new PipelineError('Worksheet has no items', { retryable: false, userMessage: INVALID });
  return { content, meta: { repaired: result.repaired, itemsRequested: s.itemCount, items: allItems(content).length } };
};

/** Clearly labelled development output (PIPELINE_DEMO_FALLBACK). */
function demoWorksheet(ctx: GenerationContext, s: SheetSettings): WorksheetContent {
  const topic = ctx.units[0]?.title ?? ctx.title;
  const items: Item[] = Array.from({ length: s.itemCount }, (_, i) => {
    const type = s.itemTypes[i % s.itemTypes.length]!;
    const base = { number: i + 1, type, marks: type === 'long' ? 5 : type === 'short' ? 2 : 1 };
    switch (type) {
      case 'mcq':
        return { ...base, prompt: `[Demo] Question ${i + 1} about ${topic}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A' };
      case 'true_false':
        return { ...base, prompt: `[Demo] Statement ${i + 1} about ${topic}.`, options: ['True', 'False'], answer: 'True' };
      case 'fill_blank':
        return { ...base, prompt: `[Demo] ${topic} is _____.`, options: [], answer: '[Demo] answer' };
      case 'match':
        return { ...base, prompt: '[Demo] 1. One\n2. Two\n3. Three', options: ['a', 'b', 'c'], answer: '1-a, 2-b, 3-c' };
      default:
        return { ...base, prompt: `[Demo] Explain ${topic}.`, options: [], answer: '[Demo] Key points.' };
    }
  });
  return { instructions: '[Demo] Demo content — no AI provider is configured.', sections: [{ title: '[Demo] Section A', items }] };
}
