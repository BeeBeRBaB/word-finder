import { test, expect } from '@playwright/test';
import { findAndDrag, blockServiceWorker } from './helpers.js';
import { WORDS as NATURE } from '../../src/subjects/nature.js';

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

test('the win card counter is empty at first paint and fills on a win', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#list .w');
  // ARIA22: the live region must exist before the message, or the update is unreliable.
  await expect(page.locator('#winstats')).toHaveCount(1);
  await expect(page.locator('#winstats')).toHaveText('');
  await expect(page.locator('#winstats')).toHaveAttribute('aria-atomic', 'true');

  for (const w of await page.locator('#list .w').allTextContents()) {
    await findAndDrag(page, w.toUpperCase());
  }
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#winstats')).toHaveText('1 puzzle solved');
});

test('the checkbox reflects and persists the stored setting', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  await page.locator('#newbtn').click();
  const box = page.locator('#picker-least-box');
  await expect(box, 'on by default').toBeChecked();

  await box.uncheck();
  expect((await record(page)).favourLeastSeen).toBe(false);

  // Unlike the category select, this must NOT reset when the dialog reopens.
  await page.locator('#picker-cancel').click();
  await page.locator('#newbtn').click();
  await expect(box).not.toBeChecked();

  await page.reload();
  await page.waitForSelector('#letters .cell');
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-least-box'), 'survives a reload').not.toBeChecked();
});

test('a fully covered category is marked done in the select', async ({ page }) => {
  // Seed the record as if every Nature subject had been through a full cycle. 24 ids,
  // because isComplete refuses to guess when it has fewer ids than the recorded size.
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  const ids = Object.keys(NATURE);
  await page.evaluate(([k, list]) => {
    /** @type {Record<string, {n:number,c:number,d:string}>} */
    const bags = {};
    for (const id of /** @type {string[]} */ (list)) bags[id] = { n: 40, c: 1, d: '' };
    localStorage.setItem(/** @type {string} */ (k), JSON.stringify({
      v: 1, puzzles: 0, favourLeastSeen: true, bags, sizes: { nature: list.length },
    }));
  }, /** @type {[string, string[]]} */ ([KEY, ids]));

  await page.reload();
  await page.waitForSelector('#letters .cell');
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-select option[value="nature"]')).toHaveText('Nature (done)');
  await expect(page.locator('#picker-select option[value="food"]')).toHaveText('Food & Drink');
});

test('the picker action buttons stay reachable on a short landscape phone', async ({ page }) => {
  // 844x300 is the tightest shape in tests/viewport.js, and the dialog gained a row.
  // Opened WITH a game in progress and an error showing, which is the tallest the card
  // ever gets: #picker-warning and #picker-error are both hidden on a fresh board, and a
  // version of this test that skipped them missed ~58px and passed while Start sat 37px
  // below the fold.
  await page.setViewportSize({ width: 844, height: 300 });
  // The worker would serve the pool from its own cache where page.route cannot see the
  // request -- see blockServiceWorker's comment in helpers.js.
  await blockServiceWorker(page);
  await page.route('**/src/subjects/nature.js', route => route.abort());
  await page.goto('/?subject=sports/golf');
  await page.waitForSelector('#list .w');
  const first = /** @type {string} */ (await page.locator('#list .w').first().textContent());
  await findAndDrag(page, first.toUpperCase());   // now inProgress, so the warning shows

  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-warning')).toBeVisible();
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker-error')).toBeVisible();   // the tallest state

  // The card itself must stay inside the viewport...
  const card = await page.locator('#pickercard').boundingBox();
  expect(card).not.toBeNull();
  const c = /** @type {{y:number,height:number}} */ (card);
  expect(c.y).toBeGreaterThanOrEqual(0);
  expect(c.y + c.height, 'the card must not extend past the fold').toBeLessThanOrEqual(300);

  // ...and Start must be REACHABLE, which is the guarantee that actually matters. If it
  // needs scrolling the card must be a scroll container; the bug this guards is a cap
  // with no overflow, where the button is clipped and unreachable by any means.
  const start = page.locator('#picker-start');
  await start.scrollIntoViewIfNeeded();
  const box = await start.boundingBox();
  expect(box).not.toBeNull();
  const b = /** @type {{y:number,height:number}} */ (box);
  expect(b.y, 'Start must not sit above the fold after scrolling').toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, 'nor below it').toBeLessThanOrEqual(300);
  await expect(start).toBeVisible();
  // Cancel rather than Start: a failed deal clears the select, which correctly disables
  // Start. Cancel sits in the same row, so pressing it proves the row is reachable.
  await page.locator('#picker-cancel').click();
  await expect(page.locator('#picker')).toBeHidden();
});

test('the checkbox row is a control, not a second field label', async ({ page }) => {
  // #pickercard label was (1,0,1) and silently beat #picker-least's (1,0,0), rendering
  // this row as tracked uppercase orange -- visually a second CATEGORY heading, with the
  // box jammed against the text because `display` never became flex either.
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  await page.locator('#newbtn').click();
  const style = await page.locator('#picker-least').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, transform: cs.textTransform, size: cs.fontSize };
  });
  expect(style.display).toBe('flex');
  expect(style.transform).toBe('none');
  expect(style.size).toBe('14.5px');

  // ...and the Category label above it is untouched.
  const cat = await page.locator('label[for="picker-select"]').evaluate(
    (el) => getComputedStyle(el).textTransform);
  expect(cat).toBe('uppercase');
});
