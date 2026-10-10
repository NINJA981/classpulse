/** Teacher-controlled classroom-device recording (mounted at /api/recordings). */
import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Id, IdParams, StartRecordingInput } from '@classpulse/shared';
import { devices } from '../../db/schema/index.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { listDevices } from '../devices/service.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('teacher'));

router.get('/devices', async (req, res) => {
  const { sectionId } = parseQuery(req, z.object({ sectionId: Id }));
  const user = currentUser(req);
  const { roomId } = await service.teacherSectionRoom(user.id, sectionId);
  if (!roomId) {
    res.json([]);
    return;
  }
  res.json(await listDevices(and(eq(devices.roomId, roomId), eq(devices.institutionId, user.institutionId))));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, StartRecordingInput);
  res.status(201).json(await service.startRecording(currentUser(req).id, input));
});

router.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getRecording(currentUser(req).id, id));
});

router.post('/:id/stop', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.stopRecording(currentUser(req).id, id));
});

router.post('/:id/cancel', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.cancelRecording(currentUser(req).id, id));
});
