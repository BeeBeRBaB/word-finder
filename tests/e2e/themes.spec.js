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

test('the Theme row opens a page of every theme, its palettes as tiles, the current one focused', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await expect(page.locator('#settings-body')).toBeHidden();
  await expect(page.locator('.lookgroup')).toHaveCount(7);
  await expect(page.locator('.looktile')).toHaveCount(28);
  await expect(page.locator('#look-plum')).toHaveText('Plum');
  await expect(page.locator('.looktile[data-look="plum/jewel"] input')).toHaveAccessibleName('Plum Jewel');
  await expect(page.locator('.looktile[data-look="phosphor/classic"] input')).toBeFocused();
  await expect(page.locator('.looktile[data-look="phosphor/classic"] input')).toBeChecked();
  for (const h of await page.locator('.looktile').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  // Every id in the page once, now that both pages' markup is in.
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dupes).toEqual([]);
});

test('a tile applies its theme and palette at once, is shown on the row, and is remembered', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  await openPage(page);
  await page.locator('.looktile[data-look="grove/calm"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'grove');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'calm');
  await expect(page.locator('#settings-themepage')).toBeVisible();   // stays, to compare others
  await page.locator('#theme-back').click();
  await expect(page.locator('#settings-theme')).toBeFocused();
  await expect(page.locator('#settings-theme')).toHaveAccessibleName('Theme Grove · Calm');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'grove');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'calm');
  await openPage(page);
  await expect(page.locator('.looktile[data-look="grove/calm"] input')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
});

test('each preview shows the colours its look really has, in either mode', async ({ page }) => {
  await page.goto('/?seed=1&subject=space/jupiter');
  for (const mode of ['dark', 'light']) {
    await page.locator('#appearance').click();
    await page.locator(`#mode-${mode}`).click();
    await page.locator('#settings-theme').click();
    const before = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    const shown = await page.locator('.looktile').evaluateAll(ts => ts.map(t => [
      /** @type {HTMLElement} */ (t).dataset.look, getComputedStyle(/** @type {Element} */ (t.querySelector('.lookprev'))).backgroundColor]));
    // Reading them left the page in its own look.
    expect(await page.evaluate(() => ({ ...document.documentElement.dataset }))).toEqual(before);
    for (const [look, bg] of shown) {
      await page.locator(`.looktile[data-look="${look}"]`).click();
      expect(await rootBg(page), `${look} ${mode}`).toBe(bg);
    }
    await page.keyboard.press('Escape');
  }
});
