/** Competency insights (Bloom level × topic mastery per student), mounted at /api/insights. Teachers only. */
import { Router } from 'express';
import { z } from 'zod';
import { Id } from '@classiq/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseParams } from '../../middleware/validate.js';
import { sectionInsights } from './insights.js';

export const insightsRouter = Router();
insightsRouter.use(authenticate(), requireRole('teacher'));

/** GET /api/insights/sections/:sectionId → SectionInsights (404 unless the teacher teaches the section). */
insightsRouter.get('/sections/:sectionId', async (req, res) => {
  const { sectionId } = parseParams(req, z.object({ sectionId: Id }));
  res.json(await sectionInsights(currentUser(req), sectionId));
});
