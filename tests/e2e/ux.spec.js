import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';

test('New theme mid-game asks to confirm; cancel keeps the board', async ({ page }) => {
  await page.goto('/?seed=1&theme=0');
  // Every `.w` chip's textContent is set from a word string in view.js, so it is
  // never actually null; see helpers.js's findWordInGrid for the same cast.
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await expect(page.locator('.w.done')).toHaveCount(1);
  await page.locator('#newbtn').click();
  await expect(page.locator('#confirm')).toBeVisible();
  await page.locator('#confirm-cancel').click();
  await expect(page.locator('#confirm')).toBeHidden();
  await expect(page.locator('.w.done')).toHaveCount(1);          // board intact
});

test('the win overlay can be dismissed, leaving the solved board', async ({ page }) => {
  await page.goto('/?seed=1&theme=0');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winclose').click();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('.w.done')).toHaveCount(12);         // board still there
});

test('progress and puzzle survive a reload', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/');                          // no seed -> a random puzzle that gets saved
  const grid1 = await page.locator('.cell').allTextContents();
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await expect(page.locator('.w.done')).toHaveCount(1);
  await page.reload();
  const grid2 = await page.locator('.cell').allTextContents();
  expect(grid2.join('')).toBe(grid1.join(''));   // same grid (seed restored)
  await expect(page.locator('.w.done')).toHaveCount(1);   // still crossed out
});
