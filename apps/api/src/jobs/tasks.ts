import type { PeriodicTask } from './periodic.js';
import { retentionTask } from './retention.js';
import { deviceSweepTask } from '../modules/devices/sweep.js';
import { examSweepTask } from '../modules/exams/sweep.js';
import { assignmentReminderTask } from '../modules/assignments/reminders.js';
import { opsTasks } from './opsTasks.js';
import { storageSweepTask } from './storageSweep.js';
import { tmpSweepTask } from './tmpSweep.js';

export const maintenanceTasks: PeriodicTask[] = [
  retentionTask,
  deviceSweepTask,
  examSweepTask,
  assignmentReminderTask,
  ...opsTasks,
  storageSweepTask,
  tmpSweepTask,
];
