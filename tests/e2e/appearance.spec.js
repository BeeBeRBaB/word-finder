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
  await page.goto('/?seed=1&subject=nature/birds');
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
  await page.goto('/?seed=1&subject=nature/birds');
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
    bg: '#100a05', surface: '#241a15', border: '#3d2b21',
    text: '#f0e0d2', textStrong: '#fdf4ea', muted: '#bfa694',
    label: '#e0913f', hint: '#a89283',
    accent: '#ff8c3a', accentText: '#ffa869', accentInk: '#2b1508',
    pill1: 'rgba(255,183,77,.34)', pillEdge: 'rgba(255,255,255,.25)',
  });
});

// The inline <head> script (see its comment in index.html) sets data-appearance on every
// normal load. The guarantee it has to uphold is that a visitor for whom the resolver
// genuinely cannot run still gets the dark palette this game has always shipped with,
// never an unstyled/white page. The localStorage read has its own inner try, so a
// throwing getItem no longer counts as "the resolver cannot run" -- it falls through to
// the default and DOES set data-appearance. Both tests block src/main.js from loading, to
// rule out the module papering over the inline script either way.
test('a throwing localStorage.getItem resolves dark, it does not abort the resolver', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.getItem = () => { throw new Error('blocked'); };
  });
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-appearance'))).toBe('dark');
  const seen = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim(), surface: cs.getPropertyValue('--surface').trim() };
  });
  expect(seen).toEqual({ bg: '#100a05', surface: '#241a15' });
  // The computed rule, not just the declared tokens — proves something is actually
  // consuming --bg rather than it merely sitting on the attribute unused.
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(16, 10, 5)');
});

// Replaces a test that broke matchMedia to reach the "resolver cannot run" branch. The
// resolver no longer calls matchMedia at all, so that test could no longer fail. What is
// worth pinning instead is the absence itself: an OS query here would reintroduce the
// third setting through the back door, and would make first paint depend on something the
// player never chose.
test('the inline resolver contains no OS colour-scheme query', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const html = await page.content();
  expect(html).not.toContain('prefers-color-scheme');
  expect(html).not.toContain('matchMedia(\'(prefers-color-scheme');
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
// pre-fix inline script and pass after it allowlists to only 'light'/'dark'. The stored
// value 'system' now takes the same path — it is exactly "a value this build does not
// recognise" — so this doubles as the migration guard.
test('an invalid stored preference resolves through the allowlist, never verbatim', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wordfinder-appearance', 'banana');
  });

  // Isolate what the pre-paint inline script alone produces, with the deferred
  // module blocked so nothing else can set the attribute.
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  const painted = await modeOf(page);
  expect(painted).toBe('dark');                       // never 'banana' verbatim
  const paintedBg = await bgOf(page);

  // Now let the module run for real and hydrate. It must agree with what was
  // already painted — disagreement here is exactly the load-time flip.
  await page.unroute('**/src/main.js');
  await page.reload();
  await expect.poll(() => modeOf(page)).toBe(painted);
  expect(await bgOf(page)).toBe(paintedBg);
});

// Same bug class as the allowlist test above, reached through a different door: the
// inline resolver used to sit entirely inside one try, so a throwing
// localStorage.getItem (iOS Safari's "Block All Cookies", Chrome with site data
// blocked -- storage.test.js's "Safari private mode" case) aborted the whole thing
// before data-appearance was ever set. Unlike the tests above, this leaves src/main.js
// unblocked: a `readystatechange` listener installed before the document is parsed
// captures data-appearance the instant `document.readyState` becomes 'interactive',
// which per the HTML spec happens after parsing (so after the inline <head> script has
// run) but before deferred/module scripts execute -- i.e. exactly the pre-hydration
// paint, without having to fake the module's absence.
//
// It used to assert a fall-through to the OS. There is no OS to fall through to now, so
// what it pins is the property that actually matters and always did: whatever the inline
// script paints, hydration must agree with, so the player never sees a flip.
test('a throwing localStorage resolves dark, and does not flip on hydration', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.getItem = () => { throw new Error('blocked'); };
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        /** @type {any} */ (window).__prePaint = document.documentElement.dataset.appearance;
      }
    });
  });
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('.cell').first()).toBeVisible(); // src/main.js really did hydrate

  const prePaint = await page.evaluate(() => /** @type {any} */ (window).__prePaint);
  const hydrated = await modeOf(page);
  expect(prePaint).toBe(hydrated);   // no flip between what was painted and what hydration settled on
  expect(hydrated).toBe('dark');
});

// One pass over the whole toggle, asserting everything the button owns at each step:
// the stored pref, the resolved mode, the repaint (background AND a grid letter — the
// page background alone would still pass if a token were declared in only one palette),
// the visible icon, and the accessible name. Two steps now rather than three: with
// `system` gone a preference IS the resolved mode, and a new visitor starts on dark.
const CYCLE = [
  { pref: 'dark', mode: 'dark', icon: 'i-dark', label: 'Appearance: Dark' },
  { pref: 'light', mode: 'light', icon: 'i-light', label: 'Appearance: Light' },
  { pref: 'dark', mode: 'dark', icon: 'i-dark', label: 'Appearance: Dark' },
];

test('the button toggles dark <-> light, repainting and relabelling each step', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  /** @type {Record<string, string>} */
  const darkPaint = { bg: await bgOf(page), ink: await inkOf(page) };

  for (const [i, step] of CYCLE.entries()) {
    expect(await prefOf(page), `step ${i} pref`).toBe(step.pref);
    expect(await modeOf(page), `step ${i} mode`).toBe(step.mode);
    await expect(page.locator(`#appearance svg.${step.icon}`)).toBeVisible();
    await expect(page.locator('#appearance svg:visible')).toHaveCount(1);
    await expect(page.locator('#appearance')).toHaveAttribute('aria-label', step.label);

    const paint = { bg: await bgOf(page), ink: await inkOf(page) };
    if (step.mode === 'dark') expect(paint, `step ${i} paint`).toEqual(darkPaint);
    else expect(paint, `step ${i} paint`).not.toEqual(darkPaint);

    await page.locator('#appearance').click();
  }
});

// The three first-paint cases. A stored value in each direction, and a first-ever visit,
// must all be correct in the markup the browser first paints — not after hydration.
// src/main.js is blocked so only the inline resolver can have done it.
for (const [name, stored, expected] of /** @type {[string, string|null, string][]} */ ([
  ['a stored dark preference', 'dark', 'dark'],
  ['a stored light preference', 'light', 'light'],
  ['a first-ever visit', null, 'dark'],
])) {
  test(`${name} is already correct at first paint`, async ({ page }) => {
    await page.addInitScript((v) => {
      try {
        if (v === null) window.localStorage.removeItem('wordfinder-appearance');
        else window.localStorage.setItem('wordfinder-appearance', v);
      } catch (e) { /* ignore */ }
    }, stored);
    await page.route('**/src/main.js', route => route.abort());
    await page.goto('/?seed=1&subject=nature/birds');
    await expect(page.locator('.cell')).toHaveCount(0);   // the module really did not run
    expect(await modeOf(page)).toBe(expected);
  });
}

// The inline <head> script is the whole reason a dark-mode player doesn't see a
// white flash on every load. Blocking the module proves the resolution happened
// before any deferred script ran, which a plain reload assertion cannot.
test('a stored preference applies with the module blocked entirely', async ({ page }) => {
  await page.goto('/');
  await page.locator('#appearance').click();                 // stores 'light'
  expect(await modeOf(page)).toBe('light');

  await page.route('**/src/main.js', route => route.abort());
  await page.reload();
  await expect(page.locator('.cell')).toHaveCount(0);         // the module really did not run
  expect(await modeOf(page)).toBe('light');
});

test('the status bar colour tracks the page background', async ({ page }) => {
  await page.goto('/');
  const meta = page.locator('meta[name="theme-color"]');
  await expect(meta).toHaveAttribute('content', '#100a05');
  await page.locator('#appearance').click();
  await expect(meta).toHaveAttribute('content', '#f2e3d5');
});

// The migration off the third setting. Anyone holding 'system' when this shipped must
// land on dark, at first paint, with no OS query involved. normalizePref's fallback is
// the whole migration -- there is no migration code to test, only its effect.
test('a stored "system" preference migrates to dark at first paint', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wordfinder-appearance', 'system');
  });
  await page.route('**/src/main.js', route => route.abort());
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('.cell')).toHaveCount(0);
  expect(await modeOf(page)).toBe('dark');
});

// A visitor reported the theme button as an empty circle after a deploy. Reproduced: the
// service worker revalidates each file independently, so new CSS can pair with old markup
// for one load, and the old markup ships data-pref="system" -- which an exact
// [data-pref="dark"] selector does not match, leaving zero icons visible.
//
// The button must never render glyph-less, whatever the attribute says. This drives the
// attribute directly rather than through the toggle, because the toggle can only ever
// produce the two values this build already handles.
test('exactly one icon shows for any data-pref, including values this build retired', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  for (const pref of ['dark', 'light', 'system', 'banana', '']) {
    const shown = await page.evaluate((p) => {
      const btn = /** @type {HTMLElement} */ (document.getElementById('appearance'));
      btn.dataset.pref = p;
      return [...btn.querySelectorAll('svg')]
        .filter(s => getComputedStyle(s).display !== 'none')
        .map(s => s.getAttribute('class'));
    }, pref);
    expect(shown, `data-pref="${pref}" must show exactly one icon`).toHaveLength(1);
    expect(shown[0]).toBe(pref === 'light' ? 'i-light' : 'i-dark');
  }
});
