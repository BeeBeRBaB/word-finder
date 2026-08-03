import { test, expect } from '@playwright/test';
import { findAndDrag } from './helpers.js';

// Word coverage. The two tests that matter most here are the reproduction opt-outs: both
// fail silently if they regress, because a double-advanced bag or a seed-dependent grid
// still renders a perfectly normal-looking board.

const KEY = 'wordfinder-progress-v1';
/** @param {import('@playwright/test').Page} page */
const record = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

test('a restored board neither re-draws the bag nor re-counts a puzzle', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  const before = await record(page);
  expect(Object.keys(before.bags || {}).length, 'the first deal must have filled a bag').toBe(1);

  await page.reload();
  await page.waitForSelector('#letters .cell');
  const after = await record(page);
  expect(after.bags).toEqual(before.bags);
  expect(after.puzzles).toEqual(before.puzzles);

  // Twice, because a double-advance is cumulative and one reload could coincide.
  await page.reload();
  await page.waitForSelector('#letters .cell');
  expect((await record(page)).bags).toEqual(before.bags);
});

test('a pinned seed is neither steered by the bag nor recorded in it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  const grid = (await page.locator('.cell').allTextContents()).join('');
  expect((await record(page)).bags?.['nature/birds'], 'a pinned puzzle must not consume the bag').toBeUndefined();

  // Give that subject a bag with a different shape, then reload the same URL. A pinned
  // seed that consulted coverage would now deal a different grid.
  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify({
      v: 1, puzzles: 0, favourLeastSeen: true,
      bags: { 'nature/birds': { n: 105, c: 0, d: '/////////////w==' } }, sizes: {},
    }));
  }, KEY);
  await page.reload();
  await page.waitForSelector('#letters .cell');
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(grid);
});

test('playing one subject twice deals a different word set', async ({ page }) => {
  await page.goto('/?subject=nature/birds');
  await page.waitForSelector('#list .w');
  const first = (await page.locator('#list .w').allTextContents()).sort().join(',');

  // Clear only the board save, so the next load deals fresh from the same subject while
  // the coverage record survives.
  await page.evaluate(() => localStorage.removeItem('wordfinder-save-v1'));
  await page.goto('/?subject=nature/birds');
  await page.waitForSelector('#list .w');
  const second = (await page.locator('#list .w').allTextContents()).sort().join(',');
  expect(second).not.toEqual(first);
});

test('solving a puzzle counts it, and an unsolved one does not', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#list .w');
  expect((await record(page)).puzzles ?? 0).toBe(0);

  const words = await page.locator('#list .w').allTextContents();
  for (const w of words.slice(0, -1)) await findAndDrag(page, w.toUpperCase());
  expect((await record(page)).puzzles ?? 0, 'one word short is not a solve').toBe(0);

  await findAndDrag(page, words[words.length - 1].toUpperCase());
  await expect(page.locator('#win')).toBeVisible();
  expect((await record(page)).puzzles).toBe(1);
});
