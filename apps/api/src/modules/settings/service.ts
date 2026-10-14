import { eq } from 'drizzle-orm';
import {
  DEFAULT_MODEL_SETTINGS,
  STT_MODELS,
  SttProvider,
  isSupportedLlmModel,
  isSupportedSttModel,
  type ModelSettings,
  type ModelSettingsInput,
  type UpdateModelSettingsInput,
} from '@classiq/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { modelSettings } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';

function configured(): ModelSettings['configured'] {
  return { sarvam: Boolean(env.SARVAM_API_KEY), openai: Boolean(env.OPENAI_API_KEY) };
}

function toInput(row: typeof modelSettings.$inferSelect): ModelSettingsInput {
  // Stored values were validated on write; fall back to defaults if a provider value is ever unknown.
  return {
    sttProvider: SttProvider.safeParse(row.sttProvider).data ?? DEFAULT_MODEL_SETTINGS.sttProvider,
    sttModel: row.sttModel,
    llmProvider: row.llmProvider === 'openai' ? row.llmProvider : DEFAULT_MODEL_SETTINGS.llmProvider,
    llmModel: row.llmModel,
    questionsPerLesson: row.questionsPerLesson,
    bilingual: row.bilingual,
  };
}

/** The school's default for the teacher's "number of questions" field. */
export async function defaultQuestionCount(institutionId: string): Promise<number> {
  return (await currentSettings(institutionId)).questionsPerLesson;
}

async function currentSettings(institutionId: string): Promise<ModelSettingsInput> {
  const row = await db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, institutionId) });
  return row ? toInput(row) : { ...DEFAULT_MODEL_SETTINGS };
}

export async function getModelSettings(institutionId: string): Promise<ModelSettings> {
  return { ...(await currentSettings(institutionId)), configured: configured() };
}

export async function updateModelSettings(institutionId: string, patch: UpdateModelSettingsInput): Promise<ModelSettings> {
  // JSON bodies cannot carry `undefined`, so omitted keys simply keep their current value.
  const merged: ModelSettingsInput = { ...(await currentSettings(institutionId)), ...patch };
  // Switching provider without naming a model picks that provider's default model.
  if (patch.sttProvider && !patch.sttModel && !isSupportedSttModel(merged.sttProvider, merged.sttModel)) {
    merged.sttModel = STT_MODELS[merged.sttProvider][0]!.id;
  }
  const issues = [
    ...(isSupportedSttModel(merged.sttProvider, merged.sttModel)
      ? []
      : [{ path: 'sttModel', message: `Choose a ${merged.sttProvider} speech-to-text model from the list` }]),
    ...(isSupportedLlmModel(merged.llmModel) ? [] : [{ path: 'llmModel', message: 'Choose a quiz model from the list' }]),
  ];
  if (issues.length) throw new AppError('VALIDATION_FAILED', 'Unsupported model', issues);
  const [row] = await db
    .insert(modelSettings)
    .values({ institutionId, ...merged })
    .onConflictDoUpdate({ target: modelSettings.institutionId, set: merged })
    .returning();
  return { ...toInput(row!), configured: configured() };
}
