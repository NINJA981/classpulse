import { afterAll, beforeEach } from 'vitest';
import { closeDb } from '../src/db/client.js';
import { resetDatabase } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});
