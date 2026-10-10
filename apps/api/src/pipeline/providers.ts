/**
 * Provider indirection used by the generation job and the remedial endpoint.
 * Tests swap implementations with `setPipelineProvidersForTests()` so nothing
 * hits the network.
 *
 * Demo output is used only when PIPELINE_DEMO_FALLBACK=true (never allowed in
 * production) AND the provider key is missing — it is labelled, logged and
 * recorded in pipelineMeta, never silent. Provider *failures* always surface.
 */
import type { RemedialPlan } from '@classpulse/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { demoGenerate, demoGenerateQuestions, demoRemedial, demoTranscribe } from './demo.js';
import { generateQuestionsWithOpenAI, generateRemedialPlan, generateWithOpenAI } from './llm.js';
import { transcribeWithOpenAI } from './openaiStt.js';
import { transcribeWithSarvam } from './sarvam.js';
import type { GenerateInput, GenerateQuestionsResult, GenerateResult, RemedialInput, TranscribeInput, TranscribeResult } from './types.js';

export interface PipelineProviders {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
  generate(input: GenerateInput): Promise<GenerateResult>;
  generateQuestions(input: GenerateInput): Promise<GenerateQuestionsResult>;
  remedial(input: RemedialInput): Promise<RemedialPlan>;
}

const useDemo = (key: string, what: string) => {
  if (key || !env.PIPELINE_DEMO_FALLBACK) return false;
  logger.warn({ what }, 'PIPELINE_DEMO_FALLBACK: provider not configured, producing labelled demo output');
  return true;
};

const defaults: PipelineProviders = {
  transcribe: async (input) => {
    if (input.provider === 'openai') return useDemo(env.OPENAI_API_KEY, 'stt') ? demoTranscribe(input) : transcribeWithOpenAI(input);
    return useDemo(env.SARVAM_API_KEY, 'stt') ? demoTranscribe(input) : transcribeWithSarvam(input);
  },
  generate: async (input) => (useDemo(env.OPENAI_API_KEY, 'llm') ? demoGenerate(input) : generateWithOpenAI(input)),
  generateQuestions: async (input) =>
    useDemo(env.OPENAI_API_KEY, 'llm') ? demoGenerateQuestions(input) : generateQuestionsWithOpenAI(input),
  remedial: async (input) => (useDemo(env.OPENAI_API_KEY, 'remedial') ? demoRemedial(input) : generateRemedialPlan(input)),
};

export const providers: PipelineProviders = { ...defaults };

/** Override providers in tests; pass `null` (or `{}`) to restore the real implementations. */
export function setPipelineProvidersForTests(overrides: Partial<PipelineProviders> | null): void {
  Object.assign(providers, defaults, overrides ?? {});
}
