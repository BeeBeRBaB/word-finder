import { test, expect } from '@playwright/test';
import { findAndDrag, skipAhead } from './helpers.js';

/** @typedef {import('@playwright/test').Page} Page */

// Theme tests read the resolved tokens, so a cached main.js must not stand in for the
// one under test. Same reasoning as appearance.spec.js.
test.use({ serviceWorkers: 'block' });

/** @param {Page} page @returns {Promise<string>} */
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

/** Open Settings if it is closed, then the Theme page, and pick a theme in one flavour.
 * @param {Page} page @param {string} theme @param {'light'|'dark'} [mode] */
async function pickLook(page, theme, mode = 'dark') {
  if (!(await page.locator('#settings').isVisible())) await page.locator('#appearance').click();
  if (!(await page.locator('#settings-themepage').isVisible())) await page.locator('#settings-theme').click();
  await page.locator(`.looktile[data-look="${theme}/${mode}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('data-appearance', mode);
}

/** @param {Page} page @returns {Promise<void>} */
async function solve(page) {
  for (const w of await page.locator('.w').allTextContents()) await findAndDrag(page, w.toUpperCase());
  await expect(page.locator('#win')).toBeVisible();
}

// Both panes say aria-modal; Tab used to walk out of them onto the board's controls behind.
test('Tab stays inside Settings and New game while they are open', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  for (const opener of ['#appearance', '#catbtn']) {
    await page.locator(opener).click();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#app, #win, #toast')), `${opener} tab ${i}`).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator(opener)).toBeFocused();
  }
  await expect(page.locator('#pickercard')).toHaveAttribute('role', 'dialog');
});

test('the header button opens Settings, and Escape closes it with focus returned', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const btn = page.locator('#appearance');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  // The title, not a select: focusing a select from a tap opens it at once on an iPhone.
  await expect(page.locator('#settings-title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(btn).toBeFocused();
});

test('every theme repaints in both flavours, and no two looks share a background', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  const themes = await page.locator('.lookgroup').evaluateAll(gs => gs.map(g => g.getAttribute('aria-labelledby')?.slice(5)));
  expect(themes.length).toBeGreaterThanOrEqual(7);
  /** @type {Set<string>} */
  const seen = new Set();
  for (const mode of /** @type {const} */ (['dark', 'light'])) {
    for (const t of themes) {
      await pickLook(page, /** @type {string} */ (t), mode);
      const bg = await bgOf(page);
      expect(seen.has(bg), `${t}/${mode} repeats background ${bg}`).toBe(false);
      seen.add(bg);
    }
  }
});

test('a chosen theme is applied at first paint, before any module runs', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await pickLook(page, 'grove');
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
    await page.clock.install();
    await page.goto('/?seed=1&subject=nature/birds');
    await solve(page);
    const letters = await page.locator('#letters').textContent();
    await act(page);
    await expect(page.locator('#winnext')).toBeHidden();
    await skipAhead(page, 6000);
    expect(await page.locator('#letters').textContent()).toBe(letters);
    await expect(page.locator('.w.done')).toHaveCount(await page.locator('.w').count());
  });
}

test('with auto-start turned off, a win waits for the player', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#appearance').click();
  await page.locator('#settings-auto-box').uncheck();
  await page.keyboard.press('Escape');
  await page.reload();   // and the choice is remembered
  await solve(page);
  await expect(page.locator('#winnext')).toBeHidden();
  await expect(page.locator('#winstats')).not.toContainText('Next puzzle');
  await skipAhead(page, 6000);
  await expect(page.locator('#win')).toBeVisible();
});

test('turning auto-start off mid-countdown stops it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?seed=1&subject=nature/birds');
  await solve(page);
  const letters = await page.locator('#letters').textContent();
  // Keyboard reaches the header behind the card; this is that path, driven directly.
  await page.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('appearance')).click());
  await expect(page.locator('#winnext')).toBeHidden();   // opening Settings already cancels it
  await page.locator('#settings-auto-box').uncheck();
  await skipAhead(page, 6000);
  expect(await page.locator('#letters').textContent()).toBe(letters);
});

test('a slow win-card deal the player walked away from never replaces their next board', async ({ page }) => {
  // Every pool except the one the player picks is held until they have started a board of
  // their own, so the win card's random draw is still in flight when they walk away from it.
  let release = () => {};
  const held = new Promise((r) => { release = () => r(undefined); });
  /** @type {Promise<void>[]} */
  const late = [];
  await page.route('**/src/subjects/*.js', (route) => {
    if (route.request().url().endsWith('/nature.js')) return route.continue();
    const done = held.then(() => route.continue());
    late.push(done);
    return done;
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
  release();                                      // the abandoned deal resolves now
  await Promise.all(late);
  await page.waitForTimeout(500);
  await expect(page.locator('#subject')).toHaveText(/** @type {string} */ (subject));
  await expect(page.locator('#category')).toHaveText('Nature');
});

// A themed dropdown's list is part of the page, so Escape reaches the app's own handler.
// It must close the list and leave the pane around it open.
test('Escape in an open themed dropdown closes the list, not the pane', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#catbtn').click();
  await page.locator('#picker-select').click();
  const open = await page.locator('#picker-select').evaluate(s => { try { return s.matches(':open'); } catch { return null; } });
  test.skip(!open, 'a touch screen, or an engine that draws a native popup, which never reaches the page');
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeVisible();
  expect(await page.locator('#picker-select').evaluate(s => s.matches(':open'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
});

/** Open Settings and press one option of a segmented setting.
 * @param {Page} page @param {string} key @param {string} value */
async function pick(page, key, value) {
  if (!(await page.locator('#settings').isVisible())) await page.locator('#appearance').click();
  await page.locator(`.seg[data-setting="${key}"] button[data-value="${value}"]`).click();
  await expect(page.locator(`.seg[data-setting="${key}"] button[data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true');
}

test('Board size deals the chosen board from the next game, and is remembered', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('.cell')).toHaveCount(169);        // desktop's own board
  await pick(page, 'board', 'compact');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cell')).toHaveCount(169);        // not until the next game
  await page.locator('#newbtn').click();
  await expect(page.locator('.cell')).toHaveCount(100);
  await page.reload();
  await page.locator('#newbtn').click();
  await expect(page.locator('.cell')).toHaveCount(100);
});

test('Easy deals shorter words than Hard, in every direction', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  /** @param {string} level @returns {Promise<{len:number, dirs:Set<string>}>} */
  const play = async (level) => {
    await pick(page, 'difficulty', level);
    await page.keyboard.press('Escape');
    let len = 0, n = 0; const dirs = new Set();
    for (let i = 0; i < 6; i++) {
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-save-v1') || '{}').seed);
      await page.locator('#newbtn').click();
      await page.waitForFunction((s) => JSON.parse(localStorage.getItem('wordfinder-save-v1') || '{}').seed !== s, before);
      const pl = await page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-save-v1') || '{}').placements);
      for (const p of pl) { len += p.word.length; n++; dirs.add(`${p.dx},${p.dy}`); }
    }
    return { len: len / n, dirs };
  };
  const easy = await play('easy'), hard = await play('hard');
  expect(easy.len).toBeLessThan(hard.len - 1);
  expect(easy.dirs.size, 'difficulty is the words, never the directions').toBe(8);
  expect(hard.dirs.size).toBe(8);
});

test('Large letters enlarge the board letters without changing the board', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  const size = () => page.locator('.cell').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const box = () => page.locator('#gridbox').boundingBox();
  const [f0, b0] = [await size(), await box()];
  await pick(page, 'letters', 'large');
  expect(await size()).toBeGreaterThan(f0 * 1.2);
  expect(await box()).toEqual(b0);
});

test('Reveal, sound, vibrate and motion toggles take effect and persist', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  await page.locator('#appearance').click();
  await page.locator('#settings-reveal-box').uncheck();
  await expect(page.locator('#reveal')).toBeHidden();
  await page.locator('#settings-motion-box').check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.locator('#settings-sound-box').uncheck();
  await page.reload();
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#reveal')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-sound-box')).not.toBeChecked();
  await expect(page.locator('#settings-motion-box')).toBeChecked();
});

test('the Settings button is a gear, and Settings has Account, Look, Game and Feedback sections', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#appearance svg.i-look')).toBeVisible();
  await page.locator('#appearance').click();
  await expect(page.locator('#settings .panesection')).toHaveText(['Account', 'Look', 'Game', 'Feedback']);
});

test('Settings fits a laptop without scrolling, and is a full-screen page with Back on a phone', async ({ page }) => {
  for (const [w, h] of [[1366, 768], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?seed=1&subject=sports/golf');
    await page.waitForSelector('#letters .cell');
    await page.locator('#appearance').click();
    const card = page.locator('#settingscard');
    await expect(page.locator('#settings-back')).toBeHidden();
    expect(await card.evaluate(c => c.scrollHeight - c.clientHeight), `${w}x${h} scrolls`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=1&subject=sports/golf');
  await page.waitForSelector('#letters .cell');
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-close')).toBeHidden();
  // Measured once the slide-in has finished, not part-way across.
  await page.locator('#settingscard').evaluate(c => Promise.all(c.getAnimations().map(a => a.finished)));
  const box = await page.locator('#settingscard').boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await page.locator('#settings-back').click();
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#appearance')).toBeFocused();
});
