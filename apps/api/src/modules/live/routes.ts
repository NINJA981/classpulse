/** Live quiz REST (mounted at /api/live-sessions). The realtime protocol lives in sockets/liveQuiz.ts. */
import { Router } from 'express';
import { z } from 'zod';
import { CreateLiveSessionInput, IdParams, LivePin } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { pinLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate());

// Registered before '/:id' so "pin" is never parsed as an id.
router.get('/pin/:pin', requireRole('student'), pinLimiter, async (req, res) => {
  const { pin } = parseParams(req, z.object({ pin: LivePin }));
  res.json(await service.lookupPin(currentUser(req).id, pin));
});

router.post('/', requireRole('teacher'), async (req, res) => {
  const input = parseBody(req, CreateLiveSessionInput);
  res.status(201).json(await service.createLiveSession(currentUser(req).id, input));
});

router.get('/:id', requireRole('teacher'), async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getLiveSession(currentUser(req).id, id));
});

router.get('/:id/results', requireRole('teacher'), async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getLiveResults(currentUser(req).id, id));
});
