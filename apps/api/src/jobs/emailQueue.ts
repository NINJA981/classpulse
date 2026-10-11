/**
 * Email delivery queue. Messages are rendered by the caller (lib/emailTemplates)
 * and delivered by the worker process through BullMQ: 5 attempts with
 * exponential backoff, rate-limited to stay well inside Gmail's sending quota.
 * Without Redis (dev/test) the message is delivered in-process right away.
 *
 * When a job carries `passwordTokenId`, the token's `email_status` is updated so
 * admins can see whether an invitation actually went out. Every outcome is also
 * written to `email_log` (recipient stored only as a sha256, never the body).
 */
import { Queue, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { emailLog, passwordTokens } from '../db/schema/index.js';
import { sha256Hex } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { emailEnabled, sendMail, type MailMessage } from '../lib/mailer.js';
import { getRedis, newRedisConnection } from '../lib/redis.js';

export const EMAIL_QUEUE = 'email';
const EMAIL_JOB_ATTEMPTS = 5;
const EMAIL_BACKOFF_MS = 60_000;
/** Gmail allows roughly 500 (Workspace 2,000) recipients a day; 60/min keeps bursts polite. */
const EMAIL_RATE = { max: 60, duration: 60_000 };

export interface EmailJobData {
  message: MailMessage;
  /** Update this password token's delivery status (invites and reset links). */
  passwordTokenId?: string;
  /** Short label for logs, e.g. "invite" or "assignment-reminder". */
  kind: string;
  /** School the email is for (platform email statistics). */
  institutionId?: string | null;
}

let queue: Queue<EmailJobData> | null = null;

function getQueue(): Queue<EmailJobData> | null {
  const connection = getRedis();
  if (!connection) return null;
  queue ??= new Queue<EmailJobData>(EMAIL_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: EMAIL_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: EMAIL_BACKOFF_MS },
      // Messages contain set-password links: don't keep them around after delivery.
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  return queue;
}

async function recordDelivery(data: EmailJobData, outcome: { ok: true } | { ok: false; error: string }) {
  await db
    .insert(emailLog)
    .values({
      kind: data.kind.slice(0, 40),
      institutionId: data.institutionId ?? null,
      toHash: sha256Hex(data.message.to.trim().toLowerCase()),
      status: outcome.ok ? 'sent' : 'failed',
      // SMTP errors can echo the recipient: never store an address.
      error: outcome.ok ? null : outcome.error.replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+/g, '[address]').slice(0, 300),
    })
    .catch((err: Error) => logger.error({ err: err.message }, 'Could not write the email log'));
  if (!data.passwordTokenId) return;
  await db
    .update(passwordTokens)
    .set(
      outcome.ok
        ? { emailStatus: 'sent', emailSentAt: new Date(), emailError: null }
        : { emailStatus: 'failed', emailError: outcome.error.slice(0, 300) },
    )
    .where(eq(passwordTokens.id, data.passwordTokenId))
    .catch((err: Error) => logger.error({ err: err.message }, 'Could not record email delivery status'));
}

/** Smtp errors can echo addresses; keep a short, generic reason for the admin UI. */
const reasonOf = (err: unknown) => (err instanceof Error ? err.message.split('\n')[0]! : 'Email delivery failed');

/**
 * Queue one email. Returns false (and sends nothing) when email is not configured.
 * Never throws for delivery problems: those are retried and recorded.
 */
export async function enqueueEmail(data: EmailJobData): Promise<boolean> {
  if (!emailEnabled()) return false;
  const q = getQueue();
  if (q) {
    await q.add(data.kind, data);
    return true;
  }
  // No Redis: deliver now (a couple of quick retries), recording the outcome.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sendMail(data.message);
      await recordDelivery(data, { ok: true });
      return true;
    } catch (err) {
      if (attempt === 3) {
        logger.warn({ kind: data.kind, err: reasonOf(err) }, 'Email delivery failed');
        await recordDelivery(data, { ok: false, error: reasonOf(err) });
        return true;
      }
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return true;
}

export interface EmailWorkerHandle {
  close(): Promise<void>;
}

/** Worker process only (with Redis). Without Redis, enqueueEmail delivers in-process. */
export function startEmailWorker(): EmailWorkerHandle {
  if (!env.REDIS_URL) return { close: async () => undefined };
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE,
    async (job) => {
      await sendMail(job.data.message);
      await recordDelivery(job.data, { ok: true });
    },
    { connection: newRedisConnection(), concurrency: 2, limiter: EMAIL_RATE },
  );
  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= EMAIL_JOB_ATTEMPTS;
    logger.warn({ kind: job.data.kind, attempt: job.attemptsMade, exhausted, err: reasonOf(err) }, 'Email delivery attempt failed');
    if (exhausted) void recordDelivery(job.data, { ok: false, error: reasonOf(err) });
  });
  worker.on('error', (err) => logger.error({ err: err.message }, 'Email worker error'));
  logger.info('Email worker started (BullMQ)');
  return { close: () => worker.close() };
}

export async function closeEmailQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}
