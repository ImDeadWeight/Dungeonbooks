/**
 * @file End-to-end tests (e2e/): the browser version of the app (the Vite dev
 * server, data in localStorage) driven in Chromium. Each test seeds the data
 * it needs. Locally an already running `npm run dev` is reused.
 */
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:1440',
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1440',
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
