/**
 * fetch with per-step retries for upstream AI providers. Retries 429/5xx,
 * network errors and timeouts with exponential backoff + jitter. Response
 * bodies of failed calls are never surfaced (they may echo request content).
 */
import { logger } from '../lib/logger.js';
import { PipelineError } from './errors.js';

export interface RetryPolicy {
  /** Total tries per HTTP step (1 = no retry). */
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Mutable so tests can shrink delays. */
export const httpRetryPolicy: RetryPolicy = { attempts: 4, baseDelayMs: 1_000, maxDelayMs: 20_000 };

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

export interface FetchStepOptions {
  /** Short label for logs, e.g. "sarvam:init". */
  step: string;
  timeoutMs: number;
  /** User-facing message when the step finally fails. */
  userMessage: string;
  /** User-facing message for 401/403 (credentials rejected). */
  authUserMessage?: string;
  policy?: RetryPolicy;
}

function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 60_000);
  return null;
}

/**
 * Perform one logical HTTP step. Returns the successful Response. Throws a
 * PipelineError: retryable when retries were exhausted on transient failures,
 * non-retryable for other 4xx (bad request, credentials).
 */
export async function fetchStep(url: string, init: RequestInit, opts: FetchStepOptions): Promise<Response> {
  const policy = opts.policy ?? httpRetryPolicy;
  let lastProblem = 'unknown error';
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
    } catch (err) {
      lastProblem = err instanceof Error ? `${err.name}: ${err.message}` : 'network error';
    }

    if (res?.ok) return res;

    let waitMs = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
    if (res) {
      // Drain the body so the connection can be reused; never log it.
      await res.body?.cancel().catch(() => undefined);
      lastProblem = `HTTP ${res.status}`;
      if (!isRetryableStatus(res.status)) {
        const auth = res.status === 401 || res.status === 403;
        throw new PipelineError(`${opts.step} failed with HTTP ${res.status}`, {
          retryable: false,
          userMessage: auth && opts.authUserMessage ? opts.authUserMessage : opts.userMessage,
        });
      }
      waitMs = retryAfterMs(res) ?? waitMs;
    }

    if (attempt < policy.attempts) {
      const jitter = Math.floor(Math.random() * Math.min(500, policy.baseDelayMs));
      logger.warn({ step: opts.step, attempt, problem: lastProblem }, 'Upstream call failed; retrying');
      await sleep(waitMs + jitter);
    }
  }
  throw new PipelineError(`${opts.step} failed after ${policy.attempts} tries (${lastProblem})`, {
    retryable: true,
    userMessage: opts.userMessage,
  });
}

/** Parse a JSON body, turning malformed JSON into a retryable PipelineError. */
export async function readJson(res: Response, step: string, userMessage: string): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch (err) {
    throw new PipelineError(`${step} returned malformed JSON`, { retryable: true, userMessage, cause: err });
  }
}
