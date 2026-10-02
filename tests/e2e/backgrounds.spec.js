import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

// The animated modules load on first use; a cached copy must not stand in for the one under test.
test.use({ serviceWorkers: 'block' });

/** @param {Page} page */
async function openPage(page) {
  await page.locator('#appearance').click();
  await page.locator('#settings-bg').click();
  await expect(page.locator('#settings-bgpage')).toBeVisible();
}

test('the Background page has a tile per background, marked Still or Animated', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  const tiles = page.locator('.bgtile');
  await expect(tiles).toHaveCount(12);
  await expect(page.locator('.bgtile[data-bg="aurora"] .bgbadge')).toHaveText('Animated');
  await expect(page.locator('.bgtile[data-bg="pixel"] .bgbadge')).toHaveText('Still');
  // The current choice has focus, so the arrow keys move through the choices at once.
  await expect(page.locator('.bgtile[data-bg="illustrated"] input')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bgtile[data-bg="pixel"] input')).toBeChecked();
  // Every tile is a 44px target.
  for (const box of await tiles.evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
});

test('an animated background runs behind the word list, then the whole page, and stops for a still one', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="aurora"]').click();
  await expect(page.locator('#bgside canvas')).toHaveCount(1);
  await expect(page.locator('#bg canvas')).toHaveCount(0);
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await expect(page.locator('#bgside canvas')).toHaveCount(0);
  // Under the page: it takes no clicks, and the board still paints over it.
  await page.keyboard.press('Escape');
  expect(await page.locator('#bg').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  const top = await page.evaluate(() => {
    const r = /** @type {HTMLElement} */ (document.getElementById('gridbox')).getBoundingClientRect();
    return document.elementFromPoint(r.x + 5, r.y + 5)?.closest('#gridbox') !== null;
  });
  expect(top).toBe(true);
  await openPage(page);
  await page.locator('.bgtile[data-bg="pixel"]').click();
  await expect(page.locator('#bg canvas, #bgside canvas')).toHaveCount(0);
});

test('the choice and area are remembered, and a new deal keeps the background running', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="starfield"]').click();
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await page.reload();
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  const canvas = await page.locator('#bg canvas').elementHandle();
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText('Jupiter');
  // The same canvas: an ordinary background is not restarted by a deal.
  expect(await page.evaluate(c => c?.isConnected, canvas)).toBe(true);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Starfield');
});

test('Back returns to Settings and its row; Escape closes the pane from the page', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('#bg-back').click();
  await expect(page.locator('#settings-bgpage')).toBeHidden();
  await expect(page.locator('#settings-body')).toBeVisible();
  await expect(page.locator('#settings-bg')).toBeFocused();
  await page.locator('#settings-bg').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  // Opening again starts on the main page.
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-body')).toBeVisible();
  await expect(page.locator('#settings-bgpage')).toBeHidden();
});

test('on a phone the page is full screen with Back, and Full screen still art leaves the board corner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#art svg')).toBeVisible();
  await openPage(page);
  const card = await page.locator('#settingscard').boundingBox();
  // Read mid-slide, the translate leaves a few millionths of a pixel on the width.
  expect(card?.width).toBeCloseTo(390, 1);
  await expect(page.locator('#bg-back')).toBeVisible();
  await expect(page.locator('#bg-close')).toBeHidden();
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await page.locator('#bg-back').click();
  await page.locator('#settings-back').click();
  // Fixed to the page now, not clipped inside the board.
  expect(await page.locator('#art').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  const art = await page.locator('#art svg').boundingBox();
  const board = await page.locator('#gridbox').boundingBox();
  expect((art?.y ?? 0) + (art?.height ?? 0)).toBeGreaterThan((board?.y ?? 0) + (board?.height ?? 0));
});
