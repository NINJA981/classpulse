/**
 * AI usage accounting: one `ai_usage` row per provider call (successful or not), for the platform's
 * usage and cost statistics and the per-school monthly transcription limit.
 *
 * Recording is fire-and-forget: it never throws and never delays the AI call it describes. Callers pass
 * an `AiUsageContext` (who the call is for and why) through the pipeline inputs; without one nothing is
 * recorded. Cost is NOT stored — it is estimated at read time from the platform's price rates.
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import type { AiUsageKind } from '@classiq/shared';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { aiUsage, institutions } from '../db/schema/index.js';
import { isPipelineError } from '../pipeline/errors.js';
import { invalidState } from './errors.js';
import { logger } from './logger.js';
import { institutionState } from './platformState.js';

export type { AiUsageKind };

/** Who an AI call is for and why. Thread this through pipeline inputs (`usage`); never use global state. */
export interface AiUsageContext {
  institutionId: string | null;
  lessonId?: string | null;
  kind: AiUsageKind;
}

export interface AiUsageEntry extends AiUsageContext {
  provider: string;
  model: string;
  /** Speech-to-text only: seconds of audio sent (null on failure). */
  audioSeconds?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  ok: boolean;
  /** Short machine code for failures, e.g. "http_429", "timeout" (see aiErrorCode). */
  errorCode?: string | null;
}

const pending = new Set<Promise<void>>();

const intOrNull = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null);

/**
 * Record one provider call. Fire-and-forget: returns immediately; a failed insert is logged, never thrown.
 * Use this directly when calling a provider outside the pipeline helpers (e.g. `chat()` without a context).
 */
export function recordAiUsage(entry: AiUsageEntry): void {
  const p = db
    .insert(aiUsage)
    .values({
      institutionId: entry.institutionId ?? null,
      lessonId: entry.lessonId ?? null,
      kind: entry.kind,
      provider: entry.provider.slice(0, 20),
      model: (entry.model || 'unknown').slice(0, 80),
      audioSeconds: typeof entry.audioSeconds === 'number' && Number.isFinite(entry.audioSeconds) ? Math.max(0, entry.audioSeconds) : null,
      inputTokens: intOrNull(entry.inputTokens),
      outputTokens: intOrNull(entry.outputTokens),
      ok: entry.ok,
      errorCode: entry.errorCode ? entry.errorCode.slice(0, 60) : null,
    })
    .then(() => undefined)
    .catch((err: Error) => logger.warn({ err: err.message, kind: entry.kind }, 'Could not record AI usage'))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/** Wait for in-flight usage writes (tests, graceful shutdown). */
export async function flushAiUsage(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

/** A short, non-sensitive failure code (never a response body or message text). */
export function aiErrorCode(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  const name = err instanceof Error ? err.name : '';
  const status = /HTTP (\d{3})/.exec(message)?.[1];
  if (status) return `http_${status}`;
  if (name === 'TimeoutError' || /timed? ?out/i.test(message)) return 'timeout';
  if (name === 'AbortError') return 'aborted';
  if (/not set|missing|not configured/i.test(message)) return 'not_configured';
  if (/refused/i.test(message)) return 'refused';
  if (/empty/i.test(message)) return 'empty_output';
  if (/invalid|malformed|valid questions|no new/i.test(message)) return 'invalid_output';
  if (/job failed|output\(s\) missing/i.test(message)) return 'provider_failed';
  if (isPipelineError(err)) return 'pipeline_error';
  if (name === 'TypeError') return 'network';
  return 'error';
}

/**
 * Run one provider call and record it: on success with `measure(result)` (tokens/audio), on failure
 * with ok=false and an error code (then rethrow). Without a context the call just runs.
 */
export async function trackAiCall<T>(
  ctx: AiUsageContext | undefined,
  call: { provider: string; model: string },
  fn: () => Promise<T>,
  measure?: (result: T) => Pick<AiUsageEntry, 'audioSeconds' | 'inputTokens' | 'outputTokens'>,
): Promise<T> {
  if (!ctx) return fn();
  try {
    const result = await fn();
    let measured: Pick<AiUsageEntry, 'audioSeconds' | 'inputTokens' | 'outputTokens'> = {};
    try {
      measured = measure?.(result) ?? {};
    } catch {
      // measurement must never break the call
    }
    recordAiUsage({ ...ctx, ...call, ...measured, ok: true });
    return result;
  } catch (err) {
    recordAiUsage({ ...ctx, ...call, ok: false, errorCode: aiErrorCode(err) });
    throw err;
  }
}

/** Seconds of audio successfully transcribed for a school since the 1st of this month (in its time zone). */
export async function audioSecondsThisMonth(institutionId: string): Promise<number> {
  const [row] = await db
    .select({ secs: sql<number>`coalesce(sum(${aiUsage.audioSeconds}), 0)::float8` })
    .from(aiUsage)
    .innerJoin(institutions, eq(institutions.id, aiUsage.institutionId))
    .where(
      and(
        eq(aiUsage.institutionId, institutionId),
        eq(aiUsage.ok, true),
        eq(aiUsage.kind, 'stt'),
        gte(aiUsage.at, sql`(date_trunc('month', now() at time zone ${institutions.timezone}) at time zone ${institutions.timezone})`),
      ),
    );
  return Number(row?.secs ?? 0);
}

export const AI_AUDIO_LIMIT_MESSAGE = "This school's monthly AI transcription minutes are used up. Contact your administrator.";

/**
 * A school's monthly transcription allowance in minutes: its own limit, else the platform default
 * (DEFAULT_AI_AUDIO_MINUTES_PER_MONTH). null = unlimited (only when the default is 0).
 */
export function effectiveAiAudioMinutes(schoolLimit: number | null | undefined): number | null {
  if (schoolLimit !== null && schoolLimit !== undefined) return schoolLimit;
  return env.DEFAULT_AI_AUDIO_MINUTES_PER_MONTH > 0 ? env.DEFAULT_AI_AUDIO_MINUTES_PER_MONTH : null;
}

/**
 * Monthly transcription limit (institution.limits.aiAudioMinutesPerMonth, or the platform default when the
 * school has none): throws INVALID_STATE when transcribing `addingSec` more seconds would go over this
 * month's allowance.
 */
export async function assertAiAudioAvailable(institutionId: string, addingSec: number): Promise<void> {
  const state = await institutionState(institutionId);
  const limitMin = effectiveAiAudioMinutes(state?.limits.aiAudioMinutesPerMonth);
  if (limitMin === null) return;
  const used = await audioSecondsThisMonth(institutionId);
  if (used + Math.max(0, addingSec) > limitMin * 60) throw invalidState(AI_AUDIO_LIMIT_MESSAGE);
}
