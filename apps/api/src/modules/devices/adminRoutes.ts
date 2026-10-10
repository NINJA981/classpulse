/** Admin fleet management (mounted at /api/admin/devices). Institution-scoped. */
import { Router } from 'express';
import { CreateEnrollmentTokenInput, IdParams } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.listInstitutionDevices(currentUser(req).institutionId));
});

router.post('/enrollment-tokens', async (req, res) => {
  const input = parseBody(req, CreateEnrollmentTokenInput);
  const user = currentUser(req);
  res.status(201).json(await service.createEnrollmentToken(user.institutionId, user.id, input));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.revokeDevice(currentUser(req).institutionId, id);
  res.status(204).end();
});
