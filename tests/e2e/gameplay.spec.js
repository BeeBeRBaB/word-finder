import { test, expect } from '@playwright/test';
import { findWordInGrid, findDiagonalWord, dragCells } from './helpers.js';

test('dragging across a word finds it', async ({ page }) => {
  await page.goto('/');
  const sel = await findWordInGrid(page);
  await dragCells(page, sel);
  await expect(page.locator('#count')).toContainText('1 of 12 found');
  await expect(page.locator('#pills .pill')).toHaveCount(1);
});

test('dragging across nonsense finds nothing', async ({ page }) => {
  await page.goto('/');
  // A single cell can never match a word, and leaves no pill behind.
  await dragCells(page, { x0: 0, y0: 0, x1: 0, y1: 0 });
  await expect(page.locator('#count')).toContainText('0 of 12 found');
  await expect(page.locator('#pills .pill')).toHaveCount(0);
});

test('a found word glows green, then crosses out', async ({ page }) => {
  await page.goto('/');
  const sel = await findWordInGrid(page);
  await dragCells(page, sel);
  const chip = page.locator('.w', { hasText: new RegExp(`^${sel.word}$`, 'i') });
  // The green glow is applied synchronously on pointerup, so it is already
  // present by the time dragCells resolves; the strike-through follows GLOW_MS
  // later. Both assertions auto-retry, so they observe the two states in order.
  await expect(chip).toHaveClass(/\bglow\b/);
  await expect(chip).toHaveClass(/\bdone\b/);
});

test('clicking a word list item does nothing', async ({ page }) => {
  await page.goto('/');
  const chip = page.locator('.w').first();
  await chip.click();
  await expect(chip).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toContainText('0 of 12 found');
});

test('finding every word raises the win overlay', async ({ page }) => {
  await page.goto('/');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) {
    await dragCells(page, await findWordInGrid(page, w.toUpperCase()));
  }
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#winmsg')).toContainText('You found every');
});

test('a diagonal word is selectable without overshoot', async ({ page }) => {
  // Seed 1 with theme 0 is pinned because it is known to contain a
  // diagonally-placed word; findDiagonalWord throws if none exist, and an
  // unseeded puzzle only has a diagonal word most of the time (not always).
  await page.goto('/?seed=1&theme=0');
  const sel = await findDiagonalWord(page);
  await dragCells(page, sel);
  await expect(page.locator('#count')).toContainText('1 of 12 found');
});

test('the same seed reproduces the same puzzle', async ({ page }) => {
  await page.goto('/?seed=12345&theme=0');
  const a = await page.locator('.cell').allTextContents();
  const themeA = await page.locator('#theme').textContent();
  await page.goto('/?seed=12345&theme=0');
  const b = await page.locator('.cell').allTextContents();
  expect(b.join('')).toBe(a.join(''));
  expect(await page.locator('#theme').textContent()).toBe(themeA);

  await page.goto('/?seed=999&theme=0');
  const c = await page.locator('.cell').allTextContents();
  expect(c.join('')).not.toBe(a.join(''));   // different seed, different grid
});
