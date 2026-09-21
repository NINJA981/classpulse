import { cleanRefineText } from './textRefiner.js';
import type { TranscriptSegment, RefinedChunk } from './types.js';

export interface ChunkerResult {
  segments: TranscriptSegment[];
  refinedChunks: RefinedChunk[];
  durationSec: number;
}

/**
 * Splits continuous lecture text into timestamped segments and ~30-60s context chunks.
 */
export function chunkTranscript(
  text: string,
  totalDurationSec?: number,
  targetChunkSec: number = 30
): ChunkerResult {
  const sentences = text.match(/[^.!?\n]+[.!?]?/g) || [text];
  const cleanedSentences = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  const durationSec =
    totalDurationSec && totalDurationSec > 0
      ? totalDurationSec
      : Math.max(30, cleanedSentences.length * 4); // ~4 sec per sentence heuristic

  const secPerSentence = durationSec / Math.max(1, cleanedSentences.length);

  const segments: TranscriptSegment[] = [];
  const refinedChunks: RefinedChunk[] = [];

  let currentChunkSentences: string[] = [];
  let currentChunkSegmentIds: string[] = [];
  let currentChunkStart = 0;
  let chunkIndex = 1;

  cleanedSentences.forEach((sentence, idx) => {
    const seq = idx + 1;
    const startTime = Number((idx * secPerSentence).toFixed(2));
    const endTime = Number(((idx + 1) * secPerSentence).toFixed(2));
    const segmentId = `seg_${seq}`;
    const cleaned = cleanRefineText(sentence);

    segments.push({
      id: segmentId,
      sequenceNumber: seq,
      startTime,
      endTime,
      rawText: sentence,
      finalText: cleaned
    });

    currentChunkSentences.push(cleaned);
    currentChunkSegmentIds.push(segmentId);

    const chunkElapsed = endTime - currentChunkStart;
    if (chunkElapsed >= targetChunkSec || idx === cleanedSentences.length - 1) {
      refinedChunks.push({
        id: `chunk_${chunkIndex}`,
        startTime: currentChunkStart,
        endTime,
        refinedText: currentChunkSentences.join(' '),
        segmentIds: [...currentChunkSegmentIds]
      });

      chunkIndex += 1;
      currentChunkStart = endTime;
      currentChunkSentences = [];
      currentChunkSegmentIds = [];
    }
  });

  return { segments, refinedChunks, durationSec };
}

