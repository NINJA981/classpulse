import { Router } from 'express';
import { CreateTeacherInput, IdParams, ImportTeachersInput, UpdateTeacherInput } from '@classpulse/shared';
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
  const actor = currentUser(req);
  res.status(201).json(await service.createTeacher(actor.institutionId, input, actor.id));
});

router.post('/import', async (req, res) => {
  const input = parseBody(req, ImportTeachersInput);
  const actor = currentUser(req);
  res.json(await service.importTeachers(actor.institutionId, input, actor.id));
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

router.post('/:id/send-invite', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  res.json(await service.sendTeacherLink(actor.institutionId, id, 'invite', actor.id));
});

router.post('/:id/send-reset-link', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  res.json(await service.sendTeacherLink(actor.institutionId, id, 'reset', actor.id));
});
