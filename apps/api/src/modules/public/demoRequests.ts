/**
 * "Book a demo" requests from the public product page (/about). Each request becomes one email to a fixed
 * internal inbox (DEMO_REQUEST_TO, else MAIL_FROM's address); nothing is stored and nothing is ever sent to
 * the address a visitor types (it is only the Reply-To). Request bodies are never logged.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { toSingleLine, type DemoRequestInput } from '@classiq/shared';
import { env } from '../../config/env.js';
import { enqueueEmail } from '../../jobs/emailQueue.js';
import { renderEmail } from '../../lib/emailTemplates.js';
import { AppError } from '../../lib/errors.js';
import { emailEnabled, type MailMessage } from '../../lib/mailer.js';
import { getRedis } from '../../lib/redis.js';

export const DEMO_REQUEST_EMAIL_KIND = 'demo-request';
/** Inbox used only when E2E_MAIL_CAPTURE is on (never in production) and no inbox is configured. */
export const CAPTURE_INBOX = 'demo-requests@classiq.test';
/** The same request sent again within this window is accepted (204) but not emailed twice. */
const DUPLICATE_WINDOW_SEC = 24 * 3600;

const emailUnavailable = () =>
  new AppError(
    'EMAIL_UNAVAILABLE',
    'Demo requests can’t be sent from here right now. Please email us instead.',
  );

/** "ClassIQ <noreply@x.in>" or "noreply@x.in" -> "noreply@x.in"; null when there is no valid address. */
export function addressOf(mailbox: string): string | null {
  const candidate = (/<([^<>\s]+)>/.exec(mailbox)?.[1] ?? mailbox).trim();
  return candidate && z.email().safeParse(candidate).success ? candidate : null;
}

/** The fixed inbox demo requests go to, or null when none is configured. */
export function demoRecipient(
  cfg: Pick<typeof env, 'DEMO_REQUEST_TO' | 'MAIL_FROM' | 'E2E_MAIL_CAPTURE'> = env,
): string | null {
  return cfg.DEMO_REQUEST_TO || addressOf(cfg.MAIL_FROM) || (cfg.E2E_MAIL_CAPTURE ? CAPTURE_INBOX : null);
}

/** Whether a raw body has the honeypot filled in (checked before validation, so bots learn nothing). */
export function isHoneypotFilled(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const website = (body as { website?: unknown }).website;
  return typeof website === 'string' && website.trim() !== '';
}

/** Subject and header text: one line, no control characters, bounded. */
const headerSafe = (s: string, max = 200) => toSingleLine(s).slice(0, max);

export function buildDemoRequestEmail(to: string, r: DemoRequestInput): MailMessage {
  const lines = [
    `Name: ${r.name}`,
    `School: ${r.school}`,
    `City: ${r.city}`,
    `Phone (WhatsApp): ${r.phone}`,
    ...(r.email ? [`Email: ${r.email}`] : []),
    ...(r.role ? [`Role: ${r.role}`] : []),
    ...(r.classrooms !== undefined ? [`Classrooms: ${r.classrooms}`] : []),
  ];
  const message = r.message ? ['Message:', ...r.message.split('\n').filter((l) => l.trim() !== '')] : [];
  return renderEmail({
    to,
    subject: headerSafe(`Demo request: ${r.school}, ${r.city}`),
    schoolName: 'Website',
    heading: headerSafe(`Demo request from ${r.school}`),
    paragraphs: [
      ...lines,
      ...message,
      r.email
        ? 'Reply to this email to answer them directly, or call them on the number above.'
        : 'Call or WhatsApp them on the number above.',
    ],
    footer:
      'Sent by the "Book a demo" form on the ClassIQ product page (/about). The requester was not sent a copy.',
    ...(r.email && { replyTo: r.email }),
  });
}

/* ---------------------------------------------------------------- duplicates */

const seenInMemory = new Map<string, number>();

/** Claims a request fingerprint for 24 h. False when the same request was already sent. */
async function claim(key: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) return (await redis.set(`demo:seen:${key}`, '1', 'EX', DUPLICATE_WINDOW_SEC, 'NX')) === 'OK';
  const now = Date.now();
  for (const [k, expires] of seenInMemory) if (expires <= now) seenInMemory.delete(k);
  if (seenInMemory.has(key)) return false;
  seenInMemory.set(key, now + DUPLICATE_WINDOW_SEC * 1000);
  return true;
}

async function release(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) await redis.del(`demo:seen:${key}`).catch(() => undefined);
  else seenInMemory.delete(key);
}

const fingerprint = (r: DemoRequestInput) =>
  createHash('sha256')
    .update(JSON.stringify({ ...r, website: undefined }))
    .digest('hex');

/**
 * Emails one validated request to the fixed inbox. Returns false for a duplicate (nothing sent).
 * Throws 503 EMAIL_UNAVAILABLE when email isn't configured here.
 */
export async function sendDemoRequest(r: DemoRequestInput): Promise<boolean> {
  const to = demoRecipient();
  if (!to || !emailEnabled()) throw emailUnavailable();
  const key = fingerprint(r);
  if (!(await claim(key))) return false;
  try {
    const queued = await enqueueEmail({
      kind: DEMO_REQUEST_EMAIL_KIND,
      message: buildDemoRequestEmail(to, r),
    });
    if (!queued) throw emailUnavailable();
  } catch (err) {
    await release(key); // a retry must not be swallowed as a duplicate
    throw err;
  }
  return true;
}
