import { Router } from 'express';
import { IdParams, RoomInput } from '@classpulse/shared';
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
  res.status(201).json(await service.createRoom(currentUser(req).institutionId, input));
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, RoomPatch);
  res.json(await service.updateRoom(currentUser(req).institutionId, id, input));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteRoom(currentUser(req).institutionId, id);
  res.status(204).end();
});
