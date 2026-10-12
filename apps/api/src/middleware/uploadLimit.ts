/**
 * Per-user upload rate limits (lecture audio, voice prompts, teacher materials). Keyed by the signed-in
 * user, not the IP, so a school behind one NAT shares nothing and one account cannot flood the server with
 * transcoding, extraction or paid transcription. Must run after `authenticate()`.
 */
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { ApiErrorBody } from '@classpulse/shared';
import { isTest } from '../config/env.js';
import { getRedis } from '../lib/redis.js';

export interface UserLimiterOptions {
  /** Unique name (Redis key prefix). */
  prefix: string;
  windowMs: number;
  limit: number;
  message: string;
  /** Tests switch rate limits off; a test of the limiter itself turns this on. */
  enforceInTests?: boolean;
}

export function userRateLimiter(opts: UserLimiterOptions): RequestHandler {
  const redis = getRedis();
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: opts.message } };
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest && !opts.enforceInTests,
    store: redis
      ? new RedisStore({
          prefix: `rl:${opts.prefix}:`,
          sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
        })
      : undefined,
    // authenticate() always runs first; the fallback only matters if a route is mis-wired.
    keyGenerator: (req) => `u:${req.user?.id ?? 'anonymous'}`,
    message: body,
  });
}

const TOO_MANY = 'Too many uploads. Please wait a few minutes and try again.';

/** Lecture audio uploads: 20 per hour per teacher. */
export const lessonAudioUploadLimiter = userRateLimiter({ prefix: 'up-audio', windowMs: 60 * 60_000, limit: 20, message: TOO_MANY });
/** Voice prompts: 60 per hour per teacher. */
export const voicePromptLimiter = userRateLimiter({ prefix: 'up-voice', windowMs: 60 * 60_000, limit: 60, message: TOO_MANY });
/** Teacher materials (PDF/DOCX/TXT extraction): 30 per hour per teacher. */
export const materialUploadLimiter = userRateLimiter({ prefix: 'up-material', windowMs: 60 * 60_000, limit: 30, message: TOO_MANY });

/** Run `limiter` first, then `next` only when the request was not limited. */
export function limited(limiter: RequestHandler, handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void limiter(req, res, (err?: unknown) => {
      if (err) return next(err);
      return handler(req, res, next);
    });
  };
}
