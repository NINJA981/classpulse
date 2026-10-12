/**
 * Per-socket event rate limiting (token bucket). One student script must not be able to flood
 * `player:answer` (a database write each) or any other event.
 */

export interface BucketOptions {
  /** Burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly opts: BucketOptions,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = opts.capacity;
    this.last = now();
  }

  /** Take one token; false when the bucket is empty. */
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.opts.capacity, this.tokens + ((t - this.last) / 1000) * this.opts.refillPerSec);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** 5 events a second with bursts of 10. */
export const SOCKET_EVENT_LIMIT: BucketOptions = { capacity: 10, refillPerSec: 5 };
/**
 * Refused events allowed before the socket is dropped: 20, recovering 1 a second.
 * A browser never comes close; only a sustained flood empties it.
 */
export const SOCKET_ABUSE_LIMIT: BucketOptions = { capacity: 20, refillPerSec: 1 };
/** Concurrent sockets per user; the oldest is dropped when a new one connects past the cap. */
export const MAX_SOCKETS_PER_USER = 5;
/** How often every connected socket's session is re-checked (token version, status, school, maintenance). */
export const SOCKET_REVALIDATE_MS = 60_000;
