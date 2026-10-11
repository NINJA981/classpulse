/**
 * End-to-end test support (E2E_MAIL_CAPTURE=true, never in production): outgoing email is
 * captured instead of sent, so a browser test can read an invitation and follow its link.
 *
 * With Redis the capture list lives there, because the separate worker process delivers
 * queued email; the worker must call installMailCapture() too. Without Redis it is kept in memory.
 */
import { setMailerForTests, type MailMessage } from '../../lib/mailer.js';
import { getRedis } from '../../lib/redis.js';

export interface CapturedEmail extends MailMessage {
  at: string;
}

const KEEP = 100;
const REDIS_KEY = 'e2e:mail-capture';
const memory: CapturedEmail[] = [];

async function store(mail: CapturedEmail): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.multi().lpush(REDIS_KEY, JSON.stringify(mail)).ltrim(REDIS_KEY, 0, KEEP - 1).expire(REDIS_KEY, 86_400).exec();
    return;
  }
  memory.unshift(mail);
  memory.length = Math.min(memory.length, KEEP);
}

/** Newest first, optionally only those sent to `to` (case-insensitive). */
export async function capturedEmails(to?: string): Promise<CapturedEmail[]> {
  const redis = getRedis();
  const all = redis ? (await redis.lrange(REDIS_KEY, 0, KEEP - 1)).map((s) => JSON.parse(s) as CapturedEmail) : memory;
  const want = to?.trim().toLowerCase();
  return want ? all.filter((m) => m.to.toLowerCase() === want) : [...all];
}

export function installMailCapture(): void {
  setMailerForTests((msg) => store({ ...msg, at: new Date().toISOString() }));
}
