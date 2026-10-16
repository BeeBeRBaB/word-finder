import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

import { DEVICES, measure } from '../viewport.js';
import { openBoard } from './helpers.js';

for (const d of DEVICES) {
  test.describe(`${d.name} (${d.w}x${d.h})`, () => {
    // Set here, not with setViewportSize() inside the test: the preset is resolved
    // during boot, and a viewport applied after goto() would measure every phone
    // against a desktop board.
    test.use({ viewport: { width: d.w, height: d.h } });

    test('layout fits', async ({ page }) => {
      // Pinned so the shape under test is the only variable: a random deal would vary
      // the longest word and the subject-name length, both of which move the layout.
      await openBoard(page, '/?subject=nature/birds');
      const m = await measure(page);

      expect(m.offscreenWords, `words off screen: ${m.offscreenWords.join(', ')}`).toHaveLength(0);
      // All four edges. The left one is checked nowhere else and cannot be scrolled
      // to -- a centring change once put a board's whole first column out there and
      // every one of these tests still passed.
      expect(m.offscreenCells, 'grid cells off screen').toBe(0);
      expect(m.gridOverflowY, 'grid extends below the viewport').toBeLessThanOrEqual(0);
      expect(m.gridOverflowX, 'grid extends past the right edge').toBeLessThanOrEqual(0);
      expect(m.clippedY, 'content clipped vertically by #app').toBe(0);
      expect(m.clippedX, 'content clipped horizontally by #app').toBe(0);
    });

    // min(viewport) under 480 is the compact board. Asserted per device because
    // "the layout fits" passes just as well when the wrong board is on screen.
    test('deals the board this device should get', async ({ page }) => {
      await page.goto('/?subject=nature/birds');   // pinned; see the note on the test above
      await expect(page.locator('.cell')).toHaveCount(Math.min(d.w, d.h) < 480 ? 100 : 169);
    });
  });
}

// An iPad Home Screen app opens in a window still growing to the screen, and iPadOS scales the
// frame on screen until the page lays out again, so a board shown at launch opened zoomed in.
// WebKit only: Chromium's `screen` mirrors the viewport, so it cannot hold a screen apart from it.
test.describe('Home Screen launch', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'needs a screen apart from the viewport');
  test.use({ viewport: { width: 590, height: 410 } });

  /** Pretends to be a Home Screen app on an 820x1180 iPad, as iOS reports its screen held either
   * way, and times when the curtain lifts.
   * @param {Page} page @param {{w:number, h:number}} [screen] @returns {Promise<void>} */
  async function launch(page, screen = { w: 820, h: 1180 }) {
    await page.addInitScript((s) => {
      Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true });
      Object.defineProperty(Screen.prototype, 'width', { get: () => s.w });
      Object.defineProperty(Screen.prototype, 'height', { get: () => s.h });
      const w = /** @type {any} */ (window);
      new MutationObserver(() => {
        if (!document.documentElement.hasAttribute('data-booting') && !w.liftedAt) {
          w.liftedAt = performance.now();
          w.liftedWidth = innerWidth;
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-booting'] });   // no <html> yet
    }, screen);
    await page.goto('/?subject=nature/birds');
    await page.locator('.cell').first().waitFor({ state: 'attached' });
  }
  const lifted = (/** @type {Page} */ page) => page.evaluate(() => /** @type {any} */ (window).liftedAt || 0);

  test('shows the board only once the window fills the screen, laid out for it', async ({ page }) => {
    await launch(page);
    expect(await lifted(page), 'curtain lifted while the window was still growing').toBe(0);
    const grownAt = await page.evaluate(() => performance.now());
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForFunction(() => /** @type {any} */ (window).liftedAt);
    const at = await page.evaluate(() => ({ t: /** @type {any} */ (window).liftedAt, w: /** @type {any} */ (window).liftedWidth }));
    expect(at.w).toBe(1180);
    // Well inside the 500ms quiet wait: filling the screen lifts it, not the timer.
    expect(at.t - grownAt).toBeLessThan(200);
    const m = await measure(page);
    expect(m.gridOverflowY, 'grid extends below the viewport').toBeLessThanOrEqual(0);
    expect(m.offscreenCells, 'grid cells off screen').toBe(0);
  });

  test('a window that settles short of the screen still shows', async ({ page }) => {
    await launch(page);
    await page.waitForFunction(() => /** @type {any} */ (window).liftedAt, null, { timeout: 1000 });
    const at = await page.evaluate(() => ({ t: /** @type {any} */ (window).liftedAt, w: /** @type {any} */ (window).liftedWidth }));
    expect(at.w).toBe(590);
    await expect(page.locator('.cell')).toHaveCount(169);   // the iPad's board, so the wait was the iPad's
  });

  test('an iPhone Home Screen app shows its board at once, as before', async ({ page }) => {
    await launch(page, { w: 390, h: 844 });
    expect(await lifted(page), 'curtain still up once the board was dealt').toBeGreaterThan(0);
  });
});
