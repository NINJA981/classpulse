process.env.CP_PROCESS_NAME ??= 'worker';

const { env } = await import('./config/env.js');
const { logger } = await import('./lib/logger.js');

if (!env.REDIS_URL) {
  logger.info('REDIS_URL not set — the API process runs jobs in-process; standalone worker idle.');
} else {
  const { closeDb, pingDb } = await import('./db/client.js');
  const { closeRedis } = await import('./lib/redis.js');
  const { storage } = await import('./lib/storage.js');
  const { startLessonWorker } = await import('./jobs/lessonWorker.js');
  const { startPeriodicTasks } = await import('./jobs/periodic.js');
  const { maintenanceTasks } = await import('./jobs/tasks.js');
  const { recoverStuckLessons } = await import('./jobs/lessonGeneration.js');
  const { closeQueue } = await import('./jobs/queue.js');

  await pingDb();
  await storage.ensureWritable();
  const worker = startLessonWorker();
  const periodic = startPeriodicTasks(maintenanceTasks);
  // A failed recovery pass (e.g. the database is mid-migration) must not take the worker down with it.
  await recoverStuckLessons().catch((err: unknown) => logger.error({ err }, 'Stuck-lesson recovery failed; continuing'));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down');
    periodic.stop();
    await worker.close();
    await closeQueue();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
