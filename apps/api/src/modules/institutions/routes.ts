import { Router } from 'express';
import { InstitutionInput } from '@classiq/shared';
import { audit } from '../../lib/audit.js';
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
  const institution = await service.upsertInstitution(currentUser(req).institutionId, input);
  await audit(req, { action: 'institution.update', targetType: 'institution', targetId: currentUser(req).institutionId, metadata: { fields: Object.keys(input) } });
  res.json(institution);
});
