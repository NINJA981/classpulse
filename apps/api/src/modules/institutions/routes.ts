import { Router } from 'express';
import { InstitutionInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.getInstitution(currentUser(req).institutionId));
});

router.put('/', async (req, res) => {
  const input = parseBody(req, InstitutionInput);
  res.json(await service.upsertInstitution(currentUser(req).institutionId, input));
});
