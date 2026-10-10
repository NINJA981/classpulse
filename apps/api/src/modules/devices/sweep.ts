/**
 * Periodic device maintenance (runs in exactly one process):
 *  - devices that stopped sending heartbeats become `offline`;
 *  - undelivered/unacked commands past their expiry become `expired`;
 *  - recordings whose start command was never acked fail (and their lessons with them);
 *  - recordings stopped long ago that never finalized fail.
 */
import { and, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { deviceCommands, devices, recordingSessions } from '../../db/schema/index.js';
import type { PeriodicTask } from '../../jobs/periodic.js';
import { logger } from '../../lib/logger.js';
import { failRecordingSession } from '../recordings/service.js';

/** A recording still `pending` after this long means the device never started it. */
export const PENDING_RECORDING_TIMEOUT_MS = 2 * 60_000;
/**
 * A recording still `stopping` this long after Stop never finalized (e.g. stopped with no audio,
 * or the device was lost). Generous so a Pi that was offline for a school day can still catch up.
 */
export const STOPPING_RECORDING_TIMEOUT_MS = 6 * 3600_000;

export async function sweepDevices(now = new Date()): Promise<{ offline: number; expired: number; failed: number }> {
  const offlineBefore = new Date(now.getTime() - env.DEVICE_OFFLINE_AFTER_SEC * 1000);
  const offline = await db
    .update(devices)
    .set({ status: 'offline' })
    .where(
      and(
        isNull(devices.revokedAt),
        ne(devices.status, 'offline'),
        or(isNull(devices.lastHeartbeatAt), lt(devices.lastHeartbeatAt, offlineBefore)),
      ),
    )
    .returning({ id: devices.id });

  const expired = await db
    .update(deviceCommands)
    .set({ status: 'expired' })
    .where(and(inArray(deviceCommands.status, ['pending', 'delivered']), lt(deviceCommands.expiresAt, now)))
    .returning({ id: deviceCommands.id });

  const stuck = await db
    .select({ id: recordingSessions.id })
    .from(recordingSessions)
    .where(
      and(
        eq(recordingSessions.status, 'pending'),
        lt(recordingSessions.createdAt, new Date(now.getTime() - PENDING_RECORDING_TIMEOUT_MS)),
      ),
    );
  const abandoned = await db
    .select({ id: recordingSessions.id })
    .from(recordingSessions)
    .where(
      and(
        eq(recordingSessions.status, 'stopping'),
        lt(recordingSessions.stoppedAt, new Date(now.getTime() - STOPPING_RECORDING_TIMEOUT_MS)),
      ),
    );
  let failed = 0;
  for (const s of abandoned) {
    if (await failRecordingSession(s.id, 'The classroom device never finished uploading this recording.')) failed++;
  }
  for (const s of stuck) {
    if (await failRecordingSession(s.id, 'The classroom device did not start recording. Check that it is online and try again.')) {
      failed++;
    }
  }

  if (offline.length || expired.length || failed) {
    logger.info({ offline: offline.length, expiredCommands: expired.length, failedRecordings: failed }, 'Device sweep');
  }
  return { offline: offline.length, expired: expired.length, failed };
}

export const deviceSweepTask: PeriodicTask = {
  name: 'device-sweep',
  intervalMs: 30_000,
  run: async () => {
    await sweepDevices();
  },
};
