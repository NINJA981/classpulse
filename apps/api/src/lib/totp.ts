/**
 * Time-based one-time passwords (RFC 6238 / RFC 4226) with node:crypto only:
 * HMAC-SHA1, 30-second steps, 6 digits, accepting the previous and next step for clock drift.
 * Callers store the last accepted step and pass it back so a code can never be used twice.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Steps accepted either side of "now". */
const WINDOW = 1;
const SECRET_BYTES = 20;
const ISSUER = 'ClassPulse';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random secret (160 bits), base32-encoded for authenticator apps. */
export const generateTotpSecret = () => base32Encode(randomBytes(SECRET_BYTES));

export const currentStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** The code for one time step (RFC 4226 dynamic truncation). */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(binary).padStart(DIGITS, '0');
}

/**
 * The step `code` matches within ±WINDOW of now, or null. Steps at or before `lastStep`
 * (already used) never match, which blocks replaying a code.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep(nowMs);
  const given = Buffer.from(code);
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpAt(secret, step)), given)) return step;
  }
  return null;
}

/** otpauth://totp/ClassPulse:{email}?secret=…&issuer=ClassPulse (rendered as a QR code). */
export function otpauthUri(email: string, secret: string): string {
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
