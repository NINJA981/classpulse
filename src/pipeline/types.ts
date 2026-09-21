export interface PipelineQuestion {
  id: string;
  type: string; // mcq | true_false | fill_in_the_blank | short_answer
  question: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  answerExplanation: string;
  difficulty: string;
  source: { startTime: number; endTime: number; chunkIds: string[] };
}

export interface RefinedChunk {
  id: string;
  startTime: number;
  endTime: number;
  refinedText: string;
  segmentIds: string[];
}

export interface TranscriptSegment {
  id: string;
  sequenceNumber: number;
  startTime: number;
  endTime: number;
  rawText: string;
  finalText: string;
}

export interface KnowledgeItem {
  id: string;
  name: string;
  description: string;
  type: 'topic' | 'concept' | 'definition' | 'fact' | 'importantPoint';
  sourceChunkIds: string[];
}

export interface PipelineIngestResult {
  sessionId: string;
  language: string | null;
  durationSec: number;
  transcript: {
    segments: TranscriptSegment[];
    refinedChunks: RefinedChunk[];
  };
  quiz: {
    id: string;
    contentUntil: number;
    questions: PipelineQuestion[];
  };
  summary: string | null;
  keyTakeaways: string[];
}

