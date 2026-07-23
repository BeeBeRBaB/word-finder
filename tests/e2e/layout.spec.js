import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

// Real Safari innerHeight (browser chrome subtracted) — what players actually get.
const DEVICES = [
  { name: 'iPhone 13 portrait',      w: 390,  h: 664 },
  { name: 'iPhone 13 landscape',     w: 844,  h: 300 },
  { name: 'iPhone Pro Max portrait', w: 430,  h: 752 },
  { name: 'iPhone Pro Max landscape',w: 932,  h: 340 },
  { name: 'iPad Mini portrait',      w: 744,  h: 1053 },
  { name: 'iPad Mini landscape',     w: 1133, h: 664 },
  { name: 'Desktop',                 w: 1440, h: 900 },
];

/**
 * @param {Page} page
 * @returns {Promise<{gridOverflowY:number, gridOverflowX:number, clippedY:number, clippedX:number, offscreen:(string|null)[]}>}
 */
async function measure(page) {
  return page.evaluate(() => {
    /** @param {string} id @returns {HTMLElement} */
    const q = id => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`missing element #${id}`);
      return el;
    };
    const gb = q('gridbox').getBoundingClientRect();
    const app = q('app');
    const offscreen = [...document.querySelectorAll('.w')]
      .filter(e => {
        const r = e.getBoundingClientRect();
        return r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5;
      })
      .map(e => e.textContent);
    return {
      gridOverflowY: Math.round(gb.bottom - innerHeight),
      gridOverflowX: Math.round(gb.right - innerWidth),
      clippedY: app.scrollHeight - app.clientHeight,
      clippedX: app.scrollWidth - app.clientWidth,
      offscreen,
    };
  });
}

for (const d of DEVICES) {
  test(`layout fits: ${d.name} (${d.w}x${d.h})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'viewport is set explicitly');

    await page.setViewportSize({ width: d.w, height: d.h });
    await page.goto('/');
    await page.waitForTimeout(250);
    const m = await measure(page);

    expect(m.offscreen, `words off screen: ${m.offscreen.join(', ')}`).toHaveLength(0);
    expect(m.gridOverflowY, 'grid extends below the viewport').toBeLessThanOrEqual(0);
    expect(m.gridOverflowX, 'grid extends past the right edge').toBeLessThanOrEqual(0);
    expect(m.clippedY, 'content clipped vertically by #app').toBe(0);
    expect(m.clippedX, 'content clipped horizontally by #app').toBe(0);
  });
}
