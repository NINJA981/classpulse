/**
 * Small authenticated-encryption box for secrets at rest (platform admins' TOTP secrets):
 * AES-256-GCM under PLATFORM_ENCRYPTION_KEY (base64, 32 bytes). Sealed values look like
 * `v1.<iv>.<tag>.<ciphertext>` (base64url). Without a valid key nothing can be sealed or opened.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const VERSION = 'v1';

/** The decoded key, or null when it is missing or not exactly 32 bytes. Read on each call (tests set it late). */
export function encryptionKey(raw = env.PLATFORM_ENCRYPTION_KEY): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

export const secretBoxReady = () => encryptionKey() !== null;

function requireKey(): Buffer {
  const key = encryptionKey();
  if (!key) throw new Error('PLATFORM_ENCRYPTION_KEY is missing or is not a base64 32-byte key');
  return key;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function open(sealed: string): string {
  const [version, iv, tag, ct] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error('Unrecognised sealed value');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}
