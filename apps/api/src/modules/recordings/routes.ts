/** Teacher-controlled classroom-device recording (mounted at /api/recordings). */
import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Id, IdParams, StartRecordingInput } from '@classiq/shared';
import { devices } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
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
  const session = await service.startRecording(currentUser(req).id, input);
  await audit(req, {
    action: 'recording.start',
    targetType: 'recording',
    targetId: session.id,
    metadata: { lessonId: session.lessonId, deviceId: session.device.id },
  });
  res.status(201).json(session);
});

router.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getRecording(currentUser(req).id, id));
});

router.post('/:id/stop', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const session = await service.stopRecording(currentUser(req).id, id);
  await audit(req, { action: 'recording.stop', targetType: 'recording', targetId: id, metadata: { lessonId: session.lessonId } });
  res.json(session);
});

router.post('/:id/cancel', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const session = await service.cancelRecording(currentUser(req).id, id);
  await audit(req, { action: 'recording.cancel', targetType: 'recording', targetId: id, metadata: { lessonId: session.lessonId } });
  res.json(session);
});
