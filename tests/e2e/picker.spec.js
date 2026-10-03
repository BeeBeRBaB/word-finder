import { test, expect } from '@playwright/test';
import { findWordInGrid, findAndDrag, dragCells, blockServiceWorker, openBoard, skipAhead } from './helpers.js';
import { CATEGORIES } from '../../src/catalog.js';

test('New game opens the picker, and Cancel leaves the board alone', async ({ page }) => {
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const before = await page.locator('.cell').allTextContents();
  await page.locator('#catbtn').click();
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
  await blockServiceWorker(page);
  /** @type {() => void} */
  let release = () => {};
  /** @type {Promise<void>} */
  const held = new Promise((r) => { release = () => r(); });
  await page.route('**/src/subjects/food.js', async (route) => { await held; await route.continue(); });

  await openBoard(page, '/?seed=1&subject=nature/birds');
  const before = (await page.locator('.cell').allTextContents()).join('');

  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();

  // Mid-flight: both controls are disabled, so neither a second Start nor a Cancel can
  // reach the handler, and the dialog refuses to close on a promise it cannot recall.
  await expect(page.locator('#picker-start')).toBeDisabled();
  await expect(page.locator('#picker-cancel')).toBeDisabled();
  await page.locator('#picker-cancel').click({ force: true });
  await expect(page.locator('#picker')).toBeVisible();
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(before);
  // Choosing again meanwhile does not bring Start back for a click the dialog would ignore.
  await page.locator('#picker-select').selectOption('sports');
  await expect(page.locator('#picker-start')).toBeDisabled();

  // Once it lands the dialog closes itself, having dealt exactly one puzzle.
  release();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

test('the picker lists every category behind a placeholder, with Start held back', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#catbtn').click();
  const opts = await page.locator('#picker-select option').allTextContents();
  expect(opts[0]).toBe('Choose a category…');
  expect(opts).toContain('Nature');
  expect(opts).toContain('Food & Drink');
  expect(opts).toHaveLength(CATEGORIES.length + 1);
  // Random is the header's one-click New game, so the list holds only choosable things
  // and Start has nothing to start until one is picked.
  await expect(page.locator('#picker-start')).toBeDisabled();
  await expect(page.locator('#picker-surprise')).toHaveCount(0);
  await page.locator('#picker-select').selectOption('food');
  await expect(page.locator('#picker-start')).toBeEnabled();
});

test('choosing a category deals a subject from it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

test('New game deals a random game in one click, without opening the picker', async ({ page }) => {
  // Truly random: content.test.js guarantees all 25 categories have a module, so the
  // draw can be what it says it is rather than a pinned Math.random.
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const before = await page.locator('#letters').textContent();
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect.poll(() => page.locator('#letters').textContent()).not.toBe(before);
  await expect(page.locator('#count')).toContainText('0 of');
  await expect(page.locator('#toast')).toBeHidden();   // nothing was in progress, so nothing to undo
});

test('a one-click deal over a board in progress offers Undo, which brings it back', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  const board = await page.locator('#letters').textContent();
  await page.locator('#newbtn').click();
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast-msg')).toHaveText('New game dealt.');
  await page.locator('#toast-undo').click();
  await expect(page.locator('#toast')).toBeHidden();
  await expect.poll(() => page.locator('#letters').textContent()).toBe(board);
  await expect(page.locator('.w.done')).toHaveCount(1);
  await expect(page.locator('#subject')).toHaveText('Birds');
});

test('the Undo offer goes away on its own, waits while the pointer is on it, and goes on the first move', async ({ page }) => {
  await page.clock.install();
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const toast = page.locator('#toast');
  const dealOverAFind = async () => {
    await findAndDrag(page, /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase());
    await page.locator('#newbtn').click();
    await expect(toast).toBeVisible();
  };
  await dealOverAFind();
  // On Undo itself: the rest of the toast lets the pointer through to the board.
  const box = /** @type {{x:number, y:number, width:number, height:number}} */ (await page.locator('#toast-undo').boundingBox());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await skipAhead(page, 7000);
  await expect(toast).toBeVisible();
  await page.mouse.move(5, 5);
  await skipAhead(page, 7000);
  await expect(toast).toBeHidden();
  await dealOverAFind();
  await page.locator('#gridbox').click({ position: { x: 30, y: 30 } });
  await expect(toast).toBeHidden();
});

test('the category chevron opens the pane and reports it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const chev = page.locator('#catbtn');
  await expect(chev).toHaveAttribute('aria-expanded', 'false');
  await chev.click();
  await expect(page.locator('#picker')).toBeVisible();
  await expect(chev).toHaveAttribute('aria-expanded', 'true');
  // The title, not the select: focusing a select from a tap opens it at once on an iPhone.
  await expect(page.locator('#picker-title')).toBeFocused();
  await page.locator('#picker-cancel').click();
  await expect(chev).toHaveAttribute('aria-expanded', 'false');
  await expect(chev).toBeFocused();
});

// The dialog replaces the old confirm, so the warning it absorbed has to survive:
// an accidental tap mid-board must still say what it is about to cost.
test('the warning shows only when a board is in progress', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#catbtn').click();
  await expect(page.locator('#picker-warning')).toBeHidden();
  await page.locator('#picker-cancel').click();

  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await page.locator('#catbtn').click();
  await expect(page.locator('#picker-warning')).toBeVisible();
  await expect(page.locator('#picker-warning')).toHaveText('Start a new game? Your progress will be lost.');
});

test('Escape closes the picker', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#catbtn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
});

// The win card deliberately bypasses the dialog: a winning streak should not be
// interrupted by a form.
test('the win card deals a game without opening the picker', async ({ page }) => {
  await openBoard(page, '/?seed=1&subject=nature/birds');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winbtn').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#win')).toBeHidden();
});

// A category whose module cannot be fetched is the offline case, forced here with
// page.route rather than by naming a category that happens to lack a file — so this
// stays honest now that every category has one.
test('a category that fails to load stays open, reports the failure inline, and disables the option', async ({ page }) => {
  await blockServiceWorker(page);
  await page.goto('/?seed=1&subject=nature/birds');
  await page.route('**/src/subjects/food.js', route => route.abort());

  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();

  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#picker-error')).toBeVisible();
  await expect(page.locator('#picker-error')).toHaveText("Food & Drink isn't available offline yet. Try another category.");
  // Reset to the placeholder rather than left pointing at the option that just failed.
  await expect(page.locator('#picker-select')).toHaveValue('');
  await expect(page.locator('#picker-select option[value="food"]')).toBeDisabled();
  // Focus stays in the dialog, not on the page the dialog covers.
  await expect(page.locator('#picker-title')).toBeFocused();

  // The dialog is still usable: a different, working category still deals, closing it.
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Nature');
});

// A failed deal clears the category that failed, not one chosen while it was loading.
test('a category chosen while a failing deal loads is kept, ready to start', async ({ page }) => {
  await blockServiceWorker(page);
  await openBoard(page, '/?seed=1&subject=nature/birds');
  /** @type {() => void} */
  let fail = () => {};
  const held = new Promise((r) => { fail = () => r(undefined); });
  await page.route('**/src/subjects/food.js', async (route) => { await held; await route.abort(); });
  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await page.locator('#picker-select').selectOption('sports');
  fail();
  await expect(page.locator('#picker-error')).toBeVisible();
  await expect(page.locator('#picker-select')).toHaveValue('sports');
  await expect(page.locator('#picker-start')).toBeEnabled();
});

// Undo used to regenerate the old board from its save. A deal steered by the coverage bag
// does not regenerate identically, so Undo brought back different words. Five ordinary
// deals of one subject leave its bag partly drawn, which is the case that broke.
test('Undo brings back the exact board, even one the coverage bag steered', async ({ page }) => {
  for (let i = 0; i < 5; i++) await page.goto('/?subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  const words = await page.locator('.w').allTextContents();
  const board = await page.locator('#letters').textContent();
  await page.locator('#newbtn').click();
  await expect(page.locator('#toast')).toBeVisible();
  await page.locator('#toast-undo').click();
  await expect.poll(() => page.locator('#letters').textContent()).toBe(board);
  expect(await page.locator('.w').allTextContents()).toEqual(words);
  await expect(page.locator('.w.done')).toHaveCount(1);
  await expect(page.locator('#newbtn')).toBeFocused();
});

test('pressing New game twice keeps the Undo for the board that had progress', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  const board = await page.locator('#letters').textContent();
  await page.locator('#newbtn').click();
  await expect(page.locator('#toast')).toBeVisible();
  const second = await page.locator('#letters').textContent();
  await page.locator('#newbtn').click();
  await expect.poll(() => page.locator('#letters').textContent()).not.toBe(second);
  await expect(page.locator('#toast')).toBeVisible();
  await page.locator('#toast-undo').click();
  await expect.poll(() => page.locator('#letters').textContent()).toBe(board);
  await expect(page.locator('#subject')).toHaveText('Birds');
});

test('Escape does not cancel a one-click deal that is still loading', async ({ page }) => {
  await page.route('**/src/subjects/*.js', async (route) => {
    if (!route.request().url().endsWith('/nature.js')) await new Promise(r => setTimeout(r, 1200));
    await route.continue();
  });
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const board = await page.locator('#letters').textContent();
  await page.evaluate(() => { Math.random = () => 0.99; });   // draw a category other than nature
  await page.locator('#newbtn').click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('#letters').textContent(), { timeout: 5000 }).not.toBe(board);
});

/** The real dialog, rebuilt by a second makePicker with a stand-in Levels side, so picker.js
 * is tested in the page's own markup and CSS.
 * @param {import('@playwright/test').Page} page
 * @param {{enabled?:boolean, mode?:string, ready?:boolean, fail?:boolean}} [o] */
async function levelsPicker(page, o = {}) {
  await openBoard(page, '/?seed=1&subject=nature/birds');
  await page.evaluate(async ({ enabled = true, mode = 'levels', ready = true, fail = false }) => {
    const url = '/src/picker.js';
    const { makePicker } = await import(url);
    const old = /** @type {HTMLElement} */ (document.getElementById('picker'));
    const root = /** @type {HTMLElement} */ (old.cloneNode(true));
    root.querySelector('#picker-mode')?.remove();
    root.querySelector('#picker-level')?.remove();
    old.replaceWith(root);
    const w = /** @type {any} */ (window);
    Object.assign(w, { log: [], mode, ready, fail, enabled });
    const q = (/** @type {string} */ id) => root.querySelector('#' + id);
    w.p2 = makePicker({ root, heading: q('picker-title'), select: q('picker-select'), warning: q('picker-warning'),
      error: q('picker-error'), start: q('picker-start'), cancel: q('picker-cancel'),
      categories: [{ id: 'nature', name: 'Nature' }], isUnavailable: () => false, isComplete: () => false,
      onStart: async (/** @type {string} */ id) => { w.log.push(['random', id]); },
      levels: {
        enabled: () => w.enabled, getMode: () => w.mode,
        setMode: (/** @type {string} */ m) => { w.log.push(['setMode', m]); w.mode = m; },
        render: (/** @type {HTMLElement} */ host) => {
          host.textContent = 'Level 12';
          if (!w.ready && !w.noButton) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Try again'; host.append(b); }
          return { ready: w.ready, start: w.ready ? 'Play level 12' : 'Play level' };
        },
        onLevel: async () => { w.log.push(['level']); if (w.fail) throw new Error('offline'); },
      } });
    w.p2.open(false);
  }, o);
}
/** @param {import('@playwright/test').Page} page */
const picks = (page) => page.evaluate(() => /** @type {any} */ (window).log);

test('the Levels side takes the category\'s place, and Start plays the level', async ({ page }) => {
  await levelsPicker(page);
  const mode = page.locator('#picker-mode');
  await expect(mode).toBeVisible();
  await expect(mode.getByRole('button', { name: 'Levels' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#picker-select')).toBeHidden();
  await expect(page.locator('label[for="picker-select"]')).toBeHidden();
  await expect(page.locator('#picker-level')).toHaveText('Level 12');
  await expect(page.locator('#picker-start')).toHaveText('Play level 12');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  expect(await picks(page)).toEqual([['level']]);
});

test('Random brings the category back, and the side chosen is remembered', async ({ page }) => {
  await levelsPicker(page);
  await page.locator('#picker-mode').getByRole('button', { name: 'Random' }).click();
  await expect(page.locator('#picker-mode').getByRole('button', { name: 'Random' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#picker-level')).toBeHidden();
  await expect(page.locator('#picker-start')).toHaveText('Start');
  await expect(page.locator('#picker-start')).toBeDisabled();
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  expect(await picks(page)).toEqual([['setMode', 'random'], ['random', 'nature']]);
});

test('a Levels side that cannot start yet keeps Start off until it is redrawn ready', async ({ page }) => {
  await levelsPicker(page, { ready: false });
  await expect(page.locator('#picker-start')).toHaveText('Play level');
  await expect(page.locator('#picker-start')).toBeDisabled();
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.ready = true; w.p2.refresh(); });
  await expect(page.locator('#picker-start')).toBeEnabled();
  await expect(page.locator('#picker-start')).toHaveText('Play level 12');
});

test('focus inside the Levels pane survives a redraw: to its new button, else to Start, else to the heading', async ({ page }) => {
  await levelsPicker(page, { ready: false });
  const retry = page.locator('#picker-level').getByRole('button', { name: 'Try again' });
  await retry.focus();
  await page.evaluate(() => /** @type {any} */ (window).p2.refresh());
  await expect(retry).toBeFocused();   // the new one
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.ready = true; w.p2.refresh(); });
  await expect(page.locator('#picker-start')).toBeFocused();
  // Focus outside the pane is left where it is.
  await page.locator('#picker-cancel').focus();
  await page.evaluate(() => /** @type {any} */ (window).p2.refresh());
  await expect(page.locator('#picker-cancel')).toBeFocused();
  // No button and no Start to go to: the heading.
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.ready = false; w.p2.refresh(); });
  await retry.focus();
  await page.evaluate(() => { const w = /** @type {any} */ (window); w.noButton = true; w.p2.refresh(); });
  await expect(page.locator('#picker-title')).toBeFocused();
});

test('without accounts there is no Levels side, whatever was chosen before', async ({ page }) => {
  await levelsPicker(page, { enabled: false, mode: 'levels' });
  await expect(page.locator('#picker-mode')).toBeHidden();
  await expect(page.locator('#picker-level')).toBeHidden();
  await expect(page.locator('#picker-select')).toBeVisible();
  await expect(page.locator('#picker-start')).toHaveText('Start');
});

test('a level that cannot load keeps the dialog open and says so', async ({ page }) => {
  await levelsPicker(page, { fail: true });
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker-error')).toHaveText("This level isn't available offline yet. Try again once you're back online.");
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#picker-start')).toBeEnabled();
  await expect(page.locator('#picker-start')).toBeFocused();   // to try again
  // Switching side clears the message.
  await page.locator('#picker-mode').getByRole('button', { name: 'Random' }).click();
  await expect(page.locator('#picker-error')).toBeHidden();
});
