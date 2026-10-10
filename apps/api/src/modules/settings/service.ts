import { eq } from 'drizzle-orm';
import {
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
  type ModelSettingsInput,
  type UpdateModelSettingsInput,
} from '@classpulse/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { modelSettings } from '../../db/schema/index.js';

function configured(): ModelSettings['configured'] {
  return { sarvam: Boolean(env.SARVAM_API_KEY), openai: Boolean(env.OPENAI_API_KEY) };
}

function toInput(row: typeof modelSettings.$inferSelect): ModelSettingsInput {
  // Stored values were validated on write; fall back to defaults if a provider value is ever unknown.
  return {
    sttProvider: row.sttProvider === 'sarvam' ? row.sttProvider : DEFAULT_MODEL_SETTINGS.sttProvider,
    sttModel: row.sttModel,
    llmProvider: row.llmProvider === 'openai' ? row.llmProvider : DEFAULT_MODEL_SETTINGS.llmProvider,
    llmModel: row.llmModel,
    questionsPerLesson: row.questionsPerLesson,
    bilingual: row.bilingual,
  };
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
  const [row] = await db
    .insert(modelSettings)
    .values({ institutionId, ...merged })
    .onConflictDoUpdate({ target: modelSettings.institutionId, set: merged })
    .returning();
  return { ...toInput(row!), configured: configured() };
}
