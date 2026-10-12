import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { ZodType } from 'zod';
import { PlatformLoginInput, StaffLoginInput, StudentLoginInput, type ApiErrorBody } from '@classpulse/shared';
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

/** Builds the account part of a limiter key from the request body; undefined = per IP only. */
type AccountKey = (body: unknown) => string | undefined;

/**
 * `perUser`: count per signed-in user instead of per IP. Used behind authentication, where a whole
 * class (or a staffroom) shares one school internet IP and per-IP counting would block them.
 */
function limiter(prefix: string, windowMs: number, limit: number, accountKey?: AccountKey, perUser = false) {
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' } };
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    store: store(prefix),
    keyGenerator: (req) => {
      if (perUser && req.user) return `user:${req.user.id}`;
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      const account = accountKey?.(req.body);
      return account === undefined ? ip : `${ip}:${account}`;
    },
    message: body,
  });
}

/**
 * The account a sign-in request targets, taken only from the body as the route will parse it
 * (trimmed, lower-cased), so neither extra fields nor whitespace variants get a fresh bucket. A body
 * the route would reject shares one "invalid" bucket per IP.
 */
function accountFrom<T>(schema: ZodType<T>, pick: (input: T) => string): AccountKey {
  return (body) => {
    const parsed = schema.safeParse(body);
    return parsed.success ? pick(parsed.data).toLowerCase() : 'invalid';
  };
}

/** School staff sign-in: the normalised email. */
export const staffAccountKey = accountFrom(StaffLoginInput, (i) => `staff:${i.email}`);
/** Student sign-in: the school code (empty when not given) and the trimmed roll number. */
export const studentAccountKey = accountFrom(StudentLoginInput, (i) => `student:${i.institutionCode ?? ''}:${i.rollNumber}`);
/** Platform sign-in: the normalised email. */
export const platformAccountKey = accountFrom(PlatformLoginInput, (i) => `platform:${i.email}`);

const LOGIN_WINDOW = 15 * 60_000;

/**
 * Every sign-in, set-password and 2FA request: AUTH_IP_RATE_LIMIT (default 300) / 15 min per IP, on
 * top of the per-account limits. Generous, because a whole school can sit behind one NAT address.
 */
export const authIpLimiter = limiter('auth-ip', LOGIN_WINDOW, env.AUTH_IP_RATE_LIMIT);
/** Staff login: LOGIN_RATE_LIMIT (default 10) attempts / 15 min per IP + email. */
export const staffLoginLimiter = limiter('login', LOGIN_WINDOW, env.LOGIN_RATE_LIMIT, staffAccountKey);
/** Student login: LOGIN_RATE_LIMIT (default 10) attempts / 15 min per IP + school code + roll number. */
export const studentLoginLimiter = limiter('login', LOGIN_WINDOW, env.LOGIN_RATE_LIMIT, studentAccountKey);
/** Platform (super admin) password step: 5 / 15 min per IP + email. */
export const platformLoginLimiter = limiter('platform-login', LOGIN_WINDOW, 5, platformAccountKey);
/**
 * Platform code steps (enrol, verify, regenerate recovery codes): 5 / 15 min per IP. Wrong codes are
 * also counted per admin and per challenge by the platform auth service.
 */
export const platformCodeLimiter = limiter('platform-code', LOGIN_WINDOW, 5);
/** Live-quiz PIN lookups/joins: 30 / min per IP. */
export const pinLimiter = limiter('pin', 60_000, 30, undefined, true);
/** Paid AI calls (generation, remedial): 20 / hour per IP. */
export const aiLimiter = limiter('ai', 60 * 60_000, 20, undefined, true);
/** Device registration: 10 / hour per IP. */
export const deviceRegisterLimiter = limiter('device-register', 60 * 60_000, 10);
/** Set-password links (preview, redeem, forgot-password): 20 / 15 min per IP. */
export const tokenLimiter = limiter('pw-token', LOGIN_WINDOW, 20);
