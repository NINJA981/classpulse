import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, db } from './client.js';
import { logger } from '../lib/logger.js';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

try {
  await migrate(db, { migrationsFolder });
  logger.info('Database migrations applied');
} catch (err) {
  logger.fatal({ err }, 'Database migration failed');
  process.exitCode = 1;
} finally {
  await closeDb();
}
