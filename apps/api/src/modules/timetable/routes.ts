import { Router } from 'express';
import { z } from 'zod';
import { Id, ReplaceTimetableInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

const SectionParams = z.object({ sectionId: Id });

router.get('/', async (req, res) => {
  const query = parseQuery(req, service.TimetableQuery);
  res.json(await service.listTimetable(currentUser(req).institutionId, query));
});

router.put('/:sectionId', async (req, res) => {
  const { sectionId } = parseParams(req, SectionParams);
  const input = parseBody(req, ReplaceTimetableInput);
  res.json(await service.replaceTimetable(currentUser(req).institutionId, sectionId, input));
});
