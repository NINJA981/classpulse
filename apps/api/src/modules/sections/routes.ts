import { Router } from 'express';
import { IdParams, SectionInput, SetSectionStudentsInput, UpdateSectionInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.listSections(currentUser(req).institutionId));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, SectionInput);
  res.status(201).json(await service.createSection(currentUser(req).institutionId, input));
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateSectionInput);
  res.json(await service.updateSection(currentUser(req).institutionId, id, input));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteSection(currentUser(req).institutionId, id);
  res.status(204).end();
});

router.post('/:id/rotate-code', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.rotateJoinCode(currentUser(req).institutionId, id));
});

router.get('/:id/students', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.listSectionStudents(currentUser(req).institutionId, id));
});

router.put('/:id/students', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, SetSectionStudentsInput);
  res.json(await service.setSectionStudents(currentUser(req).institutionId, id, input));
});
