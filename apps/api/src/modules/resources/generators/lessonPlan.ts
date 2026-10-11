/**
 * Lesson plan generator: teacher request + grounding → LessonPlanContent.
 * Checks after the model answers (strict json_schema + zod, ONE repair round):
 * - the section timings sum to the total duration (durationMin × periods) and every section has time;
 * - objectives, sections and assessment are present.
 * If the timings are still off after the repair, they are rescaled proportionally (recorded in meta).
 */
import { z } from 'zod';
import type { LessonPlanContent } from '@classpulse/shared';
import { PipelineError } from '../../../pipeline/errors.js';
import {
  arr,
  contextMessage,
  demoMode,
  generateStructured,
  groundingInstruction,
  languageInstruction,
  num,
  obj,
  resourceUsage,
  str,
} from './common.js';
import type { GenerationContext, GenerationResult, ResourceGenerator } from './types.js';

const INVALID = 'The AI returned an invalid lesson plan twice. Please try generating again.';

export const lessonPlanJsonSchema = obj({
  overview: str,
  level: str,
  durationMin: num,
  objectives: arr(str),
  prerequisites: arr(str),
  materials: arr(str),
  sections: arr(obj({ title: str, durationMin: num, activity: str, teacherNotes: str, studentTask: str })),
  assessment: arr(str),
  homework: str,
  differentiation: obj({ support: str, extension: str }),
});

const nonEmpty = z.string().trim().min(1);
const LessonPlanOut = z.object({
  overview: nonEmpty.max(3000),
  level: z.string().trim().max(120),
  durationMin: z.number(),
  objectives: z.array(nonEmpty.max(400)).min(1).max(12),
  prerequisites: z.array(nonEmpty.max(400)).max(12),
  materials: z.array(nonEmpty.max(300)).max(20),
  sections: z
    .array(
      z.object({
        title: nonEmpty.max(200),
        durationMin: z.number().int().min(1),
        activity: nonEmpty.max(4000),
        teacherNotes: z.string().trim().max(3000),
        studentTask: z.string().trim().max(2000),
      }),
    )
    .min(2)
    .max(40),
  assessment: z.array(nonEmpty.max(600)).min(1).max(12),
  homework: z.string().trim().max(2000),
  differentiation: z.object({ support: z.string().trim().max(2000), extension: z.string().trim().max(2000) }),
});

interface PlanSettings {
  durationMin: number;
  periods: number;
  pedagogy?: string;
  total: number;
}

function settingsOf(ctx: GenerationContext): PlanSettings {
  const o = ctx.options.type === 'lesson_plan' ? ctx.options : { durationMin: 45, periods: 1, pedagogy: undefined };
  return { durationMin: o.durationMin, periods: o.periods, pedagogy: o.pedagogy, total: o.durationMin * o.periods };
}

const sumMinutes = (plan: Pick<LessonPlanContent, 'sections'>) => plan.sections.reduce((s, x) => s + x.durationMin, 0);

/** Rescale section minutes to `total` (integers, each ≥ 1); the rounding remainder goes to the longest section. */
export function rescaleTimings(sections: LessonPlanContent['sections'], total: number): LessonPlanContent['sections'] {
  const sum = sections.reduce((s, x) => s + x.durationMin, 0);
  if (!sum || sum === total) return sections;
  const scaled = sections.map((s) => ({ ...s, durationMin: Math.max(1, Math.round((s.durationMin * total) / sum)) }));
  const diff = total - scaled.reduce((s, x) => s + x.durationMin, 0);
  const longest = scaled.reduce((best, s, i) => (s.durationMin > scaled[best]!.durationMin ? i : best), 0);
  scaled[longest]!.durationMin = Math.max(1, scaled[longest]!.durationMin + diff);
  return scaled;
}

function messages(ctx: GenerationContext, s: PlanSettings) {
  const periodsText =
    s.periods > 1
      ? `${s.periods} periods of ${s.durationMin} minutes (${s.total} minutes in total). Start each period's first section title with "Period N: ".`
      : `one period of ${s.durationMin} minutes.`;
  const system = [
    'You are an expert teacher-educator in India who writes practical, classroom-ready lesson plans for any level (school classes, college courses, diplomas).',
    groundingInstruction(ctx),
    'Pitch the language, examples and activities at the learners\' level. Prefer active learning: questioning, think-pair-share, worked examples, short practice, quick checks for understanding.',
    'Timings must be realistic and the section durations MUST add up exactly to the total duration. Include an opening (hook / recall) and a closing (recap / exit check).',
    'Objectives are measurable ("Students will be able to …"). Assessment lists concrete checks (questions or tasks), not generic advice.',
    'teacherNotes: what the teacher says/does, likely misconceptions and board work. studentTask: what students do in that section.',
    'differentiation.support helps struggling learners; differentiation.extension challenges advanced learners.',
    languageInstruction(ctx.language),
    'Return JSON only, matching the schema. Set "durationMin" to the total minutes and "level" to the learners\' level (e.g. "Class 8", "B.Tech semester 3").',
  ].join('\n');
  const task =
    `Write a lesson plan for ${periodsText}` + (s.pedagogy ? ` Teaching approach requested: ${s.pedagogy}.` : '');
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: contextMessage(ctx, task) },
  ];
}

export const generate: ResourceGenerator = async (ctx): Promise<GenerationResult<LessonPlanContent>> => {
  const s = settingsOf(ctx);
  if (demoMode()) return { content: demoLessonPlan(ctx, s), meta: { demo: true } };

  const check = (plan: LessonPlanContent) => {
    const issues: string[] = [];
    const sum = sumMinutes(plan);
    if (sum !== s.total) issues.push(`the section durations add up to ${sum} minutes but must add up to exactly ${s.total}`);
    if (plan.durationMin !== s.total) issues.push(`durationMin must be ${s.total}`);
    return issues;
  };
  // A structurally valid plan whose only remaining problem is the timing arithmetic is fixed below.
  const timingOnly = (_plan: LessonPlanContent, issues: string[]) => issues.every((i) => /durations add up|durationMin must be/.test(i));

  const result = await generateStructured(
    {
      model: ctx.model,
      messages: messages(ctx, s),
      schemaName: 'lesson_plan',
      jsonSchema: lessonPlanJsonSchema,
      zod: LessonPlanOut,
      maxTokens: Math.min(16_000, 5_000 + s.periods * 1_500),
      check,
      invalidMessage: INVALID,
      usage: resourceUsage(ctx),
    },
    timingOnly,
  );
  const plan = result.value;
  const adjusted = result.remainingIssues.length > 0;
  const content: LessonPlanContent = {
    ...plan,
    durationMin: s.total,
    sections: adjusted ? rescaleTimings(plan.sections, s.total) : plan.sections,
  };
  if (sumMinutes(content) !== s.total) throw new PipelineError('Lesson plan timings could not be balanced', { retryable: false, userMessage: INVALID });
  return { content, meta: { repaired: result.repaired, timingsAdjusted: adjusted } };
};

/** Clearly labelled development output (PIPELINE_DEMO_FALLBACK). */
function demoLessonPlan(ctx: GenerationContext, s: PlanSettings): LessonPlanContent {
  const topic = ctx.units[0]?.title ?? ctx.title;
  const parts = [0.15, 0.35, 0.3, 0.2];
  const sections = rescaleTimings(
    ['Hook and recall', 'Explain the idea', 'Guided practice', 'Recap and exit check'].map((title, i) => ({
      title: `[Demo] ${title}`,
      durationMin: Math.max(1, Math.round(s.total * parts[i]!)),
      activity: `[Demo] ${title} for "${topic}".`,
      teacherNotes: '[Demo] Demo content — no AI provider is configured.',
      studentTask: '[Demo] Students take part in the activity.',
    })),
    s.total,
  );
  return {
    overview: `[Demo] A ${s.total}-minute lesson on ${topic}.`,
    level: ctx.course?.level ?? 'General',
    durationMin: s.total,
    objectives: [`[Demo] Students will be able to explain ${topic}.`],
    prerequisites: ['[Demo] Earlier unit'],
    materials: ['[Demo] Board and chalk'],
    sections,
    assessment: ['[Demo] Exit ticket with two questions'],
    homework: '[Demo] Revise the notes.',
    differentiation: { support: '[Demo] Worked example', extension: '[Demo] Challenge problem' },
  };
}
