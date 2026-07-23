# Dev Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `word-finder` a local test suite, a testable module structure, and type checking — without adding a build step or changing anything a player can see.

**Architecture:** Playwright end-to-end tests are written and made green against the *current, unmodified* code first. Only then is `game.js` split into `src/` modules along the pure-logic/DOM boundary, with the suite acting as the safety net. Pure modules then get fast `node:test` unit tests, and JSDoc annotations bring `tsc --noEmit` to zero errors.

**Tech Stack:** Vanilla ES modules, no bundler. `@playwright/test` (the only dependency). `node:test` for unit tests. `tsc` for type checking only — it never emits.

## Global Constraints

- **No build step, ever.** GitHub Pages serves the repo verbatim. Nothing in `src/` may require compilation. `tsconfig.json` uses `noEmit: true`.
- **Zero runtime dependencies. Exactly two devDependencies: `@playwright/test` and `typescript`.** (The spec said one; it overlooked that `tsc --noEmit` needs the `typescript` package installed. This is the corrected count. Both are dev-only — neither ships to a player, and `node_modules/` is gitignored, so the "served verbatim" guarantee is intact.)
- **No user-visible change.** Same rendering, same behaviour, same offline support. A player must not be able to tell this shipped.
- **`sw.js`, `index.html`, `styles.css`, `manifest.webmanifest`, `icon-*.png` stay at the repo root.** `sw.js` needs root scope; `index.html` needs to answer `/`.
- **Grid is 13×13 (`N=13`), padding `PAD=10`, 12 words per puzzle (`COUNT=12`).**
- **Node 24+** (`node:test` runner, `--experimental-strip-types` not used).
- Local test server port: **5173**.
- Live site: `https://beeberbab.github.io/word-finder/`.
- Commit to `main` directly. No feature branches, no PRs.

---

### Task 1: Test harness bootstrap

**Files:**
- Create: `package.json`
- Create: `tests/server.mjs`
- Create: `playwright.config.js`
- Create: `tests/e2e/smoke.spec.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Playwright against `http://localhost:5173`. The server exposes two test-only endpoints used by Task 4: `GET /__probe.js` (body changes every request) and `GET /__stats` (JSON request counts).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "word-finder",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "node --test tests/unit/",
    "test:e2e": "playwright test",
    "test:live": "LIVE=1 playwright test --config playwright.live.config.js",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `tests/server.mjs`**

Zero-dependency static server. The `__probe` and `__stats` routes exist so Task 4 can prove stale-while-revalidate locally without writing files to disk.

```js
// Static file server for the Playwright suite. Zero dependencies on purpose:
// the app itself has none, and `npx serve` would need a network fetch.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

// How many times each path was actually served from this process. A request that
// the service worker answered from its cache never arrives here — which is exactly
// what the cache-first assertions in Task 4 measure.
const hits = Object.create(null);
let probeCounter = 0;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = decodeURIComponent(url.pathname);
  hits[path] = (hits[path] || 0) + 1;

  if (path === '/__stats') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(hits));
  }
  if (path === '/__reset') {
    for (const k of Object.keys(hits)) delete hits[k];
    probeCounter = 0;
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  // Body changes on every origin hit, so a stale cached copy is distinguishable
  // from a revalidated one. Cache-Control mirrors GitHub Pages' max-age=600.
  if (path === '/__probe.js') {
    probeCounter += 1;
    res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'max-age=600' });
    return res.end(`export const probe = ${probeCounter};\n`);
  }

  if (path.endsWith('/')) path += 'index.html';
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, safe));
    res.writeHead(200, {
      'Content-Type': MIME[extname(safe)] || 'application/octet-stream',
      'Cache-Control': 'max-age=600',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
```

- [ ] **Step 3: Create `playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,          // the service-worker tests share one origin's cache
  workers: 1,
  reporter: [['list']],
  use: { baseURL: BASE, trace: 'on-first-retry' },
  webServer: {
    command: 'node tests/server.mjs',
    url: `${BASE}/index.html`,
    reuseExistingServer: true,   // Playwright still owns and kills the one it starts
    stdout: 'ignore',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, hasTouch: true },
    },
  ],
});
```

- [ ] **Step 4: Create the smoke test `tests/e2e/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('app boots and renders a full puzzle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(169);          // 13 x 13
  await expect(page.locator('.w')).toHaveCount(12);
  await expect(page.locator('#theme')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText('0 of 12 found');
});
```

- [ ] **Step 5: Add build artefacts to `.gitignore`**

Append to the existing `.gitignore` (which already contains `.playwright-mcp/`):

```gitignore
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 6: Install and run**

Run: `npm install && npx playwright install chromium`
Then: `npm run test:e2e`
Expected: `2 passed` (one per project). If the count assertion fails at 169, stop — the grid size assumption is wrong and the rest of the plan depends on it.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.js tests/ .gitignore
git commit -m "Add Playwright harness with a zero-dependency static server"
git push origin main
```

---

### Task 2: Core gameplay end-to-end tests

**Files:**
- Create: `tests/e2e/helpers.js`
- Create: `tests/e2e/gameplay.spec.js`

**Interfaces:**
- Consumes: the harness from Task 1.
- Produces: `findWordInGrid(page, word?) -> {word, x0, y0, x1, y1}`, `dragCells(page, sel)`, `gridGeometry(page) -> {left, top, cell, pad}`. Later tasks import these from `./helpers.js`.

**Why a DOM solver when we also have a seed:** the seed makes the *puzzle* reproducible; the solver locates coordinates *within* it. Hardcoding coordinates would make every test break the moment Task 5 changes the RNG or placement order — which it does by design.

- [ ] **Step 1: Write `tests/e2e/helpers.js`**

```js
export const N = 13;
export const PAD = 10;

/** Grid origin and cell size, read from the live DOM. */
export async function gridGeometry(page) {
  return page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    const r = gb.getBoundingClientRect();
    return { left: r.left, top: r.top, cell: (gb.offsetWidth - 20) / 13, pad: 10 };
  });
}

/**
 * Locate a word in the rendered grid by brute force over all 8 directions.
 * Pass a word to find that specific one, or omit to get the first word from the
 * list that is locatable. Returns grid coordinates, not pixels.
 */
export async function findWordInGrid(page, word) {
  const found = await page.evaluate((target) => {
    const N = 13;
    const letters = [...document.querySelectorAll('.cell')].map(e => e.textContent);
    const words = target
      ? [target]
      : [...document.querySelectorAll('.w')].map(e => e.textContent.toUpperCase());
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    for (const w of words) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
          if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
          let ok = true;
          for (let i = 0; i < w.length; i++) {
            if (letters[(y + dy * i) * N + (x + dx * i)] !== w[i]) { ok = false; break; }
          }
          if (ok) return { word: w, x0: x, y0: y, x1: ex, y1: ey };
        }
      }
    }
    return null;
  }, word);
  if (!found) throw new Error(`could not locate ${word || 'any word'} in the grid`);
  return found;
}

/** Same brute-force search, but only accepts a diagonally placed word. */
export async function findDiagonalWord(page) {
  const all = await page.locator('.w').allTextContents();
  for (const w of all) {
    const hit = await findWordInGrid(page, w.toUpperCase());
    if (hit.x0 !== hit.x1 && hit.y0 !== hit.y1) return hit;
  }
  throw new Error('no diagonally placed word in this puzzle');
}

/** Drag across a selection using real pointer events, with intermediate steps. */
export async function dragCells(page, sel) {
  const g = await gridGeometry(page);
  const pt = (x, y) => ({
    x: g.left + g.pad + (x + 0.5) * g.cell,
    y: g.top + g.pad + (y + 0.5) * g.cell,
  });
  const a = pt(sel.x0, sel.y0), b = pt(sel.x1, sel.y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}
```

- [ ] **Step 2: Write `tests/e2e/gameplay.spec.js`**

```js
import { test, expect } from '@playwright/test';
import { findWordInGrid, findDiagonalWord, dragCells } from './helpers.js';

test('dragging across a word finds it', async ({ page }) => {
  await page.goto('/');
  const sel = await findWordInGrid(page);
  await dragCells(page, sel);
  await expect(page.locator('#count')).toContainText('1 of 12 found');
  await expect(page.locator('#pills .pill')).toHaveCount(1);
});

test('dragging across nonsense finds nothing', async ({ page }) => {
  await page.goto('/');
  // A single cell can never match a word, and leaves no pill behind.
  await dragCells(page, { x0: 0, y0: 0, x1: 0, y1: 0 });
  await expect(page.locator('#count')).toContainText('0 of 12 found');
  await expect(page.locator('#pills .pill')).toHaveCount(0);
});

test('tapping a found word crosses it out', async ({ page }) => {
  await page.goto('/');
  const sel = await findWordInGrid(page);
  await dragCells(page, sel);
  const chip = page.locator('.w', { hasText: new RegExp(`^${sel.word}$`, 'i') });
  await chip.click();
  await expect(chip).toHaveClass(/done/);
});

test('tapping an unfound word does nothing', async ({ page }) => {
  await page.goto('/');
  const chip = page.locator('.w').first();
  await chip.click();
  await expect(chip).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toContainText('0 of 12 found');
});

test('finding every word raises the win overlay', async ({ page }) => {
  await page.goto('/');
  const words = await page.locator('.w').allTextContents();
  for (const w of words) {
    await dragCells(page, await findWordInGrid(page, w.toUpperCase()));
  }
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#winmsg')).toContainText('You found every');
});

test('a diagonal word is selectable without overshoot', async ({ page }) => {
  await page.goto('/');
  const sel = await findDiagonalWord(page);
  await dragCells(page, sel);
  await expect(page.locator('#count')).toContainText('1 of 12 found');
});
```

- [ ] **Step 3: Run and verify all pass against the current code**

Run: `npm run test:e2e`
Expected: `14 passed` (7 tests × 2 projects). **Every one must pass before continuing** — these tests define "unchanged behaviour" for the refactor in Task 6. If the drag tests fail, the pointer-event simulation is wrong and must be fixed here, not worked around later.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/helpers.js tests/e2e/gameplay.spec.js
git commit -m "Add end-to-end tests for the core gameplay loop"
git push origin main
```

---

### Task 3: Regression tests for the four fixed bugs

**Files:**
- Create: `tests/e2e/regressions.spec.js`

**Interfaces:**
- Consumes: `findWordInGrid`, `dragCells` from `./helpers.js`.
- Produces: nothing new.

Each test pins a bug that has already been fixed and shipped. All must pass immediately; a failure means the fix regressed.

- [ ] **Step 1: Write `tests/e2e/regressions.spec.js`**

```js
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
    const r = gb.getBoundingClientRect();
    const cell = (gb.offsetWidth - 20) / 13;
    const pt = (x, y) => ({ x: r.left + 10 + (x + 0.5) * cell, y: r.top + 10 + (y + 0.5) * cell });
    const a = pt(0, 0), b = pt(3, 3);
    const ev = (t, p) => gb.dispatchEvent(new PointerEvent(t, {
      clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1,
    }));
    ev('pointerdown', a);
    ev('pointermove', b);
    // The live selection pill spans (cells-1)*cell + height. Recover the cell count.
    const pill = document.querySelector('#pills .pill');
    const h = parseFloat(pill.style.height);
    const w = parseFloat(pill.style.width);
    ev('pointerup', b);
    return Math.round((w - h) / (cell * Math.SQRT2)) + 1;
  });
  expect(len).toBe(4);   // (0,0)..(3,3) inclusive. Pre-fix this measured 5 or 6.
});

// Regression for d468bd7. The service worker used to fall back to index.html for ANY
// failed request, so an offline/failed non-navigation asset resolved with HTML bytes
// instead of erroring. The fix restricts the fallback to navigations; everything else
// rejects via Response.error().
//
// The failure only reproduces when the underlying fetch() REJECTS (a network-level
// failure), not when a live server answers 404 — a 404 is a resolved response, so the
// .catch() branch that holds the fix never runs. The test therefore goes offline to
// force a real rejection for a non-cached, non-navigation asset, and asserts it does
// NOT come back as the precached index.html. Verified to fail if the fix is reverted.
test('a failed non-navigation fetch does not fall back to index.html', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++)
      await new Promise(r => setTimeout(r, 250));
  });
  await context.setOffline(true);
  let result;
  try {
    result = await page.evaluate(async () => {
      try {
        const res = await fetch('./definitely-not-here.js');   // never cached, non-navigation
        return { resolved: true, text: (await res.text()).slice(0, 40) };
      } catch (e) {
        return { resolved: false, error: e.name };              // Response.error() -> reject
      }
    });
  } finally {
    await context.setOffline(false);
  }
  // Reverted (pre-d468bd7), offline resolves the missing .js as the precached index.html
  // document, so this is the discriminating assertion.
  expect(result.resolved && result.text.includes('<!DOCTYPE html>')).toBe(false);
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
```

- [ ] **Step 2: Run and verify**

Run: `npm run test:e2e -- regressions.spec.js`
Expected: `8 passed`. Any failure here means a shipped fix has regressed — stop and investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/regressions.spec.js
git commit -m "Pin all four previously fixed bugs with regression tests"
git push origin main
```

---

### Task 4: Layout guard (expected to fail until spec 2)

**Files:**
- Create: `tests/e2e/layout.spec.js`

**Interfaces:**
- Consumes: the harness.
- Produces: the objective pass condition that spec 2 must satisfy.

This encodes the measured device table. Landscape phones fail today; `test.fail()` keeps the suite green while also erroring the moment they start passing, so spec 2 cannot finish without deleting the annotation.

- [ ] **Step 1: Write `tests/e2e/layout.spec.js`**

```js
import { test, expect } from '@playwright/test';

// Real Safari innerHeight (browser chrome subtracted) — what players actually get.
// brokenToday reflects MEASURED behaviour on the current build: portrait phones and
// the small iPad-Mini portrait also clip content (the hint row), by 26-64px, not just
// landscape. Only iPad-Mini landscape and Desktop fully fit today.
const DEVICES = [
  { name: 'iPhone SE portrait',      w: 375,  h: 553,  brokenToday: true },
  { name: 'iPhone SE landscape',     w: 667,  h: 285,  brokenToday: true },
  { name: 'iPhone 13 portrait',      w: 390,  h: 664,  brokenToday: true },   // clips 64px
  { name: 'iPhone 13 landscape',     w: 844,  h: 300,  brokenToday: true },
  { name: 'iPhone Pro Max portrait', w: 430,  h: 752,  brokenToday: true },   // clips 28px
  { name: 'iPhone Pro Max landscape',w: 932,  h: 340,  brokenToday: true },
  { name: 'iPad Mini portrait',      w: 744,  h: 1053, brokenToday: true },   // clips 26px
  { name: 'iPad Mini landscape',     w: 1133, h: 664,  brokenToday: false },
  { name: 'Desktop',                 w: 1440, h: 900,  brokenToday: false },
];

async function measure(page) {
  return page.evaluate(() => {
    const q = id => document.getElementById(id);
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

// Run only once, not per project — these tests set their own viewport.
test.describe.configure({ mode: 'serial' });

for (const d of DEVICES) {
  test(`layout fits: ${d.name} (${d.w}x${d.h})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'viewport is set explicitly');
    // Delete this annotation in spec 2. Playwright errors if a test.fail() passes,
    // so the suite itself enforces that the fix is real.
    if (d.brokenToday) test.fail(true, 'known broken until the responsive layout spec lands');

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
```

- [ ] **Step 2: Run and confirm the expected split**

Run: `npm run test:e2e -- layout.spec.js`
Expected: the 5 devices marked `brokenToday: false` **pass**; the 4 marked `true` report as **expected failures** (`4 failed (expected)` in Playwright's summary, exit code 0). If a `brokenToday: true` case unexpectedly passes, Playwright errors — update the table, because the measurement was wrong.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/layout.spec.js
git commit -m "Add layout guard encoding the measured device table"
git push origin main
```

---

### Task 5: Seeded RNG, added in place

**Files:**
- Modify: `game.js` (lines 6-11, 19, 27, 31-32, 41, 198)

**Interfaces:**
- Produces: `?seed=<int>` pins the puzzle; `?theme=<int>` pins the theme index. With neither, behaviour is identical to today.

Done *before* the module split so the split is a pure move, with one behavioural change isolated in its own commit.

- [ ] **Step 1: Add the PRNG and seed resolution near the top of `game.js`**

Insert immediately after the existing `var PAL=[...]` line:

```js
// Deterministic PRNG so a puzzle can be reproduced exactly. `?seed=N` pins the
// sequence, `?theme=N` pins the theme; with neither, the clock seeds it and the
// game behaves exactly as before. This is the shipped path, not a test-only branch.
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
var params=new URLSearchParams(location.search);
var seedParam=params.get('seed');
var rand=mulberry32(seedParam!==null?parseInt(seedParam,10)||0:Date.now());
```

- [ ] **Step 2: Replace every `Math.random()` call site**

There are six. Replace `Math.random()` with `rand()` on each of these lines:

- `var themeIdx=Math.floor(Math.random()*THEMES.length);` → uses `rand()`, then honour `?theme=`:

```js
var themeParam=params.get('theme');
var themeIdx=themeParam!==null
  ? Math.min(THEMES.length-1,Math.max(0,parseInt(themeParam,10)||0))
  : Math.floor(rand()*THEMES.length);
```

- In the shuffle: `var j=Math.floor(Math.random()*(i+1));` → `var j=Math.floor(rand()*(i+1));`
- In placement: `var d=DIRS[Math.floor(Math.random()*8)]` → `DIRS[Math.floor(rand()*8)]`
- `var x0=xmin+Math.floor(Math.random()*(xmax-xmin+1));` → `rand()`
- `var y0=ymin+Math.floor(Math.random()*(ymax-ymin+1));` → `rand()`
- Filler letters: `A[Math.floor(Math.random()*26)]` → `A[Math.floor(rand()*26)]`

Leave the `Math.random()` calls inside `burst()` alone — confetti is decoration, not puzzle state, and seeding it would make the effect visibly repetitive.

- [ ] **Step 3: Add a determinism test to `tests/e2e/gameplay.spec.js`**

```js
test('the same seed reproduces the same puzzle', async ({ page }) => {
  await page.goto('/?seed=12345&theme=0');
  const a = await page.locator('.cell').allTextContents();
  const themeA = await page.locator('#theme').textContent();
  await page.goto('/?seed=12345&theme=0');
  const b = await page.locator('.cell').allTextContents();
  expect(b.join('')).toBe(a.join(''));
  expect(await page.locator('#theme').textContent()).toBe(themeA);

  await page.goto('/?seed=999&theme=0');
  const c = await page.locator('.cell').allTextContents();
  expect(c.join('')).not.toBe(a.join(''));   // different seed, different grid
});
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:e2e`
Expected: all previously passing tests still pass, plus the new determinism test. The layout guard still reports 4 expected failures.

- [ ] **Step 5: Commit**

```bash
git add game.js tests/e2e/gameplay.spec.js
git commit -m "Seed the puzzle RNG so a grid can be reproduced exactly"
git push origin main
```

---

### Task 6: Split `game.js` into `src/` modules

**Files:**
- Create: `src/rng.js`, `src/puzzle.js`, `src/layout.js`, `src/view.js`, `src/effects.js`, `src/main.js`
- Move: `themes.js` → `src/themes.js`
- Delete: `game.js`
- Modify: `index.html:36`, `sw.js:2`

**Interfaces:**
- Consumes: the seeded RNG from Task 5.
- Produces:

```js
// src/rng.js
export function mulberry32(seed)                       // -> () => number in [0,1)
export function makeRng(seed)                          // -> {random, int, pick, shuffle}
export function resolveSeed(search)                    // -> number
export function resolveThemeIndex(search, count, rng)  // -> number

// src/puzzle.js
export function cap(s)                                 // -> string
export function buildPuzzle({themes, themeIdx, rng, size, count})
  // -> {name, cells: string[], words: string[], placements: [{word,x0,y0,dx,dy}]}
export function snap(sx, sy, fx, fy, size)             // -> {x1, y1}
export function readLine(cells, size, sel)             // -> string
export function matchWord(words, found, str)           // -> string | null

// src/layout.js
export function computeLayout({vw, vh, size, pad})
  // -> {landscape, cell, gridSize, sideWidth, listColumns}

// src/view.js
export function applyLayout(els, dims)
export function renderGrid(els, puzzle, dims, size, pad)
export function renderPills(els, state, dims, pad)
export function renderList(els, puzzle, state, onTap)

// src/effects.js
export function burst(fxEl, sel, count, dims, pad)
export function pop(win)
```

**This is the highest-risk task in the plan.** It moves every line of the file. The suite from Tasks 2–5 is the safety net, and it must stay green the entire way.

- [ ] **Step 1: Move the theme data**

```bash
git mv themes.js src/themes.js
```

- [ ] **Step 2: Create `src/rng.js`**

```js
/** Small fast PRNG. Same seed, same sequence — the basis of reproducible puzzles. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const random = mulberry32(seed);
  return {
    random,
    int: (n) => Math.floor(random() * n),
    pick: (arr) => arr[Math.floor(random() * arr.length)],
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/** `?seed=N` when present and numeric, else the clock. */
export function resolveSeed(search) {
  const v = new URLSearchParams(search).get('seed');
  if (v === null) return Date.now();
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/** `?theme=N` clamped into range when present, else a random theme. */
export function resolveThemeIndex(search, count, rng) {
  const v = new URLSearchParams(search).get('theme');
  if (v === null) return rng.int(count);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(count - 1, Math.max(0, n)) : 0;
}
```

- [ ] **Step 3: Create `src/puzzle.js` — all pure, no DOM**

```js
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function cap(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }

/**
 * Generate a puzzle. `placements` records where each word actually landed, so a
 * test can assert the grid really contains what the word list claims.
 */
export function buildPuzzle({ themes, themeIdx, rng, size, count }) {
  const name = themes[themeIdx][0];
  const pool = themes[themeIdx][1].split(',').filter(w => w.length <= size - 1);
  const words = rng.shuffle(pool).slice(0, count).sort((a, b) => b.length - a.length);

  const g = Array.from({ length: size }, () => new Array(size).fill(null));
  const placements = [];
  for (const w of words) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const [dx, dy] = DIRS[rng.int(8)];
      const span = w.length - 1;
      const xmin = dx < 0 ? span : 0, xmax = dx > 0 ? size - 1 - span : size - 1;
      const ymin = dy < 0 ? span : 0, ymax = dy > 0 ? size - 1 - span : size - 1;
      if (xmax < xmin || ymax < ymin) continue;
      const x0 = xmin + rng.int(xmax - xmin + 1);
      const y0 = ymin + rng.int(ymax - ymin + 1);
      let ok = true;
      for (let i = 0; i < w.length; i++) {
        const c = g[y0 + dy * i][x0 + dx * i];
        if (c && c !== w[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) g[y0 + dy * i][x0 + dx * i] = w[i];
      placements.push({ word: w, x0, y0, dx, dy });
      break;
    }
  }

  const cells = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) cells.push(g[y][x] || ALPHABET[rng.int(26)]);

  return { name, cells, words: placements.map(p => p.word), placements };
}

/**
 * Snap a free pointer offset to the nearest of 8 directions and a whole number of
 * cells. Length is the PROJECTION of the offset onto the snapped direction: using
 * raw Euclidean distance overshoots, because a k-cell diagonal spans k*sqrt(2).
 */
export function snap(sx, sy, fx, fy, size) {
  const dx = fx - sx, dy = fy - sy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { x1: sx, y1: sy };
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(ang)), uy = Math.round(Math.sin(ang));
  let L = Math.round((dx * ux + dy * uy) / (ux * ux + uy * uy));
  while (L > 0 && (sx + ux * L < 0 || sx + ux * L >= size || sy + uy * L < 0 || sy + uy * L >= size)) L--;
  return { x1: sx + ux * L, y1: sy + uy * L };
}

/** Read the letters under a selection, start to end inclusive. */
export function readLine(cells, size, sel) {
  const dx = Math.sign(sel.x1 - sel.x0), dy = Math.sign(sel.y1 - sel.y0);
  const len = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)) + 1;
  let out = '';
  for (let i = 0; i < len; i++) out += cells[(sel.y0 + dy * i) * size + (sel.x0 + dx * i)];
  return out;
}

/** First unfound word matching the string forwards or backwards. */
export function matchWord(words, found, str) {
  const rev = str.split('').reverse().join('');
  for (const w of words) if (!found[w] && (w === str || w === rev)) return w;
  return null;
}
```

- [ ] **Step 4: Create `src/layout.js` — pure viewport arithmetic, behaviour unchanged**

Transcribed exactly from `game.js:52-66`, including the floors that spec 2 will change. **Do not fix anything here** — that is spec 2's job, and changing it now would break Task 4's expected-failure annotations.

```js
/**
 * Viewport arithmetic. Pure so it can be unit-tested across a device table.
 * NOTE: the `max(24, ...)` and `max(availH, 240)` floors can force the grid LARGER
 * than the space available, which is why landscape phones overflow today. Spec 2
 * changes this; it is transcribed verbatim here so the split stays behaviour-neutral.
 */
export function computeLayout({ vw, vh, size, pad }) {
  const landscape = vw > vh * 1.08;
  const availW = landscape ? vw - 320 : vw - 44;
  const availH = vh - (landscape ? 130 : 380);
  const cell = Math.max(24, Math.min(54, Math.floor(Math.min(availW, Math.max(availH, 240)) / size)));
  const gridSize = size * cell + 2 * pad;
  return {
    landscape,
    cell,
    gridSize,
    sideWidth: landscape ? 240 : gridSize,
    listColumns: landscape ? '1fr' : '1fr 1fr',
  };
}
```

- [ ] **Step 5: Create `src/view.js`, `src/effects.js`, `src/main.js`**

Move the remaining code across without altering behaviour. Exact source mapping (line numbers refer to the pre-refactor `game.js`, which is still in git history at `HEAD~` after this task):

`src/view.js` — the rendering that touches the DOM:
- `pillDiv` (`game.js:77-88`) and `renderPills` (`game.js:89-93`) → export `renderPills(els, state, dims, pad)`, with `pillDiv` a module-private helper. `state` supplies `foundOrder`, `found`, `sel`; `dims` supplies `cell`; `PAL` moves here as a module constant.
- the cell-building loop (`game.js:67-74`) → export `renderGrid(els, puzzle, dims, size, pad)`.
- `renderList` (`game.js:94-108`) → export `renderList(els, puzzle, state, onTap)`, where `onTap(word)` replaces the inline click handler so `main.js` owns the state mutation.
- the layout-application side of `layout()` (`game.js:60-66`: setting `gridbox`, `main`, `side`, `listEl` styles) → export `applyLayout(els, dims)`. The arithmetic itself is already in `computeLayout` from Step 4.

`src/effects.js` — `burst` (`game.js:168-183`) and `pop` (`game.js:184-197`) verbatim, exported as `burst(fxEl, sel, count, dims, pad)` and `pop(win)`. Keep the `Math.random()` calls inside `burst` — confetti is decoration, not puzzle state.

`src/main.js` — the orchestration and everything stateful:
- element lookups (`game.js:9-10`), `GLOW_MS`, `N`, `PAD`, `COUNT` constants (`game.js:6`).
- the mutable state `puzzle, found, foundOrder, sel, drag, cell, ac, winTimer` (`game.js:8`) lives here and nowhere else.
- `buildPuzzle` orchestration (`game.js:13-50`) becomes a thin `newPuzzle(idx)` that calls `puzzle.buildPuzzle(...)`, then `renderGrid`/`renderList`/`applyLayout`.
- `layout()` (`game.js:52-76`) calls `computeLayout` then `applyLayout` + `renderGrid` + `renderPills`.
- pointer handlers (`game.js:126-167`) calling `snap`, `readLine`, `matchWord` from `puzzle.js` and `burst`/`pop` from `effects.js`.
- `newTheme` (`game.js:198`), the button/resize listeners (`game.js:199-201`), the boot call (`game.js:202`), and the SW registration (`game.js:203`).

Preserve verbatim, because each encodes a fixed bug:
- the `winTimer` clear and its comment in the puzzle-rebuild path (`game.js:44-48`),
- the projection-based length in `snap()` (already in `puzzle.js` from Step 3),
- the win-timer scheduling with its 700 ms delay (`game.js:158-162`),
- `GLOW_MS = 10000`, `N = 13`, `PAD = 10`, `COUNT = 12`.

- [ ] **Step 6: Update the entry point in `index.html`**

Change line 36 from `<script type="module" src="game.js"></script>` to:

```html
<script type="module" src="src/main.js"></script>
```

- [ ] **Step 7: Update the precache list in `sw.js`**

```js
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/themes.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
```

- [ ] **Step 8: Add an e2e assertion that every precached path resolves**

A wrong path here breaks offline support silently. Append to `tests/e2e/regressions.spec.js`:

```js
test('every asset in the service worker precache list actually resolves', async ({ page }) => {
  await page.goto('/');
  const sw = await (await fetch('http://localhost:5173/sw.js')).text();
  const list = JSON.parse(sw.match(/const ASSETS=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const results = await page.evaluate(async (paths) => {
    const out = {};
    for (const p of paths) out[p] = (await fetch(p, { cache: 'reload' })).status;
    return out;
  }, list);
  for (const [path, status] of Object.entries(results)) {
    expect(status, `${path} did not resolve`).toBe(200);
  }
});
```

- [ ] **Step 9: Delete the old entry point and run everything**

```bash
git rm game.js
npm run test:e2e
```

Expected: identical results to Task 5 — all functional and regression tests pass, layout guard still shows exactly 4 expected failures. **If any test that passed before now fails, the refactor changed behaviour. Fix the module, not the test.**

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Split game.js into src/ modules along the DOM boundary"
git push origin main
```

---

### Task 7: Unit tests for the pure modules

**Files:**
- Create: `tests/unit/rng.test.js`, `tests/unit/puzzle.test.js`, `tests/unit/layout.test.js`

**Interfaces:**
- Consumes: the exports from Task 6.

These run in milliseconds with no browser — the payoff for the split.

- [ ] **Step 1: Write `tests/unit/rng.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, resolveSeed, resolveThemeIndex } from '../../src/rng.js';

test('the same seed reproduces the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = Array.from({ length: 20 }, () => a.random());
  const seqB = Array.from({ length: 20 }, () => b.random());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a.random(), b.random());
});

test('random() stays in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.random();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('shuffle keeps every element and does not mutate the input', () => {
  const r = makeRng(3);
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = r.shuffle(input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.slice().sort((x, y) => x - y), input);
});

test('resolveSeed honours ?seed= and falls back to the clock', () => {
  assert.equal(resolveSeed('?seed=99'), 99);
  assert.equal(resolveSeed('?seed=abc'), 0);
  assert.ok(resolveSeed('') > 0);
});

test('resolveThemeIndex clamps ?theme= into range', () => {
  const rng = makeRng(1);
  assert.equal(resolveThemeIndex('?theme=5', 100, rng), 5);
  assert.equal(resolveThemeIndex('?theme=999', 100, rng), 99);
  assert.equal(resolveThemeIndex('?theme=-4', 100, rng), 0);
});
```

- [ ] **Step 2: Write `tests/unit/puzzle.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle, snap, readLine, matchWord, cap } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { THEMES } from '../../src/themes.js';

const build = (seed, themeIdx = 0) =>
  buildPuzzle({ themes: THEMES, themeIdx, rng: makeRng(seed), size: 13, count: 12 });

test('every placed word is actually readable in the grid', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const p = build(seed, seed % THEMES.length);
    for (const { word, x0, y0, dx, dy } of p.placements) {
      let read = '';
      for (let i = 0; i < word.length; i++) read += p.cells[(y0 + dy * i) * 13 + (x0 + dx * i)];
      assert.equal(read, word, `seed ${seed}: ${word} is not at its recorded position`);
    }
  }
});

test('all 12 words place across every theme', () => {
  for (let i = 0; i < THEMES.length; i++) {
    const p = build(i + 1, i);
    assert.equal(p.words.length, 12, `theme ${THEMES[i][0]} placed ${p.words.length}`);
  }
});

test('the same seed produces an identical grid', () => {
  assert.deepEqual(build(123).cells, build(123).cells);
  assert.notDeepEqual(build(123).cells, build(124).cells);
});

test('the grid is fully populated with A-Z', () => {
  const p = build(9);
  assert.equal(p.cells.length, 169);
  assert.ok(p.cells.every(c => /^[A-Z]$/.test(c)));
});

// Regression for 5e2bbf6: a k-cell diagonal spans k*sqrt(2), so length must come
// from the projection onto the snapped direction, not the Euclidean distance.
test('a diagonal drag does not overshoot', () => {
  assert.deepEqual(snap(0, 0, 3, 3, 13), { x1: 3, y1: 3 });
  assert.deepEqual(snap(0, 0, 5, 5, 13), { x1: 5, y1: 5 });
  assert.deepEqual(snap(6, 6, 3, 3, 13), { x1: 3, y1: 3 });
});

test('snap covers all eight directions', () => {
  assert.deepEqual(snap(6, 6, 9, 6, 13), { x1: 9, y1: 6 });
  assert.deepEqual(snap(6, 6, 3, 6, 13), { x1: 3, y1: 6 });
  assert.deepEqual(snap(6, 6, 6, 9, 13), { x1: 6, y1: 9 });
  assert.deepEqual(snap(6, 6, 6, 3, 13), { x1: 6, y1: 3 });
  assert.deepEqual(snap(6, 6, 9, 3, 13), { x1: 9, y1: 3 });
  assert.deepEqual(snap(6, 6, 3, 9, 13), { x1: 3, y1: 9 });
});

test('snap clamps to the grid instead of running off the edge', () => {
  const r = snap(11, 11, 40, 40, 13);
  assert.ok(r.x1 <= 12 && r.y1 <= 12, `escaped the grid: ${JSON.stringify(r)}`);
  const l = snap(1, 1, -40, -40, 13);
  assert.ok(l.x1 >= 0 && l.y1 >= 0, `escaped the grid: ${JSON.stringify(l)}`);
});

test('a tap with no movement selects a single cell', () => {
  assert.deepEqual(snap(4, 4, 4.1, 4.1, 13), { x1: 4, y1: 4 });
});

test('readLine reads a selection in order', () => {
  const cells = Array.from({ length: 169 }, (_, i) => 'ABCDEFGHIJKLM'[i % 13]);
  assert.equal(readLine(cells, 13, { x0: 0, y0: 0, x1: 3, y1: 0 }), 'ABCD');
});

test('matchWord matches forwards and backwards, skipping found words', () => {
  const words = ['CAT', 'DOG'];
  assert.equal(matchWord(words, {}, 'CAT'), 'CAT');
  assert.equal(matchWord(words, {}, 'TAC'), 'CAT');
  assert.equal(matchWord(words, { CAT: true }, 'CAT'), null);
  assert.equal(matchWord(words, {}, 'XYZ'), null);
});

test('cap title-cases a word', () => {
  assert.equal(cap('SUNSHINE'), 'Sunshine');
});
```

- [ ] **Step 3: Write `tests/unit/layout.test.js`**

Documents today's behaviour, including the overflow. Spec 2 rewrites these expectations.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../../src/layout.js';

const at = (vw, vh) => computeLayout({ vw, vh, size: 13, pad: 10 });

test('orientation flips on the 1.08 aspect threshold', () => {
  assert.equal(at(390, 664).landscape, false);
  assert.equal(at(844, 300).landscape, true);
});

test('cell size stays within its clamps', () => {
  for (const [w, h] of [[375,553],[390,664],[844,300],[1440,900],[200,200]]) {
    const { cell } = at(w, h);
    assert.ok(cell >= 24 && cell <= 54, `${w}x${h} produced cell ${cell}`);
  }
});

test('desktop gets the largest cell', () => {
  assert.equal(at(1440, 900).cell, 54);
});

// Documents the defect spec 2 fixes: the 24px floor forces a 334px grid into
// 300px of viewport. Delete/invert this test when the responsive layout lands.
test('KNOWN DEFECT: landscape phones overflow the viewport', () => {
  const { gridSize } = at(844, 300);
  assert.ok(gridSize > 300, 'expected the current arithmetic to overflow');
});
```

- [ ] **Step 4: Run the unit tests**

Run: `npm run test:unit`
Expected: all pass, in well under a second.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: unit tests pass, e2e passes, layout guard shows 4 expected failures, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/
git commit -m "Add fast unit tests for the pure puzzle, rng and layout modules"
git push origin main
```

---

### Task 8: Type checking with JSDoc

**Files:**
- Create: `tsconfig.json`
- Modify: every file in `src/`

**Interfaces:**
- Produces: `npm run typecheck` exits 0.

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "skipLibCheck": true
  },
  "include": ["src/**/*.js", "tests/**/*.js", "tests/**/*.mjs", "sw.js"]
}
```

- [ ] **Step 2: Add shared typedefs at the top of `src/puzzle.js`**

```js
/**
 * @typedef {{word:string, x0:number, y0:number, dx:number, dy:number}} Placement
 * @typedef {{name:string, cells:string[], words:string[], placements:Placement[]}} Puzzle
 * @typedef {{x0:number, y0:number, x1:number, y1:number}} Selection
 * @typedef {{random:()=>number, int:(n:number)=>number, pick:<T>(a:T[])=>T, shuffle:<T>(a:T[])=>T[]}} Rng
 */
```

- [ ] **Step 3: Annotate every exported function**

Example, applied to each export in turn:

```js
/**
 * @param {{themes:[string,string][], themeIdx:number, rng:Rng, size:number, count:number}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ themes, themeIdx, rng, size, count }) { /* ... */ }

/**
 * @param {number} sx @param {number} sy @param {number} fx @param {number} fy
 * @param {number} size
 * @returns {{x1:number, y1:number}}
 */
export function snap(sx, sy, fx, fy, size) { /* ... */ }
```

DOM lookups need narrowing, since `getElementById` returns `HTMLElement | null`:

```js
/** @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}
```

- [ ] **Step 4: Run the type checker and fix until clean**

Run: `npm run typecheck`
Expected: `0 errors`. Common fixes: `HTMLElement` → `HTMLDivElement` for `.style` access on specific elements, and `/** @type {AudioContext|null} */` on the lazily-created audio context. **Do not silence errors with `@ts-ignore`** — if a type is genuinely awkward, widen the typedef instead.

- [ ] **Step 5: Confirm nothing was emitted**

Run: `git status --porcelain`
Expected: only `tsconfig.json` and the `src/` edits. **No `.d.ts`, no `dist/`, no `.js.map`.** If any appear, `noEmit` is not taking effect — stop and fix it, because the zero-build-step guarantee is the point.

- [ ] **Step 6: Run the full suite once more**

Run: `npm test`
Expected: unchanged from Task 7. JSDoc comments cannot alter runtime behaviour, so any change here means an annotation edit accidentally touched code.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json src/ package.json
git commit -m "Type-check the source with JSDoc and tsc --noEmit, no build step"
git push origin main
```

---

### Task 9: Live smoke test and README

**Files:**
- Create: `playwright.live.config.js`, `tests/live/smoke.spec.js`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run test:live`, run manually after deploying.

- [ ] **Step 1: Create `playwright.live.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

// Runs against the deployed site. No webServer — this is the real thing, and it
// only makes sense after `git push` and a Pages build.
export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://beeberbab.github.io/word-finder/',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'live', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Create `tests/live/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('the deployed app boots', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(169);
  await expect(page.locator('.w')).toHaveCount(12);
});

test('the service worker installs and takes control', async ({ page }) => {
  await page.goto('/');
  const controlled = await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++)
      await new Promise(r => setTimeout(r, 250));
    return !!navigator.serviceWorker.controller;
  });
  expect(controlled).toBe(true);
});

test('every precached asset is reachable on the live origin', async ({ page }) => {
  await page.goto('/');
  const statuses = await page.evaluate(async () => {
    const sw = await (await fetch('./sw.js', { cache: 'reload' })).text();
    const list = JSON.parse(sw.match(/const ASSETS=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
    const out = {};
    for (const p of list) out[p] = (await fetch(p, { cache: 'reload' })).status;
    return out;
  });
  for (const [path, status] of Object.entries(statuses)) {
    expect(status, `${path} is missing from the deployed site`).toBe(200);
  }
});
```

- [ ] **Step 3: Update `README.md`**

Replace the project-layout table with the new structure, and add a Development section:

```markdown
## Development

No build step. The files in this repo are exactly what GitHub Pages serves.

```bash
npm install                 # one-time; also run: npx playwright install chromium
npm test                    # unit + end-to-end, against a local server
npm run test:unit           # fast, no browser
npm run typecheck           # JSDoc types via tsc --noEmit; emits nothing
npm run test:live           # against the deployed site, AFTER pushing
```

`?seed=123&theme=4` pins a puzzle exactly — used by the tests, and handy for
reproducing a bug report.
```

- [ ] **Step 4: Verify the live suite**

Run: `git push origin main`, wait for the Pages build (typically 1–3 minutes), then `npm run test:live`
Expected: 3 passed. A failure on the precache test means `sw.js` `ASSETS` references a path that does not exist on the deployed site.

- [ ] **Step 5: Commit**

```bash
git add playwright.live.config.js tests/live/ README.md
git commit -m "Add live smoke suite and document the dev workflow"
git push origin main
```

---

## Definition of done

- `npm test` exits 0: unit tests pass, e2e passes, layout guard reports exactly 4 expected failures.
- `npm run typecheck` reports 0 errors and emits no files.
- `npm run test:live` passes against the deployed site.
- `game.js` no longer exists; `src/` holds seven focused modules.
- The deployed game looks and behaves exactly as it did before this plan started.
