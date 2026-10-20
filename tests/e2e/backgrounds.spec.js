import { test, expect } from '@playwright/test';
import { openBoard, handPickedBackground, findAndDrag, pickBackground } from './helpers.js';
import { BACKGROUNDS, findBackground, resolveBackground } from '../../src/backgrounds.js';
import { MOTIONS } from '../../src/backgrounds/subject-motion.js';
import { motionFor } from '../../src/backgrounds/icon-scene.js';

/** @typedef {import('@playwright/test').Page} Page */

// The animated modules load on first use; a cached copy must not stand in for the one under test.
test.use({ serviceWorkers: 'block' });

/** Whether the canvas in `sel` has anything drawn on it. @param {Page} page @param {string} sel */
const painted = (page, sel) => page.locator(sel).evaluate(c => {
  const cv = /** @type {HTMLCanvasElement} */ (c);
  return !!cv.getContext('2d')?.getImageData(0, 0, cv.width, cv.height).data.some((v, i) => i % 4 === 3 && v > 0);
});

/** @param {Page} page */
async function openPage(page) {
  await page.locator('#appearance').click();
  await page.locator('#settings-bg').click();
  await expect(page.locator('#settings-bgpage')).toBeVisible();
}
/** @param {Page} page @param {string} mode */
const setMode = (page, mode) => page.locator('#settings-bgmode').selectOption(mode);
/** The background showing, as the Settings row names it. @param {Page} page @returns {Promise<string>} */
const checked = async (page) => {
  const name = await page.locator('#settings-bg-now .bgname').textContent();
  return BACKGROUNDS.find(b => b.name === name)?.id ?? '';
};
/** Whether the page draws a background. @param {Page} page */
const drawn = (page) => page.evaluate(() => !!document.querySelector('#bg > *'));
/** @param {Page} page @returns {Promise<{seed:number, bg?:string}>} the saved board */
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}'));
/** Rewrite the saved board's Random pick; undefined drops it, as a save from before it had one.
 * @param {Page} page @param {string|undefined} bg */
const resave = (page, bg) => page.evaluate((bg) => {
  const save = JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}');
  localStorage.setItem('wordfinder-save-v1', JSON.stringify({ ...save, bg }));
}, bg);
test('the Background page has the mode, and under Manual a dropdown of every background', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  // Focus lands on the title, not the mode's select, which an iPhone would open at once.
  await expect(page.locator('#bg-title')).toBeFocused();
  // A new player: each theme's own background, and no dropdown.
  const mode = page.getByRole('combobox', { name: 'Choose' });
  await expect(mode.locator('option')).toHaveText(['Theme', 'Random', 'Manual']);
  await expect(mode).toHaveValue('theme');
  await expect(page.locator('#bgmode-note')).toHaveText('Each theme comes with its own background. Now: Galaxy.');
  // Icons is the page's one switch: no Area row, the whole page always.
  await expect(page.locator('#settings-bgpage .seg')).toHaveAttribute('data-setting', 'icons');
  await expect(page.locator('#bg-manual')).toBeHidden();
  await mode.selectOption('manual');
  await expect(page.locator('#bgmode-note')).toHaveText('The one you pick shows with every game.');
  // Manual shows its stored pick, the default Drifting icons, and no Still choice or radio.
  await expect(page.getByRole('radio', { name: 'Still', exact: true })).toHaveCount(0);
  const drop = page.getByRole('button', { name: 'Background Drifting icons' });
  await expect(drop).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#settings-bg-now .bgname')).toHaveText('Drifting icons');
  // One menu with every registry entry, its pick checked and focused on opening.
  await drop.click();
  const menu = page.getByRole('radiogroup', { name: 'Background' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('radio')).toHaveCount(BACKGROUNDS.length);
  await expect(page.locator('.bgtile')).toHaveCount(BACKGROUNDS.length);
  await expect(menu.getByRole('radio', { name: 'Drifting icons' })).toBeChecked();
  await expect(menu.getByRole('radio', { name: 'Drifting icons' })).toBeFocused();
  // The arrows move the pick within the menu and leave it open; Enter closes it on the dropdown.
  await page.keyboard.press('ArrowRight');
  const next = BACKGROUNDS[1];
  await expect(menu.getByRole('radio', { name: next.name, exact: true })).toBeChecked();
  await expect(menu).toBeVisible();
  await expect(page.locator('#settings-bg-now .bgname')).toHaveText(next.name);
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: `Background ${next.name}` })).toBeFocused();
  // Escape closes the menu and not the pane.
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.locator('#settings-bgpage')).toBeVisible();
  // Every option, the dropdown and the select are 44px targets.
  await page.locator('#bgdrop').click();
  const heights = await page.locator('#bgmenu .bgtile, #settings-bgpage .bgdrop, #settings-bgpage select')
    .evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height));
  expect(heights).toHaveLength(BACKGROUNDS.length + 2);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  // Each name shows whole, none cut short.
  expect(await page.locator('#bgmenu .bgname').evaluateAll(ns => ns.filter(n => n.scrollWidth > n.clientWidth).map(n => n.textContent))).toEqual([]);
});

test('Theme mode shows each theme\'s own background, in either flavour, and follows a change of theme', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#bg canvas')).toHaveCount(1);   // Phosphor's Galaxy, on the whole page
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Galaxy Theme');
  await page.locator('#settings-theme').click();
  // Broadsheet's is Halftone.
  const halftone = page.waitForRequest(/\/src\/backgrounds\/halftone\.js/);
  await page.locator('.looktile[data-look="broadsheet/light"]').click();
  await halftone;
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  const loaded = page.waitForRequest(/\/src\/backgrounds\/constellation\.js/);
  await page.locator('.looktile[data-look="graphite/dark"]').click();
  await loaded;
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await page.locator('.looktile[data-look="graphite/light"]').click();
  await page.locator('#theme-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Constellation Theme');
  await page.locator('#settings-bg').click();
  await expect(page.locator('#bgmode-note')).toHaveText('Each theme comes with its own background. Now: Constellation.');
});

test('a pick in the menu shows and closes it, and outlasts a new theme, Theme mode and a reload', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await setMode(page, 'manual');
  await pickBackground(page, 'aurora');
  await expect(page.getByRole('radiogroup', { name: 'Background' })).toBeHidden();   // a pick by pointer closes the menu
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Background Aurora' })).toBeVisible();
  await page.locator('#bg-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Aurora');
  // A new theme leaves a Manual pick alone.
  await page.locator('#settings-theme').click();
  await page.locator('.looktile[data-look="broadsheet/light"]').click();
  await page.locator('#theme-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Aurora');
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  // Theme again shows the theme's own, and Manual keeps its pick for later.
  await page.locator('#settings-bg').click();
  await setMode(page, 'theme');
  await expect(page.locator('#bgmode-note')).toHaveText('Each theme comes with its own background. Now: Halftone.');
  await setMode(page, 'manual');
  await expect(page.getByRole('button', { name: 'Background Aurora' })).toBeVisible();
  await pickBackground(page, 'constellation');
  await page.reload();
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Constellation');
  await page.locator('#settings-bg').click();
  await expect(page.getByRole('button', { name: 'Background Constellation' })).toBeVisible();
});

// A player who had picked a still background before they were removed gets the theme's own.
test('a saved still pick shows the theme\'s own background', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wordfinder-settings-v1',
    JSON.stringify({ bgmode: 'manual', art: 'illustrated', still: 'illustrated', moving: 'koi' })));
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Galaxy Theme');
});

test('Random picks again for every new game, and Undo and a reload keep the board\'s own pick', async ({ page }) => {
  await openBoard(page, '/');   // no ?seed=, so a reload puts the saved board back
  await openPage(page);
  await setMode(page, 'random');
  await expect(page.locator('#bgmode-note')).toHaveText(/^A new background with every game\. Now: /);
  const first = await checked(page);
  await expect.poll(() => drawn(page)).toBe(true);
  await page.locator('#bg-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName(new RegExp(` Random$`));
  // Not a new theme or a resize: only a new game picks again.
  await page.locator('#settings-theme').click();
  await page.locator('.looktile[data-look="plum/light"]').click();
  await page.locator('#theme-back').click();
  await page.locator('#settings-bg').click();
  await page.setViewportSize({ width: 1100, height: 760 });
  expect(await checked(page)).toBe(first);
  await page.keyboard.press('Escape');

  const subject = await page.locator('#subject').textContent();
  await page.locator('#reveal').click();   // a board with a find is kept for Undo
  await expect(page.locator('#pills .pill')).toHaveCount(1);
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText(subject ?? '');
  const second = await checked(page);
  expect(second).not.toBe(first);
  await expect.poll(() => drawn(page)).toBe(true);
  expect((await saved(page)).bg).toBe(second);   // the pick is saved with its board
  await page.locator('#toast-undo').click();
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  expect(await checked(page)).toBe(first);
  expect((await saved(page)).bg).toBe(first);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  expect(await checked(page)).toBe(first);
  await expect.poll(() => drawn(page)).toBe(true);

  // A reload shows the pick the save holds; a save from before it was kept picks by its seed alone.
  const other = first === 'koi' ? 'rain' : 'koi';
  await resave(page, other);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  expect(await checked(page)).toBe(other);
  await resave(page, undefined);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  expect(await checked(page)).toBe(resolveBackground('random', '', '', (await saved(page)).seed));
});

test('a background runs behind the whole page and takes no clicks', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await pickBackground(page, 'aurora');
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  // Under the page: it takes no clicks, and the board still paints over it.
  await page.keyboard.press('Escape');
  expect(await page.locator('#bg').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  const top = await page.evaluate(() => {
    const r = /** @type {HTMLElement} */ (document.getElementById('gridbox')).getBoundingClientRect();
    return document.elementFromPoint(r.x + 5, r.y + 5)?.closest('#gridbox') !== null;
  });
  expect(top).toBe(true);
});

// The board and the header and list cards are frosted: the surface at a share over a blur of
// the background (tools/palettes/check.mjs bounds their text at these shares). Tiles drops the
// board to a faint wash, its tiles carrying the letters, and Glass keeps the same cards as bars.
test('the board and the cards let the background through, frosted', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  /** The alpha of an element's background colour and its backdrop filter. @param {string} sel */
  const card = (sel) => page.locator(sel).first().evaluate(el => {
    const cs = getComputedStyle(el), m = cs.backgroundColor.match(/[\d.]+/g) ?? [];
    return { a: m.length > 3 ? Number(m[3]) : 1, blur: cs.backdropFilter.includes('blur') };
  });
  await page.locator('#list .w').first().waitFor();
  for (const style of ['beads', 'glass']) {
    await page.evaluate((s) => { document.documentElement.dataset.style = s; }, style);
    const board = await card('#gridbox'), hdr = await card('#hdr'), side = await card('#side');
    expect(board.a, style).toBeCloseTo(0.8, 2);
    expect(hdr.a, style).toBeCloseTo(0.88, 2);
    expect(side.a, style).toBeCloseTo(0.88, 2);
    expect([board.blur, hdr.blur, side.blur], style).toEqual([true, true, true]);
  }
  await page.evaluate(() => { document.documentElement.dataset.style = 'tiles'; });
  expect((await card('#gridbox')).a).toBeCloseTo(0.28, 2);
  expect((await card('#hdr')).a).toBeCloseTo(0.88, 2);
  // Words are plain text on the card, never tiles of their own.
  expect((await card('#list .w')).a).toBe(0);
});

// Each background has its own ground and colours in two flavours: the dark one under every dark
// theme and the light one under every light theme, whatever the theme's palette.
test('a background wears its own ground for the theme\'s flavour', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.locator('.cell').first().waitFor();
  await openPage(page);
  await pickBackground(page, 'koi');
  const ground = () => page.locator('#bg').evaluate(el => getComputedStyle(el).backgroundImage);
  /** @param {string} look */
  const wear = async (look) => {
    await page.locator(`#theme-tiles input[value="${look}"]`).evaluate(el => /** @type {HTMLInputElement} */ (el).click());
    await expect(page.locator('html')).toHaveAttribute('data-appearance', look.split('/')[1]);
    return ground();
  };
  const dark = await wear('phosphor/dark');
  expect(dark).toContain('gradient');
  expect(await wear('grove/dark')).toBe(dark);
  const light = await wear('grove/light');
  expect(light).toContain('gradient');
  expect(light).not.toBe(dark);
  expect(await wear('broadsheet/light')).toBe(light);
});

test('the choice is remembered, and a new deal keeps the background running', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await pickBackground(page, 'galaxy');
  await page.reload();
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  const canvas = await page.locator('#bg canvas').elementHandle();
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText('Jupiter');
  // The same canvas: an ordinary background is not restarted by a deal.
  expect(await page.evaluate(c => c?.isConnected, canvas)).toBe(true);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Galaxy');
});

test('a background that could not load draws once the device is back online', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.route(/\/src\/backgrounds\/aurora-drift\.js/, route => route.abort('internetdisconnected'));
  const failed = page.waitForEvent('requestfailed', r => r.url().includes('aurora-drift.js'));
  await openPage(page);
  await pickBackground(page, 'aurora');
  await failed;
  await page.unroute(/\/src\/backgrounds\/aurora-drift\.js/);
  // Again until the failed load has settled: one asked for while it is still failing fails with it.
  await expect.poll(async () => {
    await page.evaluate(() => dispatchEvent(new Event('online')));
    return page.locator('#bg canvas').count();
  }).toBe(1);
});

/** Subject motion on nature/fish with its motion module failing once, then served again.
 * @param {Page} page */
async function motionFailsOnce(page) {
  await page.addInitScript(() => localStorage.setItem('wordfinder-settings-v1',
    JSON.stringify({ bgmode: 'manual', art: 'motion' })));
  const file = MOTIONS[/** @type {keyof typeof MOTIONS} */ (motionFor('nature/fish'))];
  const url = new RegExp(`/src/backgrounds/${file}\\.js`);
  await page.route(url, route => route.abort('internetdisconnected'));
  const failed = page.waitForEvent('requestfailed', r => r.url().includes(`/${file}.js`));
  await page.goto('/?seed=1&subject=nature/fish');
  await failed;
  await page.unroute(url);
}

test('Subject motion whose motion could not load draws once the device is back online', async ({ page }) => {
  await motionFailsOnce(page);
  await expect.poll(async () => {
    await page.evaluate(() => dispatchEvent(new Event('online')));
    return page.locator('#bg canvas').count();
  }).toBe(1);
});

test('Subject motion whose motion could not load draws when it next starts', async ({ page }) => {
  await motionFailsOnce(page);
  const subject = await page.locator('#subject').textContent();
  await page.locator('#reveal').click();   // a board with a find is kept for Undo
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText(subject ?? '');
  await page.locator('#toast-undo').click();
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  await expect(page.locator('#bg canvas')).toHaveCount(1);
});

test('Back returns to Settings and its row; Escape closes the pane from the page', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('#bg-back').click();
  await expect(page.locator('#settings-bgpage')).toBeHidden();
  await expect(page.locator('#settings-body')).toBeVisible();
  await expect(page.locator('#settings-bg')).toBeFocused();
  await page.locator('#settings-bg').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
  // Opening again starts on the main page.
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-body')).toBeVisible();
  await expect(page.locator('#settings-bgpage')).toBeHidden();
});

test('on a phone the page is full screen with Back, and the background fills the screen behind it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await openPage(page);
  const card = await page.locator('#settingscard').boundingBox();
  // Read mid-slide, the translate leaves a few millionths of a pixel on the width.
  expect(card?.width).toBeCloseTo(390, 1);
  await expect(page.locator('#bg-back')).toBeVisible();
  await expect(page.locator('#bg-close')).toBeHidden();
  // Nothing on the page is wider than the phone.
  expect(await page.evaluate(() => document.getElementById('settingscard')?.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#bg-back').click();
  await page.locator('#settings-back').click();
  // Fixed to the page, not clipped inside the board.
  expect(await page.locator('#bg').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  expect(await page.locator('#bg').boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 664 });
});

test('Drifting icons restarts for every new subject', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#bgmenu .bgtile[data-bg="drift"]')).toHaveCount(1);
  await pickBackground(page, 'drift');
  await expect(page.locator('#bg > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
  const canvas = await page.locator('#bg canvas').elementHandle();
  await page.keyboard.press('Escape');
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText('Jupiter');
  // Restarted for the new subject, unlike the other animated backgrounds.
  await expect.poll(() => page.evaluate(c => c?.isConnected, canvas)).toBe(false);
  await expect(page.locator('#bg > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
});

test('Icons switches the subject backgrounds between one colour and flat colour drawings', async ({ page }) => {
  await handPickedBackground(page, 'drift');
  await page.setViewportSize({ width: 1280, height: 800 });
  /** @type {string[]} */ const loaded = [];
  page.on('requestfinished', r => { const m = r.url().match(/\/src\/backgrounds\/icons\/(mono|flat)\/([a-z]+)\.js/); if (m) loaded.push(`${m[1]}/${m[2]}`); });
  await page.goto('/?seed=1&subject=animals/dogs');
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
  // Its category's drawings alone, in the default style.
  expect(loaded).toEqual(['mono/animals']);
  const canvas = await page.locator('#bg canvas').elementHandle();
  await openPage(page);
  const flat = page.getByRole('button', { name: 'Flat colour' });
  await flat.click();
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  // Restarted in the new style, which loads its own files and keeps the setting.
  await expect.poll(() => page.evaluate(c => c?.isConnected, canvas)).toBe(false);
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
  expect(loaded).toEqual(['mono/animals', 'flat/animals']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-settings-v1') ?? '{}').icons)).toBe('flat');
});

test('icons that failed to load offline draw once the device is back online', async ({ page }) => {
  await handPickedBackground(page, 'drift');
  await page.route('**/src/backgrounds/icons/**', (route) => route.abort());
  await page.goto('/?seed=1&subject=animals/dogs');
  await expect(page.locator('#bg > canvas')).toHaveCount(1);
  await page.waitForTimeout(1000);
  expect(await painted(page, '#bg > canvas')).toBe(false);
  await page.unroute('**/src/backgrounds/icons/**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
});

test('Subject motion runs the motion its subject is mapped to, and a new subject can change it', async ({ page }) => {
  await handPickedBackground(page, 'motion');
  await page.setViewportSize({ width: 1280, height: 800 });
  /** @type {string[]} */ const loaded = [];
  const motions = new Set(/** @type {string[]} */ (Object.values(MOTIONS)));
  page.on('requestfinished', r => { const m = r.url().match(/\/src\/backgrounds\/([a-z-]+)\.js/); if (m && motions.has(m[1])) loaded.push(m[1]); });
  /** @param {string} subject */
  const moduleOf = (subject) => MOTIONS[/** @type {keyof typeof MOTIONS} */ (motionFor(subject))];
  expect(moduleOf('nature/fish')).not.toBe(moduleOf('space/rockets'));
  await page.goto('/?seed=1&subject=nature/fish');
  await expect(page.locator('#bg > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
  expect(loaded).toEqual([moduleOf('nature/fish')]);
  await page.goto('/?seed=1&subject=space/rockets');
  await expect(page.locator('#bg > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bg > canvas')).toBe(true);
  expect(loaded).toEqual([moduleOf('nature/fish'), moduleOf('space/rockets')]);
});

test('the Settings row shows the background in use and how it was chosen', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.locator('#appearance').click();
  const row = page.locator('#settings-bg');
  await expect(row.locator('.bgname')).toHaveText('Galaxy');
  await expect(row.locator('.bgtag')).toHaveText('Theme');
  await expect(row.locator('svg.bgglyph')).toHaveCount(1);
  await row.click();
  await setMode(page, 'random');
  const name = findBackground(await checked(page)).name;
  await expect(page.locator('#bgmode-note')).toHaveText(`A new background with every game. Now: ${name}.`);
  await page.locator('#bg-back').click();
  await expect(row.locator('.bgname')).toHaveText(name ?? '');
  await expect(row.locator('.bgtag')).toHaveText('Random');
  await row.click();
  await pickBackground(page, 'constellation');
  await page.locator('#bg-back').click();
  await expect(row.locator('.bgname')).toHaveText('Constellation');
  await expect(row.locator('.bgtag')).toHaveCount(0);   // Manual: the player's own pick needs no tag
  // The longest name and its tag fit without being cut short.
  await row.click();
  await setMode(page, 'theme');
  await page.locator('#bg-back').click();
  await page.locator('#settings-theme').click();
  await page.locator('.looktile[data-look="graphite/dark"]').click();
  await page.locator('#theme-back').click();
  await expect(row.locator('.bgname')).toHaveText('Constellation');
  expect(await row.locator('.bgname').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
});

// The background shows through the board, fainter than around it, with nothing drawn on
// the letters; a pill keeps solid surface under its colour, so a find reads as on a solid board.
test('the background shows through the board but not through its found words', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.locator('.cell').first().waitFor();
  /** The alpha of a colour. @param {string} c */
  const alpha = (c) => { const m = c.match(/[\d.]+/g) ?? []; return m.length > 3 ? Number(m[3]) : 1; };
  await openPage(page);
  await pickBackground(page, 'koi');
  expect(alpha(await page.locator('#gridbox').evaluate(el => getComputedStyle(el).backgroundColor))).toBe(0.8);
  // The blur is of what is behind the board; its letters stay crisp, with no shadow.
  expect(await page.locator('.cell').first().evaluate(el => getComputedStyle(el).textShadow)).toBe('none');
  await page.keyboard.press('Escape');
  await findAndDrag(page, ((await page.locator('#list .w').first().textContent()) ?? '').trim().toUpperCase());
  // A found word's colour is opaque, so its letters sit on it whatever is behind the board.
  const bead = await page.locator('#pills .p1').evaluate(el => {
    const probe = document.body.appendChild(document.createElement('i'));
    probe.style.color = 'var(--pill-1)';
    const c = getComputedStyle(probe).color;
    probe.remove();
    return { c, image: getComputedStyle(el).backgroundImage };
  });
  expect(alpha(bead.c)).toBe(1);
  expect(bead.image).toContain(bead.c);
});

test('at 320 wide the Background page stacks each label over its control, and nothing runs off the card', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?seed=1&subject=sports/golf');
  await openPage(page);
  await setMode(page, 'manual');
  await page.locator('#bgdrop').click();
  const edges = await page.evaluate(() => {
    const card = /** @type {HTMLElement} */ (document.getElementById('settingscard'));
    const right = card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
    const controls = [...document.querySelectorAll('#settings-bgpage :is(select, .bgdrop, .bgmenu:not([hidden]) .bgtile)')].map(b => b.getBoundingClientRect().right);
    return { scroll: card.scrollWidth, client: card.clientWidth, right, widest: Math.max(...controls), count: controls.length };
  });
  expect(edges.count).toBe(1 + 1 + BACKGROUNDS.length);
  expect(edges.scroll).toBeLessThanOrEqual(edges.client);
  expect(edges.widest).toBeLessThanOrEqual(edges.right + 0.5);
  const label = await page.locator('#lbl-bgmode').boundingBox();
  const select = await page.locator('#settings-bgmode').boundingBox();
  expect((select?.y ?? 0)).toBeGreaterThanOrEqual((label?.y ?? 0) + (label?.height ?? 0));
  const head = await page.locator('#bghead').boundingBox();
  const drop = await page.locator('#bgdrop').boundingBox();
  expect((drop?.y ?? 0)).toBeGreaterThanOrEqual((head?.y ?? 0) + (head?.height ?? 0));
});

test('Subject motion\'s one large school starts beside the board, so a reduced-motion frame shows it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wordfinder-settings-v1',
    JSON.stringify({ bgmode: 'manual', art: 'motion', motion: 'reduce' })));
  // Seeds 1 and 4 deal swim's one-school variant; a landscape board takes the left, a portrait one the top.
  for (const [width, height, seed] of [[1280, 800, 1], [390, 844, 4]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/?seed=${seed}&subject=animals/jellyfish`);
    await expect(page.locator('#bg canvas')).toHaveCount(1);
    const beside = () => page.evaluate(() => {
      const cv = /** @type {HTMLCanvasElement} */ (document.querySelector('#bg canvas'));
      const board = /** @type {Element} */ (document.getElementById('gridbox')).getBoundingClientRect();
      const k = cv.width / innerWidth, wide = innerWidth > innerHeight;
      const x = wide ? Math.ceil(board.right * k) : 0, y = wide ? 0 : Math.ceil(board.bottom * k);
      const data = cv.getContext('2d')?.getImageData(x, y, cv.width - x, cv.height - y).data ?? [];
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
      return n;
    });
    await expect.poll(beside, { message: `${width}x${height}` }).toBeGreaterThan(2000);
  }
});

test('flutter\'s flocks never leave a phone\'s screen bare for long', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  // A minute and a half of the flock variant (seed 1) on a phone-sized host, its frames run by
  // hand and painting nothing: the longest stretch, in ms, with no icon on the host.
  const bare = await page.evaluate(async (mod) => {
    const { start } = await import(mod);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px';
    document.body.append(host);
    /** @type {FrameRequestCallback[]} */ let queue = [];
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => queue.push(cb);
    const stop = start(host, { colors: ['#e33', '#3a3', '#33e'], dark: true, reducedMotion: false, subject: 'tech/drones', seed: 1 });
    const cv = /** @type {HTMLCanvasElement} */ (host.querySelector('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    /** @type {[number, number][]} */ const frames = [];
    let now = 0;
    ctx.clearRect = () => { frames.push([now, 0]); };
    ctx.drawImage = (/** @type {any[]} */ ...a) => {
      const { a: m, b, e, f } = ctx.getTransform(), r = a[3] * Math.hypot(m, b) / 2;
      if (frames.length && e > -r && f > -r && e < cv.width + r && f < cv.height + r) frames[frames.length - 1][1]++;
    };
    const tick = () => { now += 1000 / 60; const due = queue; queue = []; for (const cb of due) cb(now); };
    // The sprites load in their own time; then the clock starts.
    while (!frames.some(([, hits]) => hits)) { tick(); await new Promise(r => setTimeout(r, 20)); }
    frames.length = 0;
    while (now < 90_000) tick();
    stop();
    window.requestAnimationFrame = raf;
    let since = -1, worst = 0;
    for (const [t, hits] of frames) {
      if (hits) since = -1; else if (since < 0) since = t; else worst = Math.max(worst, t - since);
    }
    return worst;
  }, '/src/backgrounds/icon-flutter.js');
  expect(bare).toBeLessThan(2000);
});
