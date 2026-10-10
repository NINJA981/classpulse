import { Router } from 'express';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.getOverview(currentUser(req).institutionId));
});
