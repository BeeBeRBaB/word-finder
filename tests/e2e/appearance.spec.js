import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';

/** @typedef {import('@playwright/test').Page} Page */

// No service worker for this file. `sw.js` serves code stale-while-revalidate, so a
// cached `main.js` is handed back from `caches.match()` without ever touching the
// network — which silently defeats the `page.route(...).abort()` in the module-blocked
// test below, and would let it pass while proving nothing. The appearance tests are
// about the inline resolver and the palette, never about caching; `regressions.spec.js`
// owns the service worker's behaviour and keeps its own workers.
test.use({ serviceWorkers: 'block' });

// The pill colours moved out of view.js's PAL and into the palette. A pill that
// renders transparent means the class/variable wiring broke, which no existing
// test would notice — they all assert on the word list, not the grid overlay.
test('a found word paints a pill coloured by the stylesheet', async ({ page }) => {
  await page.goto('/?seed=1&topic=0');
  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));

  const pill = page.locator('#pills .pill').first();
  await expect(pill).toHaveClass(/\bp1\b/);
  const paint = await pill.evaluate(el => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, ring: cs.boxShadow };
  });
  expect(paint.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(paint.ring).not.toBe('none');
});

// A Global Constraint of this work is that dark is unchanged value for value. These
// are the literals styles.css shipped with, read back through the token layer.
// Custom properties are not colour-normalised by getComputedStyle, so what comes
// back is the authored text — which is exactly what needs pinning here.
test('the dark palette still resolves to the colours the game shipped with', async ({ page }) => {
  await page.goto('/?seed=1&topic=0');
  await page.evaluate(() => { document.documentElement.dataset.appearance = 'dark'; });
  const seen = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    /** @param {string} n */
    const pick = (n) => cs.getPropertyValue(n).trim();
    return {
      bg: pick('--bg'), surface: pick('--surface'), border: pick('--border'),
      text: pick('--text'), textStrong: pick('--text-strong'), muted: pick('--muted'),
      label: pick('--label'), hint: pick('--hint'),
      accent: pick('--accent'), accentText: pick('--accent-text'), accentInk: pick('--accent-ink'),
      pill1: pick('--pill-1'), pillEdge: pick('--pill-edge'),
    };
  });
  expect(seen).toEqual({
    bg: '#16262f', surface: '#1d2f3a', border: '#2c4250',
    text: '#dfe9e5', textStrong: '#eef6f2', muted: '#9fb8ae',
    label: '#6fa899', hint: '#7d968c',
    accent: '#4fd1a5', accentText: '#8fe8c8', accentInk: '#0b2c20',
    pill1: 'rgba(240,196,90,.38)', pillEdge: 'rgba(255,255,255,.25)',
  });
});

// Task 6's inline <head> script now sets data-appearance on every normal load, so the
// pre-Task-6 "nothing ever sets the attribute" world no longer exists — this
// supersedes that version of the test (see its old comment, and correction 3 in
// task-6-report.md). The underlying guarantee is unchanged: a visitor for whom the
// resolver genuinely cannot run must still get the dark palette this game has always
// shipped with, never an unstyled/white page. Two independent failure modes can cause
// that — a throwing localStorage.getItem, and a missing matchMedia — and each gets
// its own test below rather than one test stubbing both: the inline script always
// calls getItem first, so breaking both at once would leave the matchMedia branch
// unreached and its "coverage" illusory. Both tests also block src/main.js from
// loading, to rule out the module papering over the inline script's failure.
// Regression guard for the selector swap: with `:root` hanging off the light
// palette, this rendered #eef3f1.
test('when the resolver cannot run at all, the app still renders dark, not white', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore - deliberately breaking the resolver's storage input
    window.localStorage.getItem = () => { throw new Error('blocked'); };
  });
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&topic=0');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-appearance'))).toBe(false);
  const seen = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim(), surface: cs.getPropertyValue('--surface').trim() };
  });
  expect(seen).toEqual({ bg: '#16262f', surface: '#1d2f3a' });
  // The computed rule, not just the declared tokens — proves something is actually
  // consuming --bg rather than it merely sitting on :root unused.
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(22, 38, 47)');
});

// Genuinely exercises the branch the test above cannot reach: storage is untouched
// here (getItem works normally, so the resolver gets past that call before it can
// fail), and only matchMedia is missing.
test('when only matchMedia is missing, the app still renders dark, not white', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore - deliberately breaking only matchMedia; storage is untouched
    window.matchMedia = undefined;
  });
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&topic=0');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-appearance'))).toBe(false);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toBe('#16262f');
});

/** @param {Page} page */
const modeOf = (page) => page.evaluate(() => document.documentElement.dataset.appearance);
/** @param {Page} page */
const prefOf = (page) => page.locator('#appearance').getAttribute('data-pref');
/** @param {Page} page */
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// The page background alone would still pass if a token were declared in only one
// palette; sampling a grid letter too covers the content, not just the canvas.
/** @param {Page} page */
const inkOf = (page) => page.locator('.cell').first().evaluate(el => getComputedStyle(el).color);

// Finding 1: the inline resolver used to write any non-'system' stored value straight
// into data-appearance, unvalidated. A garbage value under a light OS made that
// concrete: painted dark (data-appearance="banana" matches no CSS selector, so
// styles.css's bare :root — dark — took over), then main.js's own normalizePref
// coerced 'banana' to 'system' and repainted light. A visible flip on load, which is
// the exact bug class this feature exists to prevent. This must fail against the
// pre-fix inline script and pass after it allowlists to only 'light'/'dark'.
test('an invalid stored preference resolves through the allowlist, never verbatim', async ({ page }) => {
  // Light OS: maximizes visibility, since the pre-fix bug painted dark (bare :root
  // fallback for an unrecognised data-appearance) then hydrated light.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    window.localStorage.setItem('wordfinder-appearance', 'banana');
  });

  // Isolate what the pre-paint inline script alone produces, with the deferred
  // module blocked so nothing else can set the attribute.
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&topic=0');
  const painted = await modeOf(page);
  expect(['light', 'dark']).toContain(painted);       // never 'banana' verbatim
  const paintedBg = await bgOf(page);

  // Now let the module run for real and hydrate. It must agree with what was
  // already painted — disagreement here is exactly the load-time flip.
  await page.unroute('**/src/main.js');
  await page.reload();
  await expect.poll(() => modeOf(page)).toBe(painted);
  expect(await bgOf(page)).toBe(paintedBg);
});

test('the button cycles system -> light -> dark and repaints the page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?seed=1&topic=0');
  expect(await prefOf(page)).toBe('system');
  expect(await modeOf(page)).toBe('dark');
  const darkBg = await bgOf(page), darkInk = await inkOf(page);

  await page.locator('#appearance').click();
  expect(await prefOf(page)).toBe('light');
  expect(await modeOf(page)).toBe('light');
  expect(await bgOf(page)).not.toBe(darkBg);
  expect(await inkOf(page)).not.toBe(darkInk);

  await page.locator('#appearance').click();
  expect(await prefOf(page)).toBe('dark');
  expect(await bgOf(page)).toBe(darkBg);
  expect(await inkOf(page)).toBe(darkInk);

  await page.locator('#appearance').click();
  expect(await prefOf(page)).toBe('system');
  expect(await modeOf(page)).toBe('dark');       // the emulated OS is dark
});

test('exactly one icon is visible at a time', async ({ page }) => {
  await page.goto('/');
  for (const pref of ['system', 'light', 'dark']) {
    expect(await prefOf(page)).toBe(pref);
    await expect(page.locator('#appearance svg:visible')).toHaveCount(1);
    await page.locator('#appearance').click();
  }
});

test('the button announces the current appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('#appearance')).toHaveAttribute('aria-label', 'Appearance: System (Dark)');
  await page.locator('#appearance').click();
  await expect(page.locator('#appearance')).toHaveAttribute('aria-label', 'Appearance: Light');
});

test('System follows the OS live; a pinned preference ignores it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await modeOf(page)).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => modeOf(page)).toBe('dark');

  await page.locator('#appearance').click();                 // pin to light
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(150);
  expect(await modeOf(page)).toBe('light');
});

// The inline <head> script is the whole reason a dark-mode player doesn't see a
// white flash on every load. Blocking the module proves the resolution happened
// before any deferred script ran, which a plain reload assertion cannot.
test('a stored preference applies with the module blocked entirely', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.locator('#appearance').click();                 // stores 'light'
  expect(await modeOf(page)).toBe('light');

  await page.route('**/src/main.js', route => route.abort());
  await page.reload();
  await expect(page.locator('.cell')).toHaveCount(0);         // the module really did not run
  expect(await modeOf(page)).toBe('light');
});

test('the status bar colour tracks the page background', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const meta = page.locator('meta[name="theme-color"]');
  await expect(meta).toHaveAttribute('content', '#16262f');
  await page.locator('#appearance').click();
  await expect(meta).toHaveAttribute('content', '#eef3f1');
});
