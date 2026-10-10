import { z } from 'zod';

export const SttProvider = z.enum(['sarvam']);
export const LlmProvider = z.enum(['openai']);

export const ModelSettingsInput = z.object({
  sttProvider: SttProvider,
  sttModel: z.string().trim().min(1).max(80),
  llmProvider: LlmProvider,
  llmModel: z.string().trim().min(1).max(80),
  questionsPerLesson: z.number().int().min(1).max(20),
  /** Generate stem/options/explanations in the lesson language in addition to English. */
  bilingual: z.boolean(),
});
export type ModelSettingsInput = z.infer<typeof ModelSettingsInput>;

export const UpdateModelSettingsInput = ModelSettingsInput.partial();
export type UpdateModelSettingsInput = z.infer<typeof UpdateModelSettingsInput>;

export interface ModelSettings extends ModelSettingsInput {
  /** Which provider keys are configured on the server (values are never exposed). */
  configured: { sarvam: boolean; openai: boolean };
}

export const DEFAULT_MODEL_SETTINGS: ModelSettingsInput = {
  sttProvider: 'sarvam',
  sttModel: 'saaras:v3',
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  questionsPerLesson: 5,
  bilingual: true,
};
