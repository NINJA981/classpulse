import { z } from 'zod';

export const SttProvider = z.enum(['sarvam', 'openai']);
export type SttProvider = z.infer<typeof SttProvider>;
export const LlmProvider = z.enum(['openai']);

export interface ModelOption {
  id: string;
  label: string;
}

/** Speech-to-text models offered per provider (the first is the default). */
export const STT_MODELS: Record<SttProvider, readonly ModelOption[]> = {
  sarvam: [
    { id: 'saaras:v3', label: 'Sarvam Saaras v3: Indian languages mixed with English (recommended)' },
    { id: 'saarika:v2.5', label: 'Sarvam Saarika v2.5: single-language transcription' },
  ],
  openai: [{ id: 'whisper-1', label: 'OpenAI Whisper' }],
};

/** Quiz-writing models tested with the structured quiz format (the first is the default). */
export const LLM_MODELS: readonly ModelOption[] = [
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini: fast, good quality (recommended)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini: fastest, lowest cost' },
  { id: 'gpt-4.1', label: 'GPT-4.1: higher quality' },
  { id: 'gpt-4o', label: 'GPT-4o: higher quality' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini: reasoning model, slower' },
];

export const isSupportedSttModel = (provider: SttProvider, model: string) => STT_MODELS[provider].some((m) => m.id === model);
export const isSupportedLlmModel = (model: string) => LLM_MODELS.some((m) => m.id === model);

export const ModelSettingsInput = z.object({
  sttProvider: SttProvider,
  sttModel: z.string().trim().min(1).max(80),
  llmProvider: LlmProvider,
  llmModel: z.string().trim().min(1).max(80),
  /** Default for the teacher's "number of questions" field. */
  questionsPerLesson: z.number().int().min(1).max(30),
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
  llmModel: 'gpt-4.1-mini',
  questionsPerLesson: 5,
  bilingual: true,
};
