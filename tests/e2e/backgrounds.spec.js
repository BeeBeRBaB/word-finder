import { test, expect } from '@playwright/test';
import { findAndDrag } from './helpers.js';

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

test('the Background page has a tile per background, marked Still or Animated', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  const tiles = page.locator('.bgtile');
  await expect(tiles).toHaveCount(14);
  await expect(page.locator('.bgtile[data-bg="aurora"] .bgbadge')).toHaveText('Animated');
  await expect(page.locator('.bgtile[data-bg="pixel"] .bgbadge')).toHaveText('Still');
  // The current choice has focus, so the arrow keys move through the choices at once.
  await expect(page.locator('.bgtile[data-bg="illustrated"] input')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bgtile[data-bg="pixel"] input')).toBeChecked();
  // Every tile is a 44px target.
  for (const box of await tiles.evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
});

test('an animated background runs behind the word list, then the whole page, and stops for a still one', async ({ page }) => {
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
    return page.locator('#bgside canvas').count();
  }).toBe(1);
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
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await expect(page.locator('#art svg')).toBeVisible();
  await openPage(page);
  const card = await page.locator('#settingscard').boundingBox();
  // Read mid-slide, the translate leaves a few millionths of a pixel on the width.
  expect(card?.width).toBeCloseTo(390, 1);
  await expect(page.locator('#bg-back')).toBeVisible();
  await expect(page.locator('#bg-close')).toBeHidden();
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
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('.bgtile[data-bg="scene"] .bgbadge')).toHaveText('Still');
  await expect(page.locator('.bgtile[data-bg="drift"] .bgbadge')).toHaveText('Animated');
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

test('on a phone with Word list the scene keeps the board corner, and moves to the rail in landscape', async ({ page }) => {
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

// Full screen lets the background through the board, fainter than around it, with nothing drawn on
// the letters; a pill keeps solid surface under its colour, so a find reads as on a solid board.
test('in Full screen the background shows through the board but not through its pills', async ({ page }) => {
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
