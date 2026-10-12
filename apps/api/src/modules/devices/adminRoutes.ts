/** Admin fleet management (mounted at /api/admin/devices). Institution-scoped. */
import { Router } from 'express';
import { CreateEnrollmentTokenInput, IdParams } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
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
  const token = await service.createEnrollmentToken(user.institutionId, user.id, input);
  // Never the token itself.
  await audit(req, {
    action: 'device.enrollment_token.create',
    targetType: 'room',
    targetId: token.room.id,
    metadata: { name: token.name, expiresAt: token.expiresAt },
  });
  res.status(201).json(token);
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.revokeDevice(currentUser(req).institutionId, id);
  await audit(req, { action: 'device.revoke', targetType: 'device', targetId: id });
  res.status(204).end();
});
