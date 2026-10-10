/**
 * Classroom-device recording sessions (teacher side) plus the DTO/notification
 * helpers shared with the devices module and the device sweep.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { RecordingSession, StartRecordingInput } from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import {
  deviceCommands,
  devices,
  lessons,
  recordingChunks,
  recordingSessions,
  sections,
  sectionTeachers,
} from '../../db/schema/index.js';
import { conflict, invalidState, isUniqueViolation, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { storage, storageKeys } from '../../lib/storage.js';
import { iso } from '../../lib/time.js';
import { notifyUser } from '../../realtime/notify.js';
import { signalDeviceCommand } from '../devices/commandBus.js';

export const ACTIVE_RECORDING_STATUSES = ['pending', 'recording', 'stopping'] as const;
/** Start commands that are not picked up within this window expire (the sweep then fails the session). */
export const START_COMMAND_TTL_MS = 2 * 60_000;
/** Stop commands live longer: a device may be briefly offline while the teacher stops the class. */
export const STOP_COMMAND_TTL_MS = 30 * 60_000;

type SessionRow = typeof recordingSessions.$inferSelect;

const sessionSelection = {
  session: recordingSessions,
  deviceName: devices.name,
  deviceStatus: devices.status,
  chunksReceived: sql<number>`(select count(*)::int from ${recordingChunks} where ${recordingChunks.sessionId} = ${recordingSessions.id})`,
};

function toRecordingSession(row: {
  session: SessionRow;
  deviceName: string;
  deviceStatus: RecordingSession['device']['status'];
  chunksReceived: number;
}): RecordingSession {
  const s = row.session;
  return {
    id: s.id,
    lessonId: s.lessonId,
    device: { id: s.deviceId, name: row.deviceName, status: row.deviceStatus },
    status: s.status,
    chunksReceived: Number(row.chunksReceived),
    expectedChunks: s.expectedChunks,
    startedAt: iso(s.startedAt),
    stoppedAt: iso(s.stoppedAt),
    failureReason: s.failureReason,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Load a session DTO (no authorization). */
export async function loadRecordingSession(sessionId: string, tx: DbOrTx = db): Promise<RecordingSession | null> {
  const [row] = await tx
    .select(sessionSelection)
    .from(recordingSessions)
    .innerJoin(devices, eq(devices.id, recordingSessions.deviceId))
    .where(eq(recordingSessions.id, sessionId));
  return row ? toRecordingSession(row) : null;
}

/** Push the current session state to its teacher (`recording:update`). Never throws. */
export async function notifyRecordingUpdate(sessionId: string): Promise<RecordingSession | null> {
  try {
    const dto = await loadRecordingSession(sessionId);
    if (!dto) return null;
    const [owner] = await db
      .select({ teacherId: recordingSessions.teacherId })
      .from(recordingSessions)
      .where(eq(recordingSessions.id, sessionId));
    if (owner) notifyUser(owner.teacherId, 'recording:update', dto);
    return dto;
  } catch (err) {
    logger.warn({ err, sessionId }, 'Failed to send recording update');
    return null;
  }
}

/**
 * Mark an active session failed and its lesson failed with a user-facing reason.
 * No-op if the session is already terminal. Returns whether anything changed.
 */
export async function failRecordingSession(sessionId: string, reason: string): Promise<boolean> {
  const changed = await db.transaction(async (tx) => {
    const [s] = await tx
      .update(recordingSessions)
      .set({ status: 'failed', failureReason: reason.slice(0, 500) })
      .where(and(eq(recordingSessions.id, sessionId), inArray(recordingSessions.status, [...ACTIVE_RECORDING_STATUSES])))
      .returning({ lessonId: recordingSessions.lessonId, deviceId: recordingSessions.deviceId });
    if (!s) return false;
    await tx.update(lessons).set({ status: 'failed', failureReason: reason.slice(0, 500) }).where(eq(lessons.id, s.lessonId));
    await tx
      .update(devices)
      .set({ status: 'online' })
      .where(and(eq(devices.id, s.deviceId), eq(devices.status, 'recording')));
    return true;
  });
  if (changed) {
    logger.info({ sessionId }, 'Recording session failed');
    await notifyRecordingUpdate(sessionId);
  }
  return changed;
}

/* ----------------------------------------------------------------------------
 * Teacher operations
 * ------------------------------------------------------------------------- */

async function teacherSection(teacherId: string, sectionId: string) {
  const [row] = await db
    .select({ id: sections.id, institutionId: sections.institutionId, roomId: sections.roomId })
    .from(sections)
    .innerJoin(sectionTeachers, and(eq(sectionTeachers.sectionId, sections.id), eq(sectionTeachers.teacherId, teacherId)))
    .where(eq(sections.id, sectionId));
  if (!row) throw notFound('Section');
  return row;
}

async function ownedSession(teacherId: string, sessionId: string): Promise<SessionRow> {
  const [row] = await db
    .select()
    .from(recordingSessions)
    .where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.teacherId, teacherId)));
  if (!row) throw notFound('Recording');
  return row;
}

/** Devices usable for a section: the non-revoked devices in its room. */
export async function teacherSectionRoom(teacherId: string, sectionId: string): Promise<{ roomId: string | null }> {
  const section = await teacherSection(teacherId, sectionId);
  return { roomId: section.roomId };
}

export async function startRecording(teacherId: string, input: StartRecordingInput): Promise<RecordingSession> {
  const section = await teacherSection(teacherId, input.sectionId);
  if (!section.roomId) throw invalidState('This section has no classroom assigned. Ask an admin to set its room.');

  const roomDevices = await db
    .select()
    .from(devices)
    .where(and(eq(devices.roomId, section.roomId), sql`${devices.revokedAt} is null`))
    .orderBy(desc(devices.lastHeartbeatAt));

  let device: (typeof roomDevices)[number] | undefined;
  if (input.deviceId) {
    device = roomDevices.find((d) => d.id === input.deviceId);
    if (!device) throw notFound('Device');
  } else {
    device = roomDevices.find((d) => d.status === 'online') ?? roomDevices.find((d) => d.status === 'recording');
    if (!device) throw conflict('No classroom device is online in this room');
  }
  if (device.status === 'recording') throw conflict('The classroom device is already recording');
  if (device.status !== 'online') throw conflict('The classroom device is not online');

  const chosen = device;
  let sessionId: string;
  try {
    sessionId = await db.transaction(async (tx) => {
      const [lesson] = await tx
        .insert(lessons)
        .values({
          institutionId: section.institutionId,
          teacherId,
          sectionId: section.id,
          title: input.title,
          subject: input.subject,
          language: input.language,
          status: 'recording',
          sourceType: 'device',
          progressMessage: 'Recording in the classroom',
        })
        .returning({ id: lessons.id });
      const [session] = await tx
        .insert(recordingSessions)
        .values({ deviceId: chosen.id, lessonId: lesson!.id, teacherId, status: 'pending' })
        .returning({ id: recordingSessions.id });
      await tx.insert(deviceCommands).values({
        deviceId: chosen.id,
        type: 'start_recording',
        payload: { sessionId: session!.id, lessonId: lesson!.id },
        expiresAt: new Date(Date.now() + START_COMMAND_TTL_MS),
      });
      return session!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'recording_sessions_one_active_per_device')) {
      throw conflict('The classroom device is already recording');
    }
    throw err;
  }

  signalDeviceCommand(chosen.id);
  logger.info({ sessionId, deviceId: chosen.id }, 'Recording requested');
  const dto = await notifyRecordingUpdate(sessionId);
  return dto ?? (await getRecording(teacherId, sessionId));
}

export async function getRecording(teacherId: string, sessionId: string): Promise<RecordingSession> {
  await ownedSession(teacherId, sessionId);
  const dto = await loadRecordingSession(sessionId);
  if (!dto) throw notFound('Recording');
  return dto;
}

export async function stopRecording(teacherId: string, sessionId: string): Promise<RecordingSession> {
  const session = await ownedSession(teacherId, sessionId);
  if (session.status === 'stopping') return getRecording(teacherId, sessionId);
  if (session.status !== 'pending' && session.status !== 'recording') {
    throw invalidState(`This recording is already ${session.status}`);
  }
  const changed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(recordingSessions)
      .set({ status: 'stopping', stoppedAt: new Date() })
      .where(and(eq(recordingSessions.id, sessionId), inArray(recordingSessions.status, ['pending', 'recording'])))
      .returning({ id: recordingSessions.id });
    if (!row) return false;
    await tx.insert(deviceCommands).values({
      deviceId: session.deviceId,
      type: 'stop_recording',
      payload: { sessionId },
      expiresAt: new Date(Date.now() + STOP_COMMAND_TTL_MS),
    });
    return true;
  });
  if (!changed) throw invalidState('This recording changed state; refresh and try again');
  signalDeviceCommand(session.deviceId);
  logger.info({ sessionId }, 'Recording stop requested');
  return (await notifyRecordingUpdate(sessionId)) ?? getRecording(teacherId, sessionId);
}

export async function cancelRecording(teacherId: string, sessionId: string): Promise<RecordingSession> {
  const session = await ownedSession(teacherId, sessionId);
  if (session.status === 'cancelled') return getRecording(teacherId, sessionId);
  if (!(ACTIVE_RECORDING_STATUSES as readonly string[]).includes(session.status)) {
    throw invalidState(`This recording is already ${session.status}`);
  }
  const reason = 'Recording cancelled';
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(recordingSessions)
      .set({ status: 'cancelled', failureReason: reason, stoppedAt: session.stoppedAt ?? new Date() })
      .where(and(eq(recordingSessions.id, sessionId), inArray(recordingSessions.status, [...ACTIVE_RECORDING_STATUSES])))
      .returning({ id: recordingSessions.id });
    if (!row) return null;
    await tx.update(lessons).set({ status: 'failed', failureReason: reason }).where(eq(lessons.id, session.lessonId));
    // A start command the device has not picked up yet is simply withdrawn.
    const withdrawn = await tx
      .update(deviceCommands)
      .set({ status: 'expired' })
      .where(
        and(
          eq(deviceCommands.deviceId, session.deviceId),
          eq(deviceCommands.status, 'pending'),
          sql`${deviceCommands.payload}->>'sessionId' = ${sessionId}`,
        ),
      )
      .returning({ type: deviceCommands.type });
    const startWithdrawn = withdrawn.some((c) => c.type === 'start_recording');
    const needsStop = !startWithdrawn && session.status !== 'stopping';
    if (needsStop) {
      await tx.insert(deviceCommands).values({
        deviceId: session.deviceId,
        type: 'stop_recording',
        payload: { sessionId },
        expiresAt: new Date(Date.now() + STOP_COMMAND_TTL_MS),
      });
    }
    await tx
      .update(devices)
      .set({ status: 'online' })
      .where(and(eq(devices.id, session.deviceId), eq(devices.status, 'recording')));
    return { needsStop };
  });
  if (!result) throw invalidState('This recording changed state; refresh and try again');
  if (result.needsStop) signalDeviceCommand(session.deviceId);
  await storage.deletePrefix(storageKeys.recordingPrefix(sessionId)).catch(() => undefined);
  logger.info({ sessionId }, 'Recording cancelled');
  return (await notifyRecordingUpdate(sessionId)) ?? getRecording(teacherId, sessionId);
}
