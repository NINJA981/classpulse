import type {
  BloomLevel,
  Difficulty,
  Language,
  LessonAnalytics,
  QuizDifficulty,
  RemedialPlan,
  RubricItem,
  RubricMark,
  TranscriptSegment,
} from '@classpulse/shared';
import type { AiUsageContext } from '../lib/aiUsage.js';

export interface TranscribeInput {
  /** Configured STT provider for the institution. */
  provider: 'sarvam' | 'openai';
  /** Absolute local path of the normalized 16 kHz mono WAV. */
  audioPath: string;
  language: Language;
  /** Real audio duration from ffprobe. */
  durationSec: number;
  model: string;
  /** Records one ai_usage row per provider call (institution, lesson, kind); omit to record nothing. */
  usage?: AiUsageContext;
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
  /** Records one ai_usage row per provider call (institution, lesson, kind); omit to record nothing. */
  usage?: AiUsageContext;
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
  /** Optional so older providers (demo) need not set them; persisted as null when absent. */
  bloomLevel?: BloomLevel | null;
  competency?: string | null;
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
  /** Records one ai_usage row per provider call (institution, lesson, kind); omit to record nothing. */
  usage?: AiUsageContext;
}

/** A photo of the student's work sent to the model (JPEG/PNG only). */
export interface GradeImage {
  name: string;
  mime: 'image/jpeg' | 'image/png';
  data: Buffer;
}

export interface GradeInput {
  title: string;
  prompt: string;
  rubric: RubricItem[];
  text: string | null;
  images: GradeImage[];
  /** Files the model was not given, with the reason (e.g. "notes.pdf (PDF files are not read)"). */
  skippedFiles: string[];
  model: string;
  /** Records one ai_usage row per provider call (institution, lesson, kind); omit to record nothing. */
  usage?: AiUsageContext;
}

/** A grading suggestion; the teacher must review it before anything reaches the student. */
export interface GradeResult {
  /** One entry per rubric criterion, in rubric order, clamped to the criterion's marks. */
  rubricMarks: RubricMark[];
  feedback: string;
  note: string;
  model: string;
  /** The model reported text in the work addressed to the grader/AI (possible prompt injection). */
  injectionSuspected?: boolean;
}

export type { RemedialPlan };
