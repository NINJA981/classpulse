/**
 * Counts failed attempts per key (e.g. wrong 2FA codes per platform admin) in Redis when it is
 * configured, so the count is shared by every API process, and in memory otherwise (dev/test).
 * Each failure restarts the window, so a key stays counted until `windowMs` passes without failures.
 */
import { getRedis } from './redis.js';
import { logger } from './logger.js';

export interface FailureCounter {
  /** Current failure count for `key` (0 when none or expired). */
  count(key: string): Promise<number>;
  /** Record a failure; returns the new count. */
  fail(key: string): Promise<number>;
  /** Forget the failures of `key` (after a success). */
  reset(key: string): Promise<void>;
}

export function failureCounter(prefix: string, windowMs: number): FailureCounter {
  const memory = new Map<string, { n: number; until: number }>();
  const k = (key: string) => `fail:${prefix}:${key}`;

  const memoryCount = (key: string) => {
    const entry = memory.get(key);
    if (!entry) return 0;
    if (entry.until <= Date.now()) {
      memory.delete(key);
      return 0;
    }
    return entry.n;
  };

  const sweep = () => {
    if (memory.size < 1000) return;
    const now = Date.now();
    for (const [key, entry] of memory) if (entry.until <= now) memory.delete(key);
  };

  return {
    async count(key) {
      const redis = getRedis();
      if (redis) {
        try {
          return Number((await redis.get(k(key))) ?? 0);
        } catch (err) {
          logger.warn({ err: (err as Error).message }, 'Failure counter read failed; using memory');
        }
      }
      return memoryCount(key);
    },
    async fail(key) {
      const redis = getRedis();
      if (redis) {
        try {
          const [[, n]] = (await redis.multi().incr(k(key)).pexpire(k(key), windowMs).exec()) as [[unknown, number]];
          return Number(n);
        } catch (err) {
          logger.warn({ err: (err as Error).message }, 'Failure counter write failed; using memory');
        }
      }
      sweep();
      const n = memoryCount(key) + 1;
      memory.set(key, { n, until: Date.now() + windowMs });
      return n;
    },
    async reset(key) {
      memory.delete(key);
      const redis = getRedis();
      if (redis) await redis.del(k(key)).catch(() => undefined);
    },
  };
}
