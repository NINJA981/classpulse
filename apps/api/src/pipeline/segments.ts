/** Transcript segment helpers shared by the STT providers and the LLM prompt builder. */
import type { TranscriptSegment } from '@classpulse/shared';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Split text into sentences (Latin and Indic sentence terminators). */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?।॥\n]+[.!?।॥]*/g) ?? [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Build segments from plain text when the provider returned no timestamps:
 * each sentence gets a time span proportional to its character count across
 * the REAL audio duration. Callers must flag the result as approximate.
 */
export function distributeSentences(text: string, durationSec: number, offsetSec = 0): TranscriptSegment[] {
  const sentences = splitSentences(text);
  const totalChars = sentences.reduce((n, s) => n + s.length, 0);
  if (!totalChars || durationSec <= 0) return [];
  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const span = (sentence.length / totalChars) * durationSec;
    segments.push({ startSec: round2(offsetSec + cursor), endSec: round2(offsetSec + cursor + span), text: sentence });
    cursor += span;
  }
  return segments;
}

/**
 * Merge consecutive segments into blocks of at least `minSec` seconds or
 * `minChars` characters — keeps LLM prompts compact when the provider returns
 * word-level timestamps, while preserving real start/end times.
 */
export function coalesceSegments(segments: TranscriptSegment[], minSec = 12, minChars = 280): TranscriptSegment[] {
  const blocks: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    if (!current) {
      current = { startSec: seg.startSec, endSec: seg.endSec, text };
    } else {
      current = { startSec: current.startSec, endSec: Math.max(current.endSec, seg.endSec), text: `${current.text} ${text}` };
    }
    if (current.endSec - current.startSec >= minSec || current.text.length >= minChars) {
      blocks.push(current);
      current = null;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
