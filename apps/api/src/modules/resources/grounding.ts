/**
 * Builds the GenerationContext for a resource: course, units, and the grounding text — unit summaries and
 * objectives, transcripts of the teacher's recorded lessons and the teacher's uploaded materials — fitted
 * into GROUNDING_MAX_CHARS with clear headers. Sources are re-checked against the resource owner here
 * (lessons and materials must still be theirs), so a stale id can never leak another teacher's content.
 */
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { DEFAULT_MODEL_SETTINGS, type Language } from '@classiq/shared';
import { db } from '../../db/client.js';
import { courses, lessons, modelSettings, teacherMaterials, units, type teachingResources } from '../../db/schema/index.js';
import type { GenerationContext } from './generators/types.js';

export const GROUNDING_MAX_CHARS = 60_000;

export interface GroundingSource {
  header: string;
  body: string;
}

/**
 * Fit sources into `budget` characters: each source gets an equal share, short sources keep all of their
 * text and hand their unused share to the others; long ones are cut (marked "[…truncated]").
 */
export function fitSources(sources: GroundingSource[], budget: number): string {
  const items = sources.map((s) => ({ ...s, body: s.body.trim() })).filter((s) => s.body);
  if (!items.length) return '';
  const overhead = items.reduce((n, s) => n + s.header.length + 4, 0);
  let remaining = Math.max(0, budget - overhead);
  const allowance = new Map<number, number>();
  const order = items.map((s, i) => ({ i, len: s.body.length })).sort((a, b) => a.len - b.len);
  order.forEach(({ i, len }, k) => {
    const share = Math.floor(remaining / (order.length - k));
    const take = Math.min(len, share);
    allowance.set(i, take);
    remaining -= take;
  });
  return items
    .map((s, i) => {
      const max = allowance.get(i) ?? 0;
      const body = s.body.length > max ? `${s.body.slice(0, Math.max(0, max - 14)).trimEnd()} […truncated]` : s.body;
      return `${s.header}\n${body}`;
    })
    .join('\n\n');
}

type ResourceRow = typeof teachingResources.$inferSelect;

export async function buildGenerationContext(resource: ResourceRow): Promise<GenerationContext> {
  const [course, unitRows, lessonRows, materialRows, settings] = await Promise.all([
    resource.courseId
      ? db.query.courses.findFirst({ where: and(eq(courses.id, resource.courseId), eq(courses.institutionId, resource.institutionId)) })
      : Promise.resolve(undefined),
    resource.unitIds.length
      ? db
          .select({ id: units.id, title: units.title, summary: units.summary, objectives: units.objectives })
          .from(units)
          .innerJoin(courses, eq(courses.id, units.courseId))
          .where(and(inArray(units.id, resource.unitIds), eq(courses.institutionId, resource.institutionId)))
          .orderBy(asc(units.position))
      : Promise.resolve([]),
    resource.lessonIds.length
      ? db
          .select({ id: lessons.id, title: lessons.title, subject: lessons.subject, transcript: lessons.transcript, createdAt: lessons.createdAt })
          .from(lessons)
          .where(and(inArray(lessons.id, resource.lessonIds), eq(lessons.teacherId, resource.teacherId), isNotNull(lessons.transcript)))
          .orderBy(asc(lessons.createdAt))
      : Promise.resolve([]),
    resource.materialIds.length
      ? db
          .select({ id: teacherMaterials.id, title: teacherMaterials.title, text: teacherMaterials.textContent })
          .from(teacherMaterials)
          .where(and(inArray(teacherMaterials.id, resource.materialIds), eq(teacherMaterials.teacherId, resource.teacherId)))
          .orderBy(asc(teacherMaterials.createdAt))
      : Promise.resolve([]),
    db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, resource.institutionId) }),
  ]);

  const unitText = unitRows
    .map((u) => {
      const parts = [`### Unit: ${u.title}`];
      if (u.summary?.trim()) parts.push(u.summary.trim());
      if (u.objectives.length) parts.push(`Objectives:\n${u.objectives.map((o) => `- ${o}`).join('\n')}`);
      return parts.join('\n');
    })
    .join('\n\n');

  const sections: string[] = [];
  let budget = GROUNDING_MAX_CHARS;
  if (course?.description?.trim() && !unitRows.length) {
    const text = `## Course description\n${course.description.trim()}`;
    sections.push(text);
    budget -= text.length;
  }
  if (unitText.trim() && unitRows.some((u) => u.summary?.trim() || u.objectives.length)) {
    const text = `## Unit summaries and objectives\n${unitText}`.slice(0, Math.floor(GROUNDING_MAX_CHARS / 4));
    sections.push(text);
    budget -= text.length;
  }
  const sources: GroundingSource[] = [
    ...lessonRows.map((l) => ({ header: `## Recorded lesson transcript: ${l.title} (${l.subject})`, body: l.transcript ?? '' })),
    ...materialRows.map((m) => ({ header: `## Teacher material: ${m.title}`, body: m.text })),
  ];
  const fitted = fitSources(sources, Math.max(0, budget - 2));
  if (fitted) sections.push(fitted);

  return {
    resourceId: resource.id,
    institutionId: resource.institutionId,
    type: resource.type,
    title: resource.title,
    prompt: resource.prompt,
    language: resource.language as Language,
    options: resource.options,
    course: course ? { title: course.title, level: course.level, board: course.board, subject: course.subject } : null,
    units: unitRows.map((u) => ({ title: u.title, summary: u.summary, objectives: u.objectives })),
    groundingText: sections.join('\n\n'),
    model: settings?.llmModel ?? DEFAULT_MODEL_SETTINGS.llmModel,
  };
}
