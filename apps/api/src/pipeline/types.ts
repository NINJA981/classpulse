import type { Difficulty, Language, LessonAnalytics, RemedialPlan, RubricItem, TranscriptSegment } from '@classpulse/shared';

export interface TranscribeInput {
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
  questionsPerLesson: number;
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
  meta: { provider: string; model: string; demoFallback: boolean; repaired?: boolean };
}

export interface RemedialInput {
  title: string;
  subject: string;
  language: Language;
  analytics: LessonAnalytics;
  model: string;
}

export type { RemedialPlan };
