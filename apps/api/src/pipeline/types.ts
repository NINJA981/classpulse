import type { Difficulty, Language, LessonAnalytics, QuizDifficulty, RemedialPlan, RubricItem, TranscriptSegment } from '@classpulse/shared';

export interface TranscribeInput {
  /** Configured STT provider for the institution. */
  provider: 'sarvam' | 'openai';
  /** Absolute local path of the normalized 16 kHz mono WAV. */
  audioPath: string;
  language: Language;
  /** Real audio duration from ffprobe. */
  durationSec: number;
  model: string;
}

export interface TranscribeResult {
  transcript: string;
  segments: TranscriptSegment[];
  meta: {
    provider: string;
    model: string;
    /** True when Sarvam returned no timestamps and times were distributed over the real duration. */
    approximateTimestamps: boolean;
    demoFallback: boolean;
  };
}

export interface GenerateInput {
  title: string;
  subject: string;
  language: Language;
  segments: TranscriptSegment[];
  /** How many questions the teacher asked for. */
  questionsPerLesson: number;
  difficulty: QuizDifficulty;
  /** Stems of questions the quiz keeps; new questions must test other points. */
  existingStems: string[];
  bilingual: boolean;
  model: string;
}

export interface GeneratedQuestion {
  stem: string;
  stemLocal: string | null;
  options: string[];
  optionsLocal: string[] | null;
  correctIndex: number;
  explanation: string | null;
  explanationLocal: string | null;
  difficulty: Difficulty;
  topicTag: string | null;
  citationStartSec: number | null;
  citationEndSec: number | null;
}

export interface GeneratedAssignment {
  title: string;
  prompt: string;
  rubric: RubricItem[];
  estimatedMinutes: number | null;
}

export interface GenerateResult {
  summary: string;
  keyTakeaways: string[];
  questions: GeneratedQuestion[];
  assignment: GeneratedAssignment;
  meta: { provider: string; model: string; demoFallback: boolean; repaired?: boolean; questionsRequested?: number };
}

/** Questions only (adding to or replacing part of a quiz; summary and assignment are kept). */
export interface GenerateQuestionsResult {
  questions: GeneratedQuestion[];
  meta: GenerateResult['meta'];
}

export interface RemedialInput {
  title: string;
  subject: string;
  language: Language;
  analytics: LessonAnalytics;
  model: string;
}

export type { RemedialPlan };
