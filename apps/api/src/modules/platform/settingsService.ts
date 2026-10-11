/**
 * Platform settings (maintenance, banner, default models for new schools, AI price rates).
 * Stored one row per section in platform_settings; reads go through the cached lib/platformState.
 */
import { sql } from 'drizzle-orm';
import {
  STT_MODELS,
  isSupportedLlmModel,
  isSupportedSttModel,
  type PlatformSettings,
  type UpdatePlatformSettingsInput,
} from '@classpulse/shared';
import { db } from '../../db/client.js';
import { platformSettings } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { getPlatformSettings, invalidatePlatformSettings, type PlatformSettingKey } from '../../lib/platformState.js';

export async function readSettings(): Promise<PlatformSettings> {
  invalidatePlatformSettings(); // the console always sees the stored values
  return getPlatformSettings();
}

/** Replace the given sections; returns the full settings and the names of the sections changed. */
export async function updateSettings(
  input: UpdatePlatformSettingsInput,
  actorId: string,
): Promise<{ settings: PlatformSettings; changed: PlatformSettingKey[] }> {
  const models = input.defaultModels;
  if (models) {
    const issues = [
      ...(isSupportedSttModel(models.sttProvider, models.sttModel)
        ? []
        : [{ path: 'defaultModels.sttModel', message: `Choose one of: ${STT_MODELS[models.sttProvider].map((m) => m.id).join(', ')}` }]),
      ...(isSupportedLlmModel(models.llmModel) ? [] : [{ path: 'defaultModels.llmModel', message: 'Choose a quiz model from the list' }]),
    ];
    if (issues.length) throw new AppError('VALIDATION_FAILED', 'Unsupported model', issues);
  }
  const entries = Object.entries(input).filter(([, v]) => v !== undefined) as [PlatformSettingKey, unknown][];
  if (entries.length) {
    const now = new Date();
    await db
      .insert(platformSettings)
      .values(entries.map(([key, value]) => ({ key, value, updatedAt: now, updatedBy: actorId })))
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: sql`excluded.value`, updatedAt: now, updatedBy: actorId },
      });
  }
  invalidatePlatformSettings();
  return { settings: await getPlatformSettings(), changed: entries.map(([k]) => k) };
}
