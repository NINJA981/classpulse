import { Router } from 'express';
import { CreateTeacherInput, IdParams, UpdateTeacherInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.listTeachers(currentUser(req).institutionId));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, CreateTeacherInput);
  res.status(201).json(await service.createTeacher(currentUser(req).institutionId, input));
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateTeacherInput);
  res.json(await service.updateTeacher(currentUser(req).institutionId, id, input));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteTeacher(currentUser(req).institutionId, id);
  res.status(204).end();
});

router.post('/:id/reset-password', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.resetTeacherPassword(currentUser(req).institutionId, id));
});
