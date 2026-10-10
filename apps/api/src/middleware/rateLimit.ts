import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { ApiErrorBody } from '@classpulse/shared';
import { env, isTest } from '../config/env.js';
import { getRedis } from '../lib/redis.js';

function store(prefix: string): Options['store'] | undefined {
  const redis = getRedis();
  if (!redis) return undefined; // in-memory (single process dev)
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
  });
}

function limiter(prefix: string, windowMs: number, limit: number, keyExtra?: (body: unknown) => string | undefined) {
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' } };
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    store: store(prefix),
    keyGenerator: (req) => {
      const extra = keyExtra?.(req.body);
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      return extra ? `${ip}:${extra.toLowerCase()}` : ip;
    },
    message: body,
  });
}

const identifier = (b: unknown) => {
  const o = b as { email?: unknown; rollNumber?: unknown } | undefined;
  return typeof o?.email === 'string' ? o.email : typeof o?.rollNumber === 'string' ? o.rollNumber : undefined;
};

/** Login: LOGIN_RATE_LIMIT (default 10) attempts / 15 min per IP+identifier. */
export const loginLimiter = limiter('login', 15 * 60_000, env.LOGIN_RATE_LIMIT, identifier);
/** Live-quiz PIN lookups/joins: 30 / min per IP. */
export const pinLimiter = limiter('pin', 60_000, 30);
/** Paid AI calls (generation, remedial): 20 / hour per IP. */
export const aiLimiter = limiter('ai', 60 * 60_000, 20);
/** Device registration: 10 / hour per IP. */
export const deviceRegisterLimiter = limiter('device-register', 60 * 60_000, 10);
