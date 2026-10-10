/**
 * Clearly-labelled DEMO output, used ONLY when PIPELINE_DEMO_FALLBACK=true
 * (forbidden in production by env validation) AND the real provider is not
 * configured. Every string is prefixed with "[Demo]" and pipelineMeta records
 * demoFallback=true, so it can never be mistaken for real lesson content.
 * Timestamps are spread over the REAL audio duration.
 */
import type { RemedialPlan, TranscriptSegment } from '@classpulse/shared';
import type {
  GenerateInput,
  GenerateQuestionsResult,
  GenerateResult,
  GeneratedQuestion,
  RemedialInput,
  TranscribeInput,
  TranscribeResult,
} from './types.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function demoTranscribe(input: TranscribeInput): TranscribeResult {
  const count = Math.max(1, Math.min(12, Math.ceil(input.durationSec / 30)));
  const span = input.durationSec / count;
  const segments: TranscriptSegment[] = Array.from({ length: count }, (_, i) => ({
    startSec: round2(i * span),
    endSec: round2((i + 1) * span),
    text: `[Demo] Speech-to-text is not configured. Placeholder for part ${i + 1} of ${count} of the recording.`,
  }));
  return {
    transcript: segments.map((s) => s.text).join(' '),
    segments,
    meta: { provider: 'demo', model: 'demo', approximateTimestamps: true, demoFallback: true },
  };
}

function demoQuestions(input: GenerateInput): GeneratedQuestion[] {
  const segs = input.segments.length ? input.segments : [{ startSec: 0, endSec: 0, text: '' }];
  const offset = input.existingStems.length;
  return Array.from({ length: input.questionsPerLesson }, (_, i) => {
    const seg = segs[i % segs.length]!;
    return {
      stem: `[Demo] Placeholder question ${offset + i + 1} about ${input.subject}. Replace or edit before publishing.`,
      stemLocal: null,
      options: ['[Demo] Option A', '[Demo] Option B', '[Demo] Option C', '[Demo] Option D'],
      optionsLocal: null,
      correctIndex: i % 4,
      explanation: '[Demo] Generated without an AI provider; this is not real lesson content.',
      explanationLocal: null,
      difficulty: input.difficulty === 'mixed' ? (['easy', 'medium', 'hard'] as const)[i % 3]! : input.difficulty,
      topicTag: 'Demo',
      citationStartSec: seg.startSec,
      citationEndSec: seg.endSec,
    };
  });
}

export function demoGenerateQuestions(input: GenerateInput): GenerateQuestionsResult {
  return { questions: demoQuestions(input), meta: { provider: 'demo', model: 'demo', demoFallback: true } };
}

export function demoGenerate(input: GenerateInput): GenerateResult {
  const questions = demoQuestions(input);
  return {
    summary: `[Demo] Question generation is not configured. This placeholder summary for "${input.title}" is not real lesson content.`,
    keyTakeaways: [
      '[Demo] Placeholder takeaway 1',
      '[Demo] Placeholder takeaway 2',
      '[Demo] Placeholder takeaway 3',
    ],
    questions,
    assignment: {
      title: `[Demo] Assignment for ${input.title}`,
      prompt: '[Demo] Placeholder assignment. Replace it before publishing.',
      rubric: [{ criterion: '[Demo] Criterion', marks: 10, descriptor: '[Demo] Placeholder descriptor' }],
      estimatedMinutes: 20,
    },
    meta: { provider: 'demo', model: 'demo', demoFallback: true },
  };
}

export function demoRemedial(input: RemedialInput): RemedialPlan {
  const weakest = [...input.analytics.questions].sort((a, b) => a.accuracyPct - b.accuracyPct).slice(0, 3);
  return {
    generatedAt: new Date().toISOString(),
    summary: '[Demo] AI recommendations are not configured. These placeholder actions only list the weakest questions.',
    actions: weakest.length
      ? weakest.map((q) => ({
          topic: q.topicTag ?? `Question ${q.position}`,
          recommendation: `[Demo] Revisit question ${q.position} (accuracy ${q.accuracyPct}%).`,
        }))
      : [{ topic: 'General', recommendation: '[Demo] No question data available.' }],
  };
}
