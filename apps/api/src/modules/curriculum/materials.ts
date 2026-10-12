/**
 * Teacher materials (notes, textbook chapters) that ground AI output. A material belongs to the teacher who
 * uploaded it (other teachers never see it) and may be attached to a course / unit of the school.
 * Uploads (rate-limited per teacher) go to the storage temp dir via multer (≤ MATERIAL_MAX_MB), text is
 * extracted in a sandboxed worker (extract.ts), the school's storage limit is checked, and the original
 * file is moved into storage under a server-generated key.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { Id, MATERIAL_MAX_MB, type Material, type SessionUser, type UpdateMaterialInput } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { courses, teacherMaterials, units } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { storage } from '../../lib/storage.js';
import { assertStorageAvailable } from '../../lib/storageQuota.js';
import { limited, materialUploadLimiter } from '../../middleware/uploadLimit.js';
import { MATERIAL_EXTENSIONS, extractMaterialText } from './extract.js';
import { getSchoolCourse, getSchoolUnit } from './service.js';

/** Storage key of an uploaded material (`ext` is a validated extension such as ".pdf"). */
const materialKey = (institutionId: string, ext: string) => `materials/${institutionId}/${randomUUID()}${ext}`;

export const MaterialUploadFields = z.object({
  title: z.string().trim().max(200).optional(),
  courseId: z.union([Id, z.literal('')]).optional(),
  unitId: z.union([Id, z.literal('')]).optional(),
});

export const ListMaterialsQuery = z.object({
  courseId: Id.optional(),
  unitId: Id.optional(),
});
export type ListMaterialsQuery = z.infer<typeof ListMaterialsQuery>;

/** Field `file` (one file) plus text fields title / courseId / unitId. Rate-limited per teacher. */
export const materialUploadMiddleware: RequestHandler = limited(materialUploadLimiter, (req, res, next) => {
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(storage.tmpDir, { recursive: true }).then(
          () => cb(null, storage.tmpDir),
          (err: Error) => cb(err, storage.tmpDir),
        );
      },
      filename: (_req, _file, cb) => cb(null, `material-${randomUUID()}.upload`),
    }),
    defParamCharset: 'utf8',
    limits: { fileSize: MATERIAL_MAX_MB * 1024 * 1024, files: 1, fields: 5, parts: 6 },
    fileFilter: (_req, file, cb) => {
      if (!MATERIAL_EXTENSIONS[path.extname(file.originalname).toLowerCase()]) {
        return cb(badRequest('Upload a PDF, Word (.docx) or text (.txt) file.'));
      }
      cb(null, true);
    },
  }).single('file')(req, res, next);
});

type MaterialRow = typeof teacherMaterials.$inferSelect;

const selectMaterials = () =>
  db
    .select({
      m: teacherMaterials,
      courseTitle: courses.title,
      unitTitle: units.title,
      textLength: sql<number>`char_length(${teacherMaterials.textContent})::int`,
    })
    .from(teacherMaterials)
    .leftJoin(courses, eq(courses.id, teacherMaterials.courseId))
    .leftJoin(units, eq(units.id, teacherMaterials.unitId));

function toMaterial(r: { m: MaterialRow; courseTitle: string | null; unitTitle: string | null; textLength: number }): Material {
  const { m } = r;
  return {
    id: m.id,
    title: m.title,
    kind: m.kind,
    course: m.courseId && r.courseTitle ? { id: m.courseId, title: r.courseTitle } : null,
    unit: m.unitId && r.unitTitle ? { id: m.unitId, title: r.unitTitle } : null,
    sizeBytes: m.sizeBytes,
    textLength: r.textLength,
    createdAt: m.createdAt.toISOString(),
  };
}

async function materialDto(id: string): Promise<Material> {
  const [row] = await selectMaterials().where(eq(teacherMaterials.id, id));
  return toMaterial(row!);
}

/** Resolve an optional course/unit pair to ids of the user's school (the unit implies its course). */
async function resolveAttachment(user: SessionUser, courseId: string | null | undefined, unitId: string | null | undefined) {
  if (unitId) {
    const { unit } = await getSchoolUnit(user, unitId);
    if (courseId && courseId !== unit.courseId) throw badRequest('That unit belongs to a different course');
    return { courseId: unit.courseId, unitId: unit.id };
  }
  if (courseId) await getSchoolCourse(user, courseId);
  return { courseId: courseId ?? null, unitId: null };
}

export async function uploadMaterial(
  user: SessionUser,
  file: Express.Multer.File | undefined,
  fields: z.infer<typeof MaterialUploadFields>,
): Promise<Material> {
  if (!file) throw badRequest('Attach the file as "file"');
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const kind = MATERIAL_EXTENSIONS[ext]!;
    const attach = await resolveAttachment(user, fields.courseId || null, fields.unitId || null);
    await assertStorageAvailable(user.institutionId, file.size);
    const text = await extractMaterialText(kind, await readFile(file.path));
    const title = (fields.title?.trim() || path.basename(file.originalname, path.extname(file.originalname)) || 'Material').slice(0, 200);

    const key = materialKey(user.institutionId, ext);
    const stat = await storage.putFile(key, file.path);
    try {
      const [row] = await db
        .insert(teacherMaterials)
        .values({
          institutionId: user.institutionId,
          teacherId: user.id,
          courseId: attach.courseId,
          unitId: attach.unitId,
          title,
          kind,
          objectKey: key,
          originalName: file.originalname.slice(0, 255),
          sizeBytes: stat.size,
          textContent: text,
        })
        .returning({ id: teacherMaterials.id });
      return materialDto(row!.id);
    } catch (err) {
      await storage.delete(key).catch(() => undefined);
      throw err;
    }
  } finally {
    await rm(file.path, { force: true }).catch(() => undefined);
  }
}

export async function listMaterials(user: SessionUser, query: ListMaterialsQuery): Promise<Material[]> {
  const rows = await selectMaterials()
    .where(
      and(
        eq(teacherMaterials.teacherId, user.id),
        query.courseId ? eq(teacherMaterials.courseId, query.courseId) : undefined,
        query.unitId ? eq(teacherMaterials.unitId, query.unitId) : undefined,
      ),
    )
    .orderBy(desc(teacherMaterials.createdAt));
  return rows.map(toMaterial);
}

async function getOwnMaterial(user: SessionUser, id: string): Promise<MaterialRow> {
  const row = await db.query.teacherMaterials.findFirst({ where: and(eq(teacherMaterials.id, id), eq(teacherMaterials.teacherId, user.id)) });
  if (!row) throw notFound('Material');
  return row;
}

export async function updateMaterial(user: SessionUser, id: string, input: UpdateMaterialInput): Promise<Material> {
  const m = await getOwnMaterial(user, id);
  const values: Partial<typeof teacherMaterials.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.courseId !== undefined || input.unitId !== undefined) {
    const courseId = input.courseId !== undefined ? input.courseId : input.unitId ? null : m.courseId;
    const unitId = input.unitId !== undefined ? input.unitId : input.courseId !== undefined && input.courseId !== m.courseId ? null : m.unitId;
    Object.assign(values, await resolveAttachment(user, courseId, unitId));
  }
  if (Object.keys(values).length) await db.update(teacherMaterials).set(values).where(eq(teacherMaterials.id, m.id));
  return materialDto(m.id);
}

export async function deleteMaterial(user: SessionUser, id: string): Promise<void> {
  const m = await getOwnMaterial(user, id);
  await db.delete(teacherMaterials).where(eq(teacherMaterials.id, m.id));
  if (m.objectKey) await storage.delete(m.objectKey).catch((err: Error) => logger.warn({ err: err.message }, 'Could not delete material file'));
}
