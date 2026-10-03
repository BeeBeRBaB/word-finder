import { defineConfig, devices } from '@playwright/test';
import { device } from './tests/viewport.js';

// PORT moves the whole run, server included (tests/server.mjs reads it too), so a second
// checkout can test itself instead of reusing a server another checkout left on 5173.
const BASE = `http://localhost:${process.env.PORT || 5173}`;

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
      use: { ...devices['Desktop Chrome'], viewport: { width: device('Desktop').w, height: device('Desktop').h } },
    },
    // Layout again in WebKit: Safari applied no stylesheet until the cross-origin font sheet
    // arrived, so the first layout sized the board without #app's padding and overflowed.
    // Chromium cannot show that, so only this engine catches it.
    {
      name: 'safari',
      testMatch: /layout\.spec\.js/,
      use: { ...devices['Desktop Safari'], viewport: { width: device('Desktop').w, height: device('Desktop').h } },
    },
    // Only the specs whose behaviour actually depends on the viewport or on touch.
    // `gameplay` is the real reason this project exists — `hasTouch` routes drags
    // through touch pointer events rather than mouse ones. `smoke` is a cheap
    // "does it render at all on a phone" check. Everything else (service worker,
    // themes, dialogs) is viewport-independent, and running it twice only bought
    // a slower suite. `layout.spec.js` sets its own viewports, so listing it here
    // would only run the same shapes again.
    {
      name: 'mobile',
      testMatch: /(gameplay|smoke)\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: device('iPhone 13 portrait').w, height: device('iPhone 13 portrait').h }, hasTouch: true },
    },
  ],
});
