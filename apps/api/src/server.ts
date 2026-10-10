import { createServer } from 'node:http';
import { env } from './config/env.js';
import { closeDb, pingDb } from './db/client.js';
import { logger } from './lib/logger.js';
import { closeRedis } from './lib/redis.js';
import { storage } from './lib/storage.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { closeQueue } from './jobs/queue.js';
import { startLessonWorker, type LessonWorkerHandle } from './jobs/lessonWorker.js';
import { startPeriodicTasks } from './jobs/periodic.js';
import { maintenanceTasks } from './jobs/tasks.js';
import { recoverStuckLessons } from './jobs/lessonGeneration.js';

await pingDb().catch((err: Error) => {
  logger.fatal({ err: err.message }, 'Cannot reach PostgreSQL — is DATABASE_URL correct and the database running?');
  process.exit(1);
});
await storage.ensureWritable();

const app = createApp();
const server = createServer(app);
// Outlive the reverse proxy's pooled idle connections (Caddy keepalive 30 s). With Node's 5 s default, the proxy
// can reuse a socket at the moment Node closes it and the client never gets its response.
server.keepAliveTimeout = 75_000;
server.headersTimeout = 76_000;
const sockets = attachSockets(server);

// Without Redis (dev only) the API process also runs the generation worker and maintenance tasks.
let worker: LessonWorkerHandle | null = null;
let periodic: { stop(): void } | null = null;
if (!env.REDIS_URL) {
  logger.warn('REDIS_URL not set — running generation jobs and maintenance tasks in-process (development mode)');
  worker = startLessonWorker();
  periodic = startPeriodicTasks(maintenanceTasks);
  void recoverStuckLessons();
}

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ClassPulse API listening');
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  const force = setTimeout(() => process.exit(1), 15_000).unref();
  server.close();
  periodic?.stop();
  await sockets.close();
  await worker?.close();
  await closeQueue();
  await closeRedis();
  await closeDb();
  clearTimeout(force);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));
