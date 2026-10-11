import { defineConfig } from 'vitest/config';

const testDbUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://classpulse:classpulse@localhost:5432/classpulse_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    setupFiles: ['test/setup.ts'],
    // Integration tests share one database — run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      REDIS_URL: '',
      JWT_SECRET: 'test-secret-0123456789abcdef0123456789',
      STORAGE_DIR: './.test-storage',
      PUBLIC_ORIGIN: 'http://localhost:3000',
      SARVAM_API_KEY: '',
      OPENAI_API_KEY: '',
      LOG_LEVEL: 'silent',
      // Never inherit a developer's local .env e2e switches.
      E2E_MAIL_CAPTURE: 'false',
    },
  },
});
