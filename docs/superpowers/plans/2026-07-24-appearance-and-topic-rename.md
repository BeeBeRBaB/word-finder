# Appearance modes and the `theme` → `topic` rename — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the word-list concept from `theme` to `topic` so that "theme" means only how the UI looks, then add a Light / Dark / System appearance setting driven by a cycling header button.

**Architecture:** The rename is a mechanical sweep through the pure modules, then the DOM layer, then docs — done first so the word "theme" is free before the feature lands. The feature is two layers: a CSS custom-property token layer with two palettes selected by `data-appearance` on `<html>`, and `src/appearance.js`, which resolves a stored preference to a concrete mode. Resolution happens in JavaScript rather than in a `prefers-color-scheme` media query, so each palette is written exactly once.

**Tech Stack:** Vanilla ES modules, no build step, no runtime dependencies. `node:test` for unit tests, Playwright for e2e, `tsc --noEmit` over JSDoc for types.

## Global Constraints

- **No build step and no new dependencies.** The files in the repo are exactly what GitHub Pages serves.
- **No framework, no bundler, no CSS preprocessor.** Plain ES modules and plain CSS.
- **Every module keeps its pure/DOM split.** `rng.js`, `puzzle.js`, `layout.js` must not touch the DOM. `appearance.js` may only touch the DOM through injected dependencies.
- **The dark palette is unchanged, value for value.** Every dark hex/rgba in the token table is copied from today's `styles.css`. A different dark rendering is a bug in this work.
- **Copy is fixed:** `↻ New game`, `Play a new game →`, `Start a new game? Your progress will be lost.`, confirm button `New game`, app title `Word Finder`, kicker `WORD FINDER`.
- **Storage keys:** game save stays `wordfinder-save-v1`; the appearance preference uses its own key `wordfinder-appearance`.
- **Storage never throws into the game.** Every `localStorage` access is wrapped, matching `makeStorage()`.
- **`npm run typecheck` must pass after every task.** JSDoc types are enforced; `any` is not acceptable, narrow casts through `unknown` are the established idiom.
- **Commits are authored as `BeeBeRBaB <puchkiray@outlook.com>`** (already the repo's git config) with **no `Co-Authored-By` trailer**. Commit directly on `main`; no feature branch, no PR.
- **Reference spec:** `docs/superpowers/specs/2026-07-24-appearance-and-topic-rename-design.md`.

---

### Task 1: Rename `theme` → `topic` in the pure modules

The data module, the seeding helper, and the puzzle builder. Nothing here touches the DOM, so this task is fully covered by `node:test`.

**Files:**

- Rename: `src/themes.js` → `src/topics.js` (via `git mv`)
- Modify: `src/rng.js:1-6` (header comment), `src/rng.js:51-63` (`resolveThemeIndex`)
- Modify: `src/puzzle.js:17-25` (`buildPuzzle` signature and body)
- Test: `tests/unit/rng.test.js:1-3, 39-50`
- Test: `tests/unit/puzzle.test.js:1-26`

**Interfaces:**

- Consumes: nothing — this is the first task.
- Produces:
  - `TOPICS: [string,string][]` exported from `src/topics.js`
  - `resolveTopicIndex(search: string, count: number, rng: Rng): number` from `src/rng.js`
  - `buildPuzzle({topics, topicIdx, rng, size, count}): Puzzle` from `src/puzzle.js`

- [ ] **Step 1: Move the data module and rename its export**

```bash
git mv src/themes.js src/topics.js
```

Then edit the top of `src/topics.js` — only the first five lines change, the 100 data rows are untouched:

```js
// Puzzle content: each topic is [name, comma-separated uppercase words].
// This is data, not logic — kept separate so new topics can be added
// without touching the game engine.
/** @type {[string,string][]} */
export const TOPICS = [
```

- [ ] **Step 2: Update the unit tests to the new names — they must fail first**

Replace the top of `tests/unit/puzzle.test.js` (lines 1-26):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle, snap, readLine, matchWord, cap } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { TOPICS } from '../../src/topics.js';

const build = (seed, topicIdx = 0) =>
  buildPuzzle({ topics: TOPICS, topicIdx, rng: makeRng(seed), size: 13, count: 12 });

test('every placed word is actually readable in the grid', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const p = build(seed, seed % TOPICS.length);
    for (const { word, x0, y0, dx, dy } of p.placements) {
      let read = '';
      for (let i = 0; i < word.length; i++) read += p.cells[(y0 + dy * i) * 13 + (x0 + dx * i)];
      assert.equal(read, word, `seed ${seed}: ${word} is not at its recorded position`);
    }
  }
});

test('all 12 words place across every topic', () => {
  for (let i = 0; i < TOPICS.length; i++) {
    const p = build(i + 1, i);
    assert.equal(p.words.length, 12, `topic ${TOPICS[i][0]} placed ${p.words.length}`);
  }
});
```

In `tests/unit/rng.test.js`, change the import on line 3 and replace lines 39-50:

```js
import { makeRng, resolveSeed, resolveTopicIndex } from '../../src/rng.js';
```

```js
test('resolveTopicIndex clamps ?topic= into range', () => {
  const rng = makeRng(1);
  assert.equal(resolveTopicIndex('?topic=5', 100, rng), 5);
  assert.equal(resolveTopicIndex('?topic=999', 100, rng), 99);
  assert.equal(resolveTopicIndex('?topic=-4', 100, rng), 0);
});

test('resolveTopicIndex does not consume rng when ?topic= is explicit', () => {
  const rngA = makeRng(5), rngB = makeRng(5);
  resolveTopicIndex('?topic=3', 100, rngA);
  assert.equal(rngA.int(50), rngB.int(50), 'explicit ?topic= must not draw from rng');
});

// `?theme=` was the old name for this parameter and is deliberately NOT aliased —
// keeping it alive would reintroduce the ambiguity the rename removes.
test('the retired ?theme= parameter is ignored, not honoured', () => {
  const rng = makeRng(1);
  assert.equal(resolveTopicIndex('?theme=5', 100, rng), makeRng(1).int(100));
});
```

- [ ] **Step 3: Run the unit tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `SyntaxError: The requested module '../../src/rng.js' does not provide an export named 'resolveTopicIndex'`, and `Cannot find module '.../src/themes.js'` from the not-yet-updated `puzzle.test.js` import path is already fixed, so the failure there is `does not provide an export named 'TOPICS'`.

- [ ] **Step 4: Rename in `src/rng.js`**

Replace the header comment block (lines 1-6):

```js
// Seeding. Pure: no DOM, no `location` — the query string arrives as an argument
// so the same functions can be exercised from a plain unit test.
//
// Deterministic PRNG so a puzzle can be reproduced exactly. `?seed=N` pins the
// sequence, `?topic=N` pins the topic; with neither, the clock seeds it and the
// game behaves exactly as before. This is the shipped path, not a test-only branch.
```

Replace `resolveThemeIndex` (lines 51-63) with:

```js
/**
 * `?topic=N` clamped into range when present, else a random topic.
 * Note the asymmetry: the explicit branch must NOT touch `rng`, or pinning a topic
 * would shift the sequence and a pinned seed would produce a different grid.
 * @param {string} search @param {number} count @param {Rng} rng @returns {number}
 */
export function resolveTopicIndex(search, count, rng) {
  const v = new URLSearchParams(search).get('topic');
  if (v === null) return rng.int(count);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(count - 1, Math.max(0, n)) : 0;
}
```

- [ ] **Step 5: Rename in `src/puzzle.js`**

Replace lines 17-25:

```js
/**
 * Generate a puzzle. `placements` records where each word actually landed, so a
 * test can assert the grid really contains what the word list claims.
 * @param {{topics:[string,string][], topicIdx:number, rng:Rng, size:number, count:number}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ topics, topicIdx, rng, size, count }) {
  const name = topics[topicIdx][0];
  const pool = topics[topicIdx][1].split(',').filter(w => w.length <= size - 1);
```

- [ ] **Step 6: Run the unit tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS. `src/main.js` still imports `./themes.js` and is now broken, but no unit test loads it — that is Task 3's job.

- [ ] **Step 7: Commit**

```bash
git add src/topics.js src/rng.js src/puzzle.js tests/unit/rng.test.js tests/unit/puzzle.test.js
git commit -m "Rename theme -> topic in the pure modules

themes.js becomes topics.js, resolveThemeIndex becomes resolveTopicIndex
reading ?topic=, and buildPuzzle takes {topics, topicIdx}. ?theme= is
retired rather than aliased. main.js is left broken until the DOM layer
is renamed in a later commit."
```

---

### Task 2: Storage writes `topicIdx`, reads legacy `themeIdx`

A save written before this deploy carries `themeIdx`. Without a fallback, `restore()` passes `undefined` into `buildPuzzle`, which throws on `topics[undefined][0]` — a mid-game crash, not a graceful reset.

**Files:**

- Modify: `src/storage.js:6-25`
- Test: `tests/unit/storage.test.js`

**Interfaces:**

- Consumes: nothing from Task 1 at runtime; conceptually the `topicIdx` naming it settled.
- Produces: `SaveData = {seed:number, topicIdx:number, found:{word,x0,y0,x1,y1}[]}` — the shape `main.js` reads in Task 3.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/storage.test.js`, change every existing `themeIdx:` to `topicIdx:` (lines 12, 24, 31, 50), then append these three tests:

```js
// Saves written before the theme -> topic rename carry `themeIdx`. Dropping them
// would not merely lose the migration, it would hand `undefined` to buildPuzzle and
// crash on reload for anyone mid-game at deploy time.
test('a legacy save written with themeIdx loads as topicIdx', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, themeIdx: 5, found: [] }));
  assert.deepEqual(makeStorage(store).load(), { seed: 7, topicIdx: 5, found: [] });
});

test('topicIdx wins when a save somehow carries both keys', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, themeIdx: 5, topicIdx: 9, found: [] }));
  assert.deepEqual(makeStorage(store).load(), { seed: 7, topicIdx: 9, found: [] });
});

test('a save missing both index keys loads as topic 0, never undefined', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, found: [] }));
  assert.equal(makeStorage(store).load().topicIdx, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- --test-name-pattern="legacy save|both keys|missing both"`
Expected: FAIL — `load()` returns the raw parsed object, so the legacy case comes back as `{seed:7, themeIdx:5, found:[]}` and `deepEqual` reports the missing `topicIdx`.

- [ ] **Step 3: Implement the migration**

Replace `src/storage.js` lines 6-25 with:

```js
const KEY = 'wordfinder-save-v1';

/**
 * @typedef {{seed:number, topicIdx:number, found:{word:string,x0:number,y0:number,x1:number,y1:number}[]}} SaveData
 * @typedef {SaveData & {themeIdx?:number}} StoredSave
 */

/** @param {Pick<Storage,'getItem'|'setItem'|'removeItem'>|null} [store] */
export function makeStorage(store) {
  if (store === undefined) {
    try { store = /** @type {any} */ (globalThis).localStorage; } catch { store = null; }
  }
  return {
    /** @param {SaveData} data @returns {void} */
    save(data) { if (!store) return; try { store.setItem(KEY, JSON.stringify(data)); } catch { /* no persistence */ } },
    /** Saves written before the theme -> topic rename carry `themeIdx`; read both so a
     * game in progress at deploy time survives. `save()` only ever writes `topicIdx`.
     * The `?? 0` is not decoration: a save with neither key would otherwise hand
     * `undefined` to `buildPuzzle`, which throws rather than degrading.
     * @returns {SaveData|null} */
    load() {
      if (!store) return null;
      try {
        const s = store.getItem(KEY);
        if (!s) return null;
        const { themeIdx, ...rest } = /** @type {StoredSave} */ (JSON.parse(s));
        return { ...rest, topicIdx: rest.topicIdx ?? themeIdx ?? 0 };
      } catch { return null; }
    },
    /** @returns {void} */
    clear() { if (!store) return; try { store.removeItem(KEY); } catch { /* ignore */ } },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS, all storage tests included. Note `JSON.parse('null')` destructures to a `TypeError` that the existing `catch` already turns into `null`, so the malformed-JSON test still passes.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/unit/storage.test.js
git commit -m "Save topicIdx, migrating legacy themeIdx saves on read

A save from before the rename carries themeIdx; without the fallback,
restore() hands undefined to buildPuzzle and crashes on reload for anyone
mid-game at deploy time. The storage key is unchanged."
```

---

### Task 3: Rename through the DOM layer, and switch copy to "New game"

This is what unbreaks `main.js`. It also does the visible copy change and the title change, because they touch the same lines and a reviewer would judge them together.

**Files:**

- Modify: `index.html:6, 20-21, 35, 38, 40`
- Modify: `src/main.js:1-10, 51, 76, 88-104, 110-116, 225-250, 258-270, 276-291`
- Modify: `src/view.js:11-15` (the `Els` typedef)
- Modify: `sw.js:9-10` (`CACHE`, `ASSETS`)
- Modify: `manifest.webmanifest:2`
- Modify: `README.md`
- Test: `tests/e2e/smoke.spec.js:7`
- Test: `tests/e2e/ux.spec.js:4-5, 19`
- Test: `tests/e2e/gameplay.spec.js:51-67`
- Test: `tests/e2e/regressions.spec.js:7, 160`

**Interfaces:**

- Consumes: `TOPICS` from `src/topics.js`, `resolveTopicIndex` from `src/rng.js`, `buildPuzzle({topics, topicIdx, …})` from `src/puzzle.js` (Task 1); `SaveData.topicIdx` from `src/storage.js` (Task 2).
- Produces: the DOM contract later tasks build on — `#topic` for the topic name, `#newbtn` for "New game", and an `#hdr` whose right-hand side is ready to gain a second button.

- [ ] **Step 1: Update the e2e tests to the new names and copy — they must fail first**

`tests/e2e/smoke.spec.js`, line 7:

```js
  await expect(page.locator('#topic')).not.toHaveText('Loading…');
```

`tests/e2e/ux.spec.js`, lines 4-5 and 19:

```js
test('New game mid-game asks to confirm; cancel keeps the board', async ({ page }) => {
  await page.goto('/?seed=1&topic=0');
```

```js
  await page.goto('/?seed=1&topic=0');
```

`tests/e2e/gameplay.spec.js`, lines 50-67 — the pinned puzzle comment and both `#theme` reads:

```js
  // Seed 1 with topic 0 is pinned because it is known to contain a
  // diagonally-placed word; findDiagonalWord throws if none exist, and an
  // unseeded puzzle only has a diagonal word most of the time (not always).
  await page.goto('/?seed=1&topic=0');
  const sel = await findDiagonalWord(page);
  await dragCells(page, sel);
  await expect(page.locator('#count')).toContainText('1 of 12 found');
});

test('the same seed reproduces the same puzzle', async ({ page }) => {
  await page.goto('/?seed=12345&topic=0');
  const a = await page.locator('.cell').allTextContents();
  const topicA = await page.locator('#topic').textContent();
  await page.goto('/?seed=12345&topic=0');
  const b = await page.locator('.cell').allTextContents();
  expect(b.join('')).toBe(a.join(''));
  expect(await page.locator('#topic').textContent()).toBe(topicA);

  await page.goto('/?seed=999&topic=0');
```

`tests/e2e/regressions.spec.js`, line 7 and the stale module list on line 160:

```js
test('starting a new game during the win delay leaves the board playable', async ({ page }) => {
```

```js
  // module import graph (rng/puzzle/layout/view/effects/topics) actually ran, not
```

Then append a copy guard to `tests/e2e/ux.spec.js`:

```js
// "New theme" named an internal concept; "New game" names what the button does.
// Pinned as a test because the same word now means the UI's appearance elsewhere.
test('the visible copy talks about games, never themes', async ({ page }) => {
  await page.goto('/?seed=1&topic=0');
  await expect(page.locator('#newbtn')).toHaveText(/New game/);
  await expect(page.locator('#winbtn')).toHaveText(/Play a new game/);
  await expect(page.locator('#confirm p')).toHaveText(/Start a new game\?/);
  await expect(page.locator('#confirm-ok')).toHaveText('New game');
  await expect(page.locator('body')).not.toContainText(/theme/i);
});
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `npm run test:e2e`
Expected: FAIL — every test errors on page load, because `src/main.js` still imports the moved `./themes.js`. The browser console shows `Failed to resolve module specifier` / a 404 on `src/themes.js`.

- [ ] **Step 3: Update `index.html`**

Line 6, the title:

```html
<title>Word Finder</title>
```

Lines 19-22, the header — `#theme` becomes `#topic`, and the button copy changes:

```html
  <div id="hdr">
    <div><div id="kicker">WORD FINDER</div><div id="topic">Loading…</div></div>
    <button id="newbtn" type="button">&#8635; New game</button>
  </div>
```

Line 35, the win overlay button:

```html
  <button id="winbtn" type="button">Play a new game &#8594;</button>
```

Lines 38-40, the confirm dialog:

```html
  <p>Start a new game? Your progress will be lost.</p>
  <div><button id="confirm-cancel" type="button">Cancel</button>
  <button id="confirm-ok" type="button">New game</button></div>
```

- [ ] **Step 4: Update `src/view.js`'s `Els` typedef**

In the typedef block at lines 11-15, rename the `theme` member:

```js
 * @typedef {{
 *   app:HTMLElement, gridbox:HTMLElement, pills:HTMLElement, letters:HTMLElement, fx:HTMLElement,
 *   list:HTMLElement, main:HTMLElement, side:HTMLElement, count:HTMLElement,
 *   topic:HTMLElement, win:HTMLElement, winmsg:HTMLElement, confirm:HTMLElement, winclose:HTMLElement,
 * }} Els
```

- [ ] **Step 5: Update `src/main.js`**

Line 1 and the imports on lines 4-5:

```js
// Word Finder — wiring. This is the only module that owns mutable game
// state, reads the URL, or listens for events; everything it calls is either pure
// (rng, puzzle, layout) or a stateless renderer (view, effects).
import { TOPICS } from './topics.js';
import { makeRng, resolveSeed, resolveTopicIndex } from './rng.js';
```

Line 51, inside the `els` object literal:

```js
  topic: must('topic'), win: must('win'), winmsg: must('winmsg'),
```

Lines 75-76:

```js
/** @type {number} */
let topicIdx;
```

Lines 86-104, `newPuzzle` — the doc comment's reference to `newTheme` changes too:

```js
/** Every puzzle is built from its own fresh rng seeded by `seed`, never the
 * shared/advanced one — that's what lets a single stored seed reproduce an
 * identical grid later (see `restore`), and what makes `newGame` safe to
 * call repeatedly without drifting out of sync with what was last saved.
 * @param {number} seed @param {number} idx @returns {void} */
function newPuzzle(seed, idx) {
  currentSeed = seed;
  topicIdx = idx;
  const rng = makeRng(seed);
  justFound = null;
  state.found = {}; state.foundOrder = []; state.sel = null; state.miss = null; state.drag = null;
  state.puzzle = buildPuzzle({ topics: TOPICS, topicIdx: idx, rng, size: N, count: COUNT });
  els.topic.textContent = cap(state.puzzle.name);
```

Lines 106-116, `persist` and its comment:

```js
/** Save just enough to regenerate the identical grid on reload: the seed and
 * topic (from which `buildPuzzle` reproduces the same cells) plus each found
 * word's selection — not the 169 cells themselves.
 * @returns {void} */
function persist() {
  store.save({
    seed: currentSeed,
    topicIdx,
    found: state.foundOrder.map(w => ({ word: w, ...state.found[w].sel })),
  });
}
```

Lines 225-250, the two functions and the buttons wired to them:

```js
// A fresh topic is a player-facing surprise, so it stays on Math.random() rather
// than the seeded sequence — `?seed=` pins the puzzle you land on, not every one after.
// It also gets a fresh seed (not the old `currentSeed`): `newPuzzle` builds its own
// rng from scratch each time, so reusing the same seed here would reproduce the
// exact same word/placement choices for the new topic too.
/** @returns {void} */
function newGame() {
  /** @type {number} */
  let i;
  do { i = Math.floor(Math.random() * TOPICS.length); } while (i === topicIdx);
  newPuzzle(Date.now() >>> 0, i);
}
/** Mid-puzzle, an accidental tap on "New game" would silently wipe progress, so
 * confirm first; a fresh or fully-solved board has nothing to lose, so skip the
 * dialog and start immediately.
 * @returns {void} */
function requestNewGame() {
  const inProgress = state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  if (inProgress) { els.confirm.style.display = 'flex'; return; }
  newGame();
}
must('newbtn').addEventListener('click', requestNewGame);
must('confirm-cancel').addEventListener('click', () => { els.confirm.style.display = 'none'; });
must('confirm-ok').addEventListener('click', () => { els.confirm.style.display = 'none'; newGame(); });
must('winbtn').addEventListener('click', newGame);
```

Lines 258-270, the boot block:

```js
// Explicit `?seed=`/`?topic=` in the URL always wins (it's what the spec-1
// determinism e2e test relies on), even over a saved game — that's the whole
// point of pinning a puzzle by URL. Otherwise, prefer a saved game; only fall
// back to a fresh random puzzle when there's nothing to restore.
const params = new URLSearchParams(location.search);
if (params.has('seed') || params.has('topic')) {
  const seed = resolveSeed(location.search);
  newPuzzle(seed, resolveTopicIndex(location.search, TOPICS.length, makeRng(seed)));
} else {
  const saved = store.load();
  if (saved) restore(saved);
  else newPuzzle(Date.now() >>> 0, Math.floor(Math.random() * TOPICS.length));
}
```

Line 278, inside `restore`:

```js
  newPuzzle(saved.seed, saved.topicIdx); // regenerates the identical grid, empty found
```

- [ ] **Step 6: Update `sw.js`**

Lines 9-10 — the renamed module in `ASSETS`, and a cache bump so the rename is not served from a stale cache:

```js
const CACHE='wordfinder-v7';
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/topics.js','./src/storage.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
```

- [ ] **Step 7: Update `manifest.webmanifest`**

Line 2 only. `short_name` is already "Word Finder" and stays; `theme_color` and `background_color` stay at their dark values — they are read at install and splash time, before any script runs, and cannot follow a runtime preference.

```json
  "name": "Word Finder",
```

- [ ] **Step 8: Update `README.md`**

Four edits.

**The heading:** `# Themed Word Finder — PWA` → `# Word Finder — PWA`

**In the `src/` table**, two rows:

```markdown
| `src/rng.js` | Seeded PRNG and `?seed=` / `?topic=` resolution. | pure |
```

```markdown
| `src/topics.js` | The 100 topic word lists (content, not logic). Add a topic here. | data |
```

**The reproducible-puzzles section:**

```markdown
### Reproducible puzzles

`?seed=N` pins the puzzle, `?topic=N` pins the topic — e.g. `/?seed=1&topic=0`. With
neither, the clock seeds it and a random topic is chosen.

### Adding a topic

Append `["Name","WORD1,WORD2,..."]` to the array in `src/topics.js`. Words should be uppercase and ≤ 12 letters; 12 are drawn per puzzle.
```

**In the Development section**, the closing cross-reference:

```markdown
See [Reproducible puzzles](#reproducible-puzzles) above for `?seed=` / `?topic=`
— the same URL parameters the tests pin puzzles with.
```

- [ ] **Step 9: Run the full suite and the typechecker**

Run: `npm test && npm run typecheck`
Expected: PASS — all unit tests, all e2e tests on both the `desktop` and `mobile` projects, and `tsc --noEmit` silent. The precache test in `regressions.spec.js` proves `./src/topics.js` is listed in `ASSETS`; if Step 6 was missed it fails by name.

- [ ] **Step 10: Commit**

```bash
git add index.html src/main.js src/view.js sw.js manifest.webmanifest README.md tests/e2e
git commit -m "Rename theme -> topic in the DOM layer; buttons say New game

Completes the sweep: #theme becomes #topic, ?theme= becomes ?topic=,
newTheme becomes newGame, and the app drops 'Themed' from its title.
Visible copy now names the action (New game) rather than the internal
concept. sw.js cache bumped so the rename is not served stale."
```

---

### Task 4: Token layer — every colour becomes a custom property

No visible change. The dark palette is today's values, and light is defined but not yet reachable — a `data-appearance="light"` set by hand in devtools is the only way to see it. Isolating this from the toggle keeps the diff reviewable: this task is provably a no-op on the shipped look.

**Files:**

- Modify: `styles.css` (whole file)
- Modify: `src/view.js:18, 59-86` (delete `PAL`, pills take a class)
- Modify: `src/effects.js:16-24` (confetti reads the palette)
- Create: `tests/unit/tokens.test.js`
- Create: `tests/e2e/appearance.spec.js`

**Interfaces:**

- Consumes: the `Els` typedef renamed in Task 3.
- Produces:
  - CSS tokens `--bg`, `--surface`, `--border`, `--text`, `--text-strong`, `--muted`, `--label`, `--hint`, `--accent`, `--accent-text`, `--accent-hover`, `--accent-ink`, `--accent-wash`, `--scrim`, `--shadow`, `--card-shadow`, `--found-text`, `--done-text`, `--glow`, `--pill-1`…`--pill-4`, `--pill-sel`, `--pill-miss`, `--pill-edge`, `--confetti-1`…`--confetti-6`
  - The selector contract `:root, :root[data-appearance="light"]` and `:root[data-appearance="dark"]` — Task 5's `resolveAppearance` returns exactly the strings `'light'` and `'dark'` to match
  - `.pill` variants `.p1`…`.p4`, `.sel`, `.miss`

- [ ] **Step 1: Write the failing token-parity test**

A token defined in only one palette is invisible in code review and shows up as an unstyled element in one mode only. Create `tests/unit/tokens.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

const LIGHT = ':root, :root[data-appearance="light"]';
const DARK = ':root[data-appearance="dark"]';

/** The custom-property names declared inside the block that `selector` opens.
 * @param {string} selector @returns {Set<string>} */
function tokensIn(selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `no \`${selector}\` block in styles.css`);
  const open = css.indexOf('{', at), close = css.indexOf('}', open);
  return new Set([...css.slice(open, close).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
}

test('the light and dark palettes declare exactly the same tokens', () => {
  const light = tokensIn(LIGHT), dark = tokensIn(DARK);
  assert.deepEqual([...dark].filter(t => !light.has(t)), [], 'declared only in the dark palette');
  assert.deepEqual([...light].filter(t => !dark.has(t)), [], 'declared only in the light palette');
  assert.ok(light.size >= 25, `only ${light.size} tokens — did the palette blocks move?`);
});

test('every var() the stylesheet references is declared in the palettes', () => {
  const declared = tokensIn(LIGHT);
  const used = new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]));
  assert.deepEqual([...used].filter(t => !declared.has(t)), [], 'referenced but never declared');
});

// effects.js builds these names by template (`--confetti-${i}`), so no var() appears
// in the stylesheet for the parity test above to catch a missing one.
test('all six confetti slots exist in both palettes', () => {
  for (const block of [LIGHT, DARK]) {
    const t = tokensIn(block);
    for (let i = 1; i <= 6; i++) assert.ok(t.has(`--confetti-${i}`), `${block} is missing --confetti-${i}`);
  }
});

// The old palette lived as bare literals in styles.css, view.js and effects.js.
// Any survivor is a colour that cannot follow the appearance setting.
test('no bare hex literal survives outside the palette blocks', () => {
  const body = css.slice(css.indexOf('}', css.indexOf(DARK)) + 1);
  assert.deepEqual(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/unit/tokens.test.js`
Expected: FAIL — `no \`:root, :root[data-appearance="light"]\` block in styles.css`.

- [ ] **Step 3: Rewrite `styles.css` against the tokens**

Replace the whole file. The two palette blocks come first; every rule below references them and holds no literal colour.

```css
/* Two palettes, each written exactly once. `data-appearance` on <html> is always a
   RESOLVED value — `light` or `dark`, never `system`; src/appearance.js does the
   resolving. Doing it in JS rather than in a prefers-color-scheme media query is what
   keeps this to two blocks instead of four, with no chance of the copies drifting. */
:root, :root[data-appearance="light"]{
  --bg:#eef3f1; --surface:#ffffff; --border:#cfdcd7;
  --text:#1c3a31; --text-strong:#10241d; --muted:#5a736a; --label:#3f7d68; --hint:#6b8479;
  --accent:#17876a; --accent-text:#12684f; --accent-hover:#0d5741; --accent-ink:#ffffff;
  --accent-wash:rgba(23,135,106,.10);
  --scrim:rgba(20,40,34,.45);
  --shadow:0 6px 20px rgba(30,60,52,.14); --card-shadow:0 10px 40px rgba(30,60,52,.22);
  --found-text:#0b3a2c; --done-text:rgba(28,58,49,.55); --glow:rgba(23,135,106,.30);
  --pill-1:rgba(224,160,20,.34); --pill-2:rgba(40,150,210,.30);
  --pill-3:rgba(230,90,110,.30); --pill-4:rgba(150,100,225,.30);
  --pill-sel:rgba(23,135,106,.28); --pill-miss:rgba(220,50,50,.38);
  --pill-edge:rgba(20,50,42,.16);
  --confetti-1:#17876a; --confetti-2:#e0a014; --confetti-3:#2896d2;
  --confetti-4:#e65a6e; --confetti-5:#9664e1; --confetti-6:#6b8479;
}
/* Value for value, the palette the game shipped with. Any change here is a regression. */
:root[data-appearance="dark"]{
  --bg:#16262f; --surface:#1d2f3a; --border:#2c4250;
  --text:#dfe9e5; --text-strong:#eef6f2; --muted:#9fb8ae; --label:#6fa899; --hint:#7d968c;
  --accent:#4fd1a5; --accent-text:#8fe8c8; --accent-hover:#b8f5dd; --accent-ink:#0b2c20;
  --accent-wash:rgba(79,209,165,.12);
  --scrim:rgba(10,20,26,.72);
  --shadow:0 6px 20px rgba(6,20,28,.35); --card-shadow:0 10px 40px rgba(0,0,0,.5);
  --found-text:#eafff6; --done-text:rgba(223,233,229,.6); --glow:rgba(79,209,165,.42);
  --pill-1:rgba(240,196,90,.38); --pill-2:rgba(120,220,255,.33);
  --pill-3:rgba(255,140,150,.35); --pill-4:rgba(190,150,255,.36);
  --pill-sel:rgba(79,209,165,.30); --pill-miss:rgba(255,90,90,.5);
  --pill-edge:rgba(255,255,255,.25);
  --confetti-1:#4fd1a5; --confetti-2:#f0c45a; --confetti-3:#78dcff;
  --confetti-4:#ff8c96; --confetti-5:#be96ff; --confetti-6:#eef6f2;
}

/* Lock the viewport: no page scroll or rubber-band on iPad / iOS standalone. */
html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);font-family:'Atkinson Hyperlegible',sans-serif;overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
body{position:fixed;inset:0;width:100%;height:100%}
a{color:var(--accent-text)}a:hover{color:var(--accent-hover)}
#app{height:100%;display:grid;box-sizing:border-box;overflow:hidden;
  padding:calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));
  grid-template-columns:1fr;grid-template-areas:"hdr" "grid" "side";
  justify-items:center;align-content:start;gap:10px}
/* Rows: header hugs its own height (min-content) so its text sits at the top
   next to the grid's top edge; the list row takes all remaining height (1fr),
   which keeps the list directly under the header instead of floating at the
   grid's vertical centre. Without explicit rows both are `auto`, and the grid
   spanning both rows pushes half its height into each — centring the rail. */
#app[data-landscape]{grid-template-areas:"grid hdr" "grid side";grid-template-rows:min-content 1fr;align-content:start;justify-items:start;column-gap:20px;row-gap:4px}
/* Landscape phones give ~280-320px of total height for the whole right rail
   (header + list + hint), which the desktop/portrait chrome above doesn't fit
   into — measured directly: iPhone-class landscape overflowed #app by ~19-38px
   with the untrimmed rail. The hint is instructional, not gameplay-critical, so
   it's the first thing to go; the list also loses a little internal breathing
   room. Neither guard assertion (words visible, nothing clipped) needs it. */
#app[data-landscape] #hint{display:none}
#app[data-landscape] #listhdr{margin:2px 2px 4px}
#app[data-landscape] #list{gap:4px 14px}
#hdr{grid-area:hdr;width:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
#kicker{font-weight:700;font-size:11px;letter-spacing:.18em;color:var(--label)}
#topic{font-weight:700;font-size:28px;line-height:1.1;color:var(--text-strong)}
#newbtn{border:1.5px solid var(--accent);color:var(--accent-text);background:transparent;border-radius:999px;padding:9px 16px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;min-height:44px}
#newbtn:hover{background:var(--accent-wash)}
#main{display:contents}
#gridbox{grid-area:grid;position:relative;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);touch-action:none;cursor:pointer;flex:none}
#pills,#fx{position:absolute;inset:0;pointer-events:none}
/* Pill colours are class-driven so they live in the palette with everything else.
   They used to be rgba literals in view.js's PAL, tuned for a dark surface — at
   ~35% alpha on white paper they were all but invisible. */
.pill{position:absolute;border-radius:999px;box-shadow:inset 0 0 0 1px var(--pill-edge)}
.pill.p1{background:var(--pill-1)}
.pill.p2{background:var(--pill-2)}
.pill.p3{background:var(--pill-3)}
.pill.p4{background:var(--pill-4)}
.pill.sel{background:var(--pill-sel)}
.pill.miss{background:var(--pill-miss)}
.cell{position:absolute;text-align:center;font-weight:700;color:var(--text);pointer-events:none}
#side{grid-area:side;flex:none}
#listhdr{display:flex;justify-content:space-between;align-items:baseline;margin:2px 2px 8px}
#listhdr b{font-weight:700;font-size:12px;letter-spacing:.16em;color:var(--label)}
#count{font-size:13px;color:var(--muted)}
#list{display:grid;gap:6px 14px}
.w{justify-self:start;font-weight:700;font-size:17px;line-height:1.2;padding:4px 12px;border-radius:999px;cursor:default;color:var(--text)}
.w.done{text-decoration:line-through;color:var(--done-text)}
/* On find, the word glows green (fade in/out) for one beat, then main.js swaps
   this class for `.done` and it strikes through. Duration matches GLOW_MS.
   The 0%/100% stops are `transparent` rather than a token: the animation fades one
   colour between two alphas, and a second token would carry no extra information. */
.w.glow{color:var(--found-text);animation:foundGlow .9s ease}
@keyframes foundGlow{0%{background:transparent}45%{background:var(--glow)}100%{background:transparent}}
#hint{margin-top:8px;font-size:12px;line-height:1.4;color:var(--hint);max-width:280px}
#win{position:fixed;inset:0;background:var(--scrim);display:none;align-items:center;justify-content:center;z-index:50}
#wincard{position:relative;background:var(--surface);border:1px solid var(--accent);border-radius:20px;padding:34px 42px;text-align:center;animation:popIn .45s ease;box-shadow:var(--card-shadow)}
#wincard .big{font-size:44px}
#wincard h2{font-weight:700;font-size:26px;color:var(--text-strong);margin:8px 0 4px}
#wincard p{font-size:14.5px;color:var(--muted);margin:0 0 20px}
#winbtn{border:none;background:var(--accent);color:var(--accent-ink);border-radius:999px;padding:12px 22px;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer}
#winclose{position:absolute;top:0;right:0;width:44px;height:44px;border:none;background:transparent;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
#winclose:hover{color:var(--text-strong)}
@keyframes popIn{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
#confirm{position:fixed;inset:0;background:var(--scrim);display:none;align-items:center;justify-content:center;z-index:60}
#confirmcard{background:var(--surface);border:1px solid var(--accent);border-radius:20px;padding:34px 42px;text-align:center;animation:popIn .45s ease;box-shadow:var(--card-shadow)}
#confirmcard p{font-size:14.5px;color:var(--muted);margin:0 0 20px;max-width:260px}
#confirmcard div{display:flex;gap:12px;justify-content:center}
#confirm-cancel,#confirm-ok{border:none;border-radius:999px;padding:12px 22px;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer;min-height:44px}
#confirm-cancel{background:transparent;border:1.5px solid var(--accent);color:var(--accent-text)}
#confirm-ok{background:var(--accent);color:var(--accent-ink)}
@media (prefers-reduced-motion: reduce){
  #wincard{animation:none}
  .pill{transition:none}
  .w.glow{animation:none}
}
```

- [ ] **Step 4: Move the pill colours out of `src/view.js`**

Delete line 18 (`const PAL = …`) entirely. Replace `pillDiv` (lines 59-76) and `renderPills` (lines 78-86):

```js
// Which palette slot each found word gets, cycling. The colours themselves live in
// styles.css so they can follow the appearance setting; this module now holds none.
const PILL_CLASS = ['p1', 'p2', 'p3', 'p4'];

/** One rounded highlight bar laid over the cells of a selection.
 * @param {Selection} s @param {string} variant @param {number} cell @param {number} pad
 * @returns {HTMLDivElement} */
function pillDiv(s, variant, cell, pad) {
  const h = Math.round(cell * 0.82);
  const cx0 = pad + (s.x0 + 0.5) * cell, cy0 = pad + (s.y0 + 0.5) * cell;
  const cx1 = pad + (s.x1 + 0.5) * cell, cy1 = pad + (s.y1 + 0.5) * cell;
  const d = document.createElement('div');
  d.className = 'pill ' + variant;
  d.style.left = Math.round(cx0 - h / 2) + 'px';
  d.style.top = Math.round(cy0 - h / 2) + 'px';
  d.style.width = Math.round(Math.sqrt(Math.pow(cx1 - cx0, 2) + Math.pow(cy1 - cy0, 2)) + h) + 'px';
  d.style.height = h + 'px';
  d.style.transformOrigin = (h / 2) + 'px center';
  d.style.transform = 'rotate(' + Math.round(Math.atan2(cy1 - cy0, cx1 - cx0) * 180 / Math.PI) + 'deg)';
  return d;
}

/** Found-word pills in discovery order, plus the live selection on top.
 * @param {Els} els @param {GameState} state @param {LayoutDims} dims @param {number} pad
 * @returns {void} */
export function renderPills(els, state, dims, pad) {
  els.pills.innerHTML = '';
  state.foundOrder.forEach((w, i) => els.pills.appendChild(pillDiv(state.found[w].sel, PILL_CLASS[i % 4], dims.cell, pad)));
  if (state.sel) els.pills.appendChild(pillDiv(state.sel, 'sel', dims.cell, pad));
  if (state.miss) els.pills.appendChild(pillDiv(state.miss, 'miss', dims.cell, pad));
}
```

- [ ] **Step 5: Read the confetti palette from CSS in `src/effects.js`**

Replace lines 16-20 (the opening of `burst` through the `colors` array):

```js
export function burst(fxEl, s, count, dims, pad) {
  if (globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cell = dims.cell;
  const cx = pad + ((s.x0 + s.x1) / 2 + 0.5) * cell, cy = pad + ((s.y0 + s.y1) / 2 + 0.5) * cell;
  // Confetti lives in the palette so it can follow the appearance setting — the old
  // hardcoded set ended in a near-white that vanished on light paper. Read once per
  // burst rather than once per particle; getComputedStyle is not cheap.
  const cs = getComputedStyle(document.documentElement);
  const colors = [1, 2, 3, 4, 5, 6].map(i => cs.getPropertyValue('--confetti-' + i).trim());
```

- [ ] **Step 6: Write the e2e guard that pills are painted from the stylesheet**

Create `tests/e2e/appearance.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { findWordInGrid, dragCells } from './helpers.js';

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
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS. The dark palette is unchanged, so no existing assertion shifts. `tokens.test.js` passes all four cases.

- [ ] **Step 8: Pin the dark palette against the values the game shipped with**

Nothing sets `data-appearance` yet, so a screenshot at this point renders the light palette — which proves nothing about the constraint that matters. Assert the values directly instead. Append to `tests/e2e/appearance.spec.js`:

```js
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
```

Run: `npm run test:e2e -- tests/e2e/appearance.spec.js`
Expected: PASS. A failure here names the token that drifted.

- [ ] **Step 9: Commit**

```bash
git add styles.css src/view.js src/effects.js tests/unit/tokens.test.js tests/e2e/appearance.spec.js
git commit -m "Move every colour into a two-palette token layer

styles.css gains light and dark palettes selected by data-appearance on
<html>; every rule now references a var(). The two colour sets that lived
in JS move with them: view.js's PAL becomes .pill.p1-.p4/.sel/.miss classes,
and effects.js reads --confetti-1..6 at burst time. Dark is unchanged value
for value. Nothing sets data-appearance yet."
```

---

### Task 5: `src/appearance.js`

The preference model, with no knowledge of buttons, meta tags, or the header. Every side effect goes through an injected dependency, so the whole module is exercised by `node:test` without a browser — the same shape as `makeStorage()`.

**Files:**

- Create: `src/appearance.js`
- Test: `tests/unit/appearance.test.js`

**Interfaces:**

- Consumes: the `data-appearance` value contract from Task 4 — `resolveAppearance` must return exactly `'light'` or `'dark'`.
- Produces:
  - `PREF_KEY: 'wordfinder-appearance'`
  - `PREFS: readonly ['system','light','dark']` — also the cycle order
  - `normalizePref(pref: string|null|undefined): Pref`
  - `nextPref(pref: Pref): Pref`
  - `resolveAppearance(pref: Pref, prefersDark: boolean): 'light'|'dark'`
  - `appearanceLabel(pref: Pref, mode: Mode): string`
  - `makeAppearance(deps?): {get(): Pref, set(p: Pref): void, cycle(): Pref, start(): void}`

  Deps are `{store?, root?, query?, onApply?}`, where `query` is `{matches: boolean, subscribe: (listener: () => void) => void} | null`.

  Two deliberate departures from the sketch in the spec:

  - The spec listed a `meta` dependency. Writing `<meta name="theme-color">` is a page-shape concern, so it moves to `main.js` behind the `onApply(pref, mode)` callback and this module stays agnostic about what the page looks like.
  - `query` is that two-member shape rather than a `MediaQueryList`. `tsconfig.json` runs `strict` over `src/`, and structurally typing the real `MediaQueryList.addEventListener` — an overloaded method keyed on `"change"` — is a variance argument with the compiler for no benefit. Narrowing it at the boundary also means a unit test injects a plain object with no DOM in it at all.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/appearance.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS, PREF_KEY, normalizePref, nextPref, resolveAppearance, appearanceLabel, makeAppearance,
} from '../../src/appearance.js';

function memStore() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) };
}
/** A stand-in for the narrowed prefers-color-scheme query. `flipTo` is the test's
 * handle on an OS appearance change; the module only ever sees matches/subscribe. */
function fakeQuery(matches = false) {
  const listeners = [];
  return {
    matches,
    subscribe(l) { listeners.push(l); },
    flipTo(v) { this.matches = v; listeners.forEach(l => l()); },
  };
}
const fakeRoot = () => ({ dataset: {} });

test('the cycle is system -> light -> dark -> system', () => {
  assert.deepEqual([...PREFS], ['system', 'light', 'dark']);
  assert.equal(nextPref('system'), 'light');
  assert.equal(nextPref('light'), 'dark');
  assert.equal(nextPref('dark'), 'system');
});

test('normalizePref falls back to system for anything unrecognised', () => {
  assert.equal(normalizePref('dark'), 'dark');
  assert.equal(normalizePref(null), 'system');
  assert.equal(normalizePref(''), 'system');
  assert.equal(normalizePref('sepia'), 'system');
});

test('resolveAppearance pins light and dark, and defers only for system', () => {
  assert.equal(resolveAppearance('light', true), 'light');
  assert.equal(resolveAppearance('dark', false), 'dark');
  assert.equal(resolveAppearance('system', true), 'dark');
  assert.equal(resolveAppearance('system', false), 'light');
});

test('appearanceLabel names the preference, and what system resolved to', () => {
  assert.equal(appearanceLabel('system', 'dark'), 'Appearance: System (Dark)');
  assert.equal(appearanceLabel('system', 'light'), 'Appearance: System (Light)');
  assert.equal(appearanceLabel('light', 'light'), 'Appearance: Light');
  assert.equal(appearanceLabel('dark', 'dark'), 'Appearance: Dark');
});

test('start() applies the resolved mode to the root element', () => {
  const root = fakeRoot();
  makeAppearance({ store: memStore(), root, query: fakeQuery(true) }).start();
  assert.equal(root.dataset.appearance, 'dark');
});

test('the preference persists and is read back on construction', () => {
  const store = memStore(), query = fakeQuery(true);
  makeAppearance({ store, root: fakeRoot(), query }).set('light');
  assert.equal(store.getItem(PREF_KEY), 'light');

  const root = fakeRoot();
  const a = makeAppearance({ store, root, query });
  a.start();
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light', 'a stored preference must beat the OS');
});

test('cycle() advances one step and returns the new preference', () => {
  const a = makeAppearance({ store: memStore(), root: fakeRoot(), query: fakeQuery(false) });
  assert.equal(a.get(), 'system');
  assert.equal(a.cycle(), 'light');
  assert.equal(a.cycle(), 'dark');
  assert.equal(a.cycle(), 'system');
});

test('while system, an OS change repaints; once pinned, it does not', () => {
  const root = fakeRoot(), query = fakeQuery(false);
  const a = makeAppearance({ store: memStore(), root, query });
  a.start();
  assert.equal(root.dataset.appearance, 'light');

  query.flipTo(true);
  assert.equal(root.dataset.appearance, 'dark', 'system must follow the OS');

  a.set('light');
  query.flipTo(false);
  query.flipTo(true);
  assert.equal(root.dataset.appearance, 'light', 'a pinned preference must ignore the OS');
});

test('onApply reports both the preference and the resolved mode', () => {
  /** @type {[string,string][]} */
  const seen = [];
  const a = makeAppearance({
    store: memStore(), root: fakeRoot(), query: fakeQuery(true),
    onApply: (pref, mode) => seen.push([pref, mode]),
  });
  a.start();
  a.set('light');
  assert.deepEqual(seen, [['system', 'dark'], ['light', 'light']]);
});

test('a throwing store degrades to "not remembered" rather than throwing', () => {
  const bad = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  const root = fakeRoot();
  /** @type {ReturnType<typeof makeAppearance>} */
  let a;
  assert.doesNotThrow(() => { a = makeAppearance({ store: bad, root, query: fakeQuery(true) }); });
  assert.equal(a.get(), 'system');
  assert.doesNotThrow(() => a.set('light'));
  assert.equal(root.dataset.appearance, 'light', 'the setting still applies for this session');
});

test('a missing matchMedia resolves system to light instead of throwing', () => {
  const root = fakeRoot();
  const a = makeAppearance({ store: memStore(), root, query: null });
  assert.doesNotThrow(() => a.start());
  assert.equal(root.dataset.appearance, 'light');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/unit/appearance.test.js`
Expected: FAIL — `Cannot find module '.../src/appearance.js'`.

- [ ] **Step 3: Write the module**

Create `src/appearance.js`:

```js
// Appearance (light / dark / system). Split like storage.js: the two real decisions
// are pure functions any unit test can call, and every side effect goes through an
// injectable dependency, so nothing here needs a browser to exercise.
//
// This module deliberately knows nothing about the header button or the theme-color
// meta tag — those are page shape, and reach it through the `onApply` callback.

export const PREF_KEY = 'wordfinder-appearance';
/** The three settings, in the order the header button cycles through them. */
/** @type {readonly ['system','light','dark']} */
export const PREFS = ['system', 'light', 'dark'];

/**
 * @typedef {'system'|'light'|'dark'} Pref
 * @typedef {'light'|'dark'} Mode
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{matches:boolean, subscribe:(listener:()=>void)=>void}} DarkQuery
 * @typedef {{dataset:{appearance?:string}}} Root
 */

/** @param {string} s @returns {string} */
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Anything unrecognised — a null read, a hand-edited localStorage value, a
 * setting from a future build — falls back to `system` rather than propagating.
 * @param {string|null|undefined} pref @returns {Pref} */
export function normalizePref(pref) {
  return /** @type {readonly string[]} */ (PREFS).includes(/** @type {string} */ (pref))
    ? /** @type {Pref} */ (pref)
    : 'system';
}

/** The next step in the System -> Light -> Dark -> System cycle.
 * @param {Pref} pref @returns {Pref} */
export function nextPref(pref) {
  const i = PREFS.indexOf(normalizePref(pref));
  return PREFS[(i + 1) % PREFS.length];
}

/** The concrete appearance a preference resolves to; only `system` consults the OS.
 * The return values are exactly the `data-appearance` values styles.css selects on.
 * @param {Pref} pref @param {boolean} prefersDark @returns {Mode} */
export function resolveAppearance(pref, prefersDark) {
  if (pref === 'light' || pref === 'dark') return pref;
  return prefersDark ? 'dark' : 'light';
}

/** Label for the button's aria-label and tooltip. `System` also reports what it
 * currently resolved to, which is the one case the icon alone can't tell you.
 * @param {Pref} pref @param {Mode} mode @returns {string} */
export function appearanceLabel(pref, mode) {
  return pref === 'system'
    ? `Appearance: System (${title(mode)})`
    : `Appearance: ${title(pref)}`;
}

/** The real prefers-color-scheme query, narrowed to the two things this module
 * needs. Narrowing at the boundary keeps `MediaQueryList` — an overloaded,
 * event-map-keyed DOM type — out of the injectable surface, and lets a unit test
 * hand in a plain object with no DOM in it at all.
 * @returns {DarkQuery|null} */
function systemQuery() {
  if (!globalThis.matchMedia) return null;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  return {
    get matches() { return mq.matches; },
    // MediaQueryList.addEventListener needs Safari 14+. That is already below this
    // app's floor — Element.animate in effects.js requires 13.1, ES modules 10.1 —
    // so the deprecated addListener spelling is not worth carrying.
    subscribe(listener) { mq.addEventListener('change', () => listener()); },
  };
}

/**
 * @param {{store?:PrefStore|null, root?:Root, query?:DarkQuery|null, onApply?:(pref:Pref, mode:Mode)=>void}} [deps]
 */
export function makeAppearance(deps = {}) {
  let store = deps.store;
  if (store === undefined) {
    try { store = /** @type {any} */ (globalThis).localStorage; } catch { store = null; }
  }
  const root = deps.root || document.documentElement;
  const query = deps.query === undefined ? systemQuery() : deps.query;
  const onApply = deps.onApply || (() => {});

  /** @type {Pref} */
  let pref = 'system';
  // A disabled, full or throwing store must degrade to "appearance not remembered",
  // never into the game — same contract as makeStorage.
  try { pref = normalizePref(store ? store.getItem(PREF_KEY) : null); } catch { pref = 'system'; }

  /** @returns {void} */
  function apply() {
    const mode = resolveAppearance(pref, !!(query && query.matches));
    root.dataset.appearance = mode;
    onApply(pref, mode);
  }

  /** @param {Pref} p @returns {void} */
  function set(p) {
    pref = normalizePref(p);
    try { if (store) store.setItem(PREF_KEY, pref); } catch { /* not remembered */ }
    apply();
  }

  // Deliberately plain functions closing over `pref` rather than methods using
  // `this`, so a destructured `const {cycle} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    set,
    /** @returns {Pref} */
    cycle() { set(nextPref(pref)); return pref; },
    /** Apply now, then keep following the OS for as long as the preference is `system`.
     * @returns {void} */
    start() {
      apply();
      if (query) query.subscribe(() => { if (pref === 'system') apply(); });
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/unit/appearance.test.js && npm run typecheck`
Expected: PASS, 11 tests, and `tsc --noEmit` silent.

- [ ] **Step 5: Commit**

```bash
git add src/appearance.js tests/unit/appearance.test.js
git commit -m "Add src/appearance.js: the light/dark/system preference model

Pure nextPref/resolveAppearance/describe plus a makeAppearance factory whose
store, root, media query and apply callback are all injectable, so the whole
module unit-tests without a browser. Nothing wires it up yet."
```

---

### Task 6: Wire the button, and kill the flash

**Files:**

- Modify: `index.html:5-6` (inline resolver), `index.html:19-22` (header markup)
- Modify: `styles.css` (append the `#actions` / `#appearance` rules)
- Modify: `src/main.js:10` (import), `src/main.js:47-53` (`els`), and a new wiring block near the other button listeners
- Modify: `src/view.js` (the `Els` typedef gains `appearance`)
- Modify: `sw.js:10` (`ASSETS`)
- Modify: `README.md` (file table)
- Test: `tests/e2e/appearance.spec.js` (append)

**Interfaces:**

- Consumes: `makeAppearance`, `describe` from `src/appearance.js` (Task 5); `--bg` and the `data-appearance` selectors from `styles.css` (Task 4); `#hdr` from Task 3.
- Produces: the finished feature. Nothing downstream.

- [ ] **Step 1: Write the failing e2e tests**

Append to `tests/e2e/appearance.spec.js`:

```js
const modeOf = (page) => page.evaluate(() => document.documentElement.dataset.appearance);
const prefOf = (page) => page.locator('#appearance').getAttribute('data-pref');
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// The page background alone would still pass if a token were declared in only one
// palette; sampling a grid letter too covers the content, not just the canvas.
const inkOf = (page) => page.locator('.cell').first().evaluate(el => getComputedStyle(el).color);

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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:e2e -- tests/e2e/appearance.spec.js`
Expected: FAIL — `locator('#appearance')` resolves to nothing; the first assertion times out waiting for `data-pref`.

- [ ] **Step 3: Add the inline resolver to `index.html`**

Insert immediately after the viewport meta (line 5) and **before** the `<link rel="stylesheet">`, so the attribute is on `<html>` by the time the stylesheet is applied:

```html
<!-- Resolves the appearance before first paint. src/main.js is a module and therefore
     deferred, so without this a dark-mode player gets a flash of the light palette on
     every single load. This deliberately duplicates the rule in src/appearance.js
     (resolveAppearance, and the 'wordfinder-appearance' key) — there is no module-based
     equivalent that runs early enough. Keep the two in step; the "module blocked
     entirely" test in tests/e2e/appearance.spec.js guards this one. -->
<script>try{var p=localStorage.getItem('wordfinder-appearance')||'system';document.documentElement.dataset.appearance=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p}catch(e){}</script>
```

- [ ] **Step 4: Add the button markup**

Replace the `#hdr` block (lines 19-22 after Task 3). The two buttons need a flex wrapper because `#hdr` uses `justify-content: space-between` against what is currently a single right-hand child:

```html
  <div id="hdr">
    <div><div id="kicker">WORD FINDER</div><div id="topic">Loading…</div></div>
    <div id="actions">
      <button id="appearance" type="button" data-pref="system" title="Appearance: System" aria-label="Appearance: System">
        <svg class="i-system" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="solid" d="M12 3a9 9 0 0 0 0 18z"/></svg>
        <svg class="i-light" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/></svg>
        <svg class="i-dark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>
      </button>
      <button id="newbtn" type="button">&#8635; New game</button>
    </div>
  </div>
```

Inline SVG rather than the `☀` / `☾` characters: iOS renders those as colour emoji, which would sit badly next to the flat outlined button beside them.

- [ ] **Step 5: Style the button**

Append to `styles.css`, immediately after the `#newbtn:hover` rule:

```css
#actions{display:flex;align-items:center;gap:8px}
#appearance{flex:none;width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center;
  border:1.5px solid var(--accent);border-radius:999px;background:transparent;color:var(--accent-text);cursor:pointer}
#appearance:hover{background:var(--accent-wash)}
/* All three icons ship in the markup; the button's data-pref picks one. Doing it in
   CSS keeps main.js from assembling HTML strings on every click. */
#appearance svg{display:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#appearance svg .solid{fill:currentColor;stroke:none}
#appearance[data-pref="system"] .i-system,
#appearance[data-pref="light"] .i-light,
#appearance[data-pref="dark"] .i-dark{display:block}
```

- [ ] **Step 6: Wire it in `src/main.js`**

Add to the imports after line 10:

```js
import { makeAppearance, appearanceLabel } from './appearance.js';
```

Add `appearance` to the `els` object (it is a plain button, so `must()` covers it) — extend the literal at lines 48-53:

```js
  confirm: must('confirm'), winclose: must('winclose'), appearance: must('appearance'),
```

Add the matching member to the `Els` typedef in `src/view.js`:

```js
 *   topic:HTMLElement, win:HTMLElement, winmsg:HTMLElement, confirm:HTMLElement,
 *   winclose:HTMLElement, appearance:HTMLElement,
```

Then add this block immediately after the `els.win.addEventListener('click', …)` line (around line 252), keeping it with the other event wiring:

```js
// Appearance. `appearance.js` owns the preference and resolves it onto <html>; this
// callback is the page-shaped half — the button's icon and label, and the status-bar
// colour. The colour is read back off the resolved palette rather than duplicated
// here, so a future palette edit has exactly one home.
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const appearance = makeAppearance({
  onApply(pref, mode) {
    els.appearance.dataset.pref = pref;
    const label = appearanceLabel(pref, mode);
    els.appearance.title = label;
    els.appearance.setAttribute('aria-label', label);
    if (themeColorMeta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      themeColorMeta.setAttribute('content', bg);
    }
  },
});
appearance.start();
els.appearance.addEventListener('click', () => appearance.cycle());
```

- [ ] **Step 7: Add the module to the precache list**

`sw.js`, line 10 — `regressions.spec.js` fails by name if this is missed:

```js
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/topics.js','./src/storage.js','./src/appearance.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
```

- [ ] **Step 8: Update the README file table**

Two rows change and one is added:

```markdown
| `index.html` | Markup, plus a short inline script that resolves the appearance before first paint. |
```

```markdown
| `src/appearance.js` | Light / dark / system preference: resolve, persist, follow the OS. | DOM |
```

- [ ] **Step 9: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS on both the `desktop` and `mobile` Playwright projects.

- [ ] **Step 10: Check the landscape header did not wrap**

The right-hand rail on a landscape phone has only ~280–320px of height, and `#hdr` already uses `flex-wrap`. A second 44px button is the most likely thing in this plan to break layout.

Run: `npm run test:e2e -- tests/e2e/layout.spec.js`
Expected: PASS — the overflow assertions in that spec are what catch a wrapped header stealing list height.

If it fails, the fallback is to hide the button's label text in landscape only — add to `styles.css`:

```css
/* Landscape phones cannot afford both button labels on one row; the glyph alone
   still reads, and the confirm dialog spells out what it does. */
#app[data-landscape] #newbtn{font-size:0;padding:9px 14px}
#app[data-landscape] #newbtn::before{content:'\21BB';font-size:16px}
```

- [ ] **Step 11: Verify both modes by eye**

```bash
node tests/server.mjs &
npx playwright screenshot --viewport-size=1440,900 --color-scheme=dark "http://localhost:5173/?seed=1&topic=0" /tmp/wf-dark.png
npx playwright screenshot --viewport-size=1440,900 --color-scheme=light "http://localhost:5173/?seed=1&topic=0" /tmp/wf-light.png
kill %1
```

Expected: dark is pixel-identical to the pre-change game. Light is legible throughout — check specifically the outlined "New game" border, the `WORDS` label, the hint text, and (after finding a word) that the pill is clearly visible against white.

- [ ] **Step 12: Commit and push**

```bash
git add index.html styles.css src/main.js src/view.js src/appearance.js sw.js README.md tests/e2e/appearance.spec.js
git commit -m "Add a light/dark/system appearance toggle to the header

A 44px button left of New game cycles System -> Light -> Dark, with the
preference in its own localStorage key and a matchMedia listener so System
tracks the OS live. An inline head script resolves it before first paint,
which is what stops a dark-mode player seeing a white flash on every load."
git push
```

- [ ] **Step 13: Verify against the deployed site**

GitHub Pages takes 1–3 minutes to build. Then:

Run: `npm run test:live`
Expected: PASS — this is the only check that proves the service worker registers on the real origin and that every newly precached path (`./src/topics.js`, `./src/appearance.js`) actually resolves there.

Then open `https://beeberbab.github.io/word-finder/` and hard-reload, clearing the service worker cache first (DevTools → Application → Service Workers → Unregister, then reload). The `v6` → `v7` cache bump handles this for real visitors, but a developer's browser may hold the old worker.

---

## Verification summary

| Command | Covers |
| --- | --- |
| `npm run test:unit` | rng, puzzle, layout, storage, tokens, appearance |
| `npm run test:e2e` | smoke, gameplay, layout, regressions, ux, appearance — on desktop and mobile |
| `npm run typecheck` | every JSDoc type in `src/`, `tests/`, `sw.js` |
| `npm run test:live` | service-worker registration and precache resolution on GitHub Pages |
