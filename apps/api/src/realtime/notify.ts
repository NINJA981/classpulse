/**
 * Cross-process user notifications (lesson progress, recording updates).
 *
 * The API process owns the Socket.IO server and registers an emitter with
 * `setLocalEmitter`. The worker process has no sockets, so it publishes to a
 * Redis channel that the API relays. Without Redis (dev), the worker runs
 * inside the API process and the local emitter is used directly.
 */
import type { ServerToClientEvents } from '@classpulse/shared';
import { getRedis, newRedisConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

type UserEvent = 'lesson:progress' | 'recording:update';
type Payload<E extends UserEvent> = Parameters<ServerToClientEvents[E]>[0];

const CHANNEL = 'cp:notify';

type Emitter = <E extends UserEvent>(userId: string, event: E, payload: Payload<E>) => void;
let localEmitter: Emitter | null = null;

export function setLocalEmitter(emitter: Emitter): void {
  localEmitter = emitter;
}

export function notifyUser<E extends UserEvent>(userId: string, event: E, payload: Payload<E>): void {
  if (localEmitter) {
    localEmitter(userId, event, payload);
    return;
  }
  const redis = getRedis();
  if (!redis) return;
  redis.publish(CHANNEL, JSON.stringify({ userId, event, payload })).catch((err: Error) => {
    logger.warn({ err: err.message }, 'Failed to publish user notification');
  });
}

/** Called by the API process: relay notifications published by the worker. */
export async function subscribeToWorkerNotifications(emit: Emitter): Promise<() => Promise<void>> {
  if (!getRedis()) return async () => undefined;
  const sub = newRedisConnection();
  await sub.subscribe(CHANNEL);
  sub.on('message', (_channel: string, raw: string) => {
    try {
      const msg = JSON.parse(raw) as { userId: string; event: UserEvent; payload: Payload<UserEvent> };
      emit(msg.userId, msg.event, msg.payload as never);
    } catch (err) {
      logger.warn({ err }, 'Bad notification message');
    }
  });
  return async () => {
    await sub.quit().catch(() => undefined);
  };
}
