import { test, expect } from '@playwright/test';
import { findAndDrag } from './helpers.js';

/** @typedef {import('@playwright/test').Page} Page */

// Palette tests read the resolved tokens, so a cached main.js must not stand in for the
// one under test. Same reasoning as appearance.spec.js.
test.use({ serviceWorkers: 'block' });

/** @param {Page} page @returns {Promise<string>} */
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

/** @param {Page} page @returns {Promise<void>} */
async function solve(page) {
  for (const w of await page.locator('.w').allTextContents()) await findAndDrag(page, w.toUpperCase());
  await expect(page.locator('#win')).toBeVisible();
}

test('the header button opens Settings, and Escape closes it with focus returned', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const btn = page.locator('#appearance');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#settings-theme')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(btn).toBeFocused();
});

test('every theme repaints in both modes, and no two share a background', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  const themes = await page.locator('#settings-theme option').evaluateAll(os => os.map(o => /** @type {HTMLOptionElement} */ (o).value));
  expect(themes.length).toBeGreaterThanOrEqual(7);
  /** @type {Set<string>} */
  const seen = new Set();
  for (const mode of ['dark', 'light']) {
    await page.locator(`#mode-${mode}`).click();
    for (const t of themes) {
      await page.locator('#settings-theme').selectOption(t);
      await expect(page.locator('html')).toHaveAttribute('data-theme', t);
      const bg = await bgOf(page);
      expect(seen.has(bg), `${t}/${mode} repeats background ${bg}`).toBe(false);
      seen.add(bg);
    }
  }
});

test('a chosen theme is applied at first paint, before any module runs', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  await page.locator('#settings-theme').selectOption('grove');
  const groveBg = await bgOf(page);
  await page.route('**/src/main.js', route => route.abort());
  await page.reload();
  await expect(page.locator('.cell')).toHaveCount(0);   // the module really did not run
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'grove');
  expect(await bgOf(page)).toBe(groveBg);
});

test('an unknown stored theme falls back to the default at first paint', async ({ page }) => {
  await page.addInitScript(() => { window.localStorage.setItem('wordfinder-theme', 'banana'); });
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'phosphor');
  expect(await bgOf(page)).toBe('#100a05');
});

test('a win counts down and deals the next puzzle on its own', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const before = await page.locator('#letters').textContent();
  await solve(page);
  await expect(page.locator('#winnext')).toBeVisible();
  await expect(page.locator('#winstats')).toContainText('Next puzzle in 5 seconds');
  await expect(page.locator('#win')).toBeHidden({ timeout: 8000 });
  await expect(page.locator('.w.done')).toHaveCount(0);
  await expect(page.locator('#newbtn')).toBeFocused();   // not dropped to <body> with the card
  expect(await page.locator('#letters').textContent()).not.toBe(before);
});

for (const [how, act] of /** @type {[string, (p: Page) => Promise<void>][]} */ ([
  ['Stay here', (p) => p.locator('#winstay').click()],
  ['the close button', (p) => p.locator('#winclose').click()],
  ['Escape', (p) => p.keyboard.press('Escape')],
])) {
  test(`${how} cancels the countdown and keeps the solved board`, async ({ page }) => {
    await page.goto('/?seed=1&subject=nature/birds');
    await solve(page);
    const letters = await page.locator('#letters').textContent();
    await act(page);
    await expect(page.locator('#winnext')).toBeHidden();
    await page.waitForTimeout(6000);
    expect(await page.locator('#letters').textContent()).toBe(letters);
    await expect(page.locator('.w.done')).toHaveCount(await page.locator('.w').count());
  });
}

test('with auto-start turned off, a win waits for the player', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  await page.locator('#settings-auto-box').uncheck();
  await page.keyboard.press('Escape');
  await page.reload();   // and the choice is remembered
  await solve(page);
  await expect(page.locator('#winnext')).toBeHidden();
  await expect(page.locator('#winstats')).not.toContainText('Next puzzle');
  await page.waitForTimeout(6000);
  await expect(page.locator('#win')).toBeVisible();
});

test('turning auto-start off mid-countdown stops it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await solve(page);
  const letters = await page.locator('#letters').textContent();
  // Keyboard reaches the header behind the card; this is that path, driven directly.
  await page.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('appearance')).click());
  await expect(page.locator('#winnext')).toBeHidden();   // opening Settings already cancels it
  await page.locator('#settings-auto-box').uncheck();
  await page.waitForTimeout(6000);
  expect(await page.locator('#letters').textContent()).toBe(letters);
});

test('a slow win-card deal the player walked away from never replaces their next board', async ({ page }) => {
  // Every pool except the one the player picks loads 4s late, so the win card's random
  // draw is still in flight when they close it and start a board of their own.
  await page.route('**/src/subjects/*.js', async (route) => {
    if (!route.request().url().endsWith('/nature.js')) await new Promise(r => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto('/?seed=1&subject=nature/birds');
  await solve(page);
  await page.locator('#winbtn').click();          // starts the slow random deal
  await page.keyboard.press('Escape');            // ...and walks away from it
  await page.locator('#catbtn').click();
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  const subject = await page.locator('#subject').textContent();
  await page.waitForTimeout(5000);                // the abandoned deal resolves in here
  await expect(page.locator('#subject')).toHaveText(/** @type {string} */ (subject));
  await expect(page.locator('#category')).toHaveText('Nature');
});

// A themed dropdown's list is part of the page, so Escape reaches the app's own handler.
// It must close the list and leave the pane around it open.
test('Escape in an open themed dropdown closes the list, not the pane', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  await page.locator('#settings-theme').click();
  const open = await page.locator('#settings-theme').evaluate(s => { try { return s.matches(':open'); } catch { return null; } });
  test.skip(open === null, 'this engine draws a native popup, which never reaches the page');
  expect(open).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeVisible();
  expect(await page.locator('#settings-theme').evaluate(s => s.matches(':open'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
});
