import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Apply migrations to the test database once per run. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://classpulse:classpulse@localhost:5432/classpulse_test';
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(here, '../src/db/migrations') });
  } finally {
    await pool.end();
  }
}
