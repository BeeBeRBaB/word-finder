import { test, expect } from '@playwright/test';

// Opt-in smoke suite against the REAL deployed site (see playwright.live.config.js).
// Never run by `npm test` — this needs network and a Pages deploy, and its own
// config has no webServer. Keep this thin: a few checks only. The exhaustive
// SW/regression coverage already lives in tests/e2e/ against localhost; this suite
// exists solely to prove the things localhost cannot: that the real origin serves
// the app, that the SW actually installs and takes control there, and that every
// precached path resolves on the real deploy (a path typo only shows up here).

// `./` (not `/`) matters here: baseURL is `.../word-finder/`, a GitHub Pages
// *project* site living under a path, not at the origin root. A leading `/`
// resolves against the origin (`https://beeberbab.github.io/`, which 404s),
// while `./` resolves relative to baseURL as intended. Playwright's own docs
// warn about exactly this when baseURL has a non-root path.
test('the deployed app boots', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.cell')).toHaveCount(169);
  await expect(page.locator('.w')).toHaveCount(12);
});

test('the service worker installs and takes control', async ({ page }) => {
  await page.goto('./');
  const controlled = await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    return !!navigator.serviceWorker.controller;
  });
  expect(controlled).toBe(true);
});

// Same guard as tests/e2e/regressions.spec.js's precache test, but run against the
// live origin: a path typo in ASSETS breaks offline support silently on the site
// real users hit, and only a live fetch can prove every entry actually resolves
// there (localhost never sees a deploy-time path mismatch).
test('every precached asset is reachable on the live origin', async ({ page }) => {
  await page.goto('./');
  const statuses = await page.evaluate(async () => {
    const sw = await (await fetch('./sw.js', { cache: 'reload' })).text();
    const assetsMatch = sw.match(/const ASSETS=(\[[^\]]*\])/);
    if (!assetsMatch) throw new Error('could not find ASSETS list in sw.js');
    /** @type {string[]} */
    const list = JSON.parse(assetsMatch[1].replace(/'/g, '"'));
    /** @type {Record<string, number>} */
    const out = {};
    for (const p of list) out[p] = (await fetch(p, { cache: 'reload' })).status;
    return out;
  });
  for (const [path, status] of Object.entries(statuses)) {
    expect(status, `${path} is missing from the deployed site`).toBe(200);
  }
});

// The OTHER half of the guard above. "Every ASSETS entry resolves" says nothing
// about the reverse: an asset the app actually loads that isn't listed in ASSETS
// at all (e.g. a forgotten `src/*.js` after a split). That gap is silent — install
// still succeeds, every existing ASSETS entry still resolves — and only shows up as
// a 404 offline. Mirrors the primary e2e guard in tests/e2e/regressions.spec.js;
// that one is authoritative (offline-capable, runs in `npm test`), this one
// additionally proves it holds on the real deploy.
test('every same-origin asset the app loads on the live origin is covered by the precache list', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await expect(page.locator('.cell')).toHaveCount(169);

  const missing = await page.evaluate(async () => {
    const sw = await (await fetch('./sw.js', { cache: 'reload' })).text();
    const assetsMatch = sw.match(/const ASSETS=(\[[^\]]*\])/);
    if (!assetsMatch) throw new Error('could not find ASSETS list in sw.js');
    /** @type {string[]} */
    const rawAssets = JSON.parse(assetsMatch[1].replace(/'/g, '"'));

    // './', './index.html' and the bare directory URL a navigation to the app root
    // actually requests are all "the document" — collapse all three to one key.
    /** @param {string} p @returns {string} */
    const normalize = (p) => {
      const bare = p.replace(/^\.?\//, '');
      return bare === '' ? 'index.html' : bare;
    };
    const assetSet = new Set(rawAssets.map(normalize));

    // GitHub Pages serves this as a *project* site under /word-finder/, not the
    // origin root, so "relative to the app" means relative to that root path, not
    // to the bare pathname the way a root-hosted origin could get away with.
    const rootPath = new URL('./', location.href).pathname;
    const loadedUrls = [
      location.href, // the navigation itself; not in `resource` entries
      ...performance.getEntriesByType('resource').map((e) => e.name),
    ];

    // Legitimately not app assets and not expected in ASSETS: sw.js itself (a
    // service worker doesn't precache itself), and favicon.ico on principle even
    // though no browser has been observed requesting it here (no <link rel="icon">).
    const EXCLUDED = new Set(['sw.js', 'favicon.ico']);

    /** @type {string[]} */
    const out = [];
    for (const url of loadedUrls) {
      const u = new URL(url);
      if (u.origin !== location.origin) continue;        // cross-origin, e.g. Google Fonts
      if (!u.pathname.startsWith(rootPath)) continue;     // outside the app's own path
      const rel = normalize(u.pathname.slice(rootPath.length));
      if (EXCLUDED.has(rel)) continue;
      if (!assetSet.has(rel)) out.push(rel);
    }
    return out;
  });

  expect(missing, `loaded but missing from sw.js ASSETS: ${missing.join(', ')}`).toEqual([]);
});
