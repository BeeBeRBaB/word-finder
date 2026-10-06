import { test, expect } from '@playwright/test';
import { findAndDrag, dragCells, openBoard, skipAhead, blockServiceWorker } from './helpers.js';
import { buildPuzzle, runKey, spanOf } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { PRESETS } from '../../src/layout.js';
import { WORDS } from '../../src/subjects/home.js';

// Regression for 43c8402. Winning schedules the overlay on a 700ms timer. Starting
// a new puzzle inside that window used to let the stale timer drop the overlay over
// a fresh grid, where it swallowed every pointer event and made the game unplayable.
// The new game goes through the category picker, picking the category already on
// screen (nature).
test('starting a new game during the win delay leaves the board playable', async ({ page }) => {
  await page.clock.install();
  await openBoard(page, '/?seed=1&subject=nature/birds');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) await findAndDrag(page, w.toUpperCase());

  await page.locator('#catbtn').click();   // inside the 700ms window
  await page.locator('#picker-select').selectOption('nature');
  await page.locator('#picker-start').click();
  await skipAhead(page, 1200);             // let any stale timer fire

  const total = await page.locator('.w').count();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('#count')).toContainText(`0 of ${total} found`);

  // The real symptom was a dead board, so prove it still accepts input.
  const any = /** @type {string} */ (await page.locator('.w').first().textContent());
  await findAndDrag(page, any.toUpperCase());
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
});

// A save naming a subject the catalog no longer has, or a board no size can rebuild, booted to
// "Unavailable" on every launch.
for (const [what, save] of /** @type {[string, object][]} */ ([
  ['a retired subject', { seed: 1, subjectId: 'nature/retired-subject', size: 10, count: 8, found: [] }],
  ['an impossible board', { seed: 1, subjectId: 'nature/birds', size: 0, count: 12, found: [] }],
])) test(`a save naming ${what} gives way to a new deal`, async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem('wordfinder-save-v1', JSON.stringify(s)), save);
  await page.goto('/');
  await expect(page.locator('.cell').first()).toBeVisible();
  await expect(page.locator('#subject')).not.toHaveText(/^(Offline|Unavailable|Loading…)$/);
});

// Regression for 5e2bbf6. Selection length came from Euclidean distance, but a
// k-cell diagonal spans k*sqrt(2), so diagonal drags selected too many cells.
test('a diagonal drag selects exactly the cells under the pointer', async ({ page }) => {
  // Pinned: this only exercises grid geometry.
  await openBoard(page, '/?subject=nature/birds');
  const len = await page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    if (!gb) throw new Error('missing #gridbox');
    const r = gb.getBoundingClientRect();
    const n = Math.round(Math.sqrt(document.querySelectorAll('.cell').length));
    const cell = (gb.offsetWidth - 20) / n;
    /** @param {number} x @param {number} y @returns {{x:number, y:number}} */
    const pt = (x, y) => ({ x: r.left + 10 + (x + 0.5) * cell, y: r.top + 10 + (y + 0.5) * cell });
    const a = pt(0, 0), b = pt(3, 3);
    /** @param {string} t @param {{x:number, y:number}} p @returns {boolean} */
    const ev = (t, p) => gb.dispatchEvent(new PointerEvent(t, {
      clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, isPrimary: true,
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

/** Waits for the page's own service worker to take control; whether it did.
 * Run in the page. @returns {Promise<boolean>} */
async function controlled() {
  await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 250));
  return !!navigator.serviceWorker.controller;
}

// Regression for d468bd7. The service worker used to fall back to index.html for any
// FAILED request (a rejected fetch(), e.g. offline), so a missing .js asset came back
// as HTML and produced a baffling "Unexpected token '<'" instead of a clean network
// error. The fix scopes that fallback to navigation requests only; everything else
// rejects via Response.error(). A live-server 404 is a *resolved* response and never
// exercises this .catch() path, so the fetch has to fail at the network level — force
// that with context.setOffline(true) rather than requesting a merely-missing URL.
test('the service worker only falls back to index.html for navigations', async ({ page, context }) => {
  await page.goto('/');
  // Without control the offline fetch below rejects natively, which is what the fix expects too.
  expect(await page.evaluate(controlled)).toBe(true);

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

// A first visit deals before the worker controls the page, so nothing cached that board's word
// pool or its background, and the next launch offline said "Offline", or lost the background.
test('the board and background from a first visit come back offline', async ({ page, context }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('wordfinder-settings-v1')) localStorage.setItem('wordfinder-settings-v1', JSON.stringify({ art: 'drift' }));
  });
  await openBoard(page, '/');
  const letters = await page.locator('#letters').textContent();
  const drawn = page.locator('#bg canvas, #bgside canvas');
  await expect(drawn).not.toHaveCount(0);
  expect(await page.evaluate(controlled)).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const paths = new Set();
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) paths.add(new URL(r.url).pathname);
    return ['/src/backgrounds/drifting-icons.js', '/src/backgrounds/icons.js'].every(p => paths.has(p))
      && [...paths].some(p => p.startsWith('/src/subjects/'));
  })).toBe(true);
  // Offline for the worker as well: context.setOffline stops holding back the worker's own
  // requests once the page reloads, so the board came back without anything having been cached.
  await context.route('**/*', (route) => route.abort());
  await page.reload();
  await page.locator('.cell').first().waitFor();
  expect(await page.locator('#letters').textContent()).toBe(letters);
  await expect(drawn).not.toHaveCount(0);
});

// An update that takes over an open page leaves the old build's modules running, and a background
// they lack an export for draws nothing. So the page reloads when next hidden, but not before an
// update, and not over Settings or an Undo offer.
test('a page an update took over reloads when next hidden, keeping its board', async ({ page }) => {
  await openBoard(page, '/');
  expect(await page.evaluate(controlled)).toBe(true);
  const letters = await page.locator('#letters').textContent();
  const hide = (/** @type {boolean} */ hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  /** Hidden and shown again; whether the page is still the one marked. */
  const stays = async () => {
    await hide(true);
    await page.waitForTimeout(500);   // a reload, had one started, would have begun
    const same = await page.evaluate(() => /** @type {any} */ (window).mark === 1);
    await hide(false);
    return same;
  };
  await page.evaluate(() => { /** @type {any} */ (window).mark = 1; });
  expect(await stays(), 'no update yet').toBe(true);
  // A deploy's new worker: another script URL installs even with the same bytes.
  await page.evaluate(async () => {
    const changed = new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    await navigator.serviceWorker.register('./sw.js?update=1');
    await changed;
  });
  await page.click('#appearance');
  expect(await stays(), 'Settings is open').toBe(true);
  await page.keyboard.press('Escape');
  // A one-click deal over a find keeps the board only in memory, for Undo.
  await findAndDrag(page, /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase());
  await page.locator('#newbtn').click();
  await expect(page.locator('#toast-undo')).toBeVisible();
  expect(await stays(), 'Undo is offered').toBe(true);
  await page.locator('#toast-undo').click();
  await expect(page.locator('#toast')).toBeHidden();
  const reloaded = page.waitForEvent('load');
  await hide(true);
  await reloaded;
  await page.locator('.cell').first().waitFor();
  expect(await page.evaluate(() => /** @type {any} */ (window).mark)).toBeUndefined();
  expect(await page.locator('#letters').textContent()).toBe(letters);
  await expect(page.locator('.w.done')).toHaveCount(1);
});

// A launch that could not put its save back offline tries again once the network returns, even
// with New game open; but a board the player deals while it loads is theirs, and stays.
test('a launch that failed offline is tried again online, and gives way to a board the player deals', async ({ page }) => {
  await blockServiceWorker(page);
  await openBoard(page, '/?seed=3&subject=nature/birds');
  const letters = await page.locator('#letters').textContent();
  const pool = /\/src\/subjects\/nature\.js/;
  await page.route(pool, (route) => route.abort());
  const offlineLaunch = async () => {
    await page.goto('/');
    await expect(page.locator('#subject')).toHaveText('Offline');
    await page.locator('#catbtn').click();
  };
  await offlineLaunch();
  await page.unroute(pool);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('#picker-cancel').click();
  await expect.poll(() => page.locator('#letters').textContent()).toBe(letters);
  // Again, with the save's pool slow this time, and Food dealt from New game meanwhile.
  await page.route(pool, (route) => route.abort());
  await offlineLaunch();
  await page.unroute(pool);
  /** @type {() => void} */
  let release = () => {};
  const held = new Promise((r) => { release = () => r(undefined); });
  await page.route(pool, async (route) => { await held; await route.continue(); });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
  release();
  await page.waitForTimeout(500);
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

// A save the launch could not put back offline is a game in progress too. New game warns before a
// deal replaces it, and the one-click button, with no board to keep for Undo, asks the same way.
test('a save waiting for the network is warned about before a new deal replaces it', async ({ page }) => {
  await blockServiceWorker(page);
  await openBoard(page, '/?seed=3&subject=nature/birds');
  await findAndDrag(page, String(await page.locator('.w').first().textContent()).toUpperCase());
  await page.route(/\/src\/subjects\/nature\.js/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#subject')).toHaveText('Offline');
  for (const button of ['#catbtn', '#newbtn']) {
    await page.locator(button).click();
    await expect(page.locator('#picker')).toBeVisible();
    await expect(page.locator('#picker-warning')).toBeVisible();
    await page.locator('#picker-cancel').click();
  }
  await expect(page.locator('#subject')).toHaveText('Offline');
});

// Regression for 121de94 + 60b5099. Code is stale-while-revalidate: a changed asset
// must reach the user with no CACHE bump. Icons stay cache-first and must not
// generate revalidation traffic.
test('code revalidates in the background, icons stay cache-first', async ({ page, baseURL }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await fetch(`${baseURL}/__reset`);
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
    // The worker answers a miss before its cache.put lands; asking again sooner races it.
    for (let i = 0; i < 20 && !(await caches.match('./__probe.js')); i++) await new Promise(r => setTimeout(r, 50));
    const second = await get();                                 // cached, revalidates
    await new Promise(r => setTimeout(r, 1500));
    const third = await get();                                  // now the fresh copy
    return { first, second, third };
  });
  expect(probe.second).toBe(probe.first);        // served instantly from cache
  expect(probe.third).not.toBe(probe.first);     // refreshed with no CACHE bump

  // The icon is precached; repeat requests must never reach the origin again.
  const before = await (await fetch(`${baseURL}/__stats`)).json();
  await page.evaluate(() => fetch('./icon-192.png').then(r => r.arrayBuffer()));
  await page.waitForTimeout(800);
  const after = await (await fetch(`${baseURL}/__stats`)).json();
  expect(after['/icon-192.png'] || 0).toBe(before['/icon-192.png'] || 0);
});

// The other half of sw.test.js's "every precached path exists", which says nothing about
// the reverse: an asset the app actually loads that ISN'T in ASSETS. Add src/input.js,
// import it from main.js, forget to add it to sw.js — install still succeeds, every
// existing ASSETS entry still resolves, and offline silently 404s on the forgotten
// module with no error anywhere.
// Collect the same-origin resources the page really loaded and prove each one is
// covered by the parsed ASSETS list, so a forgotten entry fails loudly by name.
test('every same-origin asset the app loads is covered by the precache list', async ({ page, baseURL }) => {
  // networkidle + the full cell count together prove main.js and its entire ES
  // module import graph (rng/puzzle/layout/view/effects/catalog/subjects) actually
  // ran, not just that the top-level script tag resolved.
  await page.goto('/?subject=nature/birds', { waitUntil: 'networkidle' });
  // 169 on a desktop board, 100 on a phone — see smoke.spec.js for why a perfect
  // square is asserted rather than a fixed number.
  const cells = await page.locator('.cell').count();
  expect([100, 169]).toContain(cells);

  const sw = await (await fetch(`${baseURL}/sw.js`)).text();
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
  // endpoints, and sw.js itself (a service worker doesn't precache itself). favicon.ico
  // is excluded on principle: index.html links icon-192.png as the icon, so no browser
  // should ask for it, but that is not this test's to pin.
  const EXCLUDED = new Set(['__probe.js', '__stats', '__reset', 'sw.js', 'favicon.ico']);
  // A per-category word pool, e.g. src/subjects/nature.js, is the one thing this app
  // loads here that must NOT be in ASSETS: precaching it would pull every category's
  // words into the installed shell, defeating the whole point of fetching only the one
  // a player actually deals. src/subjects.js (the loader) is a different,
  // always-precached file and is not matched by this.
  const LAZY_SUBJECT = /^src\/subjects\/[^/]+\.js$/;
  // The backgrounds too: a new player's Theme mode loads one at once, and each is cached on first
  // use rather than precached (sw.js), like a word pool.
  const LAZY_BACKGROUND = /^src\/backgrounds\/[^/]+\.js$/;

  /** @type {string[]} */
  const missing = [];
  for (const url of loadedUrls) {
    const u = new URL(url);
    if (u.origin !== origin) continue; // cross-origin, e.g. Google Fonts
    const rel = normalize(u.pathname);
    if (EXCLUDED.has(rel) || LAZY_SUBJECT.test(rel) || LAZY_BACKGROUND.test(rel)) continue;
    if (!assetSet.has(rel)) missing.push(rel);
  }

  expect(missing, `loaded but missing from sw.js ASSETS: ${missing.join(', ')}`).toEqual([]);
});

// Regression for the WOOD-in-HARDWOOD class of bug. matchWord used to compare the dragged
// LETTERS against the word list, so a word was marked found wherever its letters happened
// to read -- inside a longer word, or by chance in the filler. Its real placement then
// failed to match and flashed as a miss on a word that is genuinely there.
//
// Measured on the corpus when this was found: 581 of 600 subjects contain a word inside
// another of their own words, and 30% of dealt puzzles contain at least one such run.
//
// Ground truth comes from rebuilding the pinned puzzle here in Node with the same pure
// modules the page uses, because the DOM cannot say which of several readable runs is the
// placement -- that is precisely the information matchWord was missing.
test('a run that only spells a word does not find it', async ({ page }) => {
  const SEED = 0, SUBJECT = 'home/carpentry';
  await page.goto(`/?seed=${SEED}&subject=${SUBJECT}`);
  await page.waitForSelector('#letters .cell');

  const size = Math.round(Math.sqrt(await page.locator('.cell').count()));
  const shape = size === PRESETS.compact.size ? PRESETS.compact : PRESETS.full;
  const puzzle = buildPuzzle({
    name: 'carpentry', pool: WORDS[SUBJECT].split(','), rng: makeRng(SEED),
    size: shape.size, count: shape.count, mix: shape.mix,
  });
  // The board the page rendered must be the board we just rebuilt, or the rest is fiction.
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(puzzle.cells.join(''));

  const placed = new Set(puzzle.placements.map((p) => runKey(shape.size, spanOf(p))));
  const ghost = findGhostRun(puzzle, shape.size, placed);
  if (!ghost) {
    // The compact 10x10 board draws 8 shorter words, so a pinned seed that ghosts on the
    // full board need not ghost here. Skipping is honest; asserting nothing would not be.
    test.skip(true, `no off-placement run on this ${shape.size}x${shape.size} board`);
    return;
  }
  const g = ghost;

  // Dragging the run that merely spells the word must do nothing at all.
  await dragCells(page, g);
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`0 of ${total} found`);
  await expect(page.locator('.w', { hasText: new RegExp(`^${g.word}$`, 'i') })).not.toHaveClass(/\bdone\b/);

  // And the word is still findable at its real placement -- the half that used to break.
  await findAndDrag(page, g.word);
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
});

/** A straight run that reads one of the puzzle's words but is NOT that word's placement.
 * Extracted rather than inlined so its `null` return narrows cleanly at the call site.
 * @param {import('../../src/puzzle.js').Puzzle} puzzle
 * @param {number} size @param {Set<string>} placed run keys of the real placements
 * @returns {{word:string, x0:number, y0:number, x1:number, y1:number}|null} */
function findGhostRun(puzzle, size, placed) {
  const rev = (/** @type {string} */ s) => s.split('').reverse().join('');
  for (const w of puzzle.words) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const x1 = x + dx * (w.length - 1), y1 = y + dy * (w.length - 1);
          if (x1 < 0 || x1 >= size || y1 < 0 || y1 >= size) continue;
          let s = '';
          for (let i = 0; i < w.length; i++) s += puzzle.cells[(y + dy * i) * size + (x + dx * i)];
          if (s !== w && rev(s) !== w) continue;
          if (!placed.has(runKey(size, { x0: x, y0: y, x1, y1 }))) return { word: w, x0: x, y0: y, x1, y1 };
        }
      }
    }
  }
  return null;
}

// At 320px the win card's 260px minimum plus 84px of padding put its right edge 26px off the
// screen, and the level score card inside it was squeezed to 200px.
// 320x400 also meets the short-screen block, which sets the card's padding there.
for (const height of [568, 400]) test(`the win card and the score card in it fit a 320x${height} screen`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height });
  await openBoard(page, '/?seed=7&subject=nature/birds');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) await findAndDrag(page, w.toUpperCase());
  await expect(page.locator('#win')).toBeVisible();
  const inside = async () => {
    // After its pop-in, which overshoots to 1.06 on the way and would read as wider than it is.
    await page.locator('#wincard').evaluate((e) => Promise.all(e.getAnimations().map(a => a.finished)));
    const b = await page.locator('#wincard').boundingBox();
    expect(b && b.x).toBeGreaterThanOrEqual(0);
    expect(b && b.x + b.width).toBeLessThanOrEqual(320);
  };
  await inside();
  // The level's score card, as the app shows it: card[data-level] restyles the whole card.
  await page.evaluate(async () => {
    const account = '/src/account.js', scoring = '/src/scoring.js';
    const { showLevelWin } = await import(account);
    const { scoreLevel } = await import(scoring);
    const W = ['SPARROW', 'ROBIN', 'EAGLE', 'HERON', 'FINCH', 'OWL', 'PELICAN', 'WREN', 'CRANE', 'SWALLOW', 'MAGPIE', 'KESTREL'];
    const bd = scoreLevel({ events: W.map((w, i) => ({ word: w, at: 9000 * (i + 1), revealed: i === 7 })), elapsedMs: 118000, difficulty: 'normal', wordCount: 12 });
    const card = /** @type {HTMLElement} */ (document.getElementById('wincard'));
    showLevelWin(card, card.querySelector('h2'), 12, { breakdown: bd, progress: { points: 5644 } },
      { reduceMotion: true, countdownMs: 0, onNext() {} }).skip();
  });
  await expect(page.locator('#wincard')).toHaveAttribute('data-level', '12');
  await inside();
  const sc = await page.locator('.sc').boundingBox();
  expect(sc && sc.width).toBeGreaterThanOrEqual(240);
});
