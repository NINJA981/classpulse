/** STUB — replaced by the API-domain workstream. Deletes lecture audio past audio_expires_at. */
import type { PeriodicTask } from './periodic.js';

export const retentionTask: PeriodicTask = { name: 'audio-retention', intervalMs: 6 * 3600_000, run: async () => undefined };
