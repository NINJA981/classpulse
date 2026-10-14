/**
 * Classroom device API (mounted at /api/devices). Devices authenticate with
 * X-Device-Id + X-Device-Key and never use session cookies. See the contract at
 * the top of packages/shared/src/devices.ts.
 */
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  CHUNK_SHA256_HEADER,
  DEVICE_CHUNK_MAX_BYTES,
  DEVICE_ID_HEADER,
  DEVICE_KEY_HEADER,
  DEVICE_MAX_CHUNKS_PER_SESSION,
  DeviceCommandAckInput,
  DeviceHeartbeatInput,
  DeviceIdString,
  DeviceRegisterInput,
  FinalizeRecordingInput,
  Id,
} from '@classiq/shared';
import { AppError, badRequest, unauthenticated } from '../../lib/errors.js';
import { deviceRegisterLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { waitForDeviceSignal } from './commandBus.js';
import * as service from './service.js';

declare module 'express-serve-static-core' {
  interface Request {
    device?: service.DeviceRow;
  }
}

export const router = Router();

const MAX_KEY_LENGTH = 200;

async function deviceAuth(req: Request, _res: Response, next: NextFunction) {
  const id = req.headers[DEVICE_ID_HEADER];
  const key = req.headers[DEVICE_KEY_HEADER];
  if (typeof id !== 'string' || typeof key !== 'string' || !key || key.length > MAX_KEY_LENGTH) {
    return next(unauthenticated('Device credentials required'));
  }
  const parsedId = DeviceIdString.safeParse(id);
  if (!parsedId.success) return next(unauthenticated('Invalid device credentials'));
  const device = await service.authenticateDevice(parsedId.data, key);
  if (!device) return next(unauthenticated('Invalid device credentials'));
  req.device = device;
  next();
}

/**
 * Everything but the heartbeat is refused while the device's school is suspended (403
 * SCHOOL_SUSPENDED), classroom devices are switched off for it (403 FEATURE_DISABLED) or the
 * platform blocks sign-ins for maintenance (503 MAINTENANCE): no commands, no uploads, so no paid
 * transcription. The agent keeps its buffered audio and retries later. The heartbeat still works
 * and reports the state in `access`.
 */
async function deviceAccess(req: Request, _res: Response, next: NextFunction) {
  const blocked = await service.deviceBlock(currentDevice(req));
  next(blocked ?? undefined);
}

function currentDevice(req: Request): service.DeviceRow {
  if (!req.device) throw unauthenticated('Device credentials required');
  return req.device;
}

router.post('/register', deviceRegisterLimiter, async (req, res) => {
  const input = parseBody(req, DeviceRegisterInput);
  res.status(201).json(await service.registerDevice(input, req.ip ?? null));
});

router.use('/me', deviceAuth);

router.post('/me/heartbeat', async (req, res) => {
  const input = parseBody(req, DeviceHeartbeatInput);
  res.json(await service.recordHeartbeat(currentDevice(req), input, req.ip ?? null));
});

router.use('/me', deviceAccess);

const CommandsQuery = z.object({ wait: z.coerce.number().int().min(0).max(25).default(0) });

router.get('/me/commands', async (req, res) => {
  const device = currentDevice(req);
  const { wait } = parseQuery(req, CommandsQuery);
  const deadline = Date.now() + wait * 1000;
  const abort = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) clientGone = true;
    abort.abort();
  });

  for (;;) {
    const command = await service.claimNextCommand(device.id);
    if (command) {
      if (clientGone) return; // claimed but undeliverable; it is redelivered after the ack window
      res.json({ command });
      return;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0 || clientGone) break;
    await waitForDeviceSignal(device.id, Math.min(remaining, 1000), abort.signal);
    if (clientGone) return;
  }
  if (!clientGone) res.json({ command: null });
});

router.post('/me/commands/:id/ack', async (req, res) => {
  const { id } = parseParams(req, z.object({ id: Id }));
  const input = parseBody(req, DeviceCommandAckInput);
  await service.ackCommand(currentDevice(req), id, input);
  res.status(204).end();
});

const SessionParams = z.object({ sessionId: Id });
const ChunkParams = z.object({
  sessionId: Id,
  idx: z
    .string()
    .regex(/^\d{1,5}$/, 'Chunk index must be an integer')
    .transform(Number)
    .pipe(z.number().int().min(0).max(DEVICE_MAX_CHUNKS_PER_SESSION - 1)),
});
const Sha256Hex = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{64}$/, 'X-Chunk-SHA256 must be a hex SHA-256 digest');

router.get('/me/sessions/:sessionId/chunks', async (req, res) => {
  const { sessionId } = parseParams(req, SessionParams);
  res.json(await service.listReceivedChunks(currentDevice(req), sessionId));
});

/** Validate the path before reading up to ~1 MB of body. */
function validateChunkParams(req: Request, _res: Response, next: NextFunction) {
  parseParams(req, ChunkParams);
  next();
}

router.put(
  '/me/sessions/:sessionId/chunks/:idx',
  validateChunkParams,
  express.raw({ type: 'application/octet-stream', limit: DEVICE_CHUNK_MAX_BYTES + 4096 }),
  async (req, res) => {
    const { sessionId, idx } = parseParams(req, ChunkParams);
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Chunks must be sent as application/octet-stream');
    }
    const shaHeader = Sha256Hex.safeParse(req.headers[CHUNK_SHA256_HEADER]);
    if (!shaHeader.success) throw badRequest('X-Chunk-SHA256 header is missing or malformed');
    if (req.body.length > DEVICE_CHUNK_MAX_BYTES) throw new AppError('PAYLOAD_TOO_LARGE', 'Chunk is too large');
    res.json(await service.storeChunk(currentDevice(req), sessionId, idx, req.body, shaHeader.data));
  },
);

router.post('/me/sessions/:sessionId/finalize', async (req, res) => {
  const { sessionId } = parseParams(req, SessionParams);
  const input = parseBody(req, FinalizeRecordingInput);
  res.json(await service.finalizeRecording(currentDevice(req), sessionId, input));
});
