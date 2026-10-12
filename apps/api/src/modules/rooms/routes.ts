import { Router } from 'express';
import { IdParams, RoomInput } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('admin'));

const RoomPatch = RoomInput.partial();

router.get('/', async (req, res) => {
  res.json(await service.listRooms(currentUser(req).institutionId));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, RoomInput);
  const room = await service.createRoom(currentUser(req).institutionId, input);
  await audit(req, { action: 'room.create', targetType: 'room', targetId: room.id });
  res.status(201).json(room);
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, RoomPatch);
  const room = await service.updateRoom(currentUser(req).institutionId, id, input);
  await audit(req, { action: 'room.update', targetType: 'room', targetId: id, metadata: { fields: Object.keys(input) } });
  res.json(room);
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteRoom(currentUser(req).institutionId, id);
  await audit(req, { action: 'room.delete', targetType: 'room', targetId: id });
  res.status(204).end();
});
