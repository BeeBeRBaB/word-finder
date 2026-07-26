import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells, blockServiceWorker } from './helpers.js';
import { CATEGORIES } from '../../src/catalog.js';

test('the win overlay can be dismissed, leaving the solved board', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winclose').click();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('.w.done')).toHaveCount(12);         // board still there
});

// Regression: the win card's button used to call newGame() with no error handling,
// so a rejected loadCategory()/loadSubject() became a silent unhandled rejection --
// the win overlay stayed open, #subject/#category never changed, and the player was
// simply stuck. Forces that exact rejection deterministically: pins Math.random() so
// newGame()'s category pick lands on a specific, known category, then aborts that
// category's module request the same way an offline network or an evicted cache
// would. The seeded initial puzzle (nature/birds) is unaffected -- its module is
// fetched before the route is even relevant, and boot()'s own subject resolution
// never touches Math.random() (it draws from the seeded rng instead).

test('a failed deal from the win card tells the player, rather than leaving a stale overlay', async ({ page }) => {
  const target = CATEGORIES[CATEGORIES.length - 1].id;
  await blockServiceWorker(page);
  await page.addInitScript((n) => {
    // Math.floor(r * n) === n - 1 for any r in [(n-1)/n, 1); 1 - 1/(2n) sits safely
    // inside that range regardless of n, so this always picks the LAST category.
    Math.random = () => 1 - 1 / (2 * n);
  }, CATEGORIES.length);
  await page.route(`**/src/subjects/${target}.js`, route => route.abort());

  await page.goto('/?seed=1&subject=nature/birds');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();

  await page.locator('#winbtn').click();

  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('#subject')).toHaveText('Offline');
  await expect(page.locator('#category')).toHaveText('');
});

test('progress and puzzle survive a reload', async ({ page }) => {
  await page.context().clearCookies();
  // no seed -> newGame() deals from the whole catalog, then reload restores from
  // localStorage -- pinning a subject here would defeat the test, since the pin
  // would still be in the URL on reload and boot() would take the URL branch
  // again instead of the restore-from-save branch this test exists to exercise.
  // One attempt, no retry. This used to loop up to 50 times because the catalog
  // listed more categories than had a module on disk, so a random draw could 404 to
  // "Offline". content.test.js now fails if any of the 25 lacks a module, so that
  // cannot happen -- and the loop had become actively harmful: an unpinned boot
  // failing half the time would be retried away into a green tick, which is exactly
  // the regression this test is positioned to catch, since it is the only one that
  // exercises the default path a real visitor takes.
  await page.goto('/');
  await expect(page.locator('#subject')).not.toHaveText(/^(Offline|Unavailable|Loading…)$/);
  const grid1 = await page.locator('.cell').allTextContents();
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await expect(page.locator('.w.done')).toHaveCount(1);
  await page.reload();
  const grid2 = await page.locator('.cell').allTextContents();
  expect(grid2.join('')).toBe(grid1.join(''));   // same grid (seed restored)
  await expect(page.locator('.w.done')).toHaveCount(1);   // still crossed out
});

// "Topic" named the internal concept twice over: once for the word list, once for
// the UI's appearance. Pinned as a test because both meanings have now moved on.
test('the visible copy talks about games and subjects, never topics or themes', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('#newbtn')).toHaveText(/New game/);
  await expect(page.locator('#winbtn')).toHaveText(/Play a new game/);
  await expect(page.locator('#picker-start')).toHaveText('Start');
  await expect(page.locator('#picker-cancel')).toHaveText('Cancel');
  await expect(page.locator('body')).not.toContainText(/theme/i);
  await expect(page.locator('body')).not.toContainText(/topic/i);
});

// The boot gate holds the first paint until the board is laid out, which took CLS from
// 0.66 to 0.002 — the shell used to paint portrait with a 0-size grid, then JS flipped
// orientation and sized it, moving #gridbox, #hdr and #side at once. The gate is only
// safe if it opens even when main.js never arrives, or a degraded page becomes a blank
// one. The inline script's own timeout is what guarantees that, so pin it here.
test('the boot gate opens even when the module never loads', async ({ page }) => {
  await blockServiceWorker(page);
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('#app')).toBeHidden();
  await expect(page.locator('#app')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#subject')).toHaveText('Loading…');
});

// The same gate must open on a failed deal too — that path goes through boot()'s catch,
// and the reveal lives in its finally precisely so the failure text is seen at once.
// The timeout here is deliberately well under the inline script's 3s fallback: without
// it this passed on the fallback alone, in 3.1s instead of 276ms, proving nothing about
// the finally it is supposed to guard.
test('the boot gate opens when the deal fails, showing the reason', async ({ page }) => {
  await blockServiceWorker(page);
  await page.route('**/src/subjects/nature.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('#app')).toBeVisible({ timeout: 1500 });
  await expect(page.locator('#subject')).toHaveText('Offline');
});
