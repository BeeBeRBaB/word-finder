import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

import { DEVICES, measure } from '../viewport.js';

for (const d of DEVICES) {
  test.describe(`${d.name} (${d.w}x${d.h})`, () => {
    // Set here, not with setViewportSize() inside the test: the preset is resolved
    // during boot, and a viewport applied after goto() would measure every phone
    // against a desktop board.
    test.use({ viewport: { width: d.w, height: d.h } });

    test('layout fits', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'viewport is set explicitly');
      // Pinned so the shape under test is the only variable: a random deal would vary
      // the longest word and the subject-name length, both of which move the layout.
      await page.goto('/?subject=nature/birds');
      await page.waitForTimeout(250);
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
    test('deals the board this device should get', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'viewport is set explicitly');
      await page.goto('/?subject=nature/birds');   // pinned; see the note on the test above
      await expect(page.locator('.cell')).toHaveCount(Math.min(d.w, d.h) < 480 ? 100 : 169);
    });
  });
}
