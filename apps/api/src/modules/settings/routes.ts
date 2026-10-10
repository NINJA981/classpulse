import { Router } from 'express';
import { UpdateModelSettingsInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.getModelSettings(currentUser(req).institutionId));
});

router.patch('/', async (req, res) => {
  const patch = parseBody(req, UpdateModelSettingsInput);
  res.json(await service.updateModelSettings(currentUser(req).institutionId, patch));
});
