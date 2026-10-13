import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.TEST_PORT || '5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: process.env.TEST_BASE_URL || `http://127.0.0.1:${testPort}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: 'chrome'
  },
  webServer: {
    command: `pnpm exec vite --host 0.0.0.0 --port ${testPort} --strictPort`,
    url: `http://127.0.0.1:${testPort}/s/atelier/`,
    reuseExistingServer: !process.env.CI && !process.env.TEST_PORT,
    timeout: 60_000
  }
});
