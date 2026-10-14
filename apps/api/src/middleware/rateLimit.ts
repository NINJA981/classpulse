import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { ZodType } from 'zod';
import { PlatformLoginInput, StaffLoginInput, StudentLoginInput, type ApiErrorBody } from '@classiq/shared';
import { env, isTest } from '../config/env.js';
import { logger } from '../lib/logger.js';
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

export interface LimiterOptions {
  /** Adds the account a request targets (from the body) to the per-IP key. */
  accountKey?: AccountKey;
  /**
   * What one bucket covers. 'ip' (default); 'user' counts per signed-in user instead, for routes behind
   * authentication where a whole class (or a staffroom) shares one school internet IP; 'global' is one
   * bucket shared by every client (a hard cap on an expensive action).
   */
  scope?: 'ip' | 'user' | 'global';
  /**
   * Count only the requests this returns true for (others are refunded once the response is sent), e.g.
   * only requests that actually sent an email.
   */
  countIf?: (req: Request, res: Response) => boolean;
  /** Tests only: enforce the limit even under NODE_ENV=test (every limiter is skipped there otherwise). */
  enforceInTests?: boolean;
  /** Log a warning (prefix and limit only, never the request) each time this limiter refuses a request. */
  warnWhenLimited?: boolean;
}

export function limiter(prefix: string, windowMs: number, limit: number, opts: LimiterOptions = {}) {
  const { accountKey, scope = 'ip', countIf, enforceInTests = false, warnWhenLimited = false } = opts;
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' } };
  return rateLimit({
    windowMs,
    limit,
    // A shared bucket's remaining count would tell every visitor how busy the action is: no headers.
    standardHeaders: scope === 'global' ? false : 'draft-8',
    legacyHeaders: false,
    skip: () => isTest && !enforceInTests,
    store: store(prefix),
    keyGenerator: (req) => {
      if (scope === 'global') return 'all';
      if (scope === 'user' && req.user) return `user:${req.user.id}`;
      if (scope === 'user' && req.platformAdmin) return `platform:${req.platformAdmin.id}`;
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      const account = accountKey?.(req.body);
      return account === undefined ? ip : `${ip}:${account}`;
    },
    ...(countIf && { skipFailedRequests: true, requestWasSuccessful: countIf }),
    message: body,
    ...(warnWhenLimited && {
      handler: (_req, res, _next, options) => {
        logger.warn({ limiter: prefix, limit, windowMs }, 'Rate limit reached');
        res.status(options.statusCode).json(options.message);
      },
    }),
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
export const staffLoginLimiter = limiter('login', LOGIN_WINDOW, env.LOGIN_RATE_LIMIT, { accountKey: staffAccountKey });
/** Student login: LOGIN_RATE_LIMIT (default 10) attempts / 15 min per IP + school code + roll number. */
export const studentLoginLimiter = limiter('login', LOGIN_WINDOW, env.LOGIN_RATE_LIMIT, { accountKey: studentAccountKey });
/** Platform (super admin) password step: 5 / 15 min per IP + email. */
export const platformLoginLimiter = limiter('platform-login', LOGIN_WINDOW, 5, { accountKey: platformAccountKey });
/**
 * Platform code steps (enrol, verify, regenerate recovery codes): 5 / 15 min per IP. Wrong codes are
 * also counted per admin and per challenge by the platform auth service.
 */
export const platformCodeLimiter = limiter('platform-code', LOGIN_WINDOW, 5);
/** Live-quiz PIN lookups/joins: 30 / min per signed-in user (per IP when there's no session). */
export const pinLimiter = limiter('pin', 60_000, 30, { scope: 'user' });
/** Paid AI calls (generation, remedial): 20 / hour per signed-in user (per IP when there's no session). */
export const aiLimiter = limiter('ai', 60 * 60_000, 20, { scope: 'user' });
/** Notification settings (push subscribe/unsubscribe, prefs): 30 / 15 min per signed-in user or platform admin. */
export const notificationSettingsLimiter = limiter('notif-settings', LOGIN_WINDOW, 30, { scope: 'user' });
/** Marking notifications read (one or all): 120 / min per signed-in user or platform admin. */
export const notificationReadLimiter = limiter('notif-read', 60_000, 120, { scope: 'user' });
/** Device registration: 10 / hour per IP. */
export const deviceRegisterLimiter = limiter('device-register', 60 * 60_000, 10);
/** Set-password links (preview, redeem, forgot-password): 20 / 15 min per IP. */
export const tokenLimiter = limiter('pw-token', LOGIN_WINDOW, 20);

/** Public "Book a demo" requests: DEMO_REQUEST_RATE_LIMIT (default 5) / hour per IP (every request counts). */
export const DEMO_REQUESTS_PER_IP = env.DEMO_REQUEST_RATE_LIMIT;
/** ...and DEMO_REQUESTS_PER_DAY / 24 h across all visitors, counting only requests that sent an email. */
export const DEMO_REQUESTS_PER_DAY = 50;

/**
 * The demo-request limiters, IP first. `countIf` tells the daily cap which requests sent an email (the
 * route sets `res.locals.demoEmailQueued`), so bots that trip the honeypot or send invalid data can't
 * use up the day's budget. `enforceInTests` is for the limiter test only.
 */
export function demoRequestLimiters(opts: Pick<LimiterOptions, 'enforceInTests'> = {}) {
  return [
    limiter('demo-ip', 60 * 60_000, DEMO_REQUESTS_PER_IP, opts),
    limiter('demo-day', 24 * 60 * 60_000, DEMO_REQUESTS_PER_DAY, {
      ...opts,
      scope: 'global',
      countIf: (_req, res) => res.locals.demoEmailQueued === true,
      // Why: someone rotating IPs could drain the day's budget; make that visible on the console's Logs page.
      warnWhenLimited: true,
    }),
  ];
}
