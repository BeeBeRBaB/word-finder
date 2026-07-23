import { defineConfig, devices } from '@playwright/test';

// Runs against the deployed site. No webServer — this is the real thing, and it
// only makes sense after `git push` and a Pages build.
export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://beeberbab.github.io/word-finder/',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'live', use: { ...devices['Desktop Chrome'] } }],
});
