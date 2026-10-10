import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const sha256Hex = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** URL-safe random token (e.g. device keys, enrollment tokens). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

const READABLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** Human-friendly initial password, e.g. "K7QM-4XPA-R2". */
export function generateInitialPassword(): string {
  const pick = (n: number) => Array.from({ length: n }, () => READABLE[randomInt(READABLE.length)]).join('');
  return `${pick(4)}-${pick(4)}-${pick(2)}`;
}

/** 6-character section join code. */
export const generateJoinCode = () => Array.from({ length: 6 }, () => READABLE[randomInt(READABLE.length)]).join('');

/** 6-digit live quiz PIN. */
export const generatePin = () => String(randomInt(100000, 1000000));
