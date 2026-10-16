import { test, expect } from '@playwright/test';
import { handPickedBackground, pickBackground } from './helpers.js';

test.use({ serviceWorkers: 'block' });
// The category art shows for the Illustrated and Pixel art backgrounds; a new player's Theme mode
// may show another, so these start from Illustrated.
test.beforeEach(({ page }) => handPickedBackground(page));

test('desktop shows the category art large in the page\'s bottom corner', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#art svg')).toBeVisible();
  await expect(page.locator('#art svg')).toHaveAttribute('data-motif', 'space');
  // It runs off the bottom right edge, past the board.
  const art = /** @type {any} */ (await page.locator('#art svg').boundingBox());
  const board = /** @type {any} */ (await page.locator('#gridbox').boundingBox());
  expect(art.x + art.width).toBeGreaterThan(1440);
  expect(art.y + art.height).toBeGreaterThan(900);
  expect(art.x + art.width).toBeGreaterThan(board.x + board.width);
});

test('a phone shows it faintly behind the board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=animals/dogs');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#art svg')).toHaveAttribute('data-motif', 'animals');
  await expect(page.locator('#art svg')).toBeVisible();
  // Under the letters, and it takes no clicks: a drag still starts on the grid.
  expect(await page.locator('#art').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
});

test('a new subject redraws the art for its category', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.waitForSelector('#letters .cell');
  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await expect(page.locator('#art svg')).toHaveAttribute('data-motif', 'food');
});

test('the Background page switches the art and is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.waitForSelector('#letters .cell');
  await page.locator('#appearance').click();
  await page.locator('#settings-bg').click();
  await pickBackground(page, 'pixel');
  await expect(page.locator('#art svg')).toHaveAttribute('data-kind', 'pixel');
  await pickBackground(page, 'none');
  await expect(page.locator('#art svg')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#art svg')).toHaveCount(0);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background None');
  await page.locator('#settings-bg').click();
  await expect(page.getByRole('button', { name: 'Still None' })).toBeVisible();
});

test('Reveal a word finds one hidden word, and the last one wins', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  const total = await page.locator('.w').count();
  await page.locator('#reveal').click();
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
  await expect(page.locator('#pills .pill')).toHaveCount(1);
  for (let i = 1; i < total; i++) await page.locator('#reveal').click();
  await expect(page.locator('#count')).toContainText(`${total} of ${total} found`);
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#reveal')).toBeHidden();   // nothing left to reveal
});
