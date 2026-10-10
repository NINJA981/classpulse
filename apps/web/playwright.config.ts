import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a live stack (`npm run dev` + seeded DB, or the
 * production compose stack via E2E_BASE_URL=https://localhost).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
