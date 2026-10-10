/**
 * Periodic maintenance tasks. Run in exactly one process: the worker when
 * Redis is configured, otherwise inside the API process.
 */
import { logger } from '../lib/logger.js';

export interface PeriodicTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

export function startPeriodicTasks(tasks: PeriodicTask[]): { stop(): void } {
  const timers: NodeJS.Timeout[] = [];
  for (const task of tasks) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await task.run();
      } catch (err) {
        logger.error({ err, task: task.name }, 'Periodic task failed');
      } finally {
        running = false;
      }
    };
    timers.push(setInterval(tick, task.intervalMs));
    setTimeout(tick, 5_000).unref();
  }
  logger.info({ tasks: tasks.map((t) => t.name) }, 'Periodic tasks started');
  return { stop: () => timers.forEach(clearInterval) };
}
