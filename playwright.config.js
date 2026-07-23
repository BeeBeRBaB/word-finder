import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,          // the service-worker tests share one origin's cache
  workers: 1,
  reporter: [['list']],
  use: { baseURL: BASE, trace: 'on-first-retry' },
  webServer: {
    command: 'node tests/server.mjs',
    url: `${BASE}/index.html`,
    reuseExistingServer: true,   // Playwright still owns and kills the one it starts
    stdout: 'ignore',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, hasTouch: true },
    },
  ],
});
