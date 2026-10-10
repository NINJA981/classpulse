import type { PeriodicTask } from './periodic.js';
import { retentionTask } from './retention.js';
import { deviceSweepTask } from '../modules/devices/sweep.js';

export const maintenanceTasks: PeriodicTask[] = [retentionTask, deviceSweepTask];
