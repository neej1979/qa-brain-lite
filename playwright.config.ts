import { defineConfig, devices } from '@playwright/test';

// CI-friendly defaults via env vars
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL ?? APP_BASE_URL; // use a separate var if API differs

export default defineConfig({
  testDir: 'examples',                     // ui/, api/, llm-evals/ live here
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Retries & workers tuned for CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 3 : undefined,

  // JSON for gating + HTML for local debugging
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }], ['html']],

  use: {
    baseURL: APP_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Two projects so you can target UI vs API separately if you want
  projects: [
    {
      name: 'ui-chromium',
      testMatch: /.*\/ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: /.*\/api\/.*\.spec\.ts/,
      use: {
        // For API specs, override baseURL to API if separate
        baseURL: API_BASE_URL,
      },
    },
    // Add other browsers if needed:
    // { name: 'ui-firefox', testMatch: /ui/, use: { ...devices['Desktop Firefox'] } },
  ],

  // Allow `--grep` via CI without hardcoding here.
});
