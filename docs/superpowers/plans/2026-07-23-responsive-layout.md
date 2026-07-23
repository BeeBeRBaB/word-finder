# Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 13×13 grid and full 12-word list fit on iPhone X-and-later and iPad, both orientations, with the theme header in the right rail in landscape and safe-area insets respected.

**Architecture:** Keep `computeLayout`'s signature and return shape unchanged; fix only its internal arithmetic (drop the two oversize floors, size the grid to the scarce dimension, 2-column list in both orientations). Handle the theme-header-in-landscape with CSS `grid-template-areas` on `#app` toggled by a `data-landscape` attribute. Handle safe-area with `env()` padding on `#app`, read back via computed style so the grid arithmetic accounts for it. No new dependencies, no build step.

**Tech Stack:** Vanilla ES modules, CSS, Playwright (`@playwright/test`), `node:test`. Same as spec 1.

## Global Constraints

- No build step. GitHub Pages serves the repo verbatim; deploy is `git push` to `main` (no branches).
- No new runtime or dev dependencies.
- Grid stays 13×13 (`N=13`), 12 words, `PAD=10` (grid-internal padding, part of `gridSize`).
- Target devices: iPhone X and later, iPad. iPhone SE is OUT of scope.
- `computeLayout` stays PURE (no DOM/window/location) and keeps its return shape `{landscape, cell, gridSize, sideWidth, listColumns}`.
- Word list is 2 columns in BOTH orientations (the widest chip is ~106px; 3 columns would clip 12-letter words).
- Cell size clamps to a max of 54; a small absolute floor of 16 is a safety net only (in-scope devices never hit it).
- `npm test` (unit + e2e), `npm run typecheck`, and the live suite must all stay green; gameplay/seed/offline behaviour must not change.
- Measured facts (real Safari innerHeight, current build): portrait non-grid chrome (header + 20px gap + `#side`) ≈ 383px including `#app`'s 28px vertical padding; header ≈ 44px; `#side` ≈ 290px (listhdr 17 + list 210 + hint 38 + margins); widest word chip ≈ 106px.

---

## File Structure

| File | Change |
| --- | --- |
| `tests/e2e/layout.spec.js` | Task 1: remove the two iPhone SE rows. Task 2: delete `test.fail()` annotations + `mode:'serial'`. |
| `tests/unit/layout.test.js` | Task 2: replace the "KNOWN DEFECT" test and SE datapoint with fit-invariant tests. |
| `src/layout.js` | Task 2: rewrite `computeLayout` internals (same signature/shape). |
| `styles.css` | Task 2: `#app` grid + `env()` padding, `#hdr`/`#gridbox`/`#side` grid-areas, chrome trims, 2-col list. |
| `src/view.js` | Task 2: `applyLayout` sets `#app` column tracks + `data-landscape`, not flexDirection. |
| `src/main.js` | Task 2: `layout()` subtracts `#app`'s computed padding (incl. resolved `env()` insets) before calling `computeLayout`. |

---

## Task 1: Drop iPhone SE from the layout guard

**Files:**
- Modify: `tests/e2e/layout.spec.js:7-8` (remove the two SE rows)

**Interfaces:**
- Produces: a 7-case guard — 5 still `test.fail()` (iPhone 13 P+L, Pro Max P+L, iPad Mini P), 2 passing (iPad Mini L, Desktop).

- [ ] **Step 1: Remove the two SE device rows**

In `tests/e2e/layout.spec.js`, delete these two lines from the `DEVICES` array:

```js
  { name: 'iPhone SE portrait',      w: 375,  h: 553,  brokenToday: true },
  { name: 'iPhone SE landscape',     w: 667,  h: 285,  brokenToday: true },
```

Leave the other seven rows unchanged.

- [ ] **Step 2: Run the guard, confirm still green**

Run: `npm run test:e2e -- layout.spec.js`
Expected: exit 0. 2 passing (iPad Mini landscape, Desktop) + 5 expected-failures (the `test.fail()` devices). No "unexpected" outcomes. (Playwright reports expected failures within the pass tally; the key is exit 0 and zero unexpected.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/layout.spec.js
git commit -m "Drop iPhone SE from the layout guard (out of scope)"
git push origin main
```

---

## Task 2: The responsive layout — arithmetic, CSS reflow, safe-area, guard

**Why one task:** the arithmetic, its DOM/CSS application, and the guard's `test.fail()`
removal are interdependent. The moment `computeLayout` is fixed, the guard's landscape
devices start passing, which Playwright reports as a failure until the annotations are
removed. Landing them together is the only way each commit stays green — important because
this deploys straight to `main`. Steps still follow TDD (tests first, then implementation).

**Files:**
- Modify: `src/layout.js` (rewrite `computeLayout` internals + JSDoc comment)
- Modify: `tests/unit/layout.test.js` (replace clamp/KNOWN-DEFECT tests with fit tests)
- Modify: `styles.css` (`#app` grid + `env()` padding, grid-areas, chrome trims, 2-col list)
- Modify: `src/view.js` (`applyLayout` sets column tracks + `data-landscape`; `Els` typedef gains `app`)
- Modify: `src/main.js` (`layout()` subtracts `#app`'s resolved padding; `els` gains `app`)
- Modify: `tests/e2e/layout.spec.js` (remove `test.fail()` + `mode:'serial'`)

**Interfaces:**
- Consumes: nothing new. `computeLayout({vw, vh, size, pad})` — same call.
- Produces: `computeLayout` returns the SAME shape `{landscape, cell, gridSize, sideWidth, listColumns}`, but `vw`/`vh` are now the space available INSIDE `#app` (padding + safe-area subtracted by `layout()`), `listColumns` is always `'1fr 1fr'`, and no in-scope device overflows. All 7 guard cases pass.

**Key formulas** (`RESERVE_PORTRAIT` = non-grid chrome height that sits above+below the grid in portrait; pin it by measurement in Step 3, starting from ~340 after Task 3's chrome trims; the fit test enforces correctness):

- `landscape = vw > vh * 1.08` (unchanged).
- Landscape (height scarce): `cell = min(54, floor((vh - 2*pad) / size))`; `sideWidth = max(160, vw - gridSize - 20)` (20 = the `#main` column gap).
- Portrait (fit under the fixed-height chrome): `cell = min(54, floor(min(vw - 2*pad, vh - RESERVE_PORTRAIT - 2*pad) / size))`; `sideWidth = gridSize` (list sits under the grid, same width).
- Both: `cell = max(16, cell)` (safety floor only); `gridSize = size*cell + 2*pad`; `listColumns = '1fr 1fr'`.

- [ ] **Step 1: Replace the unit tests with fit-invariant tests**

Replace the entire body of `tests/unit/layout.test.js` (keep the imports) with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../../src/layout.js';

const at = (vw, vh) => computeLayout({ vw, vh, size: 13, pad: 10 });

// Space available inside #app (the caller subtracts #app padding + safe-area insets).
// These are the in-scope device viewports minus a nominal 20px app padding.
const DEVICES = [
  { name: 'iPhone 13 portrait',       vw: 370,  vh: 644 },
  { name: 'iPhone 13 landscape',      vw: 824,  vh: 280 },
  { name: 'iPhone Pro Max portrait',  vw: 410,  vh: 732 },
  { name: 'iPhone Pro Max landscape', vw: 912,  vh: 320 },
  { name: 'iPad Mini portrait',       vw: 724,  vh: 1033 },
  { name: 'iPad Mini landscape',      vw: 1113, vh: 644 },
  { name: 'Desktop',                  vw: 1420, vh: 880 },
];

test('orientation flips on the 1.08 aspect threshold', () => {
  assert.equal(at(370, 644).landscape, false);
  assert.equal(at(824, 280).landscape, true);
});

test('the word list is two columns in both orientations', () => {
  assert.equal(at(370, 644).listColumns, '1fr 1fr');
  assert.equal(at(824, 280).listColumns, '1fr 1fr');
});

test('grid fits within the available space on every in-scope device', () => {
  for (const d of DEVICES) {
    const { landscape, gridSize, sideWidth } = at(d.vw, d.vh);
    // The grid box never exceeds the available height...
    assert.ok(gridSize <= d.vh + 0.5, `${d.name}: grid ${gridSize} > vh ${d.vh}`);
    if (landscape) {
      // ...and in landscape, grid + gap + list fit the width, with a usable rail.
      assert.ok(gridSize + 20 + sideWidth <= d.vw + 0.5, `${d.name}: grid+list ${gridSize + 20 + sideWidth} > vw ${d.vw}`);
      assert.ok(sideWidth >= 160, `${d.name}: list rail ${sideWidth} too narrow`);
    } else {
      // ...in portrait the grid fits the width too (list sits under it).
      assert.ok(gridSize <= d.vw + 0.5, `${d.name}: grid ${gridSize} > vw ${d.vw}`);
    }
  }
});

test('cells stay within [16, 54] and reach 54 on desktop', () => {
  for (const d of DEVICES) {
    const { cell } = at(d.vw, d.vh);
    assert.ok(cell >= 16 && cell <= 54, `${d.name}: cell ${cell}`);
  }
  assert.equal(at(1420, 880).cell, 54);
});

test('non-zero insets shrink the usable space and still fit', () => {
  // Caller passes inset-reduced vw/vh; a notch case must still fit.
  const { gridSize } = at(824 - 88, 280); // 44px inset each side in landscape
  assert.ok(gridSize <= 280 + 0.5);
});
```

- [ ] **Step 2: Run the unit tests, watch them FAIL against the current arithmetic**

Run: `npm run test:unit`
Expected: the "grid fits" test FAILS — the current `max(availH,240)`/`max(24,…)` arithmetic overflows landscape (e.g. iPhone 13 landscape grid 334 > vh 280). This confirms the tests catch the defect.

- [ ] **Step 3: Rewrite `computeLayout`**

Replace `src/layout.js` in full with:

```js
/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number, listColumns:string}} LayoutDims
 */

// Portrait non-grid chrome (header + gap + word list + hint), in px. The list is a
// fixed-height block, so on a short screen the grid must shrink to fit under it. Measured
// against the trimmed CSS in styles.css; the layout unit + e2e tests enforce that whatever
// value is here actually fits every in-scope device.
const RESERVE_PORTRAIT = 340;
const GAP = 20; // the #main column gap between grid and list rail in landscape

/**
 * Viewport arithmetic. Pure so it can be unit-tested across a device table.
 * vw/vh are the space available INSIDE #app (the caller subtracts #app's padding, which
 * includes the resolved safe-area insets). The grid is sized to the scarce dimension:
 * height in landscape, min(width, height-under-the-chrome) in portrait. No floor forces
 * the grid larger than its space, which is what used to clip it.
 * @param {{vw:number, vh:number, size:number, pad:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    cell = Math.min(54, Math.floor((vh - 2 * pad) / size));
    cell = Math.max(16, cell);
    const gridSize = size * cell + 2 * pad;
    sideWidth = Math.max(160, vw - gridSize - GAP);
    return { landscape, cell, gridSize, sideWidth, listColumns: '1fr 1fr' };
  }
  const availW = vw - 2 * pad;
  const availH = vh - RESERVE_PORTRAIT - 2 * pad;
  cell = Math.min(54, Math.floor(Math.min(availW, availH) / size));
  cell = Math.max(16, cell);
  const gridSize = size * cell + 2 * pad;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: '1fr 1fr' };
}
```

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: the fit tests now pass at the `computeLayout` level (grid never exceeds the passed vw/vh). `RESERVE_PORTRAIT=340` is the starting value; Step 9 re-checks it end-to-end against the trimmed CSS and tunes if a real device clips. Do NOT run the e2e suite yet — the guard still has `test.fail()` annotations that will error once the DOM application (below) makes devices pass. The remaining steps land in the SAME commit so the suite is only ever run green at Step 9.

- [ ] **Step 5: CSS — make `#app` a grid, add safe-area padding, trim chrome, place areas**

In `styles.css`, replace the `#app`, `#hdr`, `#main`, `#side`, `#hint`, `#list` rules with:

```css
#app{height:100%;display:grid;box-sizing:border-box;overflow:hidden;
  padding:calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));
  grid-template-columns:1fr;grid-template-areas:"hdr" "grid" "side";
  justify-items:center;align-content:start;gap:10px}
#app[data-landscape]{grid-template-areas:"grid hdr" "grid side";align-content:center;justify-items:start;column-gap:20px;row-gap:6px}
#hdr{grid-area:hdr;width:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
#gridbox{grid-area:grid}
#side{grid-area:side}
#main{display:contents}
#listhdr{display:flex;justify-content:space-between;align-items:baseline;margin:2px 2px 8px}
#list{display:grid;gap:6px 14px}
#hint{margin-top:8px;font-size:12px;line-height:1.4;color:#7d968c;max-width:280px}
```

Notes: `#main{display:contents}` makes `#gridbox` and `#side` participate directly in `#app`'s grid, so the areas place them. `#gridbox` keeps its existing `position:relative;background;border;…` rule (leave line 12 as-is; only its `grid-area` is added above). Keep every other CSS rule unchanged.

- [ ] **Step 6: `applyLayout` — set column tracks + `data-landscape`, not flexDirection**

In `src/view.js`, replace `applyLayout` with:

```js
/**
 * @param {Els} els
 * @param {import('./layout.js').LayoutDims} dims
 * @returns {void}
 */
export function applyLayout(els, dims) {
  els.gridbox.style.width = dims.gridSize + 'px';
  els.gridbox.style.height = dims.gridSize + 'px';
  if (dims.landscape) {
    els.app.setAttribute('data-landscape', '');
    els.app.style.gridTemplateColumns = dims.gridSize + 'px ' + dims.sideWidth + 'px';
  } else {
    els.app.removeAttribute('data-landscape');
    els.app.style.gridTemplateColumns = '1fr';
  }
  els.side.style.width = dims.sideWidth + 'px';
  els.list.style.gridTemplateColumns = dims.listColumns;
}
```

This needs `els.app`. In `src/main.js` where `els` is built (the `must(...)` block), add `app: must('app')` to the `els` object if it is not already present, and add `app` to the `Els` typedef in `src/view.js`.

- [ ] **Step 7: `layout()` — subtract `#app`'s resolved padding (incl. safe-area) before computing**

In `src/main.js`, replace the body of `layout()` with:

```js
function layout() {
  if (!state.puzzle) return;
  const cs = getComputedStyle(els.app);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  state.dims = computeLayout({
    vw: window.innerWidth - padX,
    vh: window.innerHeight - padY,
    size: N, pad: PAD,
  });
  applyLayout(els, state.dims);
  renderGrid(els, state.puzzle, state.dims, N, PAD);
  pills();
}
```

`getComputedStyle` resolves `env(safe-area-inset-*)` to real px, so the grid is sized for the space that isn't under the notch — no probe needed. On desktop/headless the insets resolve to 0, so behaviour there is unchanged.

- [ ] **Step 8: Remove the guard's `test.fail()` annotations and serial mode**

In `tests/e2e/layout.spec.js`: delete the line `test.describe.configure({ mode: 'serial' });`, set every remaining device's `brokenToday` to `false` (or delete the field and the `if (d.brokenToday) test.fail(...)` line entirely). The guard now asserts every device fits, with no expected-failures.

- [ ] **Step 9: Run the full suite + typecheck (must be green before committing)**

Run: `npm test` then `npm run typecheck`
Expected: unit all pass; e2e all pass including all 7 layout cases with zero unexpected; typecheck 0 errors. If a portrait device clips by a few px, raise `RESERVE_PORTRAIT` in `src/layout.js` by the reported `clippedY` and re-run (the guard prints the exact overflow). If landscape grid overflows, the `env()` padding subtraction or the height floor is off — inspect, don't weaken the assertion. Iterate here until the whole suite is green; this is the gate before the commit.

- [ ] **Step 10: Commit (everything together — one green commit)**

```bash
git add src/layout.js tests/unit/layout.test.js styles.css src/view.js src/main.js tests/e2e/layout.spec.js
git commit -m "Fit the grid on all in-scope devices: 2-col list, landscape header rail, safe-area"
git push origin main
```

- [ ] **Step 11: Visual verification on the deployed site**

After the Pages build finishes (~1–3 min), drive the deployed URL with Playwright at each in-scope viewport (`?seed=1&theme=0` for a stable grid) and screenshot portrait + landscape for iPhone 13, iPhone Pro Max, iPad Mini, and Desktop. Confirm by eye: grid fills its space, all 12 words visible, header on top in portrait / top-right in landscape, nothing clipped, list in 2 columns. This is a player-visible change, so the guard passing is necessary but the screenshots are the real sign-off. Also verify safe-area padding on a real iPhone or the iOS Simulator (headless Chromium reports insets as 0).

- [ ] **Step 7: Visual verification on the deployed site**

After the Pages build finishes (~1–3 min), drive the deployed URL with Playwright at each in-scope viewport (`?seed=1&theme=0` for a stable grid) and screenshot portrait + landscape for iPhone 13, iPhone Pro Max, iPad Mini, and Desktop. Confirm by eye: grid fills its space, all 12 words visible, header on top in portrait / top-right in landscape, nothing clipped, list in 2 columns. This is a player-visible change, so the guard passing is necessary but the screenshots are the real sign-off.

---

## Notes for the reviewer

- The one genuinely tunable value is `RESERVE_PORTRAIT` in `src/layout.js`. It is enforced by both the unit "grid fits" test and the e2e guard, so a wrong value fails loudly rather than shipping a clip.
- Everything else is deterministic. `computeLayout` stays pure and same-shaped, so no consumer outside these files changes.
