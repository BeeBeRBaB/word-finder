import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';
import { CATEGORIES } from '../../src/catalog.js';

test('New game opens the picker, and Cancel leaves the board alone', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const before = await page.locator('.cell').allTextContents();
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker')).toBeVisible();
  await page.locator('#picker-cancel').click();
  await expect(page.locator('#picker')).toBeHidden();
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(before.join(''));
});

// Cancel has to mean cancel even while a deal is in flight. `onStart` is async, so on a
// slow connection the dialog sits open with every control live for as long as the module
// fetch takes; before the busy guard, Cancel closed over the pending deal, which landed
// seconds later and replaced the board -- and persist() then overwrote the save of the
// game the player had just chosen to keep, past recovering by reload.
test('Cancel during a slow deal leaves the board alone, and Start cannot deal twice', async ({ page }) => {
  // Route, not the SW: once the worker claims the page a dynamic import is fetched from
  // inside its context where page.route cannot see it. Registration is removed before
  // any script runs, so the import goes over the wire this test controls.
  await page.addInitScript(() => { delete Object.getPrototypeOf(navigator).serviceWorker; });
  /** @type {() => void} */
  let release = () => {};
  /** @type {Promise<void>} */
  const held = new Promise((r) => { release = () => r(); });
  await page.route('**/src/subjects/food.js', async (route) => { await held; await route.continue(); });

  await page.goto('/?seed=1&subject=nature/birds');
  const before = (await page.locator('.cell').allTextContents()).join('');

  await page.locator('#newbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();

  // Mid-flight: both controls are disabled, so neither a second Start nor a Cancel can
  // reach the handler, and the dialog refuses to close on a promise it cannot recall.
  await expect(page.locator('#picker-start')).toBeDisabled();
  await expect(page.locator('#picker-cancel')).toBeDisabled();
  await page.locator('#picker-cancel').click({ force: true });
  await expect(page.locator('#picker')).toBeVisible();
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(before);

  // Once it lands the dialog closes itself, having dealt exactly one puzzle.
  release();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

test('the picker offers Surprise me first, then every category', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  const opts = await page.locator('#picker-select option').allTextContents();
  expect(opts[0]).toBe('Surprise me');
  expect(opts).toContain('Nature');
  expect(opts).toContain('Food & Drink');
  expect(opts).toContain('Sports & Games');
  expect(await page.locator('#picker-select').inputValue()).toBe('');
});

test('choosing a category deals a subject from it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

test('Surprise me deals a game', async ({ page }) => {
  // Pinned rather than truly random: the catalog currently lists more categories than
  // have a subjects/ module on disk (parallel content authoring, see the retry loop in
  // ux.spec.js's reload test), so an unpinned draw would flake against the ones that
  // 404. `(i + 0.5) / n` always resolves Math.floor(Math.random() * n) to index i,
  // whatever n is — pin it to 'nature', which is guaranteed to exist because the
  // seeded initial puzzle below already depends on it.
  const i = CATEGORIES.findIndex(c => c.id === 'nature');
  await page.addInitScript(([idx, n]) => { Math.random = () => (idx + 0.5) / n; }, [i, CATEGORIES.length]);
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#subject')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText('found');
});

// The dialog replaces the old confirm, so the warning it absorbed has to survive:
// an accidental tap mid-board must still say what it is about to cost.
test('the warning shows only when a board is in progress', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-warning')).toBeHidden();
  await page.locator('#picker-cancel').click();

  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-warning')).toBeVisible();
  await expect(page.locator('#picker-warning')).toHaveText('Start a new game? Your progress will be lost.');
});

test('Escape closes the picker', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
});

// The win card deliberately bypasses the dialog: a winning streak should not be
// interrupted by a form.
test('the win card deals a game without opening the picker', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winbtn').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#win')).toBeHidden();
});

// Real, not hypothetical: the catalog lists 25 categories but only some have a
// subjects/ module on disk yet (parallel content authoring), so a category whose
// module 404s is the everyday case, not an edge case. Aborted via page.route rather
// than picking a category known to be missing today, so this stays valid once every
// category has a module.
//
// Service worker registration is disabled for this page: main.js's own `if
// ('serviceWorker' in navigator)` guard (see the end of main.js) is false once the
// prototype accessor is gone, so it never registers here, matching how the app
// itself would skip it. This is load-bearing, not incidental — sw.js's fetch handler
// calls clients.claim() in its activate handler, so once installed it starts
// intercepting every fetch (including a category's dynamic import) from *inside the
// service worker's own execution context*, a separate target page.route cannot see.
// Left enabled, this test would pass or fail depending on whether the service worker
// had already claimed the page by the time Start was clicked, not on the picker's
// actual behaviour.
test('a category that fails to load stays open, reports the failure inline, and disables the option', async ({ page }) => {
  await page.addInitScript(() => { delete Object.getPrototypeOf(navigator).serviceWorker; });
  await page.goto('/?seed=1&subject=nature/birds');
  await page.route('**/src/subjects/food.js', route => route.abort());

  await page.locator('#newbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();

  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#picker-error')).toBeVisible();
  await expect(page.locator('#picker-error')).toHaveText("Food & Drink isn't available offline yet. Try another category.");
  // Reset to Surprise me rather than left pointing at the option that just failed.
  await expect(page.locator('#picker-select')).toHaveValue('');
  await expect(page.locator('#picker-select option[value="food"]')).toBeDisabled();

  // The dialog is still usable: a different, working category still deals, closing it.
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Nature');
});
