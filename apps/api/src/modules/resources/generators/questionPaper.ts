/**
 * Question paper generator (board-style paper with answer key and marking scheme).
 *
 * The section spec is authoritative: the teacher's `options.sections`, or a standard pattern for the level
 * (CBSE-like Sections A–E for school, Parts A–C for college) computed deterministically so the marks add up
 * exactly to `maxMarks`. The model writes the questions (strict json_schema); every question is validated
 * against its section (MCQ: 4 distinct options + correctIndex; internal choice: an "OR" alternative; a
 * non-empty answer and marking scheme). Problems get ONE repair round; afterwards a section that still
 * lacks valid questions fails the generation. Marks are always set from the spec, so a model that is off
 * on a question's marks is corrected deterministically and the total equals `maxMarks`.
 */
import { z } from 'zod';
import {
  BLOOM_LEVELS,
  BloomLevel,
  Difficulty,
  type QuestionPaperOptions,
  type PaperQuestion,
  type QuestionPaperContent,
} from '@classiq/shared';
import { logger } from '../../../lib/logger.js';
import { PipelineError } from '../../../pipeline/errors.js';
import {
  arr,
  contextMessage,
  demoMode,
  enumOf,
  generateStructured,
  groundingInstruction,
  int,
  languageInstruction,
  num,
  obj,
  resourceUsage,
  str,
} from './common.js';
import { maxOutputTokens } from '../../../pipeline/llm.js';
import type { GenerationContext, GenerationResult, ResourceGenerator } from './types.js';

export type PaperOptions = z.infer<typeof QuestionPaperOptions>;
export type SectionSpec = PaperOptions['sections'][number];
export type PaperQuestionType = SectionSpec['type'];

const INVALID_MESSAGE = 'The AI could not write a complete question paper. Please try generating again.';

/** Objective types carry 4 options and a correct index (assertion–reason uses the standard 4 options). */
export const isObjective = (type: PaperQuestionType) => type === 'mcq' || type === 'assertion_reason';

const TYPE_LABEL: Record<PaperQuestionType, string> = {
  mcq: 'multiple-choice questions',
  very_short: 'very short answer questions',
  short: 'short answer questions',
  long: 'long answer questions',
  case_based: 'case-based / source-based questions',
  assertion_reason: 'assertion–reason questions',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmtMarks = (n: number) => plural(n, 'mark');

/* ----------------------------------------------------------------------------
 * Section pattern
 * ------------------------------------------------------------------------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

export const sectionTotal = (sections: Pick<SectionSpec, 'count' | 'marksEach'>[]) =>
  round2(sections.reduce((sum, s) => sum + s.count * s.marksEach, 0));

const COLLEGE_RE =
  /\b(college|universit|semester|sem\b|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|bca|mca|mba|degree|diploma|polytechnic|undergrad|postgrad|ug\b|pg\b|engineering)/i;

/** College-style paper when the course/level/board (or the request) says so; school otherwise. */
export function isCollegeLevel(ctx: Pick<GenerationContext, 'course' | 'prompt'>): boolean {
  const c = ctx.course;
  const text = [c?.level, c?.board, c?.title].filter(Boolean).join(' ');
  if (text) return COLLEGE_RE.test(text);
  return COLLEGE_RE.test(ctx.prompt);
}

interface Template {
  name: string;
  type: PaperQuestionType;
  marksEach: number;
  /** Share of the total marks; the 1-mark MCQ section (share 0) absorbs the remainder. */
  share: number;
  internalChoice: boolean;
}

/**
 * A standard pattern scaled to `maxMarks`. Each non-MCQ section gets floor(share × max / marksEach)
 * questions and the 1-mark MCQ section takes the remainder, so the total is exact for any integer max.
 * School at 80 marks gives the CBSE pattern: A 20×1, B 5×2, C 6×3, D 4×5, E 3×4.
 */
export function standardSections(maxMarks: number, college: boolean): SectionSpec[] {
  const templates: Template[] = college
    ? [
        { name: 'Part A', type: 'mcq', marksEach: 1, share: 0, internalChoice: false },
        { name: 'Part B', type: 'short', marksEach: 4, share: 0.4, internalChoice: false },
        { name: 'Part C', type: 'long', marksEach: maxMarks >= 60 ? 10 : 6, share: 0.4, internalChoice: true },
      ]
    : [
        { name: 'Section A', type: 'mcq', marksEach: 1, share: 0, internalChoice: false },
        { name: 'Section B', type: 'very_short', marksEach: 2, share: 0.125, internalChoice: false },
        { name: 'Section C', type: 'short', marksEach: 3, share: 0.225, internalChoice: false },
        { name: 'Section D', type: 'long', marksEach: 5, share: 0.25, internalChoice: true },
        { name: 'Section E', type: 'case_based', marksEach: 4, share: 0.15, internalChoice: false },
      ];
  const counts = templates.map((t) => (t.share ? Math.floor((maxMarks * t.share) / t.marksEach) : 0));
  const used = templates.reduce((sum, t, i) => sum + counts[i]! * t.marksEach, 0);
  counts[0] = maxMarks - used;
  return templates
    .map((t, i) => ({ name: t.name, type: t.type, count: counts[i]!, marksEach: t.marksEach, internalChoice: t.internalChoice }))
    .filter((s) => s.count > 0);
}

/** "A" → "Section A"; anything longer is kept as the teacher wrote it. */
const sectionName = (name: string, i: number) => {
  const n = name.trim();
  if (!n) return `Section ${String.fromCharCode(65 + i)}`;
  return /^[A-Z]$/i.test(n) ? `Section ${n.toUpperCase()}` : n;
};

/* ----------------------------------------------------------------------------
 * Bloom / difficulty targets (approximate; stated in the prompt)
 * ------------------------------------------------------------------------- */

const DEFAULT_BLOOM: Record<BloomLevel, number> = { remember: 20, understand: 30, apply: 25, analyze: 15, evaluate: 5, create: 5 };

/** Target marks per Bloom level (largest-remainder rounding, so the targets add up to maxMarks). */
export function bloomTargets(mix: PaperOptions['bloomMix'], maxMarks: number): Partial<Record<BloomLevel, number>> {
  const entries = BLOOM_LEVELS.map((b) => [b, mix[b] ?? 0] as const).filter(([, v]) => v > 0);
  const weights = entries.length ? entries : (Object.entries(DEFAULT_BLOOM) as [BloomLevel, number][]);
  return apportion(weights, maxMarks);
}

export function difficultyTargets(mix: PaperOptions['difficultyMix'], maxMarks: number): Partial<Record<Difficulty, number>> {
  const entries = (['easy', 'medium', 'hard'] as const).map((d) => [d, mix[d]] as const).filter(([, v]) => v > 0);
  return apportion(entries.length ? entries : [['easy', 30], ['medium', 50], ['hard', 20]], maxMarks);
}

function apportion<K extends string>(weights: readonly (readonly [K, number])[], total: number): Partial<Record<K, number>> {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  const raw = weights.map(([k, w]) => ({ k, exact: (w / sum) * total }));
  const out = raw.map((r) => ({ k: r.k, n: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = Math.round(total - out.reduce((s, r) => s + r.n, 0));
  for (const r of [...out].sort((a, b) => b.rem - a.rem)) {
    if (left <= 0) break;
    r.n++;
    left--;
  }
  return Object.fromEntries(out.filter((r) => r.n > 0).map((r) => [r.k, r.n])) as Partial<Record<K, number>>;
}

/* ----------------------------------------------------------------------------
 * Model output: schema + validation
 * ------------------------------------------------------------------------- */

const QUESTION_TYPES = ['mcq', 'very_short', 'short', 'long', 'case_based', 'assertion_reason'] as const;

const questionJsonSchema = obj({
  type: enumOf(QUESTION_TYPES),
  text: str,
  options: arr(str),
  correctIndex: int,
  marks: num,
  bloomLevel: enumOf(BLOOM_LEVELS),
  competency: str,
  difficulty: enumOf(['easy', 'medium', 'hard']),
  unit: str,
  answer: str,
  markingScheme: str,
  alternative: obj({ text: str, answer: str, markingScheme: str }),
});

export const paperJsonSchema = obj({
  generalInstructions: arr(str),
  sections: arr(obj({ name: str, instructions: str, questions: arr(questionJsonSchema) })),
});

const RawQuestion = z.object({
  type: z.string(),
  text: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  marks: z.number(),
  bloomLevel: BloomLevel,
  competency: z.string(),
  difficulty: Difficulty,
  unit: z.string(),
  answer: z.string(),
  markingScheme: z.string(),
  alternative: z.object({ text: z.string(), answer: z.string(), markingScheme: z.string() }),
});
type RawQuestion = z.infer<typeof RawQuestion>;

export const RawPaper = z.object({
  generalInstructions: z.array(z.string()),
  sections: z.array(z.object({ name: z.string(), instructions: z.string(), questions: z.array(RawQuestion) })),
});
export type RawPaper = z.infer<typeof RawPaper>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Why a question cannot be used in its section (empty = usable). */
function questionProblems(q: RawQuestion, spec: SectionSpec): string[] {
  const problems: string[] = [];
  if (!q.text.trim()) problems.push('text is empty');
  if (!q.answer.trim()) problems.push('answer is empty');
  if (!isObjective(spec.type) && !q.markingScheme.trim()) problems.push('markingScheme is empty');
  if (isObjective(spec.type)) {
    const opts = q.options.map((o) => o.trim());
    if (opts.length !== 4 || opts.some((o) => !o)) problems.push('needs exactly 4 non-empty options');
    else if (new Set(opts.map(norm)).size !== 4) problems.push('options must be distinct');
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) problems.push('correctIndex must be 0-3');
  }
  if (spec.internalChoice && (!q.alternative.text.trim() || !q.alternative.answer.trim())) {
    problems.push('internal choice: give an "OR" alternative with text and answer');
  }
  return problems;
}

export interface PaperAnalysis {
  /** Usable questions per spec section (deduplicated, in model order, not yet trimmed). */
  valid: RawQuestion[][];
  /** Problems that need the model (missing sections or too few usable questions). */
  issues: string[];
  /** Every section has at least `count` usable questions. */
  complete: boolean;
  /** Questions whose marks differ from the spec (fixed deterministically). */
  marksAdjusted: number;
}

export function analyzePaper(raw: RawPaper, specs: SectionSpec[]): PaperAnalysis {
  const issues: string[] = [];
  const seen = new Set<string>();
  let marksAdjusted = 0;
  if (raw.sections.length !== specs.length) {
    issues.push(`sections: expected exactly ${specs.length} sections in the given order, got ${raw.sections.length}`);
  }
  const valid = specs.map((spec, i) => {
    const label = `sections[${i}] (${sectionName(spec.name, i)})`;
    const section = raw.sections[i];
    if (!section) {
      issues.push(`${label}: missing`);
      return [];
    }
    const ok: RawQuestion[] = [];
    const dropped: string[] = [];
    section.questions.forEach((q, j) => {
      const problems = questionProblems(q, spec);
      const key = norm(q.text);
      if (!problems.length && seen.has(key)) problems.push('duplicate question');
      if (problems.length) {
        dropped.push(`question ${j + 1}: ${problems.join(', ')}`);
        return;
      }
      seen.add(key);
      if (Math.abs(q.marks - spec.marksEach) > 1e-9) marksAdjusted++;
      ok.push(q);
    });
    if (ok.length < spec.count) {
      issues.push(
        `${label}: needs ${spec.count} valid ${TYPE_LABEL[spec.type]} of ${fmtMarks(spec.marksEach)} each, got ${ok.length}` +
          (dropped.length ? ` (${dropped.slice(0, 4).join('; ')})` : ''),
      );
    }
    return ok;
  });
  const complete = specs.every((spec, i) => valid[i]!.length >= spec.count);
  return { valid, issues, complete, marksAdjusted };
}

/* ----------------------------------------------------------------------------
 * Assembly
 * ------------------------------------------------------------------------- */

interface PaperHeaderInput {
  examName: string;
  subject: string;
  level: string;
  durationMin: number;
  maxMarks: number;
}

function defaultSectionInstructions(spec: SectionSpec): string {
  const base = `This section has ${plural(spec.count, TYPE_LABEL[spec.type].replace(/s$/, ''), TYPE_LABEL[spec.type])} of ${fmtMarks(spec.marksEach)} each.`;
  return spec.internalChoice ? `${base} Internal choice is given in some questions; attempt only one of the alternatives.` : base;
}

export function defaultGeneralInstructions(specs: SectionSpec[], header: PaperHeaderInput): string[] {
  return [
    `This question paper has ${plural(specs.length, 'section')} and ${plural(
      specs.reduce((s, x) => s + x.count, 0),
      'question',
    )}. All questions are compulsory.`,
    ...specs.map((s, i) => `${sectionName(s.name, i)}: ${s.count} ${TYPE_LABEL[s.type]} of ${fmtMarks(s.marksEach)} each.`),
    `Maximum marks: ${header.maxMarks}. Time allowed: ${header.durationMin} minutes.`,
  ];
}

/** Build the validated paper: numbering, marks from the spec, exact total. Throws if a section is short. */
export function assemblePaper(
  raw: RawPaper,
  analysis: PaperAnalysis,
  specs: SectionSpec[],
  header: PaperHeaderInput,
  fallbackUnit: string,
): QuestionPaperContent {
  if (!analysis.complete) {
    throw new PipelineError(`question paper incomplete: ${analysis.issues.join('; ')}`, { retryable: false, userMessage: INVALID_MESSAGE });
  }
  let number = 0;
  const sections = specs.map((spec, i) => {
    const questions: PaperQuestion[] = analysis.valid[i]!.slice(0, spec.count).map((q) => {
      const objective = isObjective(spec.type);
      const unit = q.unit.trim() || fallbackUnit;
      return {
        number: ++number,
        type: spec.type,
        text: q.text.trim(),
        options: objective ? q.options.map((o) => o.trim()) : [],
        correctIndex: objective ? q.correctIndex : -1,
        marks: spec.marksEach,
        bloomLevel: q.bloomLevel,
        competency: q.competency.trim() || unit,
        difficulty: q.difficulty,
        unit,
        answer: q.answer.trim(),
        markingScheme: q.markingScheme.trim() || `${fmtMarks(spec.marksEach)} for the correct answer.`,
        alternative:
          spec.internalChoice && q.alternative.text.trim()
            ? {
                text: q.alternative.text.trim(),
                answer: q.alternative.answer.trim(),
                markingScheme: q.alternative.markingScheme.trim() || q.markingScheme.trim(),
              }
            : null,
      };
    });
    const modelInstructions = raw.sections[i]?.instructions.trim();
    return { name: sectionName(spec.name, i), instructions: modelInstructions || defaultSectionInstructions(spec), questions };
  });
  fixTotal(sections, header.maxMarks);
  const general = raw.generalInstructions.map((s) => s.trim()).filter(Boolean);
  return {
    header: { ...header, generalInstructions: general.length ? general.slice(0, 12) : defaultGeneralInstructions(specs, header) },
    sections,
  };
}

/** Floating-point safety net: the last question absorbs any sub-mark drift so the paper totals maxMarks exactly. */
function fixTotal(sections: QuestionPaperContent['sections'], maxMarks: number): void {
  const all = sections.flatMap((s) => s.questions);
  const total = all.reduce((s, q) => s + q.marks, 0);
  const drift = round2(maxMarks - total);
  const last = all.at(-1);
  if (drift !== 0 && last && Math.abs(drift) < 1) last.marks = round2(last.marks + drift);
}

export const paperTotal = (content: QuestionPaperContent) =>
  round2(content.sections.reduce((s, sec) => s + sec.questions.reduce((t, q) => t + q.marks, 0), 0));

/* ----------------------------------------------------------------------------
 * Prompt
 * ------------------------------------------------------------------------- */

function maxTokensFor(specs: SectionSpec[], model: string): number {
  const per: Record<PaperQuestionType, number> = { mcq: 220, assertion_reason: 260, very_short: 260, short: 380, long: 650, case_based: 750 };
  const est = specs.reduce((s, x) => s + x.count * per[x.type] * (x.internalChoice ? 1.8 : 1), 0);
  return Math.min(maxOutputTokens(model), Math.round(1_500 + est));
}

function systemPrompt(ctx: GenerationContext, college: boolean): string {
  return [
    `You are an experienced ${college ? 'university' : 'school board'} paper setter. You write fair, unambiguous, syllabus-aligned question papers with a precise answer key and marking scheme.`,
    groundingInstruction(ctx),
    languageInstruction(ctx.language),
    'Keep the JSON enum values (type, bloomLevel, difficulty) in English exactly as listed.',
    '',
    'Rules:',
    '- Return the sections in exactly the given order, each with exactly the requested number of questions of the requested type.',
    '- marks of every question = the marks given for its section.',
    '- type "mcq": exactly 4 distinct options, exactly one correct; correctIndex is its 0-based index. Plausible distractors; never "all/none of the above".',
    '- type "assertion_reason": text has "Assertion (A): ..." and "Reason (R): ..."; options are the standard four: (a) Both A and R are true and R is the correct explanation of A, (b) Both A and R are true but R is not the correct explanation of A, (c) A is true but R is false, (d) A is false but R is true; correctIndex is the right one.',
    '- Other types: options = [] and correctIndex = -1. "case_based": a short case, passage or data followed by 2-4 sub-questions (i), (ii)... inside text; the answer covers every sub-question.',
    '- answer: the model answer (for objective types, the correct option and a one-line reason).',
    '- markingScheme: value points with the marks for each, adding up to the question\'s marks (e.g. "1 mark: definition; 1 mark: example").',
    '- Internal choice sections: alternative is an "OR" question of the same type, marks, difficulty and competency, on a different point, with its own answer and markingScheme (for an objective alternative, put its 4 options inside its text as (a)-(d)). Sections without internal choice: alternative fields are empty strings.',
    '- bloomLevel: the Bloom\'s taxonomy level the question really tests. competency: a short phrase (max 10 words) naming the skill tested. difficulty: easy / medium / hard. unit: the unit or chapter it comes from (use the given unit titles when provided).',
    '- Spread questions across the units in scope; no two questions test the same point.',
    '- generalInstructions: 4-8 short instructions for candidates. Section instructions: one sentence each.',
  ].join('\n');
}

function taskText(specs: SectionSpec[], header: PaperHeaderInput, bloom: Partial<Record<BloomLevel, number>>, diff: Partial<Record<Difficulty, number>>): string {
  const sectionLines = specs.map(
    (s, i) =>
      `  ${i + 1}. ${sectionName(s.name, i)}: ${s.count} × type "${s.type}" (${TYPE_LABEL[s.type]}), ${fmtMarks(s.marksEach)} each` +
      (s.internalChoice ? ', WITH internal choice (an "OR" alternative for every question)' : ''),
  );
  const fmt = (m: Partial<Record<string, number>>) =>
    Object.entries(m)
      .map(([k, v]) => `${k} ≈ ${v}`)
      .join(', ');
  return [
    `Write the question paper "${header.examName}"${header.subject ? ` for ${header.subject}` : ''}${header.level ? ` (${header.level})` : ''}. Maximum marks ${header.maxMarks}, time ${header.durationMin} minutes.`,
    'Sections (exactly in this order):',
    ...sectionLines,
    `Target marks by Bloom level (approximate): ${fmt(bloom)}.`,
    `Target marks by difficulty (approximate): ${fmt(diff)}.`,
  ].join('\n');
}

/* ----------------------------------------------------------------------------
 * Demo (development only)
 * ------------------------------------------------------------------------- */

function demoPaper(specs: SectionSpec[], header: PaperHeaderInput, unit: string): RawPaper {
  return {
    generalInstructions: ['[Demo] Generated without an AI provider; this is not real exam content.'],
    sections: specs.map((s, i) => ({
      name: s.name,
      instructions: '',
      questions: Array.from({ length: s.count }, (_, j) => ({
        type: s.type,
        text: `[Demo] ${sectionName(s.name, i)} question ${j + 1} about ${header.subject || 'the topic'}.`,
        options: isObjective(s.type) ? ['[Demo] Option A', '[Demo] Option B', '[Demo] Option C', '[Demo] Option D'] : [],
        correctIndex: isObjective(s.type) ? j % 4 : -1,
        marks: s.marksEach,
        bloomLevel: BLOOM_LEVELS[j % BLOOM_LEVELS.length]!,
        competency: '[Demo] Placeholder competency',
        difficulty: (['easy', 'medium', 'hard'] as const)[j % 3]!,
        unit,
        answer: '[Demo] Placeholder answer.',
        markingScheme: `[Demo] ${fmtMarks(s.marksEach)} for a complete answer.`,
        alternative: s.internalChoice
          ? { text: `[Demo] Alternative to question ${j + 1}.`, answer: '[Demo] Placeholder answer.', markingScheme: '[Demo]' }
          : { text: '', answer: '', markingScheme: '' },
      })),
    })),
  };
}

/* ----------------------------------------------------------------------------
 * Generator
 * ------------------------------------------------------------------------- */

export function resolveSpecs(ctx: GenerationContext, opts: PaperOptions): { specs: SectionSpec[]; pattern: 'teacher' | 'standard' } {
  if (opts.sections.length) {
    const total = sectionTotal(opts.sections);
    if (total !== opts.maxMarks) {
      throw new PipelineError(`section marks ${total} != maxMarks ${opts.maxMarks}`, {
        retryable: false,
        userMessage: `The sections add up to ${total} marks but the maximum marks is ${opts.maxMarks}. Adjust the sections so they add up exactly.`,
      });
    }
    return { specs: opts.sections, pattern: 'teacher' };
  }
  return { specs: standardSections(opts.maxMarks, isCollegeLevel(ctx)), pattern: 'standard' };
}

export const generate: ResourceGenerator = async (ctx): Promise<GenerationResult<QuestionPaperContent>> => {
  if (ctx.options.type !== 'question_paper') {
    throw new PipelineError(`question paper generator got ${ctx.options.type}`, { retryable: false });
  }
  const opts: PaperOptions = ctx.options;
  const college = isCollegeLevel(ctx);
  const { specs, pattern } = resolveSpecs(ctx, opts);
  const header: PaperHeaderInput = {
    examName: opts.examName,
    subject: ctx.course?.subject ?? ctx.course?.title ?? '',
    level: ctx.course?.level ?? '',
    durationMin: opts.durationMin,
    maxMarks: opts.maxMarks,
  };
  const fallbackUnit = ctx.units[0]?.title ?? (header.subject || 'General');
  const bloom = bloomTargets(opts.bloomMix, opts.maxMarks);
  const diff = difficultyTargets(opts.difficultyMix, opts.maxMarks);

  if (demoMode()) {
    const raw = demoPaper(specs, header, fallbackUnit);
    return { content: assemblePaper(raw, analyzePaper(raw, specs), specs, header, fallbackUnit), meta: { demo: true, pattern } };
  }

  const result = await generateStructured<RawPaper>(
    {
      model: ctx.model,
      messages: [
        { role: 'system', content: systemPrompt(ctx, college) },
        { role: 'user', content: contextMessage(ctx, taskText(specs, header, bloom, diff)) },
      ],
      schemaName: 'question_paper',
      jsonSchema: paperJsonSchema,
      zod: RawPaper,
      maxTokens: maxTokensFor(specs, ctx.model),
      check: (value) => analyzePaper(value, specs).issues,
      invalidMessage: INVALID_MESSAGE,
      usage: resourceUsage(ctx),
    },
    // After the repair round, extra/invalid questions are fine as long as every section can still be filled.
    (value) => analyzePaper(value, specs).complete,
  );

  const analysis = analyzePaper(result.value, specs);
  if (analysis.marksAdjusted) logger.info({ resourceId: ctx.resourceId, adjusted: analysis.marksAdjusted }, 'Question paper marks set from the section spec');
  const content = assemblePaper(result.value, analysis, specs, header, fallbackUnit);
  return {
    content,
    meta: {
      pattern,
      repaired: result.repaired,
      marksAdjusted: analysis.marksAdjusted,
      bloomTargets: bloom,
      difficultyTargets: diff,
    },
  };
};
