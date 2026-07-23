import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';

// Regression for 43c8402. Winning schedules the overlay on a 700ms timer. Starting
// a new puzzle inside that window used to let the stale timer drop the overlay over
// a fresh grid, where it swallowed every pointer event and made the game unplayable.
test('starting a new theme during the win delay leaves the board playable', async ({ page }) => {
  await page.goto('/');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) await dragCells(page, await findWordInGrid(page, w.toUpperCase()));

  await page.locator('#newbtn').click();   // inside the 700ms window
  await page.waitForTimeout(1200);         // let any stale timer fire

  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('#count')).toContainText('0 of 12 found');

  // The real symptom was a dead board, so prove it still accepts input.
  await dragCells(page, await findWordInGrid(page));
  await expect(page.locator('#count')).toContainText('1 of 12 found');
});

// Regression for 5e2bbf6. Selection length came from Euclidean distance, but a
// k-cell diagonal spans k*sqrt(2), so diagonal drags selected too many cells.
test('a diagonal drag selects exactly the cells under the pointer', async ({ page }) => {
  await page.goto('/');
  const len = await page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    if (!gb) throw new Error('missing #gridbox');
    const r = gb.getBoundingClientRect();
    const cell = (gb.offsetWidth - 20) / 13;
    /** @param {number} x @param {number} y @returns {{x:number, y:number}} */
    const pt = (x, y) => ({ x: r.left + 10 + (x + 0.5) * cell, y: r.top + 10 + (y + 0.5) * cell });
    const a = pt(0, 0), b = pt(3, 3);
    /** @param {string} t @param {{x:number, y:number}} p @returns {boolean} */
    const ev = (t, p) => gb.dispatchEvent(new PointerEvent(t, {
      clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1,
    }));
    ev('pointerdown', a);
    ev('pointermove', b);
    // The live selection pill spans (cells-1)*cell + height. Recover the cell count.
    const pill = /** @type {HTMLElement | null} */ (document.querySelector('#pills .pill'));
    if (!pill) throw new Error('missing .pill');
    const h = parseFloat(pill.style.height);
    const w = parseFloat(pill.style.width);
    ev('pointerup', b);
    return Math.round((w - h) / (cell * Math.SQRT2)) + 1;
  });
  expect(len).toBe(4);   // (0,0)..(3,3) inclusive. Pre-fix this measured 5 or 6.
});

// Regression for d468bd7. The service worker used to fall back to index.html for any
// FAILED request (a rejected fetch(), e.g. offline), so a missing .js asset came back
// as HTML and produced a baffling "Unexpected token '<'" instead of a clean network
// error. The fix scopes that fallback to navigation requests only; everything else
// rejects via Response.error(). A live-server 404 is a *resolved* response and never
// exercises this .catch() path, so the fetch has to fail at the network level — force
// that with context.setOffline(true) rather than requesting a merely-missing URL.
test('the service worker only falls back to index.html for navigations', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++)
      await new Promise(r => setTimeout(r, 250));
  });

  await context.setOffline(true);
  /** @type {{rejected:false, text:string} | {rejected:true, message:string}} */
  let result;
  try {
    result = await page.evaluate(async () => {
      try {
        const res = await fetch('./definitely-not-here.js');
        return { rejected: false, text: (await res.text()).slice(0, 40) };
      } catch (err) {
        return { rejected: true, message: String(err) };
      }
    });
  } finally {
    await context.setOffline(false);
  }

  // Fixed: the underlying fetch() rejects (network error), so the page's fetch()
  // rejects too and never resolves with a body at all. Reverted (pre-d468bd7): the
  // offline network failure still hits the unconditional index.html fallback, so the
  // missing .js resolves with the precached index.html document.
  const cameBackAsIndexHtml = !result.rejected && result.text.includes('<!DOCTYPE html>');
  expect(cameBackAsIndexHtml).toBe(false);
});

// Regression for 121de94 + 60b5099. Code is stale-while-revalidate: a changed asset
// must reach the user with no CACHE bump. Icons stay cache-first and must not
// generate revalidation traffic.
test('code revalidates in the background, icons stay cache-first', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await fetch('http://localhost:5173/__reset');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++)
      await new Promise(r => setTimeout(r, 250));
  });

  const probe = await page.evaluate(async () => {
    const get = async () => (await (await fetch('./__probe.js')).text()).trim();
    const first = await get();                                  // miss -> network, cached
    const second = await get();                                 // cached, revalidates
    await new Promise(r => setTimeout(r, 1500));
    const third = await get();                                  // now the fresh copy
    return { first, second, third };
  });
  expect(probe.second).toBe(probe.first);        // served instantly from cache
  expect(probe.third).not.toBe(probe.first);     // refreshed with no CACHE bump

  // The icon is precached; repeat requests must never reach the origin again.
  const before = await (await fetch('http://localhost:5173/__stats')).json();
  await page.evaluate(() => fetch('./icon-192.png').then(r => r.arrayBuffer()));
  await page.waitForTimeout(800);
  const after = await (await fetch('http://localhost:5173/__stats')).json();
  expect(after['/icon-192.png'] || 0).toBe(before['/icon-192.png'] || 0);
});

// Guard for the src/ split. A path typo in the precache list breaks offline support
// SILENTLY — install rejects, the old worker keeps serving, and nothing surfaces an
// error. Parse the shipped list and prove every entry actually resolves.
test('every asset in the service worker precache list actually resolves', async ({ page }) => {
  await page.goto('/');
  const sw = await (await fetch('http://localhost:5173/sw.js')).text();
  const assetsMatch = sw.match(/const ASSETS=(\[[^\]]*\])/);
  if (!assetsMatch) throw new Error('could not find ASSETS list in sw.js');
  /** @type {string[]} */
  const list = JSON.parse(assetsMatch[1].replace(/'/g, '"'));
  expect(list.length, 'ASSETS list failed to parse').toBeGreaterThan(5);
  const results = await page.evaluate(async (paths) => {
    /** @type {Record<string, number>} */
    const out = {};
    for (const p of paths) out[p] = (await fetch(p, { cache: 'reload' })).status;
    return out;
  }, list);
  for (const [path, status] of Object.entries(results)) {
    expect(status, `${path} did not resolve`).toBe(200);
  }
});

// The other half of the guard above. "Every ASSETS entry resolves" says nothing
// about the reverse: an asset the app actually loads that ISN'T in ASSETS. Add
// src/input.js, import it from main.js, forget to add it to sw.js — install still
// succeeds, every existing ASSETS entry still resolves, both precache tests stay
// green, and offline silently 404s on the forgotten module with no error anywhere.
// Collect the same-origin resources the page really loaded and prove each one is
// covered by the parsed ASSETS list, so a forgotten entry fails loudly by name.
test('every same-origin asset the app loads is covered by the precache list', async ({ page }) => {
  // networkidle + the full cell count together prove main.js and its entire ES
  // module import graph (rng/puzzle/layout/view/effects/themes) actually ran, not
  // just that the top-level script tag resolved.
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.cell')).toHaveCount(169);

  const sw = await (await fetch('http://localhost:5173/sw.js')).text();
  const assetsMatch = sw.match(/const ASSETS=(\[[^\]]*\])/);
  if (!assetsMatch) throw new Error('could not find ASSETS list in sw.js');
  /** @type {string[]} */
  const rawAssets = JSON.parse(assetsMatch[1].replace(/'/g, '"'));

  // './', './index.html' and the bare directory URL a navigation to '/' actually
  // requests are all "the document" — collapse all three to one comparable key so
  // neither side has to special-case which spelling it used.
  /** @param {string} p @returns {string} */
  const normalize = (p) => {
    const bare = p.replace(/^\.?\//, '');
    return bare === '' ? 'index.html' : bare;
  };
  const assetSet = new Set(rawAssets.map(normalize));

  const origin = new URL(page.url()).origin;
  /** @type {string[]} */
  const loadedUrls = await page.evaluate(() => [
    location.href, // the navigation itself; not in `resource` entries
    ...performance.getEntriesByType('resource').map((e) => e.name),
  ]);

  // Legitimately not app assets and not expected in ASSETS: the test harness's own
  // endpoints, and sw.js itself (a service worker doesn't precache itself). Chromium
  // did not request favicon.ico in practice here (no <link rel="icon">, headless),
  // but it's excluded on principle rather than by accident of what one browser does.
  const EXCLUDED = new Set(['__probe.js', '__stats', '__reset', 'sw.js', 'favicon.ico']);

  /** @type {string[]} */
  const missing = [];
  for (const url of loadedUrls) {
    const u = new URL(url);
    if (u.origin !== origin) continue; // cross-origin, e.g. Google Fonts
    const rel = normalize(u.pathname);
    if (EXCLUDED.has(rel)) continue;
    if (!assetSet.has(rel)) missing.push(rel);
  }

  expect(missing, `loaded but missing from sw.js ASSETS: ${missing.join(', ')}`).toEqual([]);
});
