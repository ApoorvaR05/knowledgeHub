import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration.
 *
 * Tests run against the full stack:
 *   - client  → http://localhost:3000  (or VITE_BASE_URL)
 *   - server  → http://localhost:4000  (or API_BASE_URL)
 *
 * In CI, start the stack first with `docker compose up -d` then run tests.
 * Locally, you can point at the Vite dev server + Express dev server.
 */

const BASE_URL = process.env.VITE_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // run sequentially — tests share state (DB, sessions)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['line']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
