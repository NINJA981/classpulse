process.env.CP_PROCESS_NAME ??= 'worker';

const { env } = await import('./config/env.js');
const { logger } = await import('./lib/logger.js');

if (!env.REDIS_URL) {
  logger.info('REDIS_URL not set — the API process runs jobs in-process; standalone worker idle.');
} else {
  const { closeDb, pingDb } = await import('./db/client.js');
  const { closeRedis, getRedis } = await import('./lib/redis.js');
  const { flushLogSink } = await import('./lib/logSink.js');
  const { storage } = await import('./lib/storage.js');
  const { startLessonWorker } = await import('./jobs/lessonWorker.js');
  const { startPeriodicTasks } = await import('./jobs/periodic.js');
  const { maintenanceTasks } = await import('./jobs/tasks.js');
  const { recoverStuckLessons } = await import('./jobs/lessonGeneration.js');
  const { closeQueue } = await import('./jobs/queue.js');
  const { closeEmailQueue, startEmailWorker } = await import('./jobs/emailQueue.js');
  const { closeMailer } = await import('./lib/mailer.js');
  const { closeResourceQueue, startResourceWorker } = await import('./modules/resources/queue.js');

  await pingDb();
  await storage.ensureWritable();
  if (env.E2E_MAIL_CAPTURE) (await import('./modules/testing/mailCapture.js')).installMailCapture();
  const worker = startLessonWorker();
  const emailWorker = startEmailWorker();
  const resourceWorker = startResourceWorker();
  const periodic = startPeriodicTasks(maintenanceTasks);

  // Liveness for the platform health page: a short-lived key refreshed every 15 s.
  const heartbeatStartedAt = new Date().toISOString();
  const beat = () =>
    getRedis()
      ?.set(
        'cp:worker:heartbeat',
        JSON.stringify({ pid: process.pid, startedAt: heartbeatStartedAt, at: new Date().toISOString(), version: process.env.SOURCE_COMMIT ?? 'dev' }),
        'EX',
        60,
      )
      .catch((err: unknown) => logger.warn({ err: (err as Error).message }, 'Worker heartbeat failed'));
  void beat();
  const heartbeat = setInterval(() => void beat(), 15_000);
  // A failed recovery pass (e.g. the database is mid-migration) must not take the worker down with it.
  await recoverStuckLessons().catch((err: unknown) => logger.error({ err }, 'Stuck-lesson recovery failed; continuing'));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down');
    periodic.stop();
    clearInterval(heartbeat);
    await worker.close();
    await emailWorker.close();
    await resourceWorker.close();
    await closeQueue();
    await closeEmailQueue();
    await closeResourceQueue();
    await closeMailer();
    await closeRedis();
    await flushLogSink();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
