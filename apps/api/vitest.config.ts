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
      // Web Push off unless a test installs a key pair (test/notifications*.test.ts).
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      // Fixed inbox for "Book a demo" requests (test/demo-requests.test.ts).
      DEMO_REQUEST_TO: 'demo-inbox@benx.test',
    },
  },
});
