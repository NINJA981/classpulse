/** Platform-console maintenance: log/audit retention, the 5-minute health snapshot and the deploy watcher. */
import { logger } from '../lib/logger.js';
import { purgeOldAudit } from '../modules/platform/opsAudit.js';
import { pruneHealthSnapshots, takeHealthSnapshot } from '../modules/platform/opsHealth.js';
import { purgeOldLogs } from '../modules/platform/opsLogs.js';
import { deployWatchTask } from '../modules/platform/deployWatcher.js';
import type { PeriodicTask } from './periodic.js';

export const LOG_RETENTION_DAYS = 14;
export const AUDIT_RETENTION_DAYS = 365;
export const HEALTH_SNAPSHOT_RETENTION_DAYS = 30;

export const logRetentionTask: PeriodicTask = {
  name: 'log-retention',
  intervalMs: 24 * 3600_000,
  run: async () => {
    const deleted = await purgeOldLogs(LOG_RETENTION_DAYS);
    if (deleted) logger.info({ deleted }, 'Old application logs deleted');
  },
};

export const healthSnapshotTask: PeriodicTask = {
  name: 'health-snapshot',
  intervalMs: 5 * 60_000,
  run: async () => {
    await takeHealthSnapshot();
    await pruneHealthSnapshots(HEALTH_SNAPSHOT_RETENTION_DAYS);
  },
};

export const auditRetentionTask: PeriodicTask = {
  name: 'audit-retention',
  intervalMs: 24 * 3600_000,
  run: async () => {
    const deleted = await purgeOldAudit(AUDIT_RETENTION_DAYS);
    if (deleted) logger.info({ deleted }, 'Old audit entries deleted');
  },
};

export const opsTasks: PeriodicTask[] = [logRetentionTask, healthSnapshotTask, auditRetentionTask, deployWatchTask];
