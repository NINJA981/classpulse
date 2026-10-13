import { defineConfig } from 'vitest/config';

const testDbUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://classpulse:classpulse@localhost:5432/classpulse_test';

/**
 * S3 test target (`vitest --mode s3`, i.e. `npm run test:s3`): the dev Garage from
 * infra/docker-compose.dev.yml unless overridden with S3_TEST_ENDPOINT, S3_TEST_BUCKET,
 * S3_TEST_REGION, S3_TEST_ACCESS_KEY_ID and S3_TEST_SECRET_ACCESS_KEY. The same variables enable the
 * S3 half of test/storage-driver.test.ts in a normal run.
 */
const s3Test = {
  S3_TEST_ENDPOINT: process.env.S3_TEST_ENDPOINT ?? '',
  S3_TEST_BUCKET: process.env.S3_TEST_BUCKET ?? 'classpulse-test',
  S3_TEST_REGION: process.env.S3_TEST_REGION ?? 'garage',
  S3_TEST_ACCESS_KEY_ID: process.env.S3_TEST_ACCESS_KEY_ID ?? '',
  S3_TEST_SECRET_ACCESS_KEY: process.env.S3_TEST_SECRET_ACCESS_KEY ?? '',
};

export default defineConfig(({ mode }) => {
  const s3 = mode === 's3';
  if (s3) {
    s3Test.S3_TEST_ENDPOINT ||= 'http://localhost:3900';
    // Dev-only Garage key from infra/docker-compose.dev.yml (never valid anywhere else).
    s3Test.S3_TEST_ACCESS_KEY_ID ||= 'GK0123456789abcdef01234567';
    s3Test.S3_TEST_SECRET_ACCESS_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';  // gitleaks:allow (dev/test-only fake value)
    // For test/s3GlobalSetup.ts, which runs in this (main) process.
    Object.assign(process.env, s3Test);
  }
  return {
    test: {
      environment: 'node',
      include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
      globalSetup: s3 ? ['test/globalSetup.ts', 'test/s3GlobalSetup.ts'] : ['test/globalSetup.ts'],
      setupFiles: ['test/setup.ts'],
      // Integration tests share one database — run files sequentially.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 60_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        REDIS_URL: '',
        JWT_SECRET: 'test-secret-0123456789abcdef0123456789',  // gitleaks:allow (dev/test-only fake value)
        STORAGE_DIR: './.test-storage',
        TMP_DIR: '',
        ...s3Test,
        // The app's own storage: local unless running in s3 mode.
        STORAGE_DRIVER: s3 ? 's3' : 'local',
        S3_ENDPOINT: s3 ? s3Test.S3_TEST_ENDPOINT : '',
        S3_BUCKET: s3Test.S3_TEST_BUCKET,
        S3_REGION: s3Test.S3_TEST_REGION,
        S3_ACCESS_KEY_ID: s3 ? s3Test.S3_TEST_ACCESS_KEY_ID : '',
        S3_SECRET_ACCESS_KEY: s3 ? s3Test.S3_TEST_SECRET_ACCESS_KEY : '',
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
  };
});
