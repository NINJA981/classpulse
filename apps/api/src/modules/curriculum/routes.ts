/**
 * Curriculum (courses → units), the built-in syllabus catalog and teacher materials,
 * mounted at /api/curriculum (teacher role; the school's "teacherTools" feature).
 */
import { rm } from 'node:fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { CourseInput, Id, IdParams, ReorderUnitsInput, UnitInput, UpdateMaterialInput } from '@classiq/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { draftUnitSummary } from './draftSummary.js';
import * as materials from './materials.js';
import * as service from './service.js';

export const curriculumRouter = Router();
curriculumRouter.use(authenticate(), requireRole('teacher'), requireFeature('teacherTools'));

const KeyParams = z.object({ key: z.string().regex(/^[a-z0-9-]{1,80}$/) });
const ImportInput = z.object({ sectionId: Id.nullable().optional() });

/* ---------------------------------- catalog ---------------------------------- */

curriculumRouter.get('/catalog', (req, res) => {
  res.json(service.listCatalog(parseQuery(req, service.CatalogQuery)));
});

curriculumRouter.post('/catalog/:key/import', async (req, res) => {
  const { key } = parseParams(req, KeyParams);
  res.status(201).json(await service.importCatalog(currentUser(req), key, parseBody(req, ImportInput).sectionId));
});

/* ---------------------------------- courses ---------------------------------- */

curriculumRouter.get('/courses', async (req, res) => {
  res.json(await service.listCourses(currentUser(req), parseQuery(req, service.ListCoursesQuery)));
});

curriculumRouter.post('/courses', async (req, res) => {
  res.status(201).json(await service.createCourse(currentUser(req), parseBody(req, CourseInput)));
});

curriculumRouter.get('/courses/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getCourse(currentUser(req), id));
});

curriculumRouter.patch('/courses/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateCourse(currentUser(req), id, parseBody(req, CourseInput.partial())));
});

curriculumRouter.delete('/courses/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteCourse(currentUser(req), id);
  res.status(204).end();
});

curriculumRouter.post('/courses/:id/units', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.status(201).json(await service.createUnit(currentUser(req), id, parseBody(req, UnitInput)));
});

curriculumRouter.put('/courses/:id/units/order', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.reorderUnits(currentUser(req), id, parseBody(req, ReorderUnitsInput)));
});

/* ---------------------------------- units ---------------------------------- */

curriculumRouter.patch('/units/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateUnit(currentUser(req), id, parseBody(req, UnitInput.partial())));
});

curriculumRouter.delete('/units/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteUnit(currentUser(req), id);
  res.status(204).end();
});

curriculumRouter.post('/units/:id/draft-summary', aiLimiter, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await draftUnitSummary(currentUser(req), id));
});

/* ---------------------------------- materials ---------------------------------- */

curriculumRouter.get('/materials', async (req, res) => {
  res.json(await materials.listMaterials(currentUser(req), parseQuery(req, materials.ListMaterialsQuery)));
});

curriculumRouter.post('/materials', materials.materialUploadMiddleware, async (req, res) => {
  let fields: ReturnType<typeof materials.MaterialUploadFields.parse>;
  try {
    fields = parseBody(req, materials.MaterialUploadFields);
  } catch (err) {
    if (req.file) await rm(req.file.path, { force: true }).catch(() => undefined);
    throw err;
  }
  res.status(201).json(await materials.uploadMaterial(currentUser(req), req.file, fields));
});

curriculumRouter.patch('/materials/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await materials.updateMaterial(currentUser(req), id, parseBody(req, UpdateMaterialInput)));
});

curriculumRouter.delete('/materials/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await materials.deleteMaterial(currentUser(req), id);
  res.status(204).end();
});
