import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';
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
//
// Service worker registration is disabled for this page (matching main.js's own `if
// ('serviceWorker' in navigator)` guard, made false by deleting the prototype
// accessor). This is load-bearing, not incidental: sw.js's activate handler calls
// clients.claim(), and once it has claimed the page every fetch after that --
// including a category's dynamic import() -- is issued from *inside the service
// worker's own execution context*, a target page.route() cannot see. Left enabled,
// the abort below silently did nothing and this test only ever passed because its
// target category (CATEGORIES' last entry) happened to have no file on disk yet; now
// that every category does, the abort has to actually be observed to keep failing.
test('a failed deal from the win card tells the player, rather than leaving a stale overlay', async ({ page }) => {
  const target = CATEGORIES[CATEGORIES.length - 1].id;
  await page.addInitScript(() => { delete Object.getPrototypeOf(navigator).serviceWorker; });
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
  // Retried rather than waited-out: the catalog currently lists more categories
  // than have a subjects/ module on disk (parallel content authoring), so a random
  // pick sometimes 404s straight to "Offline" -- a state a wait cannot recover
  // from, only a fresh attempt (a new Math.random() draw) can. Once every category
  // has a module this loop exits on the first attempt.
  // 50 attempts, not a handful: only a few categories have a module on disk right
  // now, so a single-digit retry budget still fails often enough to flake this test.
  const MAX_ATTEMPTS = 50;
  /** @type {string|null} */
  let subject = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && (subject === null || subject === 'Offline' || subject === 'Unavailable'); attempt++) {
    await page.goto('/');
    subject = await page.locator('#subject').textContent();
  }
  const booted = subject !== null && subject !== 'Offline' && subject !== 'Unavailable';
  expect(booted, `could not boot to a real puzzle after ${MAX_ATTEMPTS} attempts`).toBe(true);
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
