/**
 * Validated runtime configuration. This module MUST be imported before anything
 * that reads configuration — import `env` from here instead of using process.env.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/api/.env (works from src/ and dist/)
for (const candidate of [path.resolve(here, '../../.env'), path.resolve(here, '../.env')]) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate, quiet: true });
    break;
  }
}

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(5000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1).default('postgres://classpulse:classpulse@localhost:5432/classpulse'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
    /** Empty = no Redis (dev/test only): queue runs in-process, rate limits in memory. */
    REDIS_URL: z.string().optional().default(''),

    JWT_SECRET: z.string().min(16).default('dev-only-insecure-jwt-secret-change-me'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
    /** Public origin of the web app, e.g. https://app.classpulse.in. Used for CORS + cookie security. */
    PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
    /** Reverse proxies in front of the API (Caddy = 1; Coolify's Traefik + Caddy = 2). Used for client IPs. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /** Extra comma-separated origins allowed in development. */
    DEV_EXTRA_ORIGINS: z.string().optional().default(''),

    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_DIR: z.string().default('./storage'),
    AUDIO_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
    MAX_AUDIO_UPLOAD_MB: z.coerce.number().int().min(1).max(1024).default(300),

    SARVAM_API_KEY: z.string().optional().default(''),
    SARVAM_BASE_URL: z.string().url().default('https://api.sarvam.ai'),
    OPENAI_API_KEY: z.string().optional().default(''),
    OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),

    /** Dev-only escape hatch: produce clearly-labelled demo content when providers are unavailable. */
    PIPELINE_DEMO_FALLBACK: bool,
    GENERATION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),

    FEATURE_SMS_OTP: bool,
    /** Login attempts allowed per IP+identifier per 15 minutes. */
    LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
    DEVICE_OFFLINE_AFTER_SEC: z.coerce.number().int().min(30).default(90),

    /** Outgoing email (Gmail/Workspace SMTP with an app password). Email is off unless all are set. */
    SMTP_HOST: z.string().optional().default(''),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    /** e.g. "ClassPulse <noreply@benxsolutions.in>". */
    MAIL_FROM: z.string().optional().default(''),

    /** Platform (super admin) console. Its own origin (e.g. https://ops.example.org); empty = same origin. */
    PLATFORM_ORIGIN: z.string().optional().default(''),
    /** base64 32-byte key encrypting platform admins' 2FA secrets (openssl rand -base64 32). */
    PLATFORM_ENCRYPTION_KEY: z.string().optional().default(''),
    /** Coolify API for the deployments page (least-privilege token: read + deploy). */
    COOLIFY_API_URL: z.string().optional().default(''),
    COOLIFY_API_TOKEN: z.string().optional().default(''),
    COOLIFY_APP_UUID: z.string().optional().default(''),
    /** Where the host's encrypted backups are mounted read-only (for the health page). */
    BACKUP_DIR: z.string().default('/backups'),
    /** End-to-end tests only: capture outgoing email instead of sending it and expose GET /api/test/emails. */
    E2E_MAIL_CAPTURE: bool,
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (e.JWT_SECRET.length < 32 || e.JWT_SECRET.startsWith('dev-only')) {
      fail('JWT_SECRET', 'must be a random secret of at least 32 characters in production');
    }
    if (!e.REDIS_URL) fail('REDIS_URL', 'is required in production');
    if (e.PIPELINE_DEMO_FALLBACK) fail('PIPELINE_DEMO_FALLBACK', 'must not be enabled in production');
    if (!e.PUBLIC_ORIGIN.startsWith('https://')) fail('PUBLIC_ORIGIN', 'must be https in production');
    if (e.E2E_MAIL_CAPTURE) fail('E2E_MAIL_CAPTURE', 'must not be enabled in production');
    if (Buffer.from(e.PLATFORM_ENCRYPTION_KEY, 'base64').length !== 32) {
      fail('PLATFORM_ENCRYPTION_KEY', 'must be a base64 32-byte key in production (openssl rand -base64 32)');
    }
  });

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
/** Whether outgoing email is configured (otherwise admins hand over one-time passwords). */
export const mailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);

export const allowedOrigins = [
  env.PUBLIC_ORIGIN,
  ...(env.PLATFORM_ORIGIN ? [env.PLATFORM_ORIGIN] : []),
  ...(isProd ? [] : env.DEV_EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)),
];
