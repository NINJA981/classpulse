import { Router } from 'express';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('teacher'));

router.get('/dashboard', async (req, res) => {
  const user = currentUser(req);
  res.json(await service.dashboard(user.id, user.institutionId));
});

router.get('/sections', async (req, res) => {
  res.json(await service.mySections(currentUser(req).id));
});

router.get('/timetable', async (req, res) => {
  res.json(await service.myTimetable(currentUser(req).id));
});
