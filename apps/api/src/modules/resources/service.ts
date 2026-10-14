/**
 * AI teaching resources (lesson plans, worksheets, question papers, presentations).
 * Visibility: a teacher sees their own resources and resources shared with their school; only the owner
 * changes, regenerates, shares or deletes one (others get 403 for shared ones, 404 for everything else).
 * Generation is asynchronous: rows start `queued`, the `resources` job fills `content`.
 */
import { and, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import {
  LessonPlanContent,
  PresentationContent,
  QuestionPaperContent,
  WorksheetContent,
  type GenerateResourceInput,
  type ListResourcesQuery,
  type ResourceContent,
  type ResourceDetail,
  type ResourceSummary,
  type ResourceType,
  type SessionUser,
  type UpdateResourceInput,
  type Language,
} from '@classiq/shared';
import type { z } from 'zod';
import { db } from '../../db/client.js';
import { courses, lessons, teacherMaterials, teachingResources, units, users } from '../../db/schema/index.js';
import { AppError, badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { exporters, type ExportedFile } from './exporters/index.js';
import { enqueueResourceGeneration } from './queue.js';

type ResourceRow = typeof teachingResources.$inferSelect;

export const CONTENT_SCHEMAS: Record<ResourceType, z.ZodType<ResourceContent>> = {
  lesson_plan: LessonPlanContent,
  worksheet: WorksheetContent,
  question_paper: QuestionPaperContent,
  presentation: PresentationContent,
};

const TYPE_LABEL: Record<ResourceType, string> = {
  lesson_plan: 'Lesson plan',
  worksheet: 'Worksheet',
  question_paper: 'Question paper',
  presentation: 'Presentation',
};

const PROCESSING = ['queued', 'generating'] as const;
const isProcessing = (r: ResourceRow) => (PROCESSING as readonly string[]).includes(r.status);

/* ------------------------------------------ mapping ------------------------------------------ */

interface Joined {
  r: ResourceRow;
  courseTitle: string | null;
  teacherName: string;
}

const selectJoined = () =>
  db
    .select({ r: teachingResources, courseTitle: courses.title, teacherName: users.name })
    .from(teachingResources)
    .innerJoin(users, eq(users.id, teachingResources.teacherId))
    .leftJoin(courses, eq(courses.id, teachingResources.courseId));

function toSummary({ r, courseTitle, teacherName }: Joined): ResourceSummary {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    status: r.status,
    course: r.courseId && courseTitle ? { id: r.courseId, title: courseTitle } : null,
    teacher: { id: r.teacherId, name: teacherName },
    shared: r.shared,
    language: r.language as Language,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toDetail(j: Joined, user: SessionUser): ResourceDetail {
  const r = j.r;
  return {
    ...toSummary(j),
    prompt: r.prompt,
    unitIds: r.unitIds,
    lessonIds: r.lessonIds,
    materialIds: r.materialIds,
    options: r.options,
    content: r.content ?? null,
    failureReason: r.failureReason,
    mine: r.teacherId === user.id,
  };
}

/* ------------------------------------------ access ------------------------------------------ */

/** Own resources, and resources shared within the school. */
const visibleWhere = (user: SessionUser): SQL =>
  and(
    eq(teachingResources.institutionId, user.institutionId),
    or(eq(teachingResources.teacherId, user.id), eq(teachingResources.shared, true)),
  )!;

async function getVisible(user: SessionUser, id: string): Promise<Joined> {
  const [row] = await selectJoined().where(and(eq(teachingResources.id, id), visibleWhere(user)));
  if (!row) throw notFound('Resource');
  return row;
}

async function getOwned(user: SessionUser, id: string): Promise<Joined> {
  const row = await getVisible(user, id);
  if (row.r.teacherId !== user.id) throw forbidden('Only the teacher who created this resource can change it');
  return row;
}

async function detail(user: SessionUser, id: string): Promise<ResourceDetail> {
  return toDetail(await getVisible(user, id), user);
}

/* ------------------------------------------ queries ------------------------------------------ */

export async function listResources(user: SessionUser, query: ListResourcesQuery): Promise<ResourceSummary[]> {
  const rows = await selectJoined()
    .where(
      and(
        eq(teachingResources.institutionId, user.institutionId),
        query.scope === 'mine' ? eq(teachingResources.teacherId, user.id) : eq(teachingResources.shared, true),
        query.type ? eq(teachingResources.type, query.type) : undefined,
        query.courseId ? eq(teachingResources.courseId, query.courseId) : undefined,
        query.q ? ilike(teachingResources.title, `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : undefined,
      ),
    )
    .orderBy(desc(teachingResources.updatedAt), desc(teachingResources.id))
    .limit(200);
  return rows.map(toSummary);
}

export const getResource = detail;

/* ------------------------------------------ generation ------------------------------------------ */

/** Validate the grounding sources: course/units of the school, the teacher's own lessons and materials. */
async function checkSources(user: SessionUser, input: GenerateResourceInput): Promise<{ courseTitle: string | null; unitTitles: string[] }> {
  let courseTitle: string | null = null;
  if (input.courseId) {
    const course = await db.query.courses.findFirst({ where: and(eq(courses.id, input.courseId), eq(courses.institutionId, user.institutionId)) });
    if (!course) throw notFound('Course');
    courseTitle = course.title;
  }
  const unitIds = [...new Set(input.unitIds)];
  const lessonIds = [...new Set(input.lessonIds)];
  const materialIds = [...new Set(input.materialIds)];
  const [unitRows, lessonRows, materialRows] = await Promise.all([
    unitIds.length
      ? db
          .select({ id: units.id, title: units.title, courseId: units.courseId })
          .from(units)
          .innerJoin(courses, eq(courses.id, units.courseId))
          .where(and(inArray(units.id, unitIds), eq(courses.institutionId, user.institutionId)))
      : Promise.resolve([]),
    lessonIds.length
      ? db
          .select({ id: lessons.id })
          .from(lessons)
          .where(and(inArray(lessons.id, lessonIds), eq(lessons.teacherId, user.id), isNotNull(lessons.transcript)))
      : Promise.resolve([]),
    materialIds.length
      ? db
          .select({ id: teacherMaterials.id })
          .from(teacherMaterials)
          .where(and(inArray(teacherMaterials.id, materialIds), eq(teacherMaterials.teacherId, user.id)))
      : Promise.resolve([]),
  ]);
  if (unitRows.length !== unitIds.length) throw notFound('Unit');
  if (input.courseId && unitRows.some((u) => u.courseId !== input.courseId)) throw badRequest('Choose units from the selected course');
  if (lessonRows.length !== lessonIds.length) throw badRequest('Choose recorded lessons of yours that have a transcript');
  if (materialRows.length !== materialIds.length) throw notFound('Material');
  const order = new Map(unitIds.map((id, i) => [id, i]));
  return { courseTitle, unitTitles: [...unitRows].sort((a, b) => order.get(a.id)! - order.get(b.id)!).map((u) => u.title) };
}

function defaultTitle(type: ResourceType, unitTitles: string[], courseTitle: string | null, prompt: string): string {
  const topic = unitTitles[0] ?? (prompt.trim() ? prompt.trim().split(/\s+/).slice(0, 8).join(' ') : courseTitle);
  return (topic ? `${TYPE_LABEL[type]}: ${topic}` : TYPE_LABEL[type]).slice(0, 200);
}

export async function generateResource(user: SessionUser, input: GenerateResourceInput): Promise<ResourceDetail> {
  const { courseTitle, unitTitles } = await checkSources(user, input);
  if (!input.prompt.trim() && !input.courseId && !unitTitles.length && !input.lessonIds.length && !input.materialIds.length) {
    throw badRequest('Describe what you need, or choose a course, units, lessons or materials to work from');
  }
  const [row] = await db
    .insert(teachingResources)
    .values({
      institutionId: user.institutionId,
      teacherId: user.id,
      type: input.options.type,
      title: input.title?.trim() || defaultTitle(input.options.type, unitTitles, courseTitle, input.prompt),
      status: 'queued',
      courseId: input.courseId ?? null,
      unitIds: [...new Set(input.unitIds)],
      lessonIds: [...new Set(input.lessonIds)],
      materialIds: [...new Set(input.materialIds)],
      prompt: input.prompt,
      language: input.language,
      options: input.options,
      generationAttempt: 1,
    })
    .returning();
  await enqueue(row!);
  return detail(user, row!.id);
}

async function enqueue(row: ResourceRow): Promise<void> {
  try {
    await enqueueResourceGeneration({ resourceId: row.id, attempt: row.generationAttempt });
  } catch (err) {
    await db
      .update(teachingResources)
      .set({ status: 'failed', failureReason: 'Generation could not be started. Please try again.' })
      .where(eq(teachingResources.id, row.id));
    throw err;
  }
}

export async function regenerateResource(user: SessionUser, id: string): Promise<ResourceDetail> {
  const { r } = await getOwned(user, id);
  if (isProcessing(r)) throw invalidState('This resource is already being generated.');
  const [row] = await db
    .update(teachingResources)
    .set({ status: 'queued', failureReason: null, generationAttempt: sql`${teachingResources.generationAttempt} + 1` })
    .where(and(eq(teachingResources.id, r.id), eq(teachingResources.generationAttempt, r.generationAttempt)))
    .returning();
  if (!row) throw invalidState('This resource changed meanwhile. Reload and try again.');
  await enqueue(row);
  return detail(user, id);
}

/* ------------------------------------------ edits ------------------------------------------ */

export async function updateResource(user: SessionUser, id: string, input: UpdateResourceInput): Promise<ResourceDetail> {
  const { r } = await getOwned(user, id);
  const values: Partial<typeof teachingResources.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.content !== undefined) {
    if (isProcessing(r)) throw invalidState('Wait for generation to finish before editing.');
    const parsed = CONTENT_SCHEMAS[r.type].safeParse(input.content);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'The edited content is not valid for this resource type',
        parsed.error.issues.slice(0, 20).map((i) => ({ path: `content.${i.path.join('.')}`, message: i.message })),
      );
    }
    values.content = parsed.data;
    if (r.status === 'failed') {
      values.status = 'ready';
      values.failureReason = null;
    }
  }
  if (Object.keys(values).length) await db.update(teachingResources).set(values).where(eq(teachingResources.id, r.id));
  return detail(user, id);
}

export async function deleteResource(user: SessionUser, id: string): Promise<void> {
  const { r } = await getOwned(user, id);
  await db.delete(teachingResources).where(eq(teachingResources.id, r.id));
}

export async function setShared(user: SessionUser, id: string, shared: boolean): Promise<ResourceDetail> {
  const { r } = await getOwned(user, id);
  if (shared && (r.status !== 'ready' || !r.content)) throw invalidState('Only a finished resource can be shared.');
  await db
    .update(teachingResources)
    .set({ shared, sharedAt: shared ? (r.sharedAt ?? new Date()) : null })
    .where(eq(teachingResources.id, r.id));
  return detail(user, id);
}

/** Copy a shared (or own) finished resource into "mine" as a private, editable copy. */
export async function copyResource(user: SessionUser, id: string): Promise<ResourceDetail> {
  const { r } = await getVisible(user, id);
  if (r.status !== 'ready' || !r.content) throw invalidState('Only a finished resource can be copied.');
  const own = r.teacherId === user.id;
  const [row] = await db
    .insert(teachingResources)
    .values({
      institutionId: user.institutionId,
      teacherId: user.id,
      type: r.type,
      title: `${r.title.slice(0, 190)} (copy)`,
      status: 'ready',
      courseId: r.courseId,
      unitIds: r.unitIds,
      // Lessons and materials are private to their owner: a copy from a colleague keeps only the course/units.
      lessonIds: own ? r.lessonIds : [],
      materialIds: own ? r.materialIds : [],
      prompt: r.prompt,
      language: r.language,
      options: r.options,
      content: r.content,
      aiMeta: r.aiMeta,
      copiedFromId: r.id,
    })
    .returning({ id: teachingResources.id });
  return detail(user, row!.id);
}

/* ------------------------------------------ export ------------------------------------------ */

export async function exportResource(user: SessionUser, id: string, ext?: string): Promise<ExportedFile> {
  const { r, teacherName } = await getVisible(user, id);
  const exporter = exporters[r.type];
  if (ext && ext !== exporter.format) throw notFound('Export format');
  if (r.status !== 'ready' || !r.content) throw invalidState('This resource has no content to download yet.');
  const course = r.courseId ? await db.query.courses.findFirst({ where: eq(courses.id, r.courseId) }) : undefined;
  return exporter.exportFile({
    type: r.type,
    title: r.title,
    content: r.content,
    options: r.options,
    language: r.language as Language,
    course: course ? { title: course.title, level: course.level, board: course.board, subject: course.subject } : null,
    teacherName,
  });
}
