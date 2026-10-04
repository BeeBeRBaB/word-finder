import { test, expect } from '@playwright/test';
import { openBoard, handPickedBackground, findAndDrag } from './helpers.js';
import { findBackground, resolveBackground } from '../../src/backgrounds.js';
import { MOTIONS } from '../../src/backgrounds/subject-motion.js';
import { motionFor } from '../../src/backgrounds/icon-scene.js';

/** @typedef {import('@playwright/test').Page} Page */

// The animated modules load on first use; a cached copy must not stand in for the one under test.
test.use({ serviceWorkers: 'block' });

/** Whether every icon drawn in `sel` is one of the dealt subject's. @param {Page} page @param {string} sel */
const ownIcons = (page, sel) => page.evaluate(async ([sel, mod]) => {
  const { iconsFor } = await import(mod);
  const ids = iconsFor(JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}').subjectId);
  const drawn = [...document.querySelectorAll(`${sel} [data-icon]`)].map(g => g.getAttribute('data-icon') ?? '');
  return drawn.length > 0 && drawn.every(id => ids.includes(id));
}, [sel, '/src/backgrounds/icon-scene.js']);
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
const mode = (page, mode) => page.locator(`#settings-bgpage [data-setting="bgmode"] [data-value="${mode}"]`);
/** The background showing, as the page's checked tile says. @param {Page} page */
const checked = (page) => page.locator('#bg-tiles input:checked').inputValue();
/** What the page draws, by the kind of background: a canvas, the scene, the category art, or nothing.
 * @param {Page} page */
const drawn = (page) => page.evaluate(() => {
  if (document.querySelector('#bg canvas, #bgside canvas')) return 'animated';
  if (document.querySelector('#bg > svg, #bgside > svg')) return 'scene';
  return document.querySelector('#art svg[data-kind]')?.getAttribute('data-kind') ?? 'none';
});
/** @param {Page} page @returns {Promise<{seed:number, bg?:string}>} the saved board */
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}'));
/** Rewrite the saved board's Random pick; undefined drops it, as a save from before it had one.
 * @param {Page} page @param {string|undefined} bg */
const resave = (page, bg) => page.evaluate((bg) => {
  const save = JSON.parse(localStorage.getItem('wordfinder-save-v1') ?? '{}');
  localStorage.setItem('wordfinder-save-v1', JSON.stringify({ ...save, bg }));
}, bg);
/** What `id` draws, by drawn()'s kinds. @param {string} id */
const kindOf = (id) => {
  const bg = findBackground(id);
  return bg.animated ? 'animated' : bg.file ? 'scene' : bg.id;
};

test('the Background page has the mode, the area, and Still and Animated groups of tiles', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  // A new player: each theme's own background, on the whole page.
  await expect(page.getByRole('group', { name: 'Choose' }).getByRole('button')).toHaveText(['Theme', 'Random', 'Manual']);
  await expect(mode(page, 'theme')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bgmode-note')).toHaveText('Each theme comes with its own background.');
  await expect(page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]')).toHaveAttribute('aria-pressed', 'true');
  const still = page.getByRole('group', { name: 'Still' }), moving = page.getByRole('group', { name: 'Animated' });
  await expect(still.getByRole('radio')).toHaveCount(4);
  await expect(moving.getByRole('radio')).toHaveCount(15);
  expect(await still.locator('.bgtile').evaluateAll(ts => ts.map(t => t.getAttribute('data-bg')))).toEqual(['illustrated', 'pixel', 'scene', 'none']);
  await expect(page.locator('.bgtile')).toHaveCount(19);
  await expect(page.locator('.bgbadge')).toHaveCount(0);
  // Phosphor's Starfield is showing, so it is checked, and has focus for the arrow keys.
  await expect(page.locator('.bgtile[data-bg="starfield"] input')).toBeChecked();
  await expect(page.locator('.bgtile[data-bg="starfield"] input')).toBeFocused();
  // One set of radios across both groups: the arrows run from the last Still tile to the first Animated one.
  await page.locator('.bgtile[data-bg="none"] input').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bgtile[data-bg="drift"] input')).toBeChecked();
  await expect(page.locator('.bgtile[data-bg="drift"] input')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.bgtile[data-bg="none"] input')).toBeChecked();
  await expect(mode(page, 'manual')).toHaveAttribute('aria-pressed', 'true');
  // Every tile and button is a 44px target.
  const heights = await page.locator('#settings-bgpage .bgtile, #settings-bgpage .seg button').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height));
  expect(heights).toHaveLength(24);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});

test('Theme mode shows each theme\'s own background, in either flavour, and follows a change of theme', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#bg canvas')).toHaveCount(1);   // Phosphor's Starfield, on the whole page
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Starfield Theme');
  await page.locator('#settings-theme').click();
  // Broadsheet's is the still illustration: the animation stops and the category art draws.
  await page.locator('.looktile[data-look="broadsheet/light"]').click();
  await expect(page.locator('#bg canvas')).toHaveCount(0);
  await expect(page.locator('#art svg[data-kind="illustrated"]')).toHaveCount(1);
  const loaded = page.waitForRequest(/\/src\/backgrounds\/constellation\.js/);
  await page.locator('.looktile[data-look="graphite/dark"]').click();
  await loaded;
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await expect(page.locator('#art svg')).toHaveCount(0);
  await page.locator('.looktile[data-look="graphite/light"]').click();
  await page.locator('#theme-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Constellation Theme');
  await page.locator('#settings-bg').click();
  await expect(page.locator('.bgtile[data-bg="constellation"] input')).toBeChecked();
});

test('picking a tile makes it the Manual choice, even the one Theme already shows', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="starfield"]').click();
  await expect(mode(page, 'manual')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bgmode-note')).toHaveText('The one you pick below.');
  await mode(page, 'theme').click();
  await page.locator('.bgtile[data-bg="aurora"]').click();
  await expect(mode(page, 'manual')).toHaveAttribute('aria-pressed', 'true');
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
  await mode(page, 'theme').click();
  await expect(page.locator('.bgtile[data-bg="illustrated"] input')).toBeChecked();
  await expect(page.locator('#bg canvas')).toHaveCount(0);
  await mode(page, 'manual').click();
  await expect(page.locator('.bgtile[data-bg="aurora"] input')).toBeChecked();
  await page.reload();
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Aurora');
});

test('Random picks again for every new game, and Undo and a reload keep the board\'s own pick', async ({ page }) => {
  await openBoard(page, '/');   // no ?seed=, so a reload puts the saved board back
  await openPage(page);
  await mode(page, 'random').click();
  await expect(page.locator('#bgmode-note')).toHaveText('A new background with every game.');
  const first = await checked(page);
  expect(first).not.toBe('none');
  await expect.poll(() => drawn(page)).toBe(kindOf(first));
  await page.locator('#bg-back').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName(new RegExp(` Random$`));
  // Not a new theme, a resize or another setting: only a new game picks again.
  await page.locator('#settings-theme').click();
  await page.locator('.looktile[data-look="plum/light"]').click();
  await page.locator('#theme-back').click();
  await page.locator('#settings-bg').click();
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="list"]').click();
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
  await expect.poll(() => drawn(page)).toBe(kindOf(second));
  expect((await saved(page)).bg).toBe(second);   // the pick is saved with its board
  await page.locator('#toast-undo').click();
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  expect(await checked(page)).toBe(first);
  expect((await saved(page)).bg).toBe(first);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  await expect(page.locator('#subject')).toHaveText(subject ?? '');
  expect(await checked(page)).toBe(first);
  await expect.poll(() => drawn(page)).toBe(kindOf(first));

  // A reload shows the pick the save holds; a save from before it was kept picks by its seed alone.
  const other = first === 'aquarium' ? 'skyline' : 'aquarium';
  await resave(page, other);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  expect(await checked(page)).toBe(other);
  await resave(page, undefined);
  await page.reload();
  await page.locator('.cell').first().waitFor();
  expect(await checked(page)).toBe(resolveBackground('random', '', '', (await saved(page)).seed));
});

test('an animated background runs behind the word list, then the whole page, and stops for a still one', async ({ page }) => {
  await handPickedBackground(page);
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="aurora"]').click();
  await expect(page.locator('#bgside canvas')).toHaveCount(1);
  await expect(page.locator('#bg canvas')).toHaveCount(0);
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  await expect(page.locator('#bgside canvas')).toHaveCount(0);
  // Under the page: it takes no clicks, and the board still paints over it.
  await page.keyboard.press('Escape');
  expect(await page.locator('#bg').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  const top = await page.evaluate(() => {
    const r = /** @type {HTMLElement} */ (document.getElementById('gridbox')).getBoundingClientRect();
    return document.elementFromPoint(r.x + 5, r.y + 5)?.closest('#gridbox') !== null;
  });
  expect(top).toBe(true);
  await openPage(page);
  await page.locator('.bgtile[data-bg="pixel"]').click();
  await expect(page.locator('#bg canvas, #bgside canvas')).toHaveCount(0);
});

// The ring is 24 shadows on every glyph, painted for nothing when nothing is behind the text.
// The header never takes it: in Full screen it sits on a plate of the ground, since the ring
// blurred its small label and, in WebKit, painted over the name's underline.
test('text keeps its ground-colour ring only where something is drawn behind it', async ({ page }) => {
  await handPickedBackground(page);
  await page.goto('/?seed=1&subject=space/jupiter');
  /** @param {string} sel */
  const ring = (sel) => page.locator(sel).first().evaluate(el => getComputedStyle(el).textShadow !== 'none');
  await page.locator('#list .w').first().waitFor();
  expect(await ring('#list .w')).toBe(false);   // still art keeps to the board corner or below the list
  await openPage(page);
  await page.locator('.bgtile[data-bg="aurora"]').click();
  expect(await ring('#list .w')).toBe(true);
  expect(await ring('#subject')).toBe(false);   // Word list: nothing behind the header
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await page.locator('.bgtile[data-bg="none"]').click();
  expect(await ring('#list .w')).toBe(false);
  expect(await ring('#subject')).toBe(false);
  await page.locator('.bgtile[data-bg="illustrated"]').click();   // large, behind everything
  expect(await ring('#list .w')).toBe(true);
  expect(await ring('#subject')).toBe(false);
  const hdr = await page.locator('#hdr').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, ground: getComputedStyle(document.body).backgroundColor, spread: cs.boxShadow };
  });
  expect(hdr.bg).toBe(hdr.ground);
  expect(hdr.spread).toContain(hdr.ground);
});

test('the choice and area are remembered, and a new deal keeps the background running', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="starfield"]').click();
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await page.reload();
  await expect(page.locator('#bg canvas')).toHaveCount(1);
  const canvas = await page.locator('#bg canvas').elementHandle();
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText('Jupiter');
  // The same canvas: an ordinary background is not restarted by a deal.
  expect(await page.evaluate(c => c?.isConnected, canvas)).toBe(true);
  await page.locator('#appearance').click();
  await expect(page.locator('#settings-bg')).toHaveAccessibleName('Background Starfield');
});

test('a background that could not load draws once the device is back online', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.route(/\/src\/backgrounds\/aurora-drift\.js/, route => route.abort('internetdisconnected'));
  const failed = page.waitForEvent('requestfailed', r => r.url().includes('aurora-drift.js'));
  await openPage(page);
  await page.locator('.bgtile[data-bg="aurora"]').click();
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
    JSON.stringify({ bgmode: 'manual', art: 'motion', area: 'full' })));
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

test('on a phone the page is full screen with Back, and Full screen still art leaves the board corner', async ({ page }) => {
  await handPickedBackground(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#art svg')).toBeVisible();
  await openPage(page);
  const card = await page.locator('#settingscard').boundingBox();
  // Read mid-slide, the translate leaves a few millionths of a pixel on the width.
  expect(card?.width).toBeCloseTo(390, 1);
  await expect(page.locator('#bg-back')).toBeVisible();
  await expect(page.locator('#bg-close')).toBeHidden();
  // Nothing on the page is wider than the phone.
  expect(await page.evaluate(() => document.getElementById('settingscard')?.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  await page.locator('#bg-back').click();
  await page.locator('#settings-back').click();
  // Fixed to the page now, not clipped inside the board.
  expect(await page.locator('#art').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  const art = await page.locator('#art svg').boundingBox();
  const board = await page.locator('#gridbox').boundingBox();
  expect((art?.y ?? 0) + (art?.height ?? 0)).toBeGreaterThan((board?.y ?? 0) + (board?.height ?? 0));
});

test('the subject backgrounds draw the subject\'s icons, and a new deal draws the new subject\'s', async ({ page }) => {
  await handPickedBackground(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.getByRole('group', { name: 'Still' }).locator('.bgtile[data-bg="scene"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Animated' }).locator('.bgtile[data-bg="drift"]')).toHaveCount(1);
  await page.locator('.bgtile[data-bg="scene"]').click();
  // Behind the list in the rail: a picture of several icons, and no category art in the corner.
  await expect(page.locator('#bgside > svg g')).not.toHaveCount(0);
  await expect(page.locator('#art svg, #railart svg')).toHaveCount(0);
  expect(await ownIcons(page, '#bgside')).toBe(true);
  const before = await page.locator('#bgside > svg').innerHTML();
  await page.keyboard.press('Escape');
  await page.locator('#newbtn').click();
  await expect(page.locator('#subject')).not.toHaveText('Jupiter');
  await expect.poll(() => page.locator('#bgside > svg').innerHTML()).not.toBe(before);
  await expect(page.locator('#bgside > svg')).toHaveCount(1);
  expect(await ownIcons(page, '#bgside')).toBe(true);

  await openPage(page);
  await page.locator('.bgtile[data-bg="drift"]').click();
  await expect(page.locator('#bgside > canvas')).toHaveCount(1);
  await expect(page.locator('#bgside > svg')).toHaveCount(0);
  await expect.poll(() => painted(page, '#bgside > canvas')).toBe(true);
  const canvas = await page.locator('#bgside canvas').elementHandle();
  await page.keyboard.press('Escape');
  await page.locator('#newbtn').click();
  // Restarted for the new subject, unlike the other animated backgrounds.
  await expect.poll(() => page.evaluate(c => c?.isConnected, canvas)).toBe(false);
  await expect(page.locator('#bgside > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bgside > canvas')).toBe(true);
});

test('Subject motion runs the motion its subject is mapped to, and a new subject can change it', async ({ page }) => {
  await handPickedBackground(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  /** @type {string[]} */ const loaded = [];
  const motions = new Set(/** @type {string[]} */ (Object.values(MOTIONS)));
  page.on('requestfinished', r => { const m = r.url().match(/\/src\/backgrounds\/([a-z-]+)\.js/); if (m && motions.has(m[1])) loaded.push(m[1]); });
  /** @param {string} subject */
  const moduleOf = (subject) => MOTIONS[/** @type {keyof typeof MOTIONS} */ (motionFor(subject))];
  expect(moduleOf('nature/fish')).not.toBe(moduleOf('space/rockets'));
  await page.goto('/?seed=1&subject=nature/fish');
  await openPage(page);
  await page.locator('.bgtile[data-bg="motion"]').click();
  await expect(page.locator('#bgside > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bgside > canvas')).toBe(true);
  expect(loaded).toEqual([moduleOf('nature/fish')]);
  await page.goto('/?seed=1&subject=space/rockets');
  await expect(page.locator('#bgside > canvas')).toHaveCount(1);
  await expect.poll(() => painted(page, '#bgside > canvas')).toBe(true);
  expect(loaded).toEqual([moduleOf('nature/fish'), moduleOf('space/rockets')]);
});

test('on a phone with Word list the scene keeps the board corner, and moves to the rail in landscape', async ({ page }) => {
  await handPickedBackground(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.bgtile[data-bg="scene"]').click();
  await page.locator('#bg-back').click();
  await page.locator('#settings-back').click();
  // One icon in the corner, faded like the category art, and nothing behind the list.
  const corner = page.locator('#art > svg');
  await expect(corner).toHaveCount(1);
  await expect(corner).toBeVisible();
  expect(await corner.getAttribute('data-kind')).toBeNull();
  await expect(corner.locator('[data-icon]')).toHaveCount(1);
  expect(await ownIcons(page, '#art')).toBe(true);
  const fade = await corner.evaluate(el => [getComputedStyle(el).opacity, getComputedStyle(el).getPropertyValue('--art-board')].map(Number));
  expect(fade[0]).toBe(fade[1]);
  expect(fade[0]).toBeLessThan(0.6);
  await expect(page.locator('#bgside > *')).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#bgside > svg')).toHaveCount(1);
  await expect(page.locator('#art > svg')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(page.locator('#art > svg')).toHaveCount(1);
  await expect(page.locator('#bgside > *')).toHaveCount(0);
  // Back to Illustrated: the category art takes the corner again.
  await openPage(page);
  await page.locator('.bgtile[data-bg="illustrated"]').click();
  await expect(page.locator('#art > svg')).toHaveCount(1);
  expect(await page.locator('#art > svg').getAttribute('data-kind')).toBe('illustrated');
});

test('the Settings row shows the background in use and how it was chosen', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.locator('#appearance').click();
  const row = page.locator('#settings-bg');
  await expect(row.locator('.bgname')).toHaveText('Starfield');
  await expect(row.locator('.bgtag')).toHaveText('Theme');
  await expect(row.locator('svg.bgglyph')).toHaveCount(1);
  await row.click();
  await mode(page, 'random').click();
  const pick = await checked(page);
  const name = await page.locator(`.bgtile[data-bg="${pick}"] .bgname`).textContent();
  await page.locator('#bg-back').click();
  await expect(row.locator('.bgname')).toHaveText(name ?? '');
  await expect(row.locator('.bgtag')).toHaveText('Random');
  await row.click();
  await page.locator('.bgtile[data-bg="constellation"]').click();
  await page.locator('#bg-back').click();
  await expect(row.locator('.bgname')).toHaveText('Constellation');
  await expect(row.locator('.bgtag')).toHaveCount(0);   // Manual: the player's own pick needs no tag
  // The longest name and its tag fit without being cut short.
  await row.click();
  await mode(page, 'theme').click();
  await page.locator('#bg-back').click();
  await page.locator('#settings-theme').click();
  await page.locator('.looktile[data-look="graphite/dark"]').click();
  await page.locator('#theme-back').click();
  await expect(row.locator('.bgname')).toHaveText('Constellation');
  expect(await row.locator('.bgname').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
});

// Full screen lets the background through the board, fainter than around it, with nothing drawn on
// the letters; a pill keeps solid surface under its colour, so a find reads as on a solid board.
test('in Full screen the background shows through the board but not through its pills', async ({ page }) => {
  await handPickedBackground(page);
  await page.goto('/?seed=1&subject=space/jupiter');
  await page.locator('.cell').first().waitFor();
  /** The alpha of an element's background colour. @param {string} sel */
  const alpha = (sel) => page.locator(sel).first().evaluate(el => {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? [];
    return m.length > 3 ? Number(m[3]) : 1;
  });
  const surface = () => page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.background = 'var(--surface)';
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  await openPage(page);
  await page.locator('.bgtile[data-bg="aurora"]').click();
  expect(await alpha('#gridbox')).toBe(1);   // Word list: the board stays solid
  await page.locator('#settings-bgpage [data-setting="area"] [data-value="full"]').click();
  const a = await alpha('#gridbox');
  expect(a).toBeGreaterThan(0.5);
  expect(a).toBeLessThan(1);
  // No ring or blur: the letters stay crisp.
  expect(await page.locator('#gridbox').evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none');
  expect(await page.locator('.cell').first().evaluate(el => getComputedStyle(el).textShadow)).toBe('none');
  await page.keyboard.press('Escape');
  await findAndDrag(page, ((await page.locator('#list .w').first().textContent()) ?? '').trim().toUpperCase());
  const pill = await page.locator('#pills .p1').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }));
  expect(pill.bg).toBe(await surface());
  expect(pill.image).toContain('linear-gradient');
  // Nothing behind it: the board is solid again.
  await openPage(page);
  await page.locator('.bgtile[data-bg="none"]').click();
  expect(await alpha('#gridbox')).toBe(1);
});

test('at 320 wide the Background page stacks each label over its switch, and nothing runs off the card', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?seed=1&subject=sports/golf');
  await openPage(page);
  const edges = await page.evaluate(() => {
    const card = /** @type {HTMLElement} */ (document.getElementById('settingscard'));
    const right = card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
    const buttons = [...document.querySelectorAll('#settings-bgpage .seg button')].map(b => b.getBoundingClientRect().right);
    return { scroll: card.scrollWidth, client: card.clientWidth, right, widest: Math.max(...buttons) };
  });
  expect(edges.scroll).toBeLessThanOrEqual(edges.client);
  expect(edges.widest).toBeLessThanOrEqual(edges.right + 0.5);
  const label = await page.locator('#lbl-bgmode').boundingBox();
  const manual = await page.locator('#settings-bgpage [data-setting="bgmode"] [data-value="manual"]').boundingBox();
  expect((manual?.y ?? 0)).toBeGreaterThanOrEqual((label?.y ?? 0) + (label?.height ?? 0));
});

test('Subject motion\'s one large school starts beside the board, so a reduced-motion frame shows it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wordfinder-settings-v1',
    JSON.stringify({ bgmode: 'manual', art: 'motion', area: 'full', motion: 'reduce' })));
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
  await handPickedBackground(page);
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
