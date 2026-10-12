import { Router } from 'express';
import { UpdateModelSettingsInput } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
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
  const settings = await service.updateModelSettings(currentUser(req).institutionId, patch);
  // Model names and providers only: these settings hold no keys.
  await audit(req, { action: 'settings.models.update', targetType: 'institution', targetId: currentUser(req).institutionId, metadata: { ...patch } });
  res.json(settings);
});
