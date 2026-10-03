import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

// The previews are read off the live stylesheet; a cached copy must not stand in for it.
test.use({ serviceWorkers: 'block' });

/** @param {Page} page */
async function openPage(page) {
  await page.locator('#appearance').click();
  await page.locator('#settings-theme').click();
  await expect(page.locator('#settings-themepage')).toBeVisible();
}

/** @param {Page} page @returns {Promise<string>} */
const rootBg = (page) => page.evaluate(() => {
  const probe = document.body.appendChild(document.createElement('i'));
  probe.style.color = 'var(--bg)';
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
});

test('the Theme row opens a page of every theme in Light and Dark, the current one focused', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  await expect(page.locator('.lookgroup')).toHaveCount(7);
  await expect(page.locator('.looktile')).toHaveCount(14);
  await expect(page.locator('#look-plum')).toHaveText('Plum');
  await expect(page.locator('.looktile[data-look="plum/light"] input')).toHaveAccessibleName('Plum Light');
  await expect(page.locator('.looktile[data-look="phosphor/dark"] input')).toBeFocused();
  await expect(page.locator('.looktile[data-look="phosphor/dark"] input')).toBeChecked();
  // The Mode switch is gone: a flavour is part of the look.
  await expect(page.locator('#settings-mode')).toHaveCount(0);
  for (const h of await page.locator('.looktile').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  // Every id in the page once, now that both pages' markup is in.
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dupes).toEqual([]);
});

test('a tile applies its theme and flavour at once, is shown on the row, and is remembered', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.looktile[data-look="grove/light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'grove');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  await expect(page.locator('#settings-themepage')).toBeVisible();   // stays, to compare others
  await page.locator('#theme-back').click();
  await expect(page.locator('#settings-theme')).toBeFocused();
  await expect(page.locator('#settings-theme')).toHaveAccessibleName('Theme Grove · Light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'grove');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  await openPage(page);
  await expect(page.locator('.looktile[data-look="grove/light"] input')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
});

test('each preview shows the colours its look really has', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  const before = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  const shown = await page.locator('.looktile').evaluateAll(ts => ts.map(t => [
    /** @type {HTMLElement} */ (t).dataset.look, getComputedStyle(/** @type {Element} */ (t.querySelector('.lookprev'))).backgroundColor]));
  // Reading them left the page in its own look.
  expect(await page.evaluate(() => ({ ...document.documentElement.dataset }))).toEqual(before);
  expect(new Set(shown.map(([, bg]) => bg)).size, 'every look has its own ground').toBe(shown.length);
  for (const [look, bg] of shown) {
    await page.locator(`.looktile[data-look="${look}"]`).click();
    expect(await rootBg(page), look).toBe(bg);
  }
});
