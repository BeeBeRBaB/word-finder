# Categories, subjects and an adaptive grid — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 105-topic table with a Category → Subject catalog whose subjects carry 100+ word pools, draw a length-mixed sample per puzzle, give phones a 10×10 board, and let the player pick a category when starting a new game.

**Architecture:** Three layers, built bottom-up so each is unit-testable before the DOM sees it. The pure engine changes first (`puzzle.js` becomes content-agnostic and gains length-mixed selection; `layout.js` gains device presets). Then the content layer (an eager names-only `catalog.js`, lazily-imported per-category word modules, and a loader). Then the DOM layer (rename, async boot, the picker dialog) and the service worker's second cache.

**Tech Stack:** Vanilla ES modules, no build step, no runtime dependencies. `node:test` for unit tests, Playwright for e2e, `tsc --noEmit` over JSDoc for types.

**Reference spec:** `docs/superpowers/specs/2026-07-24-categories-subjects-and-adaptive-grid-design.md`

## Global Constraints

- **No build step and no new dependencies.** The files in the repo are exactly what GitHub Pages serves. Dynamic `import()` must resolve at runtime in the browser with no bundler.
- **Every module keeps its pure/DOM split.** `rng.js`, `puzzle.js`, `layout.js`, `catalog.js` must not touch the DOM. `subjects.js` takes its importer as an injected dependency.
- **`npm run typecheck` must pass after every task.** JSDoc types are enforced; `any` is not acceptable, narrow casts through `unknown` are the established idiom.
- **`styles.css` may hold no bare hex literal outside the two palette blocks**, and the type-role `:root` block must stay the file's first root-level block — `tests/unit/tokens.test.js` asserts both.
- **Copy is fixed:** `↻ New game` (header), `Play a new game →` (win card), `Start a new game? Your progress will be lost.` (warning line), `Surprise me` (first select option), `Start` (picker confirm), `Cancel` (picker dismiss), app title `Word Finder`, kicker `WORD FINDER`.
- **Storage keys:** game save stays `wordfinder-save-v1`; appearance stays `wordfinder-appearance`.
- **Storage never throws into the game.** Every `localStorage` access is wrapped, matching `makeStorage()`.
- **Word data contract:** ≥100 words per subject; `A–Z` uppercase only; 3–12 letters; no duplicates within a subject; ≥6 words of 3–4 letters; ≥8 words in each of 3–5, 5–6, 6–8, 7–9 and 9–12 letters.
- **Commits are authored as `BeeBeRBaB <puchkiray@outlook.com>`** (already the repo's git config) with **no `Co-Authored-By` trailer**. Commit directly on `main`; no feature branch, no PR.
- **Task 1 knowingly breaks `src/main.js`** (it still calls the old `buildPuzzle` signature). Unit tests stay green throughout; e2e is red from Task 1 until Task 6 lands. Do not "fix" `main.js` early — Task 6 rewrites those lines wholesale.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/puzzle.js` | 1 | Grid generation, hit detection, **and** length-mixed word selection. Knows nothing about where words come from. |
| `src/layout.js` | 2 | Viewport arithmetic **and** the device preset table (`size`, `count`, `mix`). No imports. |
| `src/catalog.js` | 3, 4 | Category and subject **names** only. Eagerly loaded, precached. |
| `src/subjects/<cat>.js` | 3, 4 | One category's word pools. Lazily imported, runtime-cached. |
| `src/subjects.js` | 3 | `loadSubject(id)` — resolves a slug to a pool, memoising each category module. |
| `src/storage.js` | 5 | The save shape. Now `{seed, subjectId, size, count, found}`. |
| `src/rng.js` | 5 | Seeding **and** `resolveSubject()` for `?subject=` / `?category=`. |
| `index.html`, `styles.css`, `src/view.js`, `src/main.js` | 6 | Rename to subject, async boot, per-board size. |
| `src/picker.js` | 7 | The category dialog: populate, open, close, report failures. |
| `sw.js` | 8 | Two caches — versioned shell, unversioned subjects. |
| `README.md` | 9 | Docs. |

`src/picker.js` is a new module rather than more lines in `main.js`: `main.js` is already 347 lines and owns all mutable game state, and the dialog is a self-contained piece of DOM with one output (a chosen category id, or null).

---

### Task 1: Length-mixed selection and a content-agnostic `buildPuzzle`

`buildPuzzle` currently indexes the topics table itself and silently drops any word it fails to place. It changes to take a resolved pool, to draw a length-mixed sample from it, and to swap in a replacement rather than drop.

**Files:**

- Modify: `src/puzzle.js:17-59` (`buildPuzzle`), plus a new `pickWords` export
- Test: `tests/unit/puzzle.test.js:1-26` (imports and the `build` helper)

**Interfaces:**

- Consumes: nothing — this is the first task.
- Produces:
  - `pickWords(pool: string[], rng: Rng, opts: {count: number, mix: Bucket[]}): string[]`
  - `Bucket = {min: number, max: number, take: number}`
  - `buildPuzzle(opts: {name: string, pool: string[], rng: Rng, size: number, count: number, mix: Bucket[]}): Puzzle`
  - `Puzzle` is unchanged: `{name, cells, words, placements}`

- [ ] **Step 1: Write the failing tests**

Replace the whole of `tests/unit/puzzle.test.js` lines 1-26 (the imports and the `build` helper) with the block below, and leave the rest of the file's existing tests in place — they call `build(...)`, which is redefined here.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle, pickWords, snap, readLine, matchWord, cap } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';

const FULL_MIX = [
  { min: 3, max: 5, take: 3 },
  { min: 6, max: 8, take: 5 },
  { min: 9, max: 12, take: 4 },
];

/** A synthetic pool with plenty in every bucket. Deliberately not real content:
 * this module must not know what a subject is, and a test that reached for one
 * would quietly reintroduce that coupling. */
const POOL = [
  'ANT', 'BEE', 'COW', 'DOE', 'ELK', 'FOX', 'GNU', 'HEN',
  'CROW', 'DEER', 'FROG', 'GOAT', 'IBIS', 'LARK', 'MOLE', 'NEWT',
  'BISON', 'CAMEL', 'EAGLE', 'GOOSE', 'HORSE', 'KOALA', 'LEMUR', 'MOOSE',
  'BADGER', 'BEAVER', 'CONDOR', 'DONKEY', 'FALCON', 'GERBIL', 'IGUANA', 'JAGUAR',
  'BUZZARD', 'CHEETAH', 'DOLPHIN', 'GAZELLE', 'GIRAFFE', 'LEOPARD', 'MEERKAT', 'OCTOPUS',
  'ANTELOPE', 'FLAMINGO', 'HEDGEHOG', 'KANGAROO', 'MARMOSET', 'PHEASANT', 'REINDEER', 'SQUIRREL',
  'ALLIGATOR', 'BUTTERFLY', 'CORMORANT', 'CROCODILE', 'PORCUPINE', 'RATTLESNAKE', 'WOODPECKER', 'HUMMINGBIRD',
];

const build = (seed, opts = {}) => buildPuzzle({
  name: 'Test', pool: POOL, rng: makeRng(seed),
  size: 13, count: 12, mix: FULL_MIX, ...opts,
});

test('pickWords draws exactly the requested number from each length bucket', () => {
  const words = pickWords(POOL, makeRng(7), { count: 12, mix: FULL_MIX });
  assert.equal(words.length, 12);
  const inBucket = (b) => words.filter(w => w.length >= b.min && w.length <= b.max).length;
  assert.equal(inBucket(FULL_MIX[0]), 3, 'short bucket');
  assert.equal(inBucket(FULL_MIX[1]), 5, 'medium bucket');
  assert.equal(inBucket(FULL_MIX[2]), 4, 'long bucket');
});

test('pickWords never repeats a word', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const words = pickWords(POOL, makeRng(seed), { count: 12, mix: FULL_MIX });
    assert.equal(new Set(words).size, 12, `seed ${seed} repeated a word`);
  }
});

test('pickWords varies its draw across seeds', () => {
  const a = pickWords(POOL, makeRng(1), { count: 12, mix: FULL_MIX }).join(',');
  const b = pickWords(POOL, makeRng(2), { count: 12, mix: FULL_MIX }).join(',');
  assert.notEqual(a, b, 'a 56-word pool must not produce one canonical draw');
});

// The whole point of a deep pool is that the same subject deals differently. This
// is the assertion that would catch a `slice(0, count)` creeping back in.
test('pickWords is deterministic for one seed', () => {
  const a = pickWords(POOL, makeRng(9), { count: 12, mix: FULL_MIX });
  const b = pickWords(POOL, makeRng(9), { count: 12, mix: FULL_MIX });
  assert.deepEqual(a, b);
});

test('pickWords backfills a short bucket rather than returning fewer words', () => {
  // Only two words in 9-12, but the mix asks for four.
  const thin = POOL.filter(w => w.length < 9).concat(['ALLIGATOR', 'BUTTERFLY']);
  const words = pickWords(thin, makeRng(3), { count: 12, mix: FULL_MIX });
  assert.equal(words.length, 12, 'must still return a full board');
  assert.equal(new Set(words).size, 12);
  assert.equal(words.filter(w => w.length >= 9).length, 2, 'takes what the bucket has');
});

test('pickWords throws when the pool cannot fill a board at all', () => {
  assert.throws(() => pickWords(['ANT', 'BEE'], makeRng(1), { count: 12, mix: FULL_MIX }), /pool/i);
});

test('buildPuzzle places every word it lists, at both presets', () => {
  const COMPACT_MIX = [
    { min: 3, max: 4, take: 2 },
    { min: 5, max: 6, take: 3 },
    { min: 7, max: 9, take: 3 },
  ];
  for (let seed = 1; seed <= 60; seed++) {
    for (const opts of [{}, { size: 10, count: 8, mix: COMPACT_MIX }]) {
      const p = build(seed, opts);
      const size = opts.size ?? 13, count = opts.count ?? 12;
      assert.equal(p.words.length, count, `seed ${seed} size ${size} dealt ${p.words.length}`);
      for (const { word, x0, y0, dx, dy } of p.placements) {
        let read = '';
        for (let i = 0; i < word.length; i++) read += p.cells[(y0 + dy * i) * size + (x0 + dx * i)];
        assert.equal(read, word, `seed ${seed} size ${size}: ${word} is not at its recorded position`);
      }
    }
  }
});

// The old buildPuzzle dropped a word that would not place after 400 attempts, so a
// board could quietly come up one word short and nothing said so. `words` is now
// exactly as long as `count` or buildPuzzle throws.
test('buildPuzzle never silently returns a short board', () => {
  for (let seed = 1; seed <= 60; seed++) assert.equal(build(seed).words.length, 12);
});

test('buildPuzzle respects the maximum word length for its grid size', () => {
  const p = build(5, { size: 10, count: 8, mix: [
    { min: 3, max: 4, take: 2 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 3 },
  ] });
  for (const w of p.words) assert.ok(w.length <= 9, `${w} is too long for a 10x10 grid`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- tests/unit/puzzle.test.js`
Expected: FAIL — `SyntaxError: The requested module '../../src/puzzle.js' does not provide an export named 'pickWords'`.

- [ ] **Step 3: Implement `pickWords` in `src/puzzle.js`**

Insert after `cap()` (which currently ends at line 15):

```js
/**
 * @typedef {{min:number, max:number, take:number}} Bucket
 */

/** How far a length sits outside a bucket's range; 0 when inside it.
 * @param {number} len @param {Bucket} b @returns {number} */
function distanceTo(len, b) {
  if (len < b.min) return b.min - len;
  if (len > b.max) return len - b.max;
  return 0;
}

/**
 * Draw `count` words, spread across the length buckets in `mix`. A pool of 100+
 * words would otherwise deal twelve nine-letter words as readily as twelve
 * four-letter ones, and neither makes a good board.
 *
 * A bucket short of candidates does not shrink the board: the shortfall is
 * backfilled from whatever is left, nearest length first, so the caller always
 * gets `count` words or an exception. Backfilling rather than throwing matters
 * because the scarce bucket is always the short words, and a subject with only
 * two three-letter words is still worth playing.
 *
 * @param {string[]} pool @param {import('./rng.js').Rng} rng
 * @param {{count:number, mix:Bucket[]}} opts
 * @returns {string[]}
 */
export function pickWords(pool, rng, { count, mix }) {
  const lo = Math.min(...mix.map(b => b.min)), hi = Math.max(...mix.map(b => b.max));
  const eligible = pool.filter(w => w.length >= lo && w.length <= hi);
  if (eligible.length < count) {
    throw new Error(`pool has ${eligible.length} eligible words, need ${count}`);
  }
  /** @type {Set<string>} */
  const used = new Set();
  /** @type {string[]} */
  const out = [];
  /** @type {Bucket[]} */
  const unfilled = [];
  for (const b of mix) {
    const cands = rng.shuffle(eligible.filter(w => !used.has(w) && distanceTo(w.length, b) === 0));
    for (const w of cands.slice(0, b.take)) { used.add(w); out.push(w); }
    if (cands.length < b.take) unfilled.push(b);
  }
  if (out.length < count) {
    // Nearest-length first, so a missing long word is replaced by the longest thing
    // left rather than by whatever the shuffle happened to surface. Shuffle before
    // sorting so ties inside one distance are still random; Array#sort is stable in
    // every engine this ships to, so the shuffled order survives the tie.
    const rest = rng.shuffle(eligible.filter(w => !used.has(w)))
      .sort((a, b2) =>
        Math.min(...unfilled.map(u => distanceTo(a.length, u))) -
        Math.min(...unfilled.map(u => distanceTo(b2.length, u))));
    for (const w of rest.slice(0, count - out.length)) { used.add(w); out.push(w); }
  }
  return out;
}
```

- [ ] **Step 4: Rewrite `buildPuzzle` in `src/puzzle.js`**

Replace lines 17-59 (the whole of the current `buildPuzzle`, from its doc comment through its `return`) with:

```js
// How many times a single word may be swapped for another of the same length before
// the puzzle gives up. Each swap costs a full 400-attempt placement pass, and with a
// 100-word pool a board that cannot be filled in eight swaps is a broken subject, not
// an unlucky seed.
const MAX_SWAPS = 8;

/**
 * Generate a puzzle from a resolved word pool. `placements` records where each word
 * actually landed, so a test can assert the grid really contains what the word list
 * claims.
 *
 * This function knows nothing about categories, subjects or the catalog — it is
 * handed a name and a bag of words. That is what lets `pickWords` and the placement
 * logic be tested against a synthetic pool with no content module loaded.
 *
 * @param {{name:string, pool:string[], rng:Rng, size:number, count:number, mix:Bucket[]}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ name, pool, rng, size, count, mix }) {
  const fits = pool.filter(w => w.length <= size - 1);
  const chosen = pickWords(fits, rng, { count, mix });
  // Longest first: a long word has the fewest legal positions, so placing it into an
  // empty grid and letting short words fill around it fails far less often.
  const words = chosen.slice().sort((a, b) => b.length - a.length);
  const spare = rng.shuffle(fits.filter(w => !chosen.includes(w)));

  /** @type {(string|null)[][]} */
  const g = Array.from({ length: size }, () => new Array(size).fill(null));
  /** @type {Placement[]} */
  const placements = [];
  let swaps = 0;

  for (let i = 0; i < words.length; i++) {
    let placed = false;
    for (let swap = 0; !placed; swap++) {
      const w = words[i];
      for (let attempt = 0; attempt < 400; attempt++) {
        const [dx, dy] = DIRS[rng.int(8)];
        const span = w.length - 1;
        const xmin = dx < 0 ? span : 0, xmax = dx > 0 ? size - 1 - span : size - 1;
        const ymin = dy < 0 ? span : 0, ymax = dy > 0 ? size - 1 - span : size - 1;
        if (xmax < xmin || ymax < ymin) continue;
        const x0 = xmin + rng.int(xmax - xmin + 1);
        const y0 = ymin + rng.int(ymax - ymin + 1);
        let ok = true;
        for (let j = 0; j < w.length; j++) {
          const c = g[y0 + dy * j][x0 + dx * j];
          if (c && c !== w[j]) { ok = false; break; }
        }
        if (!ok) continue;
        for (let j = 0; j < w.length; j++) g[y0 + dy * j][x0 + dx * j] = w[j];
        placements.push({ word: w, x0, y0, dx, dy });
        placed = true;
        break;
      }
      // A word that will not fit is swapped for another of the same length rather
      // than dropped. Dropping is what the old generator did, and it produced boards
      // that were quietly one word short with nothing anywhere saying so.
      if (placed) break;
      const alt = spare.findIndex(s => s.length === w.length);
      if (alt === -1 || ++swaps > MAX_SWAPS) {
        throw new Error(`could not place ${w} in a ${size}x${size} grid for "${name}"`);
      }
      words[i] = spare.splice(alt, 1)[0];
    }
  }

  /** @type {string[]} */
  const cells = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) cells.push(g[y][x] || ALPHABET[rng.int(26)]);

  return { name, cells, words: placements.map(p => p.word), placements };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:unit -- tests/unit/puzzle.test.js && npm run typecheck`
Expected: PASS. `src/main.js` still calls `buildPuzzle({topics, topicIdx, …})` and is now broken; no unit test loads it, and Task 6 fixes it.

- [ ] **Step 6: Commit**

```bash
git add src/puzzle.js tests/unit/puzzle.test.js
git commit -m "Draw a length-mixed sample, and swap rather than drop

buildPuzzle takes a resolved pool instead of indexing the topics table,
so it no longer knows what a subject is. pickWords spreads the draw
across length buckets, backfilling a thin bucket rather than shrinking
the board. A word that will not place is swapped for another of the same
length; the old generator dropped it and returned a short board silently.

main.js still calls the old signature and is left broken until the DOM
layer lands."
```

---

### Task 2: Device presets and reserve-by-word-count

The grid size stops being a constant. The preset is keyed on `screen`, not the viewport, so it is a property of the device and cannot move when a window does.

**Files:**

- Modify: `src/layout.js:5-53` (constants and `computeLayout`), plus `PRESETS` / `pickPreset` / `reservePortrait` exports
- Test: `tests/unit/layout.test.js:1-5` (the `at` helper) and a new block of tests

**Interfaces:**

- Consumes: nothing at runtime. The `mix` shape is the `Bucket[]` Task 1 defined.
- Produces:
  - `PRESETS: {full: Preset, compact: Preset}` where `Preset = {size, count, mix}`
  - `pickPreset(opts: {screenW: number, screenH: number}): Preset`
  - `reservePortrait(count: number): number`
  - `computeLayout(opts: {vw, vh, size, pad, count}): LayoutDims` — **gains `count`**

The mixes live here rather than in `puzzle.js` because they are preset data: a mix is only ever meaningful next to the `size` and `count` it was tuned for, and `layout.js` already owns the other numbers that describe a board's shape. `puzzle.js` keeps taking `mix` as a parameter and defines none.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/layout.test.js`, replace the import and the `at` helper (lines 1-5) with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, pickPreset, reservePortrait, PRESETS } from '../../src/layout.js';

const at = (vw, vh, count = 12) => computeLayout({ vw, vh, size: 13, pad: 10, count });
```

Then append these tests to the end of the file:

```js
// screen, not viewport. A preset that moved when the window did would rebuild the
// board out from under a desktop player dragging their window narrow, and would make
// "which board am I playing" a question about furniture rather than about the device.
const SCREENS = [
  { name: 'iPhone 13',       w: 390,  h: 844,  want: 'compact' },
  { name: 'iPhone Pro Max',  w: 430,  h: 932,  want: 'compact' },
  { name: 'iPad Mini',       w: 744,  h: 1133, want: 'full' },
  { name: 'Desktop',         w: 1440, h: 900,  want: 'full' },
];

test('pickPreset keys on the device screen, both ways round', () => {
  for (const s of SCREENS) {
    const want = PRESETS[/** @type {'full'|'compact'} */ (s.want)];
    assert.equal(pickPreset({ screenW: s.w, screenH: s.h }), want, `${s.name} portrait`);
    assert.equal(pickPreset({ screenW: s.h, screenH: s.w }), want, `${s.name} landscape`);
  }
});

// iOS Safari reports a device's portrait screen values whichever way it is held;
// Chrome on Android swaps them. min() is what makes both correct, and this is the
// test that fails if someone "simplifies" it to screenW alone.
test('pickPreset is unchanged by rotation', () => {
  assert.equal(pickPreset({ screenW: 390, screenH: 844 }), pickPreset({ screenW: 844, screenH: 390 }));
});

test('the presets are the two shapes the game deals', () => {
  assert.equal(PRESETS.full.size, 13);
  assert.equal(PRESETS.full.count, 12);
  assert.equal(PRESETS.compact.size, 10);
  assert.equal(PRESETS.compact.count, 8);
  for (const p of [PRESETS.full, PRESETS.compact]) {
    assert.equal(p.mix.reduce((n, b) => n + b.take, 0), p.count, 'the mix must add up to count');
    for (const b of p.mix) assert.ok(b.max <= p.size - 1, `${b.max} is too long for ${p.size}x${p.size}`);
  }
});

// Pinned exactly, not approximately. The full preset must be a provable no-op on a
// value that was measured against real devices; every px of drift here is a px the
// portrait grid silently loses.
test('reservePortrait(12) reproduces the measured 366 exactly', () => {
  assert.equal(reservePortrait(12), 366);
});

test('eight words reserve two rows less than twelve', () => {
  assert.equal(reservePortrait(8), 298);
  assert.ok(reservePortrait(8) < reservePortrait(12));
});

test('a shorter list gives the portrait grid its rows back', () => {
  // iPhone 13 portrait, inside #app. 13x13 with 12 words is the cramped board the
  // compact preset exists to replace.
  const big = computeLayout({ vw: 370, vh: 644, size: 13, pad: 10, count: 12 });
  const small = computeLayout({ vw: 370, vh: 644, size: 10, pad: 10, count: 8 });
  assert.equal(big.cell, 19);
  assert.ok(small.cell >= 30, `compact cell is ${small.cell}px, expected 30+`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- tests/unit/layout.test.js`
Expected: FAIL — `does not provide an export named 'pickPreset'`.

- [ ] **Step 3: Add the presets to `src/layout.js`**

Replace lines 5-21 (the constants block, from the `RESERVE_PORTRAIT` comment through `LIST_COLUMNS`) with:

```js
/**
 * @typedef {import('./puzzle.js').Bucket} Bucket
 * @typedef {{size:number, count:number, mix:Bucket[]}} Preset
 */

// The two board shapes the game deals. A mix only means anything next to the size and
// count it was tuned for — a 9-12 letter bucket is nonsense on a 10x10 grid, whose
// longest placeable word is 9 — so all three travel together as one preset.
/** @type {{full:Preset, compact:Preset}} */
export const PRESETS = {
  full: {
    size: 13, count: 12,
    mix: [{ min: 3, max: 5, take: 3 }, { min: 6, max: 8, take: 5 }, { min: 9, max: 12, take: 4 }],
  },
  compact: {
    size: 10, count: 8,
    mix: [{ min: 3, max: 4, take: 2 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 3 }],
  },
};

/**
 * Which board this DEVICE plays. Deliberately `screen`, not the viewport: a preset
 * that tracked the window would rebuild the board when a desktop player dragged their
 * window narrow, and would make an iPad in Slide Over a different game from the same
 * iPad full screen. `min()` because platforms disagree about rotation — iOS Safari
 * reports the portrait values whichever way the device is held, Chrome on Android
 * swaps them — and the smaller edge is the same number under both.
 * @param {{screenW:number, screenH:number}} opts @returns {Preset}
 */
export function pickPreset({ screenW, screenH }) {
  return Math.min(screenW, screenH) < 480 ? PRESETS.compact : PRESETS.full;
}

// Portrait non-grid chrome, in px, split into the part that does not depend on the
// word list (header, gaps, list header, hint) and the part that does. The list is a
// fixed-height block laid out in two columns, so every row it does not draw is a row
// the grid can have. BASE and ROW are pinned so that reservePortrait(12) is exactly
// 366 — the measured value this file shipped with — which makes the full preset a
// provable no-op and confines all of this change's risk to the compact board.
const RESERVE_BASE = 162;
const ROW_H = 34;
/** @param {number} count @returns {number} */
export const reservePortrait = (count) => RESERVE_BASE + Math.ceil(count / 2) * ROW_H;

const GAP = 20; // the #main column gap between grid and list rail in landscape
// #gridbox keeps its pre-existing content-box border (1px each side, per styles.css),
// so its rendered box is BORDER px larger than the width/height we set on it. Budgeted
// here rather than folded into the reserve so that stays purely "non-grid chrome" and
// this stays a fixed, well-understood 2px account for the actual CSS box model.
const BORDER = 2;
// Both word-list columns hug their content. See the note at the landscape return below
// for why this is not `1fr 1fr`; portrait shares it so the two orientations cannot drift.
const LIST_COLUMNS = 'max-content max-content';
```

- [ ] **Step 4: Take `count` in `computeLayout`**

In `src/layout.js`, change the JSDoc and signature of `computeLayout` (currently lines 29-32) and the one line that reads the reserve:

```js
 * @param {{vw:number, vh:number, size:number, pad:number, count:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad, count }) {
```

and, in the portrait branch:

```js
  const availH = vh - reservePortrait(count) - 2 * pad - BORDER;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:unit -- tests/unit/layout.test.js && npm run typecheck`
Expected: PASS, including the pinned `reservePortrait(12) === 366`.

- [ ] **Step 6: Commit**

```bash
git add src/layout.js tests/unit/layout.test.js
git commit -m "Add device presets and reserve the list by word count

PRESETS holds the two board shapes; pickPreset chooses between them on
min(screen.width, screen.height), so the preset is a property of the
device and cannot move when a window is resized or a phone rotated.

RESERVE_PORTRAIT becomes reservePortrait(count), pinned so that twelve
words still reserves exactly the measured 366px. Eight words reserve two
rows less, which takes an iPhone 13 portrait cell from 19px to 32px."
```

---

### Task 3: The catalog, the loader and the content contract

Establishes the data shape and the test that guards it, with one category holding one fully-written subject. Task 4 grows both together; nothing here is throwaway.

**Files:**

- Create: `src/catalog.js`
- Create: `src/subjects/nature.js`
- Create: `src/subjects.js`
- Create: `tests/unit/catalog.test.js`
- Create: `tests/unit/content.test.js`
- Create: `tests/unit/subjects.test.js`
- Delete: `src/topics.js` (via `git rm`)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `CATEGORIES: Category[]` where `Category = {id: string, name: string, subjects: SubjectRef[]}` and `SubjectRef = {id: string, name: string}`
  - `SUBJECTS: SubjectMeta[]` where `SubjectMeta = {id, name, category, categoryName}`
  - `findSubject(id: string): SubjectMeta | null`
  - `findCategory(id: string): Category | null`
  - `loadSubject(id: string): Promise<SubjectMeta & {words: string[]}>`
  - `makeSubjectLoader(importFn?): (id: string) => Promise<SubjectMeta & {words: string[]}>`
  - `SubjectLoadError` with `.reason: 'unknown' | 'unavailable'`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/catalog.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, SUBJECTS, findSubject, findCategory } from '../../src/catalog.js';

test('every category id is a lowercase slug matching its module filename', () => {
  for (const c of CATEGORIES) {
    assert.match(c.id, /^[a-z][a-z0-9-]*$/, `bad category id: ${c.id}`);
    assert.ok(c.name.length > 0, `category ${c.id} has no name`);
    assert.ok(c.subjects.length > 0, `category ${c.id} has no subjects`);
  }
  assert.equal(new Set(CATEGORIES.map(c => c.id)).size, CATEGORIES.length, 'duplicate category id');
});

test('every subject id is its category slash a slug of its name', () => {
  for (const c of CATEGORIES) for (const s of c.subjects) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    assert.equal(s.id, `${c.id}/${slug}`, `${s.name} should be ${c.id}/${slug}`);
  }
});

// Names are what the win card and the header show, and what accentSlot() hashes for
// the underline colour. Two subjects sharing a name would be two different word lists
// the player cannot tell apart.
test('subject ids and names are unique across the whole catalog', () => {
  assert.equal(new Set(SUBJECTS.map(s => s.id)).size, SUBJECTS.length, 'duplicate subject id');
  assert.equal(new Set(SUBJECTS.map(s => s.name)).size, SUBJECTS.length, 'duplicate subject name');
});

test('SUBJECTS carries its category down with it', () => {
  for (const s of SUBJECTS) {
    const c = findCategory(s.category);
    assert.ok(c, `${s.id} names a category that does not exist`);
    assert.equal(s.categoryName, c.name);
  }
});

test('findSubject and findCategory return null rather than throwing', () => {
  assert.equal(findSubject('nope/nope'), null);
  assert.equal(findCategory('nope'), null);
  assert.equal(findSubject(SUBJECTS[0].id)?.name, SUBJECTS[0].name);
});
```

Create `tests/unit/content.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { CATEGORIES } from '../../src/catalog.js';

const DIR = new URL('../../src/subjects/', import.meta.url);

/** Load every category module the catalog names, keyed by category id.
 * @returns {Promise<Map<string, Record<string,string>>>} */
async function loadAll() {
  /** @type {Map<string, Record<string,string>>} */
  const out = new Map();
  for (const c of CATEGORIES) {
    const mod = await import(`../../src/subjects/${c.id}.js`);
    out.set(c.id, mod.WORDS);
  }
  return out;
}

test('the catalog and the word modules agree in both directions', async () => {
  const mods = await loadAll();
  const onDisk = readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  assert.deepEqual(onDisk, CATEGORIES.map(c => c.id).sort(), 'a module exists that the catalog does not list');
  for (const c of CATEGORIES) {
    const words = mods.get(c.id);
    assert.ok(words, `no module for ${c.id}`);
    assert.deepEqual(
      Object.keys(words).sort(),
      c.subjects.map(s => s.id).sort(),
      `${c.id}.js and the catalog list different subjects`,
    );
  }
});

// Bucket floors, not just a total. A subject with 100 words that are all seven
// letters long passes a word count and still cannot deal a board.
const FLOORS = [
  { min: 3, max: 4, need: 6 },
  { min: 3, max: 5, need: 8 },
  { min: 5, max: 6, need: 8 },
  { min: 6, max: 8, need: 8 },
  { min: 7, max: 9, need: 8 },
  { min: 9, max: 12, need: 8 },
];

test('every subject meets the word contract', async () => {
  const mods = await loadAll();
  for (const [cat, words] of mods) {
    for (const [id, raw] of Object.entries(words)) {
      const list = raw.split(',');
      assert.ok(list.length >= 100, `${id}: ${list.length} words, need 100`);
      assert.equal(new Set(list).size, list.length, `${id}: duplicate word`);
      for (const w of list) {
        assert.match(w, /^[A-Z]+$/, `${id}: "${w}" is not bare uppercase A-Z`);
        assert.ok(w.length >= 3 && w.length <= 12, `${id}: "${w}" is ${w.length} letters`);
      }
      for (const f of FLOORS) {
        const n = list.filter(w => w.length >= f.min && w.length <= f.max).length;
        assert.ok(n >= f.need, `${id}: ${n} words of ${f.min}-${f.max} letters, need ${f.need} (${cat})`);
      }
    }
  }
});
```

Create `tests/unit/subjects.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSubject, makeSubjectLoader, SubjectLoadError } from '../../src/subjects.js';
import { SUBJECTS } from '../../src/catalog.js';

const FIRST = SUBJECTS[0].id;

test('loadSubject resolves a slug to its pool and its names', async () => {
  const s = await loadSubject(FIRST);
  assert.equal(s.id, FIRST);
  assert.equal(s.name, SUBJECTS[0].name);
  assert.equal(s.categoryName, SUBJECTS[0].categoryName);
  assert.ok(s.words.length >= 100);
  assert.ok(s.words.every(w => /^[A-Z]+$/.test(w)));
});

// One import per category, not per subject: the picker deals many subjects out of
// one category in a session, and re-importing is a needless round trip each time.
test('the loader imports each category module exactly once', async () => {
  let calls = 0;
  const load = makeSubjectLoader(async (cat) => {
    calls++;
    return await import(`../../src/subjects/${cat}.js`);
  });
  await load(FIRST);
  await load(FIRST);
  assert.equal(calls, 1);
});

test('an unknown subject id rejects as "unknown", without importing anything', async () => {
  let calls = 0;
  const load = makeSubjectLoader(async () => { calls++; return { WORDS: {} }; });
  await assert.rejects(() => load('nope/nope'), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unknown');
    return true;
  });
  assert.equal(calls, 0, 'a bad id must not cost a network request');
});

// Offline with an uncached category is the shipped failure mode, and the picker has
// to tell it apart from a typo'd URL to know whether to disable the option.
test('a failed import rejects as "unavailable", not as a raw import error', async () => {
  const load = makeSubjectLoader(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => load(FIRST), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unavailable');
    return true;
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- tests/unit/catalog.test.js tests/unit/content.test.js tests/unit/subjects.test.js`
Expected: FAIL — `Cannot find module '.../src/catalog.js'`.

- [ ] **Step 3: Create `src/subjects/nature.js`**

The format exemplar. One subject, 105 words, meeting every floor.

```js
// Word pools for the Nature category. Data, not logic.
//
// Loaded LAZILY by src/subjects.js and never imported statically, which is the whole
// reason the catalog exists as a separate names-only module: the picker needs 600
// names, and a player needs the one category they chose. Keep it that way — a static
// import of this file anywhere in src/ would pull every word into the precached shell.
//
// Contract, enforced by tests/unit/content.test.js: 100+ words per subject, bare
// uppercase A-Z, 3-12 letters, no duplicates, and enough in every length bucket for
// both board presets to deal from. Short words are the scarce ones; write those first.
/** @type {Record<string,string>} */
export const WORDS = {
  'nature/birds': 'OWL,JAY,HEN,EMU,AUK,TIT,MOA,KEA,DOVE,CROW,SWAN,HAWK,LOON,WREN,IBIS,KIWI,TEAL,RHEA,COOT,LARK,ROOK,MYNA,NEST,EGGS,BEAK,WING,GULL,SKUA,EAGLE,ROBIN,FINCH,HERON,CRANE,GOOSE,QUAIL,SNIPE,EGRET,RAVEN,STORK,MACAW,ROOST,PREEN,TALON,PLUME,BROOD,CHICK,FALCON,TOUCAN,PARROT,CONDOR,TURKEY,CANARY,ORIOLE,MARTIN,THRUSH,GROUSE,PIGEON,PUFFIN,AVOCET,PLOVER,CUCKOO,AVIARY,PELICAN,PENGUIN,OSTRICH,VULTURE,BUZZARD,SEAGULL,SPARROW,SWALLOW,WARBLER,BITTERN,KESTREL,FEATHER,PLUMAGE,PEACOCK,PHEASANT,FLAMINGO,STARLING,BLUEBIRD,WOODCOCK,NUTHATCH,HORNBILL,LOVEBIRD,SONGBIRD,WILDFOWL,BIRDBATH,WINGSPAN,CORMORANT,GOLDFINCH,ALBATROSS,BLACKBIRD,SANDPIPER,NIGHTHAWK,CHICKADEE,BOWERBIRD,WATERFOWL,MIGRATION,KINGFISHER,WOODPECKER,ROADRUNNER,MEADOWLARK,HUMMINGBIRD,NIGHTINGALE,MOCKINGBIRD',
};
```

- [ ] **Step 4: Create `src/catalog.js`**

```js
// Category and subject NAMES. No words live here — that is the point of the file.
// It loads on every visit and is precached in the service worker shell, so it must
// stay small enough that the cost of having 600 subjects is a list of names rather
// than the corpus behind them.

/**
 * @typedef {{id:string, name:string}} SubjectRef
 * @typedef {{id:string, name:string, subjects:SubjectRef[]}} Category
 * @typedef {{id:string, name:string, category:string, categoryName:string}} SubjectMeta
 */

/** @type {Category[]} */
export const CATEGORIES = [
  {
    id: 'nature', name: 'Nature', subjects: [
      { id: 'nature/birds', name: 'Birds' },
    ],
  },
];

/** Every subject in the catalog, flattened, each carrying its category down with it.
 * Built once at module load rather than re-derived per call: the picker, the URL
 * resolver and the loader all want this list, and it is a few hundred small objects.
 * @type {SubjectMeta[]} */
export const SUBJECTS = CATEGORIES.flatMap(c =>
  c.subjects.map(s => ({ id: s.id, name: s.name, category: c.id, categoryName: c.name })));

/** @param {string} id @returns {SubjectMeta|null} */
export const findSubject = (id) => SUBJECTS.find(s => s.id === id) ?? null;
/** @param {string} id @returns {Category|null} */
export const findCategory = (id) => CATEGORIES.find(c => c.id === id) ?? null;
```

- [ ] **Step 5: Create `src/subjects.js`**

```js
// Resolving a subject id to its words. The one place that knows word pools are
// fetched rather than merely read, and the boundary where a network failure becomes
// something the picker can act on.

import { findSubject } from './catalog.js';

/** @typedef {import('./catalog.js').SubjectMeta} SubjectMeta */
/** @typedef {SubjectMeta & {words:string[]}} Subject */

/**
 * Why the failures are typed: offline with an uncached category and a typo'd
 * `?subject=` are the same rejected promise otherwise, and the picker needs to
 * disable an option for the first while ignoring the second.
 */
export class SubjectLoadError extends Error {
  /** @param {'unknown'|'unavailable'} reason @param {string} id */
  constructor(reason, id) {
    super(`${reason} subject: ${id}`);
    this.name = 'SubjectLoadError';
    this.reason = reason;
    this.id = id;
  }
}

/**
 * The importer is injected so a unit test can fail one without a network, and so the
 * memoisation can be observed. The default is the real dynamic import — a runtime
 * `import()` with no bundler in sight, which is what keeps the no-build-step rule.
 * @param {(category:string) => Promise<{WORDS:Record<string,string>}>} [importFn]
 * @returns {(id:string) => Promise<Subject>}
 */
export function makeSubjectLoader(importFn) {
  const load = importFn ?? ((category) => import(`./subjects/${category}.js`));
  /** @type {Map<string, Record<string,string>>} */
  const cache = new Map();
  return async function loadSubject(id) {
    const meta = findSubject(id);
    if (!meta) throw new SubjectLoadError('unknown', id);
    let words = cache.get(meta.category);
    if (!words) {
      try {
        words = (await load(meta.category)).WORDS;
      } catch {
        throw new SubjectLoadError('unavailable', id);
      }
      cache.set(meta.category, words);
    }
    const raw = words[id];
    // The catalog and the module disagreeing is a content bug that content.test.js
    // catches before it ships; treat it as unknown rather than crashing the boot.
    if (!raw) throw new SubjectLoadError('unknown', id);
    return { ...meta, words: raw.split(',') };
  };
}

export const loadSubject = makeSubjectLoader();
```

- [ ] **Step 6: Delete the old topics module**

```bash
git rm src/topics.js
```

`src/main.js` still imports it and is already broken from Task 1; Task 6 rewrites those imports.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test:unit && npm run typecheck`
Expected: PASS. `content.test.js` proves `nature/birds` meets all six bucket floors and the 100-word minimum.

- [ ] **Step 8: Commit**

```bash
git add src/catalog.js src/subjects.js src/subjects/nature.js tests/unit
git commit -m "Add the category catalog, the lazy loader and the word contract

catalog.js holds names only and is precached; word pools live in
per-category modules pulled by a runtime import() and memoised per
category. Failures are typed so the picker can tell an uncached category
apart from a bad id.

content.test.js is the gate the rest of the corpus is written against:
100+ words, bare A-Z, 3-12 letters, no duplicates, and floors in every
length bucket both presets draw from. Ships with Birds as the exemplar.
topics.js is removed."
```

---

### Task 4: Write the three Spec A categories

Fills the catalog to its Spec A scope: Nature, Food & Drink, Sports & Games, 24 subjects each, 100+ words each. `content.test.js` from Task 3 is the gate — nothing lands red.

**Files:**

- Modify: `src/catalog.js` (three category entries, 72 subject refs)
- Modify: `src/subjects/nature.js` (23 more subjects)
- Create: `src/subjects/food.js`
- Create: `src/subjects/sports.js`

**Interfaces:**

- Consumes: the `Category` / `WORDS` shapes and the contract from Task 3.
- Produces: a 72-subject catalog. Task 6's e2e tests assume at least three categories exist so the picker has something to choose between.

**Subject lists.** Write exactly these, in this order:

- **Nature** (`nature`): Birds, Insects, Flowers, Trees, Ocean, Rivers, Mountains, Desert, Rainforest, Weather, Seasons, Rocks, Fungi, Reptiles, Mammals, Fish, Whales, Sharks, Butterflies, Gardens, Farms, Forests, Caves, Sky
- **Food & Drink** (`food`): Breakfast, Desserts, Pizza, Candy, Drinks, Cooking, Kitchen, Baking, Fruit, Vegetables, Herbs, Spices, Cheese, Bread, Soup, Salad, Pasta, Seafood, Grilling, Coffee, Tea, Chocolate, Picnics, Markets
- **Sports & Games** (`sports`): Soccer, Baseball, Basketball, Tennis, Swimming, Running, Cycling, Skiing, Skating, Surfing, Climbing, Golf, Hockey, Boxing, Gymnastics, Archery, Sailing, Fishing, Camping, Hiking, Chess, Card Games, Board Games, Puzzles

- [ ] **Step 1: Extend the catalog with all 72 subject refs**

Rewrite `CATEGORIES` in `src/catalog.js`. Ids are the category slug, a slash, and the name lowercased with every run of non-alphanumerics replaced by `-` — `Card Games` becomes `sports/card-games`. `catalog.test.js` asserts exactly this derivation, so a hand-typed id that disagrees fails by name.

```js
/** @type {Category[]} */
export const CATEGORIES = [
  {
    id: 'nature', name: 'Nature', subjects: [
      { id: 'nature/birds', name: 'Birds' },
      { id: 'nature/insects', name: 'Insects' },
      { id: 'nature/flowers', name: 'Flowers' },
      { id: 'nature/trees', name: 'Trees' },
      { id: 'nature/ocean', name: 'Ocean' },
      { id: 'nature/rivers', name: 'Rivers' },
      { id: 'nature/mountains', name: 'Mountains' },
      { id: 'nature/desert', name: 'Desert' },
      { id: 'nature/rainforest', name: 'Rainforest' },
      { id: 'nature/weather', name: 'Weather' },
      { id: 'nature/seasons', name: 'Seasons' },
      { id: 'nature/rocks', name: 'Rocks' },
      { id: 'nature/fungi', name: 'Fungi' },
      { id: 'nature/reptiles', name: 'Reptiles' },
      { id: 'nature/mammals', name: 'Mammals' },
      { id: 'nature/fish', name: 'Fish' },
      { id: 'nature/whales', name: 'Whales' },
      { id: 'nature/sharks', name: 'Sharks' },
      { id: 'nature/butterflies', name: 'Butterflies' },
      { id: 'nature/gardens', name: 'Gardens' },
      { id: 'nature/farms', name: 'Farms' },
      { id: 'nature/forests', name: 'Forests' },
      { id: 'nature/caves', name: 'Caves' },
      { id: 'nature/sky', name: 'Sky' },
    ],
  },
  {
    id: 'food', name: 'Food & Drink', subjects: [
      { id: 'food/breakfast', name: 'Breakfast' },
      { id: 'food/desserts', name: 'Desserts' },
      { id: 'food/pizza', name: 'Pizza' },
      { id: 'food/candy', name: 'Candy' },
      { id: 'food/drinks', name: 'Drinks' },
      { id: 'food/cooking', name: 'Cooking' },
      { id: 'food/kitchen', name: 'Kitchen' },
      { id: 'food/baking', name: 'Baking' },
      { id: 'food/fruit', name: 'Fruit' },
      { id: 'food/vegetables', name: 'Vegetables' },
      { id: 'food/herbs', name: 'Herbs' },
      { id: 'food/spices', name: 'Spices' },
      { id: 'food/cheese', name: 'Cheese' },
      { id: 'food/bread', name: 'Bread' },
      { id: 'food/soup', name: 'Soup' },
      { id: 'food/salad', name: 'Salad' },
      { id: 'food/pasta', name: 'Pasta' },
      { id: 'food/seafood', name: 'Seafood' },
      { id: 'food/grilling', name: 'Grilling' },
      { id: 'food/coffee', name: 'Coffee' },
      { id: 'food/tea', name: 'Tea' },
      { id: 'food/chocolate', name: 'Chocolate' },
      { id: 'food/picnics', name: 'Picnics' },
      { id: 'food/markets', name: 'Markets' },
    ],
  },
  {
    id: 'sports', name: 'Sports & Games', subjects: [
      { id: 'sports/soccer', name: 'Soccer' },
      { id: 'sports/baseball', name: 'Baseball' },
      { id: 'sports/basketball', name: 'Basketball' },
      { id: 'sports/tennis', name: 'Tennis' },
      { id: 'sports/swimming', name: 'Swimming' },
      { id: 'sports/running', name: 'Running' },
      { id: 'sports/cycling', name: 'Cycling' },
      { id: 'sports/skiing', name: 'Skiing' },
      { id: 'sports/skating', name: 'Skating' },
      { id: 'sports/surfing', name: 'Surfing' },
      { id: 'sports/climbing', name: 'Climbing' },
      { id: 'sports/golf', name: 'Golf' },
      { id: 'sports/hockey', name: 'Hockey' },
      { id: 'sports/boxing', name: 'Boxing' },
      { id: 'sports/gymnastics', name: 'Gymnastics' },
      { id: 'sports/archery', name: 'Archery' },
      { id: 'sports/sailing', name: 'Sailing' },
      { id: 'sports/fishing', name: 'Fishing' },
      { id: 'sports/camping', name: 'Camping' },
      { id: 'sports/hiking', name: 'Hiking' },
      { id: 'sports/chess', name: 'Chess' },
      { id: 'sports/card-games', name: 'Card Games' },
      { id: 'sports/board-games', name: 'Board Games' },
      { id: 'sports/puzzles', name: 'Puzzles' },
    ],
  },
];
```

- [ ] **Step 2: Write the word pools**

Three modules, same shape as `nature.js` from Task 3. `food.js` and `sports.js` each need the same header comment (copy it, adjusting the category name).

This is bulk authoring, not engineering. Generate it a category at a time — 24 subjects per module — and for each subject write the short words first: **the 3-4 letter bucket is the binding constraint** and it is what a lazily-generated list always runs out of.

Per-subject method that reliably clears the contract:

1. List 8-12 words of 3-4 letters. If you cannot reach 6, the subject is wrong for this game — say so rather than padding with words that are not about it.
2. List 12+ of 5-6 letters, 12+ of 7-8, and 10+ of 9-12.
3. Fill to 100+ with whatever the subject naturally offers.
4. No plurals of a word already present, no proper nouns, nothing hyphenated or spaced.

A word passing the charset and length rules can still simply not be about the subject, and no test catches that. Read each finished list once before moving on.

If this plan is being executed by subagents, dispatch one per category with the contract, the subject list, and `nature/birds` as the format exemplar. Do not dispatch one per subject — 72 agents to write one list each is a worse trade than three agents writing 24.

- [ ] **Step 3: Run the contract gate**

Run: `npm run test:unit -- tests/unit/content.test.js tests/unit/catalog.test.js`
Expected: PASS. Failures name the subject and the bucket, e.g. `food/tea: 4 words of 3-4 letters, need 6`. Fix the content, not the test.

- [ ] **Step 4: Prove every subject actually deals a board at both presets**

Create `tests/unit/deal.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { PRESETS } from '../../src/layout.js';
import { loadSubject } from '../../src/subjects.js';
import { SUBJECTS } from '../../src/catalog.js';

// The contract in content.test.js is necessary but not sufficient: bucket floors say
// a draw is possible, not that twelve words of those lengths fit in a 13x13 grid.
// This deals every subject at both presets, which is the assertion that a subject
// full of eleven-letter words fails.
test('every subject deals a full board at both presets', async () => {
  for (const meta of SUBJECTS) {
    const { name, words } = await loadSubject(meta.id);
    for (const preset of [PRESETS.full, PRESETS.compact]) {
      for (const seed of [1, 2, 3]) {
        const p = buildPuzzle({
          name, pool: words, rng: makeRng(seed),
          size: preset.size, count: preset.count, mix: preset.mix,
        });
        assert.equal(p.words.length, preset.count,
          `${meta.id} at ${preset.size}x${preset.size} seed ${seed} dealt ${p.words.length}`);
      }
    }
  }
});
```

Run: `npm run test:unit -- tests/unit/deal.test.js`
Expected: PASS — 72 subjects × 2 presets × 3 seeds.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/subjects tests/unit/deal.test.js
git commit -m "Write the Nature, Food & Drink and Sports & Games categories

72 subjects, 100+ words each, all passing the content contract. deal.test.js
adds the assertion the contract cannot make: that every subject actually
fills a board at both presets, which is what a pool full of long words
fails rather than a bucket floor."
```

---

### Task 5: The save shape and URL resolution

Two small pure modules, both consumed by Task 6. Kept together because neither is worth a review gate alone and both are pure boundary code with the same shape of test.

**Files:**

- Modify: `src/storage.js:6-45`
- Modify: `src/rng.js:50-61` (replace `resolveTopicIndex`)
- Test: `tests/unit/storage.test.js`
- Test: `tests/unit/rng.test.js:39-50`

**Interfaces:**

- Consumes: `CATEGORIES` / `SubjectRef` from Task 3.
- Produces:
  - `SaveData = {seed:number, subjectId:string, size:number, count:number, found:{word,x0,y0,x1,y1}[]}`
  - `resolveSubject(search: string, categories: Category[], rng: Rng): string`

- [ ] **Step 1: Write the failing storage tests**

In `tests/unit/storage.test.js`, replace every `themeIdx:` / `topicIdx:` in the existing tests with the new shape — a saved board is now `{seed, subjectId, size, count, found}` — then append:

```js
// A save written before deep pools shipped is unreproducible, not merely stale: its
// board was dealt by taking twelve words from a twelve-word list, and that list no
// longer exists. Absence of `size` is the whole detection rule, so there is no
// migration code and no frozen legacy pool to carry forever.
test('a legacy save with no size field is discarded, not half-read', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, topicIdx: 5, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a save with a non-numeric size is discarded', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, subjectId: 'nature/birds', size: '13', count: 12, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a save missing its subject id is discarded', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, size: 13, count: 12, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a complete save round-trips including its board shape', () => {
  const store = memStore();
  const data = {
    seed: 42, subjectId: 'nature/birds', size: 10, count: 8,
    found: [{ word: 'OWL', x0: 1, y0: 2, x1: 3, y1: 2 }],
  };
  makeStorage(store).save(data);
  assert.deepEqual(makeStorage(store).load(), data);
});

// The board shape is recorded so restore never has to ask the device what size to
// rebuild at. A 13x13 save reopened where the preset says 10x10 still comes back as
// the board that was saved — progress is not something a resize gets to destroy.
test('a save whose size does not match any current preset still loads', () => {
  const store = memStore();
  const data = { seed: 1, subjectId: 'nature/birds', size: 11, count: 9, found: [] };
  makeStorage(store).save(data);
  assert.equal(makeStorage(store).load()?.size, 11);
});
```

- [ ] **Step 2: Write the failing rng tests**

In `tests/unit/rng.test.js`, change the import on line 3 and replace lines 39-50 with:

```js
import { makeRng, resolveSeed, resolveSubject } from '../../src/rng.js';
```

```js
const CATS = [
  { id: 'nature', name: 'Nature', subjects: [
    { id: 'nature/birds', name: 'Birds' }, { id: 'nature/trees', name: 'Trees' }] },
  { id: 'food', name: 'Food & Drink', subjects: [
    { id: 'food/pizza', name: 'Pizza' }, { id: 'food/candy', name: 'Candy' }] },
];

test('resolveSubject honours an explicit ?subject=', () => {
  assert.equal(resolveSubject('?subject=food/candy', CATS, makeRng(1)), 'food/candy');
});

test('resolveSubject picks inside an explicit ?category=', () => {
  const id = resolveSubject('?category=food', CATS, makeRng(1));
  assert.ok(['food/pizza', 'food/candy'].includes(id), `got ${id}`);
});

test('resolveSubject picks from the whole catalog when neither is given', () => {
  const id = resolveSubject('', CATS, makeRng(1));
  assert.ok(CATS.flatMap(c => c.subjects).some(s => s.id === id), `got ${id}`);
});

// The asymmetry is not decoration. If pinning a subject drew from rng, the same
// ?seed= would deal a different grid with and without ?subject=, and the determinism
// the e2e suite rests on would quietly stop holding.
test('an explicit ?subject= does not consume rng', () => {
  const a = makeRng(5), b = makeRng(5);
  resolveSubject('?subject=food/candy', CATS, a);
  assert.equal(a.int(50), b.int(50));
});

test('an unknown ?subject= falls back to a random one rather than throwing', () => {
  const id = resolveSubject('?subject=nope/nope', CATS, makeRng(1));
  assert.ok(CATS.flatMap(c => c.subjects).some(s => s.id === id), `got ${id}`);
});

// ?topic=N was the old parameter and is deliberately NOT aliased: indices no longer
// identify anything stable, so honouring one would silently deal the wrong subject.
test('the retired ?topic= parameter is ignored, not honoured', () => {
  assert.equal(resolveSubject('?topic=0', CATS, makeRng(1)), resolveSubject('', CATS, makeRng(1)));
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npm run test:unit -- tests/unit/storage.test.js tests/unit/rng.test.js`
Expected: FAIL — `does not provide an export named 'resolveSubject'`, and the storage tests report a loaded object where `null` was expected.

- [ ] **Step 4: Implement the save shape**

Replace `src/storage.js` lines 8-45 (the typedef block through the closing brace of `makeStorage`) with:

```js
/**
 * @typedef {{word:string,x0:number,y0:number,x1:number,y1:number}} FoundWord
 * @typedef {{seed:number, subjectId:string, size:number, count:number, found:FoundWord[]}} SaveData
 */

/** The real `localStorage`, or `null` if it is unavailable. Merely *reading* the
 * property throws on Safari with "Block All Cookies" and in some private modes —
 * which once broke app boot — so the access itself has to be guarded, not just the
 * calls on it. Shared with `appearance.js` so that guard exists in exactly one place.
 * @returns {Storage|null} */
export function defaultStore() {
  try { return globalThis.localStorage; } catch { return null; }
}

/** @param {Pick<Storage,'getItem'|'setItem'|'removeItem'>|null} [store] */
export function makeStorage(store) {
  if (store === undefined) store = defaultStore();
  return {
    /** @param {SaveData} data @returns {void} */
    save(data) { if (!store) return; try { store.setItem(KEY, JSON.stringify(data)); } catch { /* no persistence */ } },
    /** A save is either complete or it is not a save. `size` and `count` were added
     * when word pools grew past twelve, and a board written before that cannot be
     * rebuilt at all — its twelve words came from a twelve-word list that no longer
     * exists. So the missing field is not migrated, it is the detection rule, and the
     * board is discarded rather than half-restored onto a grid it does not match.
     * @returns {SaveData|null} */
    load() {
      if (!store) return null;
      try {
        const s = store.getItem(KEY);
        if (!s) return null;
        const d = /** @type {SaveData} */ (JSON.parse(s));
        if (typeof d?.seed !== 'number') return null;
        if (typeof d.subjectId !== 'string') return null;
        if (typeof d.size !== 'number' || typeof d.count !== 'number') return null;
        if (!Array.isArray(d.found)) return null;
        return d;
      } catch { return null; }
    },
    /** @returns {void} */
    clear() { if (!store) return; try { store.removeItem(KEY); } catch { /* ignore */ } },
  };
}
```

- [ ] **Step 5: Implement `resolveSubject`**

Replace `src/rng.js` lines 50-61 (`resolveTopicIndex` and its doc comment) with:

```js
/**
 * Which subject to deal, from the URL: `?subject=<id>` pins one, `?category=<id>`
 * pins the category and picks inside it, neither picks from the whole catalog.
 *
 * Note the asymmetry, which is not decoration: the fully-explicit branch must NOT
 * touch `rng`. Drawing there would shift the sequence, so the same `?seed=` would
 * deal a different grid with and without `?subject=`, and the determinism the e2e
 * suite rests on would quietly stop holding.
 *
 * An id that is not in the catalog falls through to a random pick rather than
 * throwing — a stale bookmark should still give you a game.
 *
 * @param {string} search @param {import('./catalog.js').Category[]} categories
 * @param {Rng} rng @returns {string}
 */
export function resolveSubject(search, categories, rng) {
  const p = new URLSearchParams(search);
  const all = categories.flatMap(c => c.subjects);
  const wanted = p.get('subject');
  if (wanted !== null && all.some(s => s.id === wanted)) return wanted;
  const cat = p.get('category');
  if (cat !== null) {
    const c = categories.find(x => x.id === cat);
    if (c && c.subjects.length) return c.subjects[rng.int(c.subjects.length)].id;
  }
  return all[rng.int(all.length)].id;
}
```

Also update the header comment on `src/rng.js` lines 4-6:

```js
// Deterministic PRNG so a puzzle can be reproduced exactly. `?seed=N` pins the
// sequence, `?subject=` / `?category=` pin what is dealt; with none of them, the
// clock seeds it and a random subject is chosen. This is the shipped path, not a
// test-only branch.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/storage.js src/rng.js tests/unit/storage.test.js tests/unit/rng.test.js
git commit -m "Save the board shape; resolve subjects from the URL

The save records subjectId, size and count, so restore rebuilds a board
from the save alone without asking the device what shape to use. A save
without size predates deep pools and cannot be rebuilt at all, so it is
discarded rather than migrated.

resolveTopicIndex becomes resolveSubject, reading ?subject= and
?category=. ?topic= is retired rather than aliased: an index no longer
identifies anything stable."
```

---

### Task 6: Rename through the DOM layer, and deal the device's board

This unbreaks the app. Rename topic → subject everywhere, boot asynchronously, and size the board from the preset.

**Files:**

- Modify: `index.html:35-58` (the header)
- Modify: `styles.css:110-130` (header rules) — `#topicline`/`#topiclbl`/`#topic` become `#subjectline`/`#category`/`#subject`
- Modify: `src/view.js:11-17` (the `Els` typedef)
- Modify: `src/main.js` (imports, `els`, `state`, `newPuzzle`, `persist`, `layout`, `endDrag`, `newGame`, boot, `restore`)
- Modify: `tests/e2e/helpers.js:6-18, 27-55` (derive the grid size from the DOM)
- Modify: `playwright.config.js:17-35` (pin `screen` on both projects)
- Modify: `tests/e2e/*.spec.js` (`?topic=0` → `?subject=nature/birds`, `#topic` → `#subject`, fixed word counts → derived)

**Interfaces:**

- Consumes: `buildPuzzle` / `pickWords` (Task 1), `PRESETS` / `pickPreset` / `computeLayout` (Task 2), `CATEGORIES` / `loadSubject` (Tasks 3-4), `SaveData` / `resolveSubject` (Task 5).
- Produces: the DOM contract Task 7 builds on — `#subject`, `#category`, `#newbtn`, and a `newGame(categoryId?: string|null)` in `main.js` that the picker calls.

- [ ] **Step 1: Update the e2e helpers to read the grid size from the DOM**

`tests/e2e/helpers.js` hardcodes `N = 13` in two places. On a phone the board is 10×10, so the mobile project would compute a wrong cell size and every drag would miss. Replace lines 6-18:

```js
export const PAD = 10;

/** Grid origin, cell size and board size, read from the live DOM. The board is 13x13
 * or 10x10 depending on the device, so nothing here may assume a size — `.cell` count
 * is the source of truth, and it is a perfect square by construction. */
export async function gridGeometry(page) {
  return page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    if (!gb) throw new Error('missing #gridbox');
    const n = Math.round(Math.sqrt(document.querySelectorAll('.cell').length));
    if (!n) throw new Error('grid has not rendered yet');
    const r = gb.getBoundingClientRect();
    return { left: r.left, top: r.top, cell: (gb.offsetWidth - 20) / n, pad: 10, n };
  });
}
```

and update its JSDoc return type to `Promise<{left:number, top:number, cell:number, pad:number, n:number}>`.

Then in `findWordInGrid`, replace the hardcoded `const N = 13;` inside the `page.evaluate` callback (line 29) with:

```js
    const letters = [...document.querySelectorAll('.cell')].map(e => e.textContent);
    const N = Math.round(Math.sqrt(letters.length));
```

and delete the old `const N = 13;` line above it.

- [ ] **Step 2: Pin `screen` on both Playwright projects**

In `playwright.config.js`, both projects must state `screen` explicitly. Without it the preset depends on a Playwright default rather than on the test's intent, and the mobile project could silently exercise the desktop board — a green suite proving nothing about the compact preset.

```js
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // pickPreset reads screen, not viewport. Pinned so a spec that calls
        // setViewportSize() cannot change which board it is testing.
        screen: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: /(gameplay|smoke)\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 664 },
        screen: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
```

- [ ] **Step 3: Update `index.html`**

Replace lines 36-41 (the header comment and the topic line):

```html
    <!-- The category is a sibling of #subject, not a ::before on it, for two reasons:
         #subject's textContent has to stay the bare subject name (gameplay.spec.js
         compares it across two loads of one seed), and the per-subject underline is
         set on #subject so it marks the name only — a ::before would drag the rule
         under the category too. The separator is a ::after in CSS for the same reason. -->
    <div><div id="kicker">WORD FINDER</div>
      <div id="subjectline"><span id="category"></span><span id="subject">Loading…</span></div></div>
```

- [ ] **Step 4: Update `styles.css`**

Replace lines 113-127 (`#topicline` through the four `#topic[data-accent]` rules). The rules are unchanged apart from the selectors and the new separator; no colour value moves, so `tokens.test.js` stays green.

```css
#subjectline{display:flex;align-items:baseline;gap:8px}
/* The category reads as a label, and earns its separator in CSS rather than in the
   markup so #subject's textContent stays the bare name the tests compare. `:empty`
   guards the first paint, before boot has resolved a subject to name. */
#category{font-family:var(--utility);font-size:13px;color:var(--muted);flex:none}
#category:not(:empty)::after{content:' ·';color:var(--muted)}
```

Then rename `#topic` to `#subject` and `--topic-accent` to `--subject-accent` in the block that follows (the `#topic{...}` rule and the four `#topic[data-accent="N"]` rules), leaving every property and value exactly as it is.

- [ ] **Step 5: Update the `Els` typedef in `src/view.js`**

In the typedef at lines 11-16, rename the `topic` member and add `category`:

```js
 * @typedef {{
 *   app:HTMLElement, gridbox:HTMLElement, pills:HTMLElement, letters:HTMLElement, fx:HTMLElement,
 *   list:HTMLElement, main:HTMLElement, side:HTMLElement, count:HTMLElement,
 *   subject:HTMLElement, category:HTMLElement, win:HTMLElement, winmsg:HTMLElement,
 *   confirm:HTMLElement, winclose:HTMLElement, appearance:HTMLElement, solved:HTMLElement,
 * }} Els
```

- [ ] **Step 6: Rewrite the wiring in `src/main.js`**

Replace lines 1-11 (the header comment and imports):

```js
// Word Finder — wiring. This is the only module that owns mutable game
// state, reads the URL, or listens for events; everything it calls is either pure
// (rng, puzzle, layout, catalog) or a stateless renderer (view, effects).
import { CATEGORIES } from './catalog.js';
import { loadSubject, SubjectLoadError } from './subjects.js';
import { makeRng, resolveSeed, resolveSubject } from './rng.js';
import { buildPuzzle, cap, matchWord, readLine, snap } from './puzzle.js';
import { computeLayout, pickPreset, PRESETS } from './layout.js';
import { applyLayout, renderGrid, renderList, renderPills, renderFoundCells, renderSolvedShape } from './view.js';
import { burst, pop } from './effects.js';
import { makeStorage } from './storage.js';
import { makeAppearance, appearanceLabel } from './appearance.js';
```

Replace lines 19-34 (the `State` typedef through the `N, COUNT, PAD` constants). `N` and `COUNT` stop being constants: a board carries its own shape, because a restored save may not match the device's preset and the board that is on screen is the one that must be rendered.

```js
/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {import('./layout.js').Preset} Preset
 * @typedef {import('./view.js').Els} Els
 * @typedef {import('./view.js').FoundEntry} FoundEntry
 * @typedef {{
 *   puzzle: Puzzle|null,
 *   size: number,
 *   found: Record<string, FoundEntry>,
 *   foundOrder: string[],
 *   sel: Selection|null,
 *   miss: Selection|null,
 *   drag: {x:number, y:number}|null,
 *   dims: LayoutDims,
 *   winTimer: ReturnType<typeof setTimeout>|null,
 * }} State
 */

const PAD = 10;
// Which board THIS DEVICE deals. Resolved once, from screen rather than the viewport,
// so resizing a window or rotating a phone never changes it. It governs new games
// only — a restored board is rendered at the size it was saved at, whatever this says.
const PRESET = pickPreset({ screenW: screen.width, screenH: screen.height });
// How long a freshly found word glows green before it strikes through. Kept in
// sync with the `foundGlow` animation duration in styles.css.
const GLOW_MS = 900;
```

In the `els` literal (line 52), replace the `topic:` member. `confirm:` on the line below stays for now — Task 7 deletes it along with the dialog:

```js
  subject: must('subject'), category: must('category'), win: must('win'), winmsg: must('winmsg'),
```

In the `state` literal (lines 63-72), add `size` next to `puzzle`:

```js
  puzzle: null,
  size: PRESET.size,
```

Replace lines 75-83 (`currentSeed`, `topicIdx`, `justFound`):

```js
/** @type {number} */
let currentSeed;
/** @type {string} */
let subjectId;
/** @type {number} */
let boardCount;
// The word (if any) currently mid-glow in the list. `list()` renders it with the
// green-glow class instead of the struck-through one; a timer clears it back to
// null so it strikes through. Only ever set by a live find, never by a restore.
/** @type {string|null} */
let justFound = null;
```

Replace the `accentSlot` doc comment (lines 85-89) so it names subjects rather than topics — the body is unchanged:

```js
/** Which of the four pill hues a subject underlines its name with. Hashed from the
 * name rather than drawn from the rng so a subject keeps the same colour every time it
 * comes up, and rather than from its position so reordering the catalog doesn't
 * reshuffle all 600. Reuses the pill tokens; it introduces no colour of its own.
 * @param {string} name @returns {number} */
```

Replace `newPuzzle` (lines 107-130) — it now takes a resolved subject and a board shape:

```js
/** Every puzzle is built from its own fresh rng seeded by `seed`, never the
 * shared/advanced one — that's what lets a single stored seed reproduce an
 * identical grid later (see `restore`), and what makes `newGame` safe to
 * call repeatedly without drifting out of sync with what was last saved.
 *
 * The board's shape arrives as an argument rather than being read off PRESET: a
 * restored save may have been dealt at a different size, and the board on screen is
 * the one that has to be rendered.
 * @param {number} seed @param {import('./subjects.js').Subject} subject
 * @param {{size:number, count:number, mix:import('./puzzle.js').Bucket[]}} shape
 * @returns {void} */
function newPuzzle(seed, subject, shape) {
  currentSeed = seed;
  subjectId = subject.id;
  boardCount = shape.count;
  state.size = shape.size;
  const rng = makeRng(seed);
  justFound = null;
  state.found = {}; state.foundOrder = []; state.sel = null; state.miss = null; state.drag = null;
  state.puzzle = buildPuzzle({
    name: subject.name, pool: subject.words, rng,
    size: shape.size, count: shape.count, mix: shape.mix,
  });
  els.subject.textContent = cap(state.puzzle.name);
  els.subject.dataset.accent = String(accentSlot(state.puzzle.name));
  els.category.textContent = subject.categoryName;
  // Cancel any pending win reveal; otherwise starting a new puzzle within the
  // 700ms delay lets the stale timer drop the overlay over a fresh grid, where
  // it swallows every pointer event and makes the game unplayable.
  if (state.winTimer) { clearTimeout(state.winTimer); state.winTimer = null; }
  els.win.style.display = 'none';
  layout();
  list();
  sweep();
  persist();
}
```

Replace `persist` (lines 132-142):

```js
/** Save just enough to regenerate the identical grid on reload: the seed, the subject
 * and the board's shape (from which `buildPuzzle` reproduces the same cells) plus each
 * found word's selection — not the cells themselves.
 * @returns {void} */
function persist() {
  store.save({
    seed: currentSeed,
    subjectId,
    size: state.size,
    count: boardCount,
    found: state.foundOrder.map(w => ({ word: w, ...state.found[w].sel })),
  });
}
```

In `layout()` (lines 144-161), pass the board's size and count through, and replace every `N`:

```js
  state.dims = computeLayout({
    vw: window.innerWidth - padX,
    vh: window.innerHeight - padY,
    size: state.size, pad: PAD, count: boardCount,
  });
  applyLayout(els, state.dims);
  renderGrid(els, state.puzzle, state.dims, state.size, PAD);
  // renderGrid rebuilds every cell from scratch, so found-ness has to be reapplied
  // after it or a resize would wipe the grid's record of what you've already found.
  renderFoundCells(els, state, state.size);
  pills();
```

In `cellXY`/`clampI` (lines 186-187) and `endDrag`, replace the remaining `N` references:

```js
/** @param {number} v @returns {number} */
const clampI = (v) => Math.max(0, Math.min(state.size - 1, Math.round(v)));
```

In the `pointermove` handler, `snap(state.drag.x, state.drag.y, p.fx, p.fy, N)` becomes `..., state.size)`.
In `endDrag`, `readLine(puzzle.cells, N, s)` becomes `readLine(puzzle.cells, state.size, s)`, and `renderFoundCells(els, state, N)` becomes `renderFoundCells(els, state, state.size)`; the same for `renderSolvedShape(els, state, N)`.

Replace `newGame` / `requestNewGame` and the button wiring (lines 256-283):

```js
// A fresh subject is a player-facing surprise, so it stays on Math.random() rather
// than the seeded sequence — `?seed=` pins the puzzle you land on, not every one after.
// It also gets a fresh seed (not the old `currentSeed`): `newPuzzle` builds its own
// rng from scratch each time, so reusing the same seed here would reproduce the
// exact same word/placement choices for the new subject too.
/** @param {string|null} [categoryId] restrict the pick to one category
 * @returns {Promise<void>} */
async function newGame(categoryId) {
  const pool = categoryId
    ? (CATEGORIES.find(c => c.id === categoryId)?.subjects ?? [])
    : CATEGORIES.flatMap(c => c.subjects);
  const choices = pool.filter(s => s.id !== subjectId);
  const pick = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
  newPuzzle(Date.now() >>> 0, await loadSubject(pick.id), PRESET);
}
must('winbtn').addEventListener('click', () => { void newGame(); });
els.winclose.addEventListener('click', () => { els.win.style.display = 'none'; });
els.win.addEventListener('click', (e) => { if (e.target === els.win) els.win.style.display = 'none'; });
```

The `#newbtn` and `#confirm` listeners are deliberately dropped here — Task 7 wires `#newbtn` to the picker and deletes `#confirm`. **Until Task 7 lands, the header's New game button does nothing.** That is the one deliberately broken thing in this task; the win card's button still deals a game, so gameplay e2e stays exercisable.

Replace the boot block (lines 309-321) and `restore` (lines 323-342):

```js
// Explicit `?seed=` / `?subject=` / `?category=` in the URL always wins (it's what the
// determinism e2e test relies on), even over a saved game — that's the whole point of
// pinning a puzzle by URL. Otherwise, prefer a saved game; only fall back to a fresh
// random puzzle when there's nothing to restore.
async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('seed') || params.has('subject') || params.has('category')) {
      const seed = resolveSeed(location.search);
      const id = resolveSubject(location.search, CATEGORIES, makeRng(seed));
      newPuzzle(seed, await loadSubject(id), PRESET);
      return;
    }
    const saved = store.load();
    if (saved) { await restore(saved); return; }
    await newGame();
  } catch (err) {
    // Offline with an uncached category, or a save naming a subject since removed.
    // A blank grid with no explanation is the worst outcome available, so say what
    // happened and leave the board empty rather than half-built.
    els.subject.textContent = err instanceof SubjectLoadError && err.reason === 'unavailable'
      ? 'Offline' : 'Unavailable';
    els.category.textContent = '';
  }
}

/** Regenerate the exact grid a save came from (same seed + same subject + same shape
 * -> same fresh rng -> same puzzle, per `newPuzzle`), then replay the found words on
 * top of it. The saved shape wins over this device's preset: a board is not something
 * a resize gets to discard. Guards against a stale/corrupt save: a word the
 * regenerated puzzle doesn't contain, or one already replayed, is skipped rather
 * than crashing.
 * @param {import('./storage.js').SaveData} saved @returns {Promise<void>} */
async function restore(saved) {
  const shape = saved.size === PRESETS.compact.size ? PRESETS.compact : PRESETS.full;
  newPuzzle(saved.seed, await loadSubject(saved.subjectId), {
    size: saved.size, count: saved.count, mix: shape.mix,
  });
  for (const f of saved.found) {
    if (!state.puzzle || !state.puzzle.words.includes(f.word) || state.found[f.word]) continue;
    state.found[f.word] = { sel: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 } };
    state.foundOrder.push(f.word);
  }
  renderFoundCells(els, state, state.size);
  pills();
  list(); // redraw pills + cross out; deliberately does NOT pop the win overlay
  // `newPuzzle()` above already called `persist()` with an empty `found` (it
  // always saves a fresh puzzle), so without this the just-replayed progress
  // would only live in memory — a second reload would silently lose it even
  // though the first one looked fine. Re-save now that `found` is populated.
  persist();
}

void boot();
```

`boot()` and `restore()` are function declarations, so the `void boot()` call above them hoists fine; keep the service-worker registration as the file's last statement.

- [ ] **Step 7: Update the e2e specs for the rename**

Across `tests/e2e/`, replace `?topic=0` with `?subject=nature/birds` and `#topic` with `#subject`. The files and lines: `appearance.spec.js:18,37,79,101,136,174,199`, `gameplay.spec.js:54,61,63,64,67,69`, `ux.spec.js:5,19,46`.

In `gameplay.spec.js`, the pinned-puzzle comment on lines 51-53 becomes:

```js
  // Seed 1 with Birds is pinned because it is known to contain a diagonally-placed
  // word; findDiagonalWord throws if none exist, and an unseeded puzzle only has a
  // diagonal word most of the time (not always).
```

Fixed word counts must become derived, because the mobile project now deals 8 words rather than 12. In `gameplay.spec.js:8,16,37` and `regressions.spec.js:16,20`, replace each `toContainText('N of 12 found')` with a count read from the board:

```js
  const total = await page.locator('.w').count();
  await expect(page.locator('#count')).toContainText(`1 of ${total} found`);
```

In `smoke.spec.js`, lines 5-8 become:

```js
  // 169 on a desktop board, 100 on a phone. Asserting a perfect square rather than a
  // number is what lets this one spec cover both projects.
  const cells = await page.locator('.cell').count();
  expect([100, 169]).toContain(cells);
  await expect(page.locator('#subject')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText(`0 of ${await page.locator('.w').count()} found`);
```

In `regressions.spec.js:31`, the hardcoded `/ 13` becomes a derived board size:

```js
    const n = Math.round(Math.sqrt(document.querySelectorAll('.cell').length));
    const cell = (gb.offsetWidth - 20) / n;
```

In `regressions.spec.js`, the precache test asserts `toHaveCount(169)` — replace with the same square check as `smoke.spec.js`, and update the module list in its comment on line 160 from `topics` to `catalog/subjects`.

`ux.spec.js`'s first test (`New game mid-game asks to confirm`) and the copy-guard test both drive `#newbtn` and `#confirm`, which this task leaves unwired. Mark both `test.fixme(...)` with the note `# unwired until the picker lands in Task 7`, and Task 7 rewrites them.

- [ ] **Step 8: Update the layout spec to set a screen per device**

`layout.spec.js` iterates phone viewports inside the `desktop` project, which now pins `screen` at 1440×900 — so every device would be measured against the full board, including the phones the compact preset exists for. Give each device its real screen, via a `describe` block per device so `test.use` applies:

```js
// Real Safari innerHeight (browser chrome subtracted) — what players actually get.
// `screen` is the device's own, because pickPreset reads it: measuring an iPhone
// viewport against a desktop screen would test a 13x13 board no iPhone ever deals.
const DEVICES = [
  { name: 'iPhone 13 portrait',      w: 390,  h: 664,  sw: 390,  sh: 844 },
  { name: 'iPhone 13 landscape',     w: 844,  h: 300,  sw: 390,  sh: 844 },
  { name: 'iPhone Pro Max portrait', w: 430,  h: 752,  sw: 430,  sh: 932 },
  { name: 'iPhone Pro Max landscape',w: 932,  h: 340,  sw: 430,  sh: 932 },
  { name: 'iPad Mini portrait',      w: 744,  h: 1053, sw: 744,  sh: 1133 },
  { name: 'iPad Mini landscape',     w: 1133, h: 664,  sw: 744,  sh: 1133 },
  { name: 'Desktop',                 w: 1440, h: 900,  sw: 1440, sh: 900 },
];
```

and replace the `for` loop at the bottom of the file:

```js
for (const d of DEVICES) {
  test.describe(`${d.name} (${d.w}x${d.h})`, () => {
    test.use({ viewport: { width: d.w, height: d.h }, screen: { width: d.sw, height: d.sh } });

    test('layout fits', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'viewport is set explicitly');
      await page.goto('/');
      await page.waitForTimeout(250);
      const m = await measure(page);

      expect(m.offscreen, `words off screen: ${m.offscreen.join(', ')}`).toHaveLength(0);
      expect(m.gridOverflowY, 'grid extends below the viewport').toBeLessThanOrEqual(0);
      expect(m.gridOverflowX, 'grid extends past the right edge').toBeLessThanOrEqual(0);
      expect(m.clippedY, 'content clipped vertically by #app').toBe(0);
      expect(m.clippedX, 'content clipped horizontally by #app').toBe(0);
    });
  });
}
```

The `setViewportSize` call is gone — `test.use` sets it before the page exists, which is also what makes `screen` take effect.

- [ ] **Step 9: Add the preset e2e guard**

Append to `tests/e2e/layout.spec.js`:

```js
// The rule the whole screen-vs-viewport decision exists to protect. A desktop player
// dragging their window narrow must keep the board they were playing.
test('narrowing the window does not change the board', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'needs the desktop screen');
  await page.goto('/?seed=1&subject=nature/birds');
  const before = await page.locator('.cell').count();
  expect(before).toBe(169);
  await page.setViewportSize({ width: 380, height: 700 });
  await page.waitForTimeout(250);
  expect(await page.locator('.cell').count()).toBe(169);
});
```

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, except the two `test.fixme` tests in `ux.spec.js`, which report as skipped. The mobile project renders a 10×10 board with 8 words; the desktop project renders 13×13 with 12.

- [ ] **Step 11: Commit**

```bash
git add index.html styles.css src/main.js src/view.js playwright.config.js tests/e2e
git commit -m "Rename topic -> subject and deal the device's board

#topic becomes #subject with the category beside it, buildPuzzle is fed a
loaded subject, and boot is async because a word pool is now fetched.
Board size comes from the preset for a new game and from the save for a
restored one, so state carries its own size rather than reading a constant.

e2e helpers derive the board size from the rendered cell count instead of
assuming 13, and both Playwright projects pin screen so the mobile project
genuinely exercises the compact board. #newbtn is unwired until the picker
lands; the two specs that drive it are marked fixme."
```

---

### Task 7: The category picker

**Files:**

- Create: `src/picker.js`
- Modify: `index.html:69-73` (replace `#confirm` with `#picker`)
- Modify: `styles.css:213-219` (`#confirm` rules become `#picker`, plus the select)
- Modify: `src/main.js` (wire `#newbtn`, drop the `confirm` element)
- Modify: `src/view.js:11-17` (`Els`: `confirm` → `picker`)
- Test: `tests/e2e/ux.spec.js` (un-fixme and rewrite the two tests)
- Test: `tests/e2e/picker.spec.js` (new)

**Interfaces:**

- Consumes: `CATEGORIES` (Task 3), `newGame(categoryId)` and the `Els` typedef (Task 6).
- Produces: `makePicker(deps): {open(inProgress: boolean): void, close(): void}` where `deps` is `{root: HTMLElement, select: HTMLSelectElement, warning: HTMLElement, error: HTMLElement, start: HTMLElement, cancel: HTMLElement, categories: Category[], onStart: (categoryId: string|null) => Promise<void>}`. A rejected `onStart` is how a category that will not load reaches the dialog, so there is no separate failure callback.

- [ ] **Step 1: Write the failing e2e tests**

Create `tests/e2e/picker.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';

test('New game opens the picker, and Cancel leaves the board alone', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const before = await page.locator('.cell').allTextContents();
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker')).toBeVisible();
  await page.locator('#picker-cancel').click();
  await expect(page.locator('#picker')).toBeHidden();
  expect((await page.locator('.cell').allTextContents()).join('')).toBe(before.join(''));
});

test('the picker offers Surprise me first, then every category', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  const opts = await page.locator('#picker-select option').allTextContents();
  expect(opts[0]).toBe('Surprise me');
  expect(opts).toContain('Nature');
  expect(opts).toContain('Food & Drink');
  expect(opts).toContain('Sports & Games');
  expect(await page.locator('#picker-select').inputValue()).toBe('');
});

test('choosing a category deals a subject from it', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.locator('#picker-select').selectOption('food');
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#category')).toHaveText('Food & Drink');
});

test('Surprise me deals a game', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.locator('#picker-start').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#subject')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText('found');
});

// The dialog replaces the old confirm, so the warning it absorbed has to survive:
// an accidental tap mid-board must still say what it is about to cost.
test('the warning shows only when a board is in progress', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-warning')).toBeHidden();
  await page.locator('#picker-cancel').click();

  const first = /** @type {string} */ (await page.locator('.w').first().textContent()).toUpperCase();
  await dragCells(page, await findWordInGrid(page, first));
  await page.locator('#newbtn').click();
  await expect(page.locator('#picker-warning')).toBeVisible();
  await expect(page.locator('#picker-warning')).toHaveText('Start a new game? Your progress will be lost.');
});

test('Escape closes the picker', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.locator('#newbtn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#picker')).toBeHidden();
});

// The win card deliberately bypasses the dialog: a winning streak should not be
// interrupted by a form.
test('the win card deals a game without opening the picker', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winbtn').click();
  await expect(page.locator('#picker')).toBeHidden();
  await expect(page.locator('#win')).toBeHidden();
});
```

Then in `tests/e2e/ux.spec.js`, remove the two `test.fixme` markers added in Task 6 and replace those two tests with:

```js
test('the win overlay can be dismissed, leaving the solved board', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  const total = await page.locator('.w').count();
  for (const el of await page.locator('.w').all()) {
    const w = /** @type {string} */ (await el.textContent()).toUpperCase();
    await dragCells(page, await findWordInGrid(page, w));
  }
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#winclose').click();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('.w.done')).toHaveCount(total);   // board still there
});

// "Topic" named the internal concept twice over: once for the word list, once for
// the UI's appearance. Pinned as a test because both meanings have now moved on.
test('the visible copy talks about games and subjects, never topics or themes', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await expect(page.locator('#newbtn')).toHaveText(/New game/);
  await expect(page.locator('#winbtn')).toHaveText(/Play a new game/);
  await expect(page.locator('#picker-start')).toHaveText('Start');
  await expect(page.locator('#picker-cancel')).toHaveText('Cancel');
  await expect(page.locator('body')).not.toContainText(/theme/i);
  await expect(page.locator('body')).not.toContainText(/topic/i);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:e2e -- tests/e2e/picker.spec.js`
Expected: FAIL — `#picker` never becomes visible, because `#newbtn` has no listener and the element does not exist.

- [ ] **Step 3: Replace `#confirm` in `index.html`**

Replace lines 69-73:

```html
<div id="picker"><div id="pickercard">
  <h2>New game</h2>
  <p id="picker-warning">Start a new game? Your progress will be lost.</p>
  <label for="picker-select">Category</label>
  <!-- A native select rather than a grid of chips: 25 categories is eight to twelve
       rows on a phone, while this is one control at any count, renders as a wheel
       picker on iOS, and brings keyboard and screen-reader support with it. The
       empty value is "Surprise me" so the default needs no special-casing. -->
  <select id="picker-select"></select>
  <p id="picker-error" hidden></p>
  <div><button id="picker-cancel" type="button">Cancel</button>
  <button id="picker-start" type="button">Start</button></div>
</div></div>
```

- [ ] **Step 4: Restyle it in `styles.css`**

Replace lines 213-219 (the `#confirm` block). Every colour is an existing token; no new one is introduced, so `tokens.test.js` stays green.

```css
#picker{position:fixed;inset:0;background:var(--scrim);display:none;align-items:center;justify-content:center;z-index:60}
#pickercard{background:var(--surface);border:1px solid var(--accent);border-radius:20px;padding:30px 34px;text-align:center;animation:popIn .45s ease;box-shadow:var(--card-shadow);min-width:280px}
#pickercard h2{font-family:var(--display);font-weight:700;font-size:22px;color:var(--text-strong);margin:0 0 14px}
#picker-warning{font-size:14.5px;color:var(--muted);margin:0 0 18px;max-width:260px}
#pickercard label{display:block;font-family:var(--utility);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--label);margin-bottom:6px;text-align:left}
/* appearance:none so the control takes the card's palette rather than the platform's
   white; min-height 44px is the touch target the rest of the dialogs already keep. */
#picker-select{appearance:none;-webkit-appearance:none;width:100%;box-sizing:border-box;
  background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:12px;
  padding:11px 14px;font-family:inherit;font-size:15px;min-height:44px;cursor:pointer;margin-bottom:20px}
#picker-select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#picker-error{font-size:13px;color:var(--pill-miss);margin:-12px 0 16px;max-width:260px}
#pickercard div{display:flex;gap:12px;justify-content:center}
#picker-cancel,#picker-start{border:none;border-radius:999px;padding:12px 22px;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer;min-height:44px}
#picker-cancel{background:transparent;border:1.5px solid var(--accent);color:var(--accent-text)}
#picker-start{background:var(--accent);color:var(--accent-ink)}
```

- [ ] **Step 5: Create `src/picker.js`**

```js
// The category dialog. Owns no game state: it reports a chosen category id and lets
// main.js decide what that means. Split out of main.js because that module is the
// single home of mutable game state and this is a self-contained piece of DOM with
// one output.

/** @typedef {import('./catalog.js').Category} Category */

/**
 * @param {{
 *   root:HTMLElement, select:HTMLSelectElement, warning:HTMLElement, error:HTMLElement,
 *   start:HTMLElement, cancel:HTMLElement, categories:Category[],
 *   onStart:(categoryId:string|null)=>Promise<void>,
 * }} deps
 */
export function makePicker({ root, select, warning, error, start, cancel, categories, onStart }) {
  // The empty value is Surprise me, so "no category chosen" and "the default" are the
  // same state and neither needs a sentinel string.
  select.innerHTML = '';
  for (const [value, label] of [['', 'Surprise me'], ...categories.map(c => [c.id, c.name])]) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }

  const close = () => { root.style.display = 'none'; };

  /** @param {boolean} inProgress @returns {void} */
  function open(inProgress) {
    // Reset to Surprise me on every open. Choosing a category is an act, not a
    // setting: a remembered choice would silently narrow every later game to it.
    select.value = '';
    warning.style.display = inProgress ? '' : 'none';
    error.hidden = true;
    root.style.display = 'flex';
    select.focus();
  }

  start.addEventListener('click', async () => {
    const chosen = select.value || null;
    /** @type {HTMLOptionElement} */
    const option = select.selectedOptions[0];
    try {
      await onStart(chosen);
      close();
    } catch {
      // Offline with an uncached category. Stay open, say so, and disable the option
      // so it cannot be chosen again this session — closing on failure would leave a
      // half-built board with nothing explaining it.
      error.textContent = chosen
        ? `${option.textContent} isn't available offline yet. Try another category.`
        : 'No categories are available offline yet.';
      error.hidden = false;
      if (chosen) { option.disabled = true; select.value = ''; }
    }
  });
  cancel.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  return { open, close };
}
```

- [ ] **Step 6: Wire it in `src/main.js`**

In the `els` literal, replace `confirm: must('confirm'),` with `picker: must('picker'),`. In `src/view.js`'s `Els` typedef, rename the `confirm` member to `picker` for the same reason.

Add the import beside the others:

```js
import { makePicker } from './picker.js';
```

and replace the `#newbtn` / `#confirm` wiring that Task 6 removed (it belongs immediately after `newGame`):

```js
// `newGame` rejects when a category cannot be fetched; the picker catches that to
// keep itself open, so the rejection must survive rather than being swallowed here.
const picker = makePicker({
  root: els.picker,
  select: /** @type {HTMLSelectElement} */ (must('picker-select')),
  warning: must('picker-warning'),
  error: must('picker-error'),
  start: must('picker-start'),
  cancel: must('picker-cancel'),
  categories: CATEGORIES,
  onStart: (categoryId) => newGame(categoryId),
});
// Unconditional, unlike the confirm dialog it replaces: the dialog is now how a game
// is started, and the warning is one line inside it rather than a reason to show it.
must('newbtn').addEventListener('click', () => {
  const inProgress = !!state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  picker.open(inProgress);
});
```

Update the Escape handler (line 304-306) to close the picker rather than the confirm:

```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { els.win.style.display = 'none'; picker.close(); }
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, with no skipped tests remaining in `ux.spec.js`.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/picker.js src/main.js src/view.js tests/e2e
git commit -m "Add the category picker, replacing the confirm dialog

New game now always opens a dialog: a native select of categories with
Surprise me as the default, and the progress warning folded in as one
line rather than as a reason to show it at all. A category that will not
load offline reports inline and disables its own option instead of
closing over a half-built board.

The win card still deals instantly — a winning streak should not be
interrupted by a form."
```

---

### Task 8: Two service worker caches

Word modules must not live in the versioned shell cache. If they did, the activate-time sweep would throw away every downloaded category on every deploy — up to ~700 KB re-fetched to fix a one-line CSS change, and an offline player left with nothing to play.

**Files:**

- Modify: `sw.js:9-10, 39-64`
- Test: `tests/unit/sw.test.js`
- Test: `tests/e2e/regressions.spec.js` (the precache coverage test)

**Interfaces:**

- Consumes: the module list Tasks 3-7 produced.
- Produces: `CACHE = 'wordfinder-v8'` (versioned shell) and `SUBJECT_CACHE = 'wordfinder-subjects'` (unversioned).

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/unit/sw.test.js`:

```js
test('the shell precache lists catalog.js and every src module, but no word pool', () => {
  const m = sw.match(/const ASSETS=(\[[^\]]*\])/);
  assert.ok(m, 'could not find ASSETS in sw.js');
  /** @type {string[]} */
  const assets = JSON.parse(m[1].replace(/'/g, '"'));
  assert.ok(assets.includes('./src/catalog.js'), 'the picker needs names on every visit');
  assert.ok(assets.includes('./src/subjects.js'), 'the loader is shell code, not content');
  assert.ok(assets.includes('./src/picker.js'));
  assert.ok(
    !assets.some(a => a.startsWith('./src/subjects/')),
    'word pools must not be precached: they are the whole reason the catalog is separate',
  );
});

// The cost of getting this wrong is invisible until a deploy: the shell sweep would
// delete every downloaded category, so a one-line CSS fix would cost every player a
// full re-download and would strand an offline one with nothing to play.
test('word pools live in their own cache, which the activate sweep spares', () => {
  assert.match(sw, /const SUBJECT_CACHE='wordfinder-subjects'/, 'subjects need an unversioned cache');
  const line = sw.split('\n').find((l) => l.includes("addEventListener('activate'"));
  assert.ok(line, 'could not find the activate handler in sw.js');
  assert.ok(
    line.includes('k!==SUBJECT_CACHE'),
    'the activate sweep deletes every cache that is not CACHE; it must spare SUBJECT_CACHE',
  );
});

test('a subject module is routed to the subject cache, cache-first', () => {
  assert.match(sw, /isSubject/, 'the fetch handler needs to recognise a word pool');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:unit -- tests/unit/sw.test.js`
Expected: FAIL — `subjects need an unversioned cache`.

- [ ] **Step 3: Implement the second cache in `sw.js`**

Replace lines 9-10:

```js
const CACHE='wordfinder-v8';
// Word pools are deliberately NOT versioned with the shell. They are large, they
// change only when their own file does, and the activate sweep below would otherwise
// discard every category a player had downloaded on every single deploy.
const SUBJECT_CACHE='wordfinder-subjects';
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/catalog.js','./src/subjects.js','./src/picker.js','./src/storage.js','./src/appearance.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

/** A lazily-imported word pool, as opposed to shell code. Matched on the directory
 * rather than a list, because the catalog grows and sw.js must not have to grow with it.
 * @param {URL} u @returns {boolean} */
const isSubject=u=>u.pathname.includes('/src/subjects/');
```

Replace the activate handler (line 39):

```js
sw.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==SUBJECT_CACHE).map(k=>caches.delete(k)))).then(()=>sw.clients.claim()))});
```

Insert a subject branch at the top of the fetch handler, immediately after the `method!=='GET'` guard (line 42):

```js
  const url=new URL(e.request.url);
  // Word pools are strictly cache-first out of their own cache: they are large, they
  // never change in place, and a revalidation on every deal would spend a request to
  // learn nothing. A miss falls through to the network and stores the result, which
  // is what "cache the categories you actually play" means.
  if(url.origin===sw.location.origin&&isSubject(url)){
    e.respondWith(caches.open(SUBJECT_CACHE).then(async cache=>{
      const hit=await cache.match(e.request);
      if(hit)return hit;
      const res=await fetch(e.request);
      if(res&&res.ok)cache.put(e.request,res.clone());
      return res;
    }));
    return;
  }
```

- [ ] **Step 4: Update the e2e precache coverage test**

`regressions.spec.js`'s "every same-origin asset the app loads is covered by the precache list" test would now fail on the word module the boot loads — correct behaviour, not a forgotten entry. Read that test, find the list of same-origin resources it collects from the page, and filter word pools out of it before the coverage assertion, with the reason stated:

```js
  // Word pools are runtime-cached in SUBJECT_CACHE, never precached — that is the
  // point of the split. Excluding them keeps this guard sharp for shell code, which
  // is what it exists to catch: a new src/ module that main.js imports and sw.js
  // forgot would still fail here by name.
  .filter(p => !p.includes('/src/subjects/'))
```

Do not weaken the assertion any further than this one directory. The test's whole value is that a forgotten shell module fails loudly, and a broader filter would quietly retire it.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sw.js tests/unit/sw.test.js tests/e2e/regressions.spec.js
git commit -m "Cache word pools separately from the versioned shell

The shell precache gains catalog.js, subjects.js and picker.js and is
bumped to v8. Word modules are runtime-cached, cache-first, in an
unversioned wordfinder-subjects that the activate sweep spares.

In the versioned cache they would be deleted on every deploy: a one-line
CSS fix would cost every player a full re-download of every category they
had played, and would leave an offline one with nothing to play."
```

---

### Task 9: Documentation

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: everything above. Produces nothing consumed by code.

- [ ] **Step 1: Update the `src/` table**

Replace the `src/topics.js` row and the `src/rng.js` row, and add the new modules:

```markdown
| `src/rng.js` | Seeded PRNG and `?seed=` / `?subject=` / `?category=` resolution. | pure |
| `src/catalog.js` | Category and subject names. No words — loads on every visit. | data |
| `src/subjects/*.js` | One category's word pools, 100+ words per subject. Lazily imported. | data |
| `src/subjects.js` | Resolves a subject id to its pool, memoising each category module. | pure-ish |
| `src/picker.js` | The category dialog. Reports a category id; owns no game state. | DOM |
```

- [ ] **Step 2: Rewrite the reproducible-puzzles and content sections**

```markdown
### Reproducible puzzles

`?seed=N` pins the puzzle, `?subject=<id>` pins the subject, `?category=<id>` pins the
category and picks a subject inside it — e.g. `/?seed=1&subject=nature/birds`. With
none of them, the clock seeds it and a random subject is chosen.

### Board sizes

Two presets, chosen from `screen` rather than the viewport so a device always plays one
board: **13×13 with 12 words**, or **10×10 with 8 words** when the screen's smaller edge
is under 480px. Resizing a window or rotating a phone never changes it. A saved board is
always restored at the size it was saved at.

### Adding a subject

1. Add `{ id: '<category>/<slug>', name: '<Name>' }` to that category's `subjects` in
   `src/catalog.js`. The slug is the name lowercased with non-alphanumerics replaced by `-`.
2. Add `'<category>/<slug>': 'WORD1,WORD2,...'` to `src/subjects/<category>.js`.

The word list must hold **100+ words**, bare uppercase A–Z, 3–12 letters, no duplicates,
with at least 6 words of 3–4 letters and 8 in each of 3–5, 5–6, 6–8, 7–9 and 9–12.
`npm run test:unit` enforces all of it and names the subject and bucket that failed.

Short words are the scarce ones — write those first.

### Adding a category

Add the entry to `CATEGORIES` in `src/catalog.js`, create `src/subjects/<id>.js`
exporting a `WORDS` record, and add **nothing** to `sw.js` — word modules are cached at
runtime by directory, not listed. The picker reads its options from the catalog.
```

- [ ] **Step 3: Run the full suite one last time**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add README.md
git commit -m "Document the catalog, the board presets and how to add content"
git push origin main
```

- [ ] **Step 5: Verify the deploy**

Dispatch the `deploy-verifier` agent, or run `npm run test:live` after the Pages build completes. Confirm on the deployed URL, with the service worker and its caches cleared: the header shows a category and a subject, New game opens the picker, and a phone-sized device gets a 10×10 board.

---

## Follow-on

Spec B — the remaining 22 categories, ~528 subjects, ~53,000 words — is a separate plan. It reuses `content.test.js` and `deal.test.js` unchanged as its gate; the only code it touches is `src/catalog.js` and new files under `src/subjects/`.
