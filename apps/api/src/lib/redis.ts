import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client: Redis | null = null;

/** Shared Redis connection, or null when REDIS_URL is not configured (dev/test only). */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
    client.on('error', (err) => logger.warn({ err: err.message }, 'Redis connection error'));
  }
  return client;
}

/** A fresh connection (BullMQ workers and pub/sub subscribers need their own). */
export function newRedisConnection(): Redis {
  if (!env.REDIS_URL) throw new Error('REDIS_URL is not configured');
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
