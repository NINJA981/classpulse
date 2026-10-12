/** Removes temp files (storage.tmpDir) left behind by crashed or killed uploads and transcodes. */
import { logger } from '../lib/logger.js';
import { sweepTmpDir, TMP_MAX_AGE_MS } from '../lib/storage.js';
import type { PeriodicTask } from './periodic.js';

export const tmpSweepTask: PeriodicTask = {
  name: 'tmp-sweep',
  intervalMs: 30 * 60_000,
  run: async () => {
    const removed = await sweepTmpDir(TMP_MAX_AGE_MS);
    if (removed) logger.info({ removed }, 'Removed stale temp files');
  },
};
