/**
 * Classroom devices: provisioning, device-key auth, heartbeats, the command
 * long-poll, chunked PCM upload and recording finalization. Plus the admin
 * fleet operations (institution-scoped).
 */
import fs from 'node:fs/promises';
import { and, asc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type {
  Device,
  DeviceCommand,
  DeviceCommandAckInput,
  DeviceHeartbeatInput,
  DeviceRegisterInput,
  DeviceRegisterResponse,
  DeviceSystemStats,
  EnrollmentToken,
  FinalizeRecordingInput,
  CreateEnrollmentTokenInput,
  RecordingSession,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import {
  deviceCommands,
  deviceEnrollmentTokens,
  devices,
  recordingChunks,
  recordingSessions,
  rooms,
} from '../../db/schema/index.js';
import { randomToken, safeEqualHex, sha256Hex } from '../../lib/crypto.js';
import { AppError, badRequest, conflict, invalidState, notFound, unauthenticated } from '../../lib/errors.js';
import { probeDurationSec } from '../../lib/ffmpeg.js';
import { logger } from '../../lib/logger.js';
import { storage, storageKeys } from '../../lib/storage.js';
import { iso } from '../../lib/time.js';
import { attachLessonAudio, queueLessonGeneration } from '../lessons/audio.js';
import { assemblePcmToWav } from './wav.js';
import {
  ACTIVE_RECORDING_STATUSES,
  failRecordingSession,
  loadRecordingSession,
  notifyRecordingUpdate,
} from '../recordings/service.js';

export type DeviceRow = typeof devices.$inferSelect;

export const ENROLLMENT_TOKEN_TTL_MS = 24 * 3600_000;
/** A delivered command that is not acked within this window is delivered again (at-least-once). */
const REDELIVER_AFTER_SEC = 30;

/* ----------------------------------------------------------------------------
 * DTOs
 * ------------------------------------------------------------------------- */

const deviceSelection = {
  device: devices,
  roomName: rooms.name,
  activeRecordingId: recordingSessions.id,
};

function toDevice(row: { device: DeviceRow; roomName: string; activeRecordingId: string | null }): Device {
  const d = row.device;
  return {
    id: d.id,
    deviceId: d.deviceId,
    name: d.name,
    room: { id: d.roomId, name: row.roomName },
    status: d.status,
    agentVersion: d.agentVersion,
    lastHeartbeatAt: iso(d.lastHeartbeatAt),
    ipAddress: d.ipAddress,
    stats: d.stats ?? null,
    activeRecordingId: row.activeRecordingId,
    createdAt: d.createdAt.toISOString(),
  };
}

/** Non-revoked devices matching `where`, with their room and active recording. */
export async function listDevices(where: SQL | undefined): Promise<Device[]> {
  const rows = await db
    .select(deviceSelection)
    .from(devices)
    .innerJoin(rooms, eq(rooms.id, devices.roomId))
    .leftJoin(
      recordingSessions,
      and(eq(recordingSessions.deviceId, devices.id), inArray(recordingSessions.status, [...ACTIVE_RECORDING_STATUSES])),
    )
    .where(and(isNull(devices.revokedAt), where))
    .orderBy(asc(rooms.name), asc(devices.name));
  return rows.map(toDevice);
}

/* ----------------------------------------------------------------------------
 * Provisioning & auth
 * ------------------------------------------------------------------------- */

export async function registerDevice(input: DeviceRegisterInput, ipAddress: string | null): Promise<DeviceRegisterResponse> {
  const tokenHash = sha256Hex(input.enrollmentToken);
  const deviceKey = randomToken(32);
  const apiKeyHash = sha256Hex(deviceKey);

  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(deviceEnrollmentTokens)
      .where(
        and(
          eq(deviceEnrollmentTokens.tokenHash, tokenHash),
          isNull(deviceEnrollmentTokens.usedAt),
          sql`${deviceEnrollmentTokens.expiresAt} > now()`,
        ),
      )
      .for('update');
    if (!token) throw unauthenticated('The enrollment token is invalid, expired or already used');

    const [room] = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.id, token.roomId));
    if (!room) throw unauthenticated('The enrollment token is invalid, expired or already used');

    const [existing] = await tx.select().from(devices).where(eq(devices.deviceId, input.deviceId)).for('update');
    let deviceUuid: string;
    if (existing) {
      if (existing.institutionId !== token.institutionId) throw conflict('This device ID is already in use');
      // Re-provision: new key, possibly a new room. The old key stops working immediately.
      await tx
        .update(devices)
        .set({
          apiKeyHash,
          roomId: room.id,
          name: token.name,
          revokedAt: null,
          status: 'offline',
          agentVersion: input.agentVersion || null,
          ipAddress,
        })
        .where(eq(devices.id, existing.id));
      // Commands queued for the previous installation are void.
      await tx
        .update(deviceCommands)
        .set({ status: 'expired' })
        .where(and(eq(deviceCommands.deviceId, existing.id), inArray(deviceCommands.status, ['pending', 'delivered'])));
      deviceUuid = existing.id;
    } else {
      const [created] = await tx
        .insert(devices)
        .values({
          institutionId: token.institutionId,
          roomId: room.id,
          deviceId: input.deviceId,
          name: token.name,
          apiKeyHash,
          status: 'offline',
          agentVersion: input.agentVersion || null,
          ipAddress,
        })
        .returning({ id: devices.id });
      deviceUuid = created!.id;
    }

    await tx
      .update(deviceEnrollmentTokens)
      .set({ usedAt: new Date(), usedByDeviceId: deviceUuid })
      .where(eq(deviceEnrollmentTokens.id, token.id));

    logger.info({ deviceId: input.deviceId, reprovisioned: Boolean(existing) }, 'Device registered');
    return { deviceId: input.deviceId, deviceKey, room };
  });
}

/** Resolve a device from its id + raw key. Returns null for unknown/revoked devices or a wrong key. */
export async function authenticateDevice(deviceId: string, deviceKey: string): Promise<DeviceRow | null> {
  const presented = sha256Hex(deviceKey);
  const [row] = await db.select().from(devices).where(eq(devices.deviceId, deviceId));
  if (!row || row.revokedAt) return null;
  return safeEqualHex(presented, row.apiKeyHash) ? row : null;
}

/* ----------------------------------------------------------------------------
 * Heartbeat
 * ------------------------------------------------------------------------- */

export async function recordHeartbeat(device: DeviceRow, input: DeviceHeartbeatInput, ipAddress: string | null) {
  const status = input.status === 'recording' ? 'recording' : input.status === 'error' ? 'error' : 'online';
  const stats: DeviceSystemStats = {
    micOk: input.micOk,
    micName: input.micName ?? null,
    cpuTempC: input.cpuTempC ?? null,
    cpuPct: input.cpuPct ?? null,
    memPct: input.memPct ?? null,
    diskFreeMb: input.diskFreeMb ?? null,
    backlogChunks: input.backlogChunks,
    lastError: input.lastError ?? null,
  };
  const now = new Date();
  await db
    .update(devices)
    .set({ status, stats, agentVersion: input.agentVersion || null, lastHeartbeatAt: now, ipAddress })
    .where(eq(devices.id, device.id));
  return { serverTime: now.toISOString() };
}

/* ----------------------------------------------------------------------------
 * Commands
 * ------------------------------------------------------------------------- */

function toDeviceCommand(row: { id: string; type: string; payload: Record<string, string> }): DeviceCommand {
  if (row.type === 'start_recording') {
    return { id: row.id, type: 'start_recording', payload: { sessionId: row.payload.sessionId!, lessonId: row.payload.lessonId! } };
  }
  return { id: row.id, type: 'stop_recording', payload: { sessionId: row.payload.sessionId! } };
}

/** Atomically claim the oldest deliverable command for a device (pending, or delivered but never acked). */
export async function claimNextCommand(deviceUuid: string): Promise<DeviceCommand | null> {
  const res = await db.execute<{ id: string; type: string; payload: Record<string, string> }>(sql`
    update ${deviceCommands}
       set status = 'delivered', delivered_at = now()
     where id = (
       select id from ${deviceCommands}
        where device_id = ${deviceUuid}
          and expires_at > now()
          and (status = 'pending'
               or (status = 'delivered' and delivered_at < now() - make_interval(secs => ${REDELIVER_AFTER_SEC})))
        order by created_at
        limit 1
        for update skip locked)
    returning id, type, payload`);
  const row = res.rows[0];
  return row ? toDeviceCommand(row) : null;
}

export async function ackCommand(device: DeviceRow, commandId: string, input: DeviceCommandAckInput): Promise<void> {
  const [cmd] = await db
    .select()
    .from(deviceCommands)
    .where(and(eq(deviceCommands.id, commandId), eq(deviceCommands.deviceId, device.id)));
  if (!cmd) throw notFound('Command');
  if (cmd.status === 'acked' || cmd.status === 'failed') return; // duplicate ack (agent retry)

  const error = input.ok ? null : (input.error ?? 'The device could not run the command').slice(0, 500);
  await db
    .update(deviceCommands)
    .set({ status: input.ok ? 'acked' : 'failed', error, ackedAt: new Date() })
    .where(eq(deviceCommands.id, cmd.id));

  const sessionId = cmd.payload.sessionId;
  if (!sessionId) return;

  if (cmd.type === 'start_recording') {
    if (input.ok) {
      const [started] = await db.transaction(async (tx) => {
        const rows = await tx
          .update(recordingSessions)
          .set({
            status: sql`case when ${recordingSessions.status} = 'pending' then 'recording'::recording_status else ${recordingSessions.status} end`,
            startedAt: sql`coalesce(${recordingSessions.startedAt}, now())`,
          })
          .where(
            and(
              eq(recordingSessions.id, sessionId),
              eq(recordingSessions.deviceId, device.id),
              inArray(recordingSessions.status, ['pending', 'recording', 'stopping']),
            ),
          )
          .returning({ id: recordingSessions.id });
        if (rows.length) await tx.update(devices).set({ status: 'recording' }).where(eq(devices.id, device.id));
        return rows;
      });
      if (started) {
        logger.info({ sessionId }, 'Device started recording');
        await notifyRecordingUpdate(sessionId);
      }
    } else {
      await failRecordingSession(sessionId, `The classroom device could not start recording: ${error}`);
    }
  } else if (!input.ok) {
    logger.warn({ sessionId, deviceId: device.deviceId }, 'Device failed to stop recording');
  }
}

/* ----------------------------------------------------------------------------
 * Chunks & finalize
 * ------------------------------------------------------------------------- */

async function deviceSession(device: DeviceRow, sessionId: string) {
  const [row] = await db
    .select()
    .from(recordingSessions)
    .where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.deviceId, device.id)));
  if (!row) throw notFound('Recording session');
  return row;
}

/** Indices the server already holds, plus the session status so the agent can drop dead sessions. */
export async function listReceivedChunks(device: DeviceRow, sessionId: string) {
  const session = await deviceSession(device, sessionId);
  const rows = await db
    .select({ idx: recordingChunks.idx })
    .from(recordingChunks)
    .where(eq(recordingChunks.sessionId, sessionId))
    .orderBy(asc(recordingChunks.idx));
  return { received: rows.map((r) => r.idx), status: session.status };
}

export async function storeChunk(
  device: DeviceRow,
  sessionId: string,
  idx: number,
  body: Buffer,
  claimedSha: string,
): Promise<{ idx: number; sha256: string; bytes: number }> {
  const session = await deviceSession(device, sessionId);
  if (session.status === 'pending') {
    // The start ack was lost but audio is arriving: the device is evidently recording.
    await db
      .update(recordingSessions)
      .set({ status: 'recording', startedAt: sql`coalesce(${recordingSessions.startedAt}, now())` })
      .where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.status, 'pending')));
  } else if (session.status !== 'recording' && session.status !== 'stopping') {
    throw invalidState(`This recording is ${session.status}; it no longer accepts audio`);
  }

  if (body.length === 0) throw badRequest('Chunk body is empty');
  if (body.length % 2 !== 0) throw badRequest('Chunk must contain whole 16-bit samples');
  const actualSha = sha256Hex(body);
  if (actualSha !== claimedSha) throw badRequest('Chunk SHA-256 does not match its body');

  const [existing] = await db
    .select({ sha256: recordingChunks.sha256, bytes: recordingChunks.bytes })
    .from(recordingChunks)
    .where(and(eq(recordingChunks.sessionId, sessionId), eq(recordingChunks.idx, idx)));
  if (existing?.sha256 === actualSha) return { idx, sha256: actualSha, bytes: existing.bytes };

  const objectKey = storageKeys.recordingChunk(sessionId, idx);
  await storage.put(objectKey, body);
  await db
    .insert(recordingChunks)
    .values({ sessionId, idx, sha256: actualSha, bytes: body.length, objectKey })
    .onConflictDoUpdate({
      target: [recordingChunks.sessionId, recordingChunks.idx],
      set: { sha256: actualSha, bytes: body.length, objectKey, receivedAt: new Date() },
    });

  if (session.status === 'pending') logger.info({ sessionId }, 'Recording implicitly started by first chunk');
  throttledRecordingUpdate(sessionId);
  return { idx, sha256: actualSha, bytes: body.length };
}

/** Chunk arrivals push `recording:update` at most once per window per session (leading + trailing edge). */
export const CHUNK_NOTIFY_WINDOW_MS = 5_000;
const chunkNotify = new Map<string, { last: number; timer: NodeJS.Timeout | null }>();

function throttledRecordingUpdate(sessionId: string): void {
  const now = Date.now();
  const entry = chunkNotify.get(sessionId) ?? { last: 0, timer: null };
  chunkNotify.set(sessionId, entry);
  if (now - entry.last >= CHUNK_NOTIFY_WINDOW_MS) {
    entry.last = now;
    void notifyRecordingUpdate(sessionId);
    return;
  }
  if (entry.timer) return; // a trailing update is already scheduled
  entry.timer = setTimeout(() => {
    entry.timer = null;
    entry.last = Date.now();
    void notifyRecordingUpdate(sessionId);
    // Forget idle sessions so the map does not grow without bound.
    setTimeout(() => {
      const current = chunkNotify.get(sessionId);
      if (current === entry && !entry.timer && Date.now() - entry.last >= CHUNK_NOTIFY_WINDOW_MS) chunkNotify.delete(sessionId);
    }, CHUNK_NOTIFY_WINDOW_MS).unref();
  }, CHUNK_NOTIFY_WINDOW_MS - (now - entry.last));
  entry.timer.unref();
}

const finalizing = new Set<string>();
const ASSEMBLY_FAILED = 'The recording could not be assembled into audio. Please upload the audio file instead.';

export async function finalizeRecording(
  device: DeviceRow,
  sessionId: string,
  input: FinalizeRecordingInput,
): Promise<RecordingSession> {
  const session = await deviceSession(device, sessionId);
  if (session.status === 'finalized') return (await loadRecordingSession(sessionId))!; // retried finalize
  if (session.status !== 'recording' && session.status !== 'stopping') {
    throw invalidState(`This recording is ${session.status}; it cannot be finalized`);
  }
  if (finalizing.has(sessionId)) throw invalidState('This recording is already being finalized');

  const rows = await db
    .select({ idx: recordingChunks.idx, objectKey: recordingChunks.objectKey })
    .from(recordingChunks)
    .where(and(eq(recordingChunks.sessionId, sessionId), lt(recordingChunks.idx, input.totalChunks)))
    .orderBy(asc(recordingChunks.idx));
  const have = new Set(rows.map((r) => r.idx));
  const missing: number[] = [];
  for (let i = 0; i < input.totalChunks; i++) if (!have.has(i)) missing.push(i);
  if (missing.length) {
    throw new AppError('CONFLICT', `Missing ${missing.length} chunk(s); upload them before finalizing`, { missing });
  }

  finalizing.add(sessionId);
  const wavPath = storage.newTmpPath('.wav');
  try {
    let objectKey: string;
    let sizeBytes: number;
    let durationSec: number;
    try {
      await fs.mkdir(storage.tmpDir, { recursive: true });
      const pcmSec = await assemblePcmToWav(rows.map((r) => storage.localPath(r.objectKey)), wavPath);
      // ffprobe validates the assembled file; fall back to the exact PCM length.
      durationSec = await probeDurationSec(wavPath).catch(() => pcmSec);
      if (!(durationSec > 0)) throw new Error('empty recording');
      objectKey = storageKeys.lessonAudio(session.lessonId);
      sizeBytes = (await storage.putFile(objectKey, wavPath)).size;
    } catch (err) {
      logger.error({ err, sessionId }, 'Recording assembly failed');
      await failRecordingSession(sessionId, ASSEMBLY_FAILED);
      throw invalidState(ASSEMBLY_FAILED);
    }

    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(recordingSessions)
        .set({
          status: 'finalized',
          expectedChunks: input.totalChunks,
          durationSec: Math.round(durationSec),
          finalizedAt: new Date(),
          stoppedAt: sql`coalesce(${recordingSessions.stoppedAt}, now())`,
        })
        .where(and(eq(recordingSessions.id, sessionId), inArray(recordingSessions.status, ['recording', 'stopping'])))
        .returning({ id: recordingSessions.id });
      if (!row) return false;
      await attachLessonAudio({ lessonId: session.lessonId, objectKey, sizeBytes, durationSec, sourceType: 'device' }, tx);
      await tx
        .update(devices)
        .set({ status: 'online' })
        .where(and(eq(devices.id, device.id), eq(devices.status, 'recording')));
      return true;
    });
    if (!done) {
      // Cancelled while we were assembling: discard the assembled audio.
      await storage.delete(objectKey).catch(() => undefined);
      throw invalidState('This recording was cancelled');
    }

    await storage.deletePrefix(storageKeys.recordingPrefix(sessionId)).catch((err: unknown) => {
      logger.warn({ err, sessionId }, 'Failed to delete recording chunks');
    });
    try {
      await queueLessonGeneration(session.lessonId, null);
    } catch (err) {
      // The lesson stays `queued`; stuck-lesson recovery re-enqueues it.
      logger.error({ err, lessonId: session.lessonId }, 'Failed to enqueue generation for a finalized recording');
    }
    logger.info({ sessionId, chunks: input.totalChunks, durationSec: Math.round(durationSec) }, 'Recording finalized');
    return (await notifyRecordingUpdate(sessionId)) ?? (await loadRecordingSession(sessionId))!;
  } finally {
    finalizing.delete(sessionId);
    await fs.rm(wavPath, { force: true }).catch(() => undefined);
  }
}

/* ----------------------------------------------------------------------------
 * Admin
 * ------------------------------------------------------------------------- */

export function listInstitutionDevices(institutionId: string): Promise<Device[]> {
  return listDevices(eq(devices.institutionId, institutionId));
}

export async function createEnrollmentToken(
  institutionId: string,
  adminId: string,
  input: CreateEnrollmentTokenInput,
): Promise<EnrollmentToken> {
  const [room] = await db
    .select({ id: rooms.id, name: rooms.name })
    .from(rooms)
    .where(and(eq(rooms.id, input.roomId), eq(rooms.institutionId, institutionId)));
  if (!room) throw notFound('Room');
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + ENROLLMENT_TOKEN_TTL_MS);
  await db.insert(deviceEnrollmentTokens).values({
    institutionId,
    roomId: room.id,
    name: input.name,
    tokenHash: sha256Hex(token),
    createdBy: adminId,
    expiresAt,
  });
  return { token, name: input.name, room, expiresAt: expiresAt.toISOString() };
}

export async function revokeDevice(institutionId: string, id: string): Promise<void> {
  const [device] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.institutionId, institutionId), isNull(devices.revokedAt)));
  if (!device) throw notFound('Device');
  const [active] = await db
    .select({ id: recordingSessions.id })
    .from(recordingSessions)
    .where(and(eq(recordingSessions.deviceId, id), inArray(recordingSessions.status, [...ACTIVE_RECORDING_STATUSES])));
  if (active) throw conflict('This device is recording a class. Stop or cancel the recording first.');
  await db.transaction(async (tx) => {
    await tx.update(devices).set({ revokedAt: new Date(), status: 'offline' }).where(eq(devices.id, id));
    await tx
      .update(deviceCommands)
      .set({ status: 'expired' })
      .where(and(eq(deviceCommands.deviceId, id), or(eq(deviceCommands.status, 'pending'), eq(deviceCommands.status, 'delivered'))));
  });
  logger.info({ deviceUuid: id }, 'Device revoked');
}
