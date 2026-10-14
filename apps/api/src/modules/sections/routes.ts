import { Router, type Request } from 'express';
import { IdParams, SectionInput, SetSectionStudentsInput, UpdateSectionInput } from '@classiq/shared';
import { audit } from '../../lib/audit.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

const sectionAudit = (req: Request, action: string, id: string, metadata?: Record<string, unknown>) =>
  audit(req, { action, targetType: 'section', targetId: id, metadata });

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.listSections(currentUser(req).institutionId));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, SectionInput);
  const section = await service.createSection(currentUser(req).institutionId, input);
  await sectionAudit(req, 'section.create', section.id, { teacherIds: input.teacherIds ?? [], roomId: input.roomId ?? null });
  res.status(201).json(section);
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateSectionInput);
  const section = await service.updateSection(currentUser(req).institutionId, id, input);
  await sectionAudit(req, 'section.update', id, {
    fields: Object.keys(input),
    ...(input.teacherIds !== undefined && { teacherIds: input.teacherIds }),
  });
  res.json(section);
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteSection(currentUser(req).institutionId, id);
  await sectionAudit(req, 'section.delete', id);
  res.status(204).end();
});

router.post('/:id/rotate-code', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const section = await service.rotateJoinCode(currentUser(req).institutionId, id);
  await sectionAudit(req, 'section.rotate_code', id);
  res.json(section);
});

router.get('/:id/students', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.listSectionStudents(currentUser(req).institutionId, id));
});

router.put('/:id/students', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, SetSectionStudentsInput);
  const change: service.EnrolmentChange = { added: 0, removed: 0 };
  const students = await service.setSectionStudents(currentUser(req).institutionId, id, input, change);
  await sectionAudit(req, 'section.enrolments.set', id, { ...change, total: students.length });
  res.json(students);
});
