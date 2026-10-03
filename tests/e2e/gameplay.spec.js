import { test, expect } from '@playwright/test';
import { findDiagonalWord, findAndDrag, findRunsInGrid, dragCells, touchDrag, cellCentre, openBoard } from './helpers.js';

// Every unseeded goto() below is pinned to ?subject=nature/birds: none of these tests care
// which subject loads, and one subject keeps a failure easy to reproduce.

test('dragging across a word finds it', async ({ page }) => {
  await page.goto('/?subject=nature/birds');
  // findAndDrag, not findWordInGrid: a word's letters can read at several runs but it is
  // placed at exactly one, and these boards are clock-seeded, so taking the first match
  // would fail on whichever run happened to be a ghost.
  const first = /** @type {string} */ (await page.locator('.w').first().textContent());
  await findAndDrag(page, first.toUpperCase());
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
  await expect(page.locator('#pills .pill')).toHaveCount(1);
});

// The phone's own path: a finger, which the page sees as touch pointers, not a mouse.
test('a finger dragging across a word finds it', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch input needs a touch device');
  await openBoard(page, '/?subject=nature/birds');
  await page.evaluate(() => {
    for (const t of ['pointerdown', 'pointerup']) document.addEventListener(t, (e) => { document.body.dataset[t] = /** @type {PointerEvent} */ (e).pointerType; }, true);
  });
  const first = /** @type {string} */ (await page.locator('.w').first().textContent());
  await findAndDrag(page, first.toUpperCase(), touchDrag);
  await expect(page.locator('body')).toHaveAttribute('data-pointerdown', 'touch');
  await expect(page.locator('body')).toHaveAttribute('data-pointerup', 'touch');
  await expect(page.locator('#pills .pill')).toHaveCount(1);
});

test('dragging across nonsense finds nothing', async ({ page }) => {
  await page.goto('/?subject=nature/birds');
  // A single cell can never match a word, and leaves no pill behind.
  await dragCells(page, { x0: 0, y0: 0, x1: 0, y1: 0 });
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`0 of ${total} found`);
  await expect(page.locator('#pills .pill')).toHaveCount(0);
});

test('a found word glows, then crosses out', async ({ page }) => {
  await page.goto('/?subject=nature/birds');
  const first = /** @type {string} */ (await page.locator('.w').first().textContent());
  const sel = await findAndDrag(page, first.toUpperCase());
  const chip = page.locator('.w', { hasText: new RegExp(`^${sel.word}$`, 'i') });
  // The glow is applied synchronously on pointerup, so it is already
  // present by the time dragCells resolves; the strike-through follows GLOW_MS
  // later. Both assertions auto-retry, so they observe the two states in order.
  await expect(chip).toHaveClass(/\bglow\b/);
  await expect(chip).toHaveClass(/\bdone\b/);
});

// An OS gesture or an incoming call takes the pointer over with pointercancel: not a release.
test('a drag the browser cancels claims nothing', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const word = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  for (const run of await findRunsInGrid(page, word)) {
    const a = await cellCentre(page, run.x0, run.y0), b = await cellCentre(page, run.x1, run.y1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.locator('#gridbox').dispatchEvent('pointercancel', { isPrimary: true });
    await page.mouse.up();
  }
  await expect(page.locator('.w.done, .w.glow')).toHaveCount(0);
  await expect(page.locator('#pills .pill')).toHaveCount(0);
});

// A second finger lifting off the board mid-drag used to end the first finger's drag there.
test('a second pointer lifting mid-drag leaves the drag to the first', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const word = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  for (const run of await findRunsInGrid(page, word)) {
    const half = Math.floor((word.length - 1) / 2), dx = Math.sign(run.x1 - run.x0), dy = Math.sign(run.y1 - run.y0);
    const a = await cellCentre(page, run.x0, run.y0), b = await cellCentre(page, run.x1, run.y1);
    const m = await cellCentre(page, run.x0 + dx * half, run.y0 + dy * half);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(m.x, m.y, { steps: 4 });
    await page.locator('#gridbox').dispatchEvent('pointerup', { isPrimary: false, pointerId: 7 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    if (await page.locator('.w.done, .w.glow').count()) break;
  }
  await expect(page.locator('.w', { hasText: new RegExp(`^${word}$`, 'i') })).toHaveClass(/\b(glow|done)\b/);
});

test('clicking a word list item does nothing', async ({ page }) => {
  await page.goto('/?subject=nature/birds');
  const chip = page.locator('.w').first();
  await chip.click();
  await expect(chip).not.toHaveClass(/done/);
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`0 of ${total} found`);
});

test('finding every word raises the win overlay', async ({ page }) => {
  await openBoard(page, '/?subject=nature/birds');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) {
    await findAndDrag(page, w.toUpperCase());
  }
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#winmsg')).toContainText('You found every');
});

test('a diagonal word is selectable without overshoot', async ({ page }) => {
  // Seed 1 with Birds is pinned because it is known to contain a diagonally-placed
  // word; findDiagonalWord throws if none exist, and an unseeded puzzle only has a
  // diagonal word most of the time (not always).
  await page.goto('/?seed=1&subject=nature/birds');
  const sel = await findDiagonalWord(page);
  await dragCells(page, sel);
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
});

test('the same seed reproduces the same puzzle', async ({ page }) => {
  await openBoard(page, '/?seed=12345&subject=nature/birds');
  const a = await page.locator('.cell').allTextContents();
  const subjectA = await page.locator('#subject').textContent();
  await openBoard(page, '/?seed=12345&subject=nature/birds');
  const b = await page.locator('.cell').allTextContents();
  expect(b.join('')).toBe(a.join(''));
  expect(await page.locator('#subject').textContent()).toBe(subjectA);

  await openBoard(page, '/?seed=999&subject=nature/birds');
  const c = await page.locator('.cell').allTextContents();
  expect(c.join('')).not.toBe(a.join(''));   // different seed, different grid
});
