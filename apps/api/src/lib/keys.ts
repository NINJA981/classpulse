/**
 * Per-purpose keys derived from JWT_SECRET with HKDF-SHA256, so a token or MAC made for one purpose
 * can never be accepted for another (school sessions, platform sessions, sign-in challenges, exam
 * device tokens, audit identifiers). Changing a purpose label rotates that key.
 */
import { hkdfSync } from 'node:crypto';
import { env } from '../config/env.js';

export type KeyPurpose = 'school-session' | 'platform-session' | 'platform-challenge' | 'exam-device' | 'audit-identifier';

const SALT = 'classpulse/v1';
const cache = new Map<KeyPurpose, Buffer>();

/** The 32-byte key for `purpose`. */
export function keyFor(purpose: KeyPurpose): Buffer {
  let key = cache.get(purpose);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', env.JWT_SECRET, SALT, purpose, 32));
    cache.set(purpose, key);
  }
  return key;
}
