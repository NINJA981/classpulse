import { Router } from 'express';
import { CreateStudentInput, IdParams, ImportStudentsInput, UpdateStudentInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  const query = parseQuery(req, service.ListStudentsQuery);
  res.json(await service.listStudents(currentUser(req).institutionId, query));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, CreateStudentInput);
  res.status(201).json(await service.createStudent(currentUser(req).institutionId, input));
});

router.post('/import', async (req, res) => {
  const input = parseBody(req, ImportStudentsInput);
  res.json(await service.importStudents(currentUser(req).institutionId, input));
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateStudentInput);
  res.json(await service.updateStudent(currentUser(req).institutionId, id, input));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteStudent(currentUser(req).institutionId, id);
  res.status(204).end();
});

router.post('/:id/reset-password', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.resetStudentPassword(currentUser(req).institutionId, id));
});
