import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('desktop shows the category art beside the board, under the word list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#app')).toHaveAttribute('data-art', 'rail');
  await expect(page.locator('#railart svg')).toBeVisible();
  await expect(page.locator('#railart svg')).toHaveAttribute('data-motif', 'space');
  await expect(page.locator('#art')).toBeHidden();
  // Never behind a letter: the rail art starts below the last word.
  const list = await page.locator('#list').boundingBox(), art = await page.locator('#railart').boundingBox();
  expect(/** @type {any} */ (art).y).toBeGreaterThanOrEqual(/** @type {any} */ (list).y + /** @type {any} */ (list).height);
});

test('a phone shows it faintly behind the board instead', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=animals/dogs');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#app')).toHaveAttribute('data-art', 'board');
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
  await expect(page.locator('#railart svg')).toHaveAttribute('data-motif', 'food');
});

test('the Background page switches the art and is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.waitForSelector('#letters .cell');
  await page.locator('#appearance').click();
  await page.locator('#settings-bg').click();
  await page.locator('.bgtile[data-bg="pixel"]').click();
  await expect(page.locator('#railart svg')).toHaveAttribute('data-kind', 'pixel');
  await page.locator('.bgtile[data-bg="none"]').click();
  await expect(page.locator('#railart svg')).toHaveCount(0);
  await expect(page.locator('#art svg')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#railart svg')).toHaveCount(0);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background None');
  await page.locator('#settings-bg').click();
  await expect(page.locator('.bgtile[data-bg="none"] input')).toBeChecked();
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
