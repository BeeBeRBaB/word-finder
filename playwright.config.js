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
  // pickPreset reads window.screen, which in headless Chromium always mirrors the
  // viewport — Playwright's `screen` option is accepted and then ignored. So each
  // project's viewport is what selects its preset: desktop gets the 13x13 board,
  // mobile the 10x10 one. The production behaviour this cannot reach — a real
  // desktop screen staying 1440px wide while its window is dragged narrow — is
  // covered by pickPreset's unit tests instead.
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Only the specs whose behaviour actually depends on the viewport or on touch.
    // `gameplay` is the real reason this project exists — `hasTouch` routes drags
    // through touch pointer events rather than mouse ones. `smoke` is a cheap
    // "does it render at all on a phone" check. Everything else (service worker,
    // palettes, dialogs) is viewport-independent, and running it twice only bought
    // a slower suite. `layout.spec.js` sets its own viewports and skips outside
    // `desktop`, so it must not be listed here.
    {
      name: 'mobile',
      testMatch: /(gameplay|smoke)\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, hasTouch: true },
    },
  ],
});
