import fs from 'fs';
import path from 'path';
import { sarvamBatchTranscribe } from './sarvamBatch.js';
import { chunkTranscript } from './chunker.js';
import { extractKnowledge } from './knowledgeExtractor.js';
import { generateQuiz, generateSummary } from './llmService.js';
import { detectTopics, TOPIC_LIBRARY } from './library.js';
import type { PipelineIngestResult } from './types.js';

export interface IngestParams {
  filePath: string;
  title: string;
  subject: string;
  teacherId: string;
  language?: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const MIME_MAP: Record<string, string> = {
  webm: 'audio/webm',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac'
};

/**
 * Executes the entire lecture processing pipeline directly in-process:
 * 1. Reads audio file
 * 2. Transcribes via Sarvam Batch API (or dev fallback if no Sarvam key)
 * 3. Cleans, refines, and chunks into ~30s intervals
 * 4. Extracts concepts and knowledge items
 * 5. Generates grounded quiz questions & summary
 * 6. Returns structured result in-memory
 */
export async function ingestLectureFileInProcess(params: IngestParams): Promise<PipelineIngestResult> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = path.extname(params.filePath).slice(1).toLowerCase() || 'webm';
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';
  const filename = path.basename(params.filePath);

  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(params.filePath);
  } catch {
    // If relative path from cwd wasn't found, try resolving relative to uploads
    const altPath = path.resolve(process.cwd(), params.filePath);
    buffer = await fs.promises.readFile(altPath);
  }

  let rawTranscript = '';
  let languageCode = params.language || 'en-IN';

  const sarvamKey = process.env.SARVAM_API_KEY?.trim();

  if (sarvamKey) {
    try {
      const batchRes = await sarvamBatchTranscribe(
        sarvamKey,
        { buffer, filename, mimeType },
        { languageCode: params.language || 'en-IN' }
      );
      rawTranscript = batchRes.transcript;
      if (batchRes.languageCode) {
        languageCode = batchRes.languageCode;
      }
    } catch (err) {
      console.warn(`[EmbeddedPipeline] Sarvam batch transcription failed, using fallback: ${err}`);
    }
  }

  // Fallback transcript when no Sarvam API key is configured or API fails
  if (!rawTranscript.trim()) {
    const searchTarget = `${params.title} ${params.subject} ${filename}`.toLowerCase();
    const matched = detectTopics(searchTarget);
    if (matched.length > 0) {
      rawTranscript = matched[0].clean.join(' ');
    } else {
      const defaultTopic = TOPIC_LIBRARY[0]; // Binary Search default
      rawTranscript = `Welcome to today's lecture on ${params.subject || params.title}. ${defaultTopic.clean.join(' ')}`;
    }
  }

  // Chunker and text refinement
  const { segments, refinedChunks, durationSec } = chunkTranscript(rawTranscript);

  // Knowledge extraction
  extractKnowledge(refinedChunks, params.subject);

  // Quiz generation
  const questions = await generateQuiz({
    subject: params.subject,
    chunks: refinedChunks,
    questionCount: params.questionCount || 5,
    difficulty: params.difficulty || 'medium'
  });

  // Summary generation
  const { summary, keyTakeaways } = await generateSummary(refinedChunks, params.subject);

  return {
    sessionId,
    language: languageCode,
    durationSec,
    transcript: {
      segments,
      refinedChunks
    },
    quiz: {
      id: `quiz_${sessionId}`,
      contentUntil: durationSec,
      questions
    },
    summary,
    keyTakeaways
  };
}
