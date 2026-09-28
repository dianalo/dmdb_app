import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4173/dmdb_app/';

/**
 * E2E-Smoke-Tests (PLAN.md, «Test-Matrix»): Chromium, Firefox, WebKit und iPad
 * (hoch und quer, mit Touch). Jeder Test bekommt einen frischen Browser-Kontext,
 * also auch eine leere IndexedDB.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'] } },
  ],
});
