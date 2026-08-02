# Word coverage tracking, ghost-match fix, and Light/Dark only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a word-matching bug that misfires on 30% of puzzles, reduce the appearance
control to Light/Dark, and add per-subject word-coverage tracking that steers both which
subject is dealt and which words it draws.

**Architecture:** A new pure module `src/progress.js` holds a per-subject shuffle bag in
`localStorage` under its own key, with merge-tolerant validation. `src/puzzle.js` gains an
optional `undrawn` Set so word selection can prefer unseen words while staying pure and
stateless. `src/main.js` wires the two together. Nothing else changes shape.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. Types via JSDoc checked
by `tsc --noEmit`. Tests: `node:test` for pure modules, Playwright for e2e.

**Spec:** [docs/superpowers/specs/2026-08-02-progress-tracking-design.md](../specs/2026-08-02-progress-tracking-design.md)

## Global Constraints

- **No new dependencies.** devDependencies stay exactly `@playwright/test` and `typescript`.
  Do not install `@types/node`. Do not add a coverage library — Node's built-in
  `--experimental-test-coverage` is the tool.
- **No build step.** The repo's files are byte-for-byte what GitHub Pages serves.
- **Types come from JSDoc**, `checkJs` and `strict` are on. Every new export needs a JSDoc
  type annotation or `tsc --noEmit` fails.
- **The pure/DOM split is load-bearing.** `rng`, `puzzle`, `layout`, `storage`, `catalog`,
  `subjects` and the new `progress` must not touch `document`, `window`, or `localStorage`
  directly — storage arrives as an injected argument.
- **A new module in `src/` must be added to the `ASSETS` array in `sw.js`.** The PostToolUse
  hook blocks on this. `src/subjects/*` is the exception and must stay OUT.
- **Unit test coverage must stay at or above 90%** lines, branches and functions for the
  pure modules, enforced by the hook from Task 1 onward.
- **Commits** are authored by repo git config (`BeeBeRBaB <puchkiray@outlook.com>`), carry no
  `Co-Authored-By` trailer, and use imperative subjects, often two clauses joined by "and".
- **Never count letters by eye.** If any step needs word lengths, script it.
- The PostToolUse hook runs after every edit to `src/*.js`, `sw.js`, `styles.css` or
  `index.html`. It takes ~0.7s and blocks on failure, so unit tests and `tsc` do not need
  running by hand.

---

### Task 1: Enforce a 90% coverage floor

**Files:**
- Modify: `package.json`
- Modify: `.claude/hooks/verify.sh:64`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run test:unit` and the PostToolUse hook both fail below 90% line, branch or
  function coverage. Later tasks rely on this to catch untested code as it lands.

Measured before writing this plan: the pure modules are at **99.22% lines, 93.53% branches,
97.18% functions**, so the floor passes today and is a regression guard rather than a
target to climb to. Coverage costs **30ms** (0.14s → 0.17s), which is why it can go in the
hook rather than only at push time.

`src/subjects/**` is excluded because it is data, not code — 25 files of string constants
that would dominate the average and never contain a branch. `tools/**` and `tests/**` are
excluded as dev-only.

- [ ] **Step 1: Prove the gate can fail before trusting it**

Run the command with an impossible threshold. If this does not fail, the flags are wrong and
nothing below is worth doing.

```bash
node --test --experimental-test-coverage \
  --test-coverage-exclude='tests/**' \
  --test-coverage-exclude='tools/**' \
  --test-coverage-exclude='src/subjects/**' \
  --test-coverage-lines=100 --test-coverage-branches=100 --test-coverage-functions=100
echo "exit=$?"
```

Expected: non-zero exit, and a line naming the shortfall. Branch coverage is 93.53%, so 100%
must fail.

- [ ] **Step 2: Confirm it passes at 90**

```bash
node --test --experimental-test-coverage \
  --test-coverage-exclude='tests/**' \
  --test-coverage-exclude='tools/**' \
  --test-coverage-exclude='src/subjects/**' \
  --test-coverage-lines=90 --test-coverage-branches=90 --test-coverage-functions=90
echo "exit=$?"
```

Expected: `exit=0`.

- [ ] **Step 3: Wire it into package.json**

Replace the `test:unit` line. Keep `test` and the others as they are.

```json
    "test:unit": "node --test --experimental-test-coverage --test-coverage-exclude='tests/**' --test-coverage-exclude='tools/**' --test-coverage-exclude='src/subjects/**' --test-coverage-lines=90 --test-coverage-branches=90 --test-coverage-functions=90",
```

- [ ] **Step 4: Wire it into the hook**

`.claude/hooks/verify.sh:64` currently reads `if ! out=$(node --test 2>&1); then`. The
comment above it explains it calls node directly rather than `npm run` to save ~150ms; that
reasoning still holds, so the flags are repeated rather than shelling out to npm.

```bash
if ! out=$(node --test --experimental-test-coverage \
    --test-coverage-exclude='tests/**' \
    --test-coverage-exclude='tools/**' \
    --test-coverage-exclude='src/subjects/**' \
    --test-coverage-lines=90 --test-coverage-branches=90 --test-coverage-functions=90 2>&1); then
```

Update the cost comment at line 6 from `unit tests 0.2s` to `unit tests 0.2s incl. coverage`.

- [ ] **Step 5: Document it**

In `README.md`, under the Development command list, change the `npm run test:unit` line to:

```text
npm run test:unit           # fast, no browser; fails under 90% coverage of the pure modules
```

- [ ] **Step 6: Verify the hook actually blocks**

Temporarily add an uncovered function to `src/rng.js`, save it, and confirm the hook fails.
Then remove it. A gate that has never been seen to fail has not been tested.

```js
export function __coverageProbe(a, b) { if (a) { return b; } return null; }
```

- [ ] **Step 7: Commit**

```bash
git add package.json .claude/hooks/verify.sh README.md
git commit -m "Gate the unit suite at 90% coverage, and run it in the hook

Node's built-in coverage needs no dependency and costs 30ms on top of
the 0.14s suite, which is cheap enough to run after every edit rather
than only before a push. src/subjects is excluded as data, not code.
The pure modules measure 99.2/93.5/97.2 today, so this is a
regression guard rather than a target."
```

---

### Task 2: Match a word by its cell run, not its letters

**Files:**
- Modify: `src/puzzle.js` (`matchWord`, plus a new `runKey` export)
- Modify: `src/main.js:246`
- Test: `tests/unit/puzzle.test.js`
- Test: `tests/e2e/regressions.spec.js`

**Interfaces:**
- Consumes: `Placement` and `Selection` typedefs already in `src/puzzle.js`.
- Produces: `runKey(size, sel) -> string` and
  `matchWord(placements, found, size, sel) -> string|null`. **This is a breaking signature
  change** — the old `matchWord(words, found, str)` is gone. Task 7 does not re-touch it.

**The bug.** `matchWord` identified a word by its letters alone:

```js
for (const w of words) if (!found[w] && (w === str || w === rev)) return w;
```

A word's letters can appear where the word is not — inside a longer word, or by chance in the
filler. Dragging there marked it found at the wrong place, and its real placement then failed
to match and flashed as a miss on a word that is genuinely there.

Measured on the real corpus: **581 of 600 subjects** contain a word inside another of their
own words (2,791 pairs — `CAT in TOMCAT`, `HORSE in HORSESHOE`, `LAB in LABRADOR`), and
**30% of dealt puzzles** contain at least one word readable at a run that is not its
placement.

Identity becomes the **cell run**. Two points determine one straight run, so the two
endpoints — unordered, so a word dragged backwards is the same run — are an exact O(1) key.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/puzzle.test.js`. Import `matchWord` and `runKey` from `../../src/puzzle.js`.

```js
test('a word is not matched at a run that is not its placement', () => {
  // HARDWOOD across the top row; WOOD placed on its own, five rows down.
  const placements = [
    { word: 'HARDWOOD', x0: 0, y0: 0, dx: 1, dy: 0 },
    { word: 'WOOD', x0: 0, y0: 5, dx: 1, dy: 0 },
  ];
  // Cells 4..7 of row 0 spell WOOD, but that is HARDWOOD's tail, not WOOD's placement.
  assert.equal(matchWord(placements, {}, 13, { x0: 4, y0: 0, x1: 7, y1: 0 }), null);
  // WOOD's real placement still matches.
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 5, x1: 3, y1: 5 }), 'WOOD');
});

test('two words sharing cells are both findable, in either order', () => {
  // WOOD sits exactly on HARDWOOD's last four cells -- a legal overlap.
  const placements = [
    { word: 'HARDWOOD', x0: 0, y0: 0, dx: 1, dy: 0 },
    { word: 'WOOD', x0: 4, y0: 0, dx: 1, dy: 0 },
  ];
  /** @type {Record<string, boolean>} */
  const found = {};
  assert.equal(matchWord(placements, found, 13, { x0: 4, y0: 0, x1: 7, y1: 0 }), 'WOOD');
  found.WOOD = true;
  assert.equal(matchWord(placements, found, 13, { x0: 0, y0: 0, x1: 7, y1: 0 }), 'HARDWOOD',
    'finding the short word must not consume the long one');
});

test('a word dragged backwards is the same run as forwards', () => {
  const placements = [{ word: 'STAR', x0: 2, y0: 3, dx: 1, dy: 0 }];
  assert.equal(matchWord(placements, {}, 13, { x0: 2, y0: 3, x1: 5, y1: 3 }), 'STAR');
  assert.equal(matchWord(placements, {}, 13, { x0: 5, y0: 3, x1: 2, y1: 3 }), 'STAR');
});

test('a diagonal placement matches only its own run', () => {
  const placements = [{ word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 1 }];
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 2, y1: 2 }), 'CAT');
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), null);
});

test('an already-found word is skipped', () => {
  const placements = [{ word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 0 }];
  assert.equal(matchWord(placements, { CAT: true }, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), null);
});

test('runKey is direction-independent and distinguishes different runs', () => {
  assert.equal(runKey(13, { x0: 1, y0: 0, x1: 4, y1: 0 }), runKey(13, { x0: 4, y0: 0, x1: 1, y1: 0 }));
  assert.notEqual(runKey(13, { x0: 1, y0: 0, x1: 4, y1: 0 }), runKey(13, { x0: 1, y0: 0, x1: 4, y1: 3 }));
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --test tests/unit/puzzle.test.js`
Expected: FAIL — `runKey is not a function`, and the `matchWord` calls fail because the third
argument is a number where a string is expected.

- [ ] **Step 3: Implement**

In `src/puzzle.js`, replace the whole `matchWord` function (currently lines 172-176, with its
doc comment above it) with:

```js
/** A cell run's identity: its two endpoints, unordered. Two points determine exactly one
 * straight run, so this is an exact key rather than a heuristic, and a word dragged
 * backwards keys the same as forwards.
 * @param {number} size @param {Selection} sel @returns {string} */
export function runKey(size, sel) {
  const a = sel.y0 * size + sel.x0, b = sel.y1 * size + sel.x1;
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The not-yet-found word whose placement occupies exactly the selected cells.
 *
 * Identity is the CELL RUN, not the letters. Matching on letters alone marked a word found
 * wherever its letters happened to read -- inside a longer word (WOOD inside HARDWOOD), or
 * by chance in the filler -- and its real placement then flashed as a miss. 581 of 600
 * subjects contain a word inside another of their own words, and 30% of dealt puzzles
 * contain at least one word readable off its placement, so this was not a rare case.
 * @param {Placement[]} placements @param {Record<string, unknown>} found
 * @param {number} size @param {Selection} sel @returns {string|null} */
export function matchWord(placements, found, size, sel) {
  const want = runKey(size, sel);
  for (const p of placements) {
    if (found[p.word]) continue;
    const last = p.word.length - 1;
    const run = runKey(size, { x0: p.x0, y0: p.y0, x1: p.x0 + p.dx * last, y1: p.y0 + p.dy * last });
    if (run === want) return p.word;
  }
  return null;
}
```

- [ ] **Step 4: Update the caller**

In `src/main.js`, line 246 currently reads:

```js
  const hit = matchWord(puzzle.words, state.found, readLine(puzzle.cells, state.size, s));
```

Replace with:

```js
  const hit = matchWord(puzzle.placements, state.found, state.size, s);
```

Then check whether `readLine` is still used in `main.js`; if not, remove it from the import
on line 7. It stays exported from `puzzle.js` — `tests/unit/puzzle.test.js` uses it.

```bash
grep -n "readLine" src/main.js
```

- [ ] **Step 5: Run the unit suite**

Run: `node --test tests/unit/puzzle.test.js`
Expected: PASS, all six new tests plus the existing ones.

- [ ] **Step 6: Fix `findWordInGrid`, which has the same bug**

`tests/e2e/helpers.js:39-51` scans the grid for the first run that spells the word and
returns it. It has no idea where the word was actually placed — the identical defect being
fixed in `matchWord`. Once `matchWord` requires the real placement, a ghost run returned by
this helper will correctly match nothing and the test that used it will fail.

This is not hypothetical: `gameplay.spec.js:52` loops over all 12 words of a pinned board,
and 30% of dealt puzzles contain at least one word readable off its placement.

The helper cannot know the true placement from the DOM, so it returns every candidate and
lets the caller find the one that registers. Replace `findWordInGrid` and add a companion:

```js
/** Every run in the grid that reads `word`, in scan order.
 *
 * More than one can exist: a word's letters also appear inside longer words and, for short
 * words, by chance in the filler. Only one of them is the word's placement, and the DOM
 * does not say which -- so callers try them in turn. Before matchWord keyed on the cell
 * run, dragging any of these "found" the word, which is the bug this suite now guards.
 * @param {Page} page @param {string} [word]
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}[]>} */
export async function findRunsInGrid(page, word) {
  const runs = await page.evaluate((target) => {
    const letters = [...document.querySelectorAll('.cell')].map(e => e.textContent);
    const N = Math.round(Math.sqrt(letters.length));
    const words = target
      ? [target]
      : [...document.querySelectorAll('.w')].map(e => /** @type {string} */ (e.textContent).toUpperCase());
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    const out = [];
    for (const w of words) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
          if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
          let ok = true;
          for (let i = 0; i < w.length; i++) {
            if (letters[(y + dy * i) * N + (x + dx * i)] !== w[i]) { ok = false; break; }
          }
          if (ok) out.push({ word: w, x0: x, y0: y, x1: ex, y1: ey });
        }
      }
    }
    return out;
  }, word);
  if (!runs.length) throw new Error(`could not locate ${word || 'any word'} in the grid`);
  return runs;
}

/** Drag runs until the word actually crosses out. Returns the run that worked.
 * @param {Page} page @param {string} word
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>} */
export async function findAndDrag(page, word) {
  const runs = await findRunsInGrid(page, word);
  for (const run of runs) {
    await dragCells(page, run);
    const done = await page.locator('.w.done, .w.glow').allTextContents();
    if (done.some(t => t.trim().toUpperCase() === word.toUpperCase())) return run;
  }
  throw new Error(`no run for ${word} registered as found -- ${runs.length} tried`);
}

/** Back-compat: the first run that reads the word. Only safe where the caller does not
 * need the word to actually register -- e.g. asserting a MISS. Prefer findAndDrag.
 * @param {Page} page @param {string} [word]
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>} */
export async function findWordInGrid(page, word) {
  return (await findRunsInGrid(page, word))[0];
}
```

`findDiagonalWord` calls `findWordInGrid` and keeps working, but it can now pick a diagonal
*ghost*. Change its body to scan `findRunsInGrid(page, w)` for the first diagonal run rather
than testing only the first run:

```js
export async function findDiagonalWord(page) {
  const all = await page.locator('.w').allTextContents();
  for (const w of all) {
    for (const hit of await findRunsInGrid(page, w.toUpperCase())) {
      if (hit.x0 !== hit.x1 && hit.y0 !== hit.y1) return hit;
    }
  }
  throw new Error('no diagonally placed word in this puzzle');
}
```

- [ ] **Step 7: Run the whole e2e suite and fix the fallout**

Run: `npx playwright test`

Expected: some `gameplay.spec.js` and `regressions.spec.js` tests may fail because they
dragged a ghost run and it no longer registers. For each failure, switch that call site from
`dragCells(page, await findWordInGrid(page, W))` to `await findAndDrag(page, W)`.

**Do not "fix" a failure by loosening an assertion.** A word that will not cross out at its
real placement is the bug returning, not a flaky test.

- [ ] **Step 8: Add the e2e regression guard**

Append to `tests/e2e/regressions.spec.js`. Use a pinned seed so the board is reproducible —
`?seed=` and `?subject=` pin the grid exactly (verified: same seed and subject give a
byte-identical grid).

```js
// WOOD inside HARDWOOD: matching on letters alone marked WOOD found wherever its letters
// read, after which its real placement flashed as a miss. See matchWord in puzzle.js.
// This drives the grid rather than reaching into internals, so it fails the way a player
// would experience it.
test('a run that only spells a word does not find it', async ({ page }) => {
  await page.goto('/?seed=6&subject=home/carpentry');
  await page.waitForSelector('#letters .cell');

  // Cell centres, by grid coordinate, from the rendered layout.
  const centre = async (/** @type {number} */ x, /** @type {number} */ y) => {
    const size = await page.evaluate(() => document.querySelectorAll('#letters .cell').length);
    const n = Math.round(Math.sqrt(size));
    const box = await page.locator(`#letters .cell`).nth(y * n + x).boundingBox();
    if (!box) throw new Error(`no cell at ${x},${y}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const drag = async (a, b) => {
    const from = await centre(a[0], a[1]), to = await centre(b[0], b[1]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  };

  // Find a listed word, and a run elsewhere in the grid that spells it but is not it.
  const ghost = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#letters .cell')].map(c => c.textContent || '');
    const n = Math.round(Math.sqrt(cells.length));
    const words = [...document.querySelectorAll('#list .w')].map(w => (w.textContent || '').trim());
    const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const w of words) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [dx, dy] of DIRS) {
        const x1 = x + dx * (w.length - 1), y1 = y + dy * (w.length - 1);
        if (x1 < 0 || x1 >= n || y1 < 0 || y1 >= n) continue;
        let s = '';
        for (let i = 0; i < w.length; i++) s += cells[(y + dy * i) * n + (x + dx * i)];
        if (s === w || [...s].reverse().join('') === w) return { word: w, a: [x, y], b: [x1, y1] };
      }
    }
    return null;
  });
  test.skip(!ghost, 'this seed produced no readable run; pick another with the probe script');

  // Dragging a run that reads the word must either find it at its real placement, or miss.
  // What must NOT happen is the word crossing out while its real placement stays plain.
  await drag(ghost.a, ghost.b);
  const struck = await page.locator('#list .w.done').count();
  const crossed = await page.locator('#list .w.done').allInnerTexts();
  expect(struck === 0 || crossed.some(t => t.trim() === ghost.word)).toBe(true);
});
```

**Implementer note:** read `tests/e2e/gameplay.spec.js` first — it already contains a drag
helper. If its helper is usable, delete the local `centre`/`drag` above and import that one
rather than keeping two. Check the class name used for a crossed-out word (`.done` above is
an assumption) against `src/view.js`'s `renderList` and correct it if it differs.

- [ ] **Step 9: Run the e2e spec**

Run: `npx playwright test tests/e2e/regressions.spec.js`
Expected: PASS on both the `desktop` and `mobile` projects.

- [ ] **Step 10: Commit**

```bash
git add src/puzzle.js src/main.js tests/unit/puzzle.test.js tests/e2e/helpers.js tests/e2e/gameplay.spec.js tests/e2e/regressions.spec.js
git commit -m "Identify a found word by its cell run, not by its letters

matchWord compared the dragged letters against the word list, so a
word was marked found wherever its letters happened to read --
inside a longer word, or by chance in the filler. Its real placement
then failed to match and flashed as a miss on a word that is
genuinely there.

Measured on the corpus: 581 of 600 subjects contain a word inside
another of their own words (CAT in TOMCAT, HORSE in HORSESHOE), and
30% of dealt puzzles contain at least one word readable off its
placement.

Identity is now the two endpoints of the run, unordered, which is
exact because two points determine one straight run. Genuinely
overlapping words are both findable, which letter matching also got
wrong in the other direction."
```

---

### Task 3: Reduce the appearance preference to Light and Dark

**Files:**
- Modify: `src/appearance.js`
- Test: `tests/unit/appearance.test.js`

**Interfaces:**
- Consumes: `defaultStore` from `src/storage.js` (unchanged).
- Produces: `PREFS = ['light','dark']`, `normalizePref(p) -> 'light'|'dark'`,
  `nextPref(p) -> 'light'|'dark'`, `appearanceLabel(pref) -> string` (**now one argument**),
  `makeAppearance({store, root, onApply})` whose `onApply` is **now `(mode) => void`**.
  `resolveAppearance` and the `query` dependency are **deleted**. Task 4 consumes these.

A first-time visitor gets **Dark**. Existing players holding `'system'` normalize to `'dark'`
on next load — the fallback is the migration, there is no migration code.

- [ ] **Step 1: Rewrite the unit tests**

Replace the whole of `tests/unit/appearance.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS, PREF_KEY, normalizePref, nextPref, appearanceLabel, makeAppearance,
} from '../../src/appearance.js';
import { memStore } from './helpers.js';

const fakeRoot = () => ({ dataset: {} });

test('there are exactly two preferences and they toggle', () => {
  assert.deepEqual([...PREFS], ['light', 'dark']);
  assert.equal(nextPref('light'), 'dark');
  assert.equal(nextPref('dark'), 'light');
});

test('nextPref is total: anything unrecognised normalizes first', () => {
  assert.equal(nextPref('system'), 'light', 'system normalizes to dark, whose next is light');
  assert.equal(nextPref('sepia'), 'light');
});

test('normalizePref falls back to dark, which is also the system migration', () => {
  assert.equal(normalizePref('light'), 'light');
  assert.equal(normalizePref('dark'), 'dark');
  assert.equal(normalizePref('system'), 'dark', 'the old third setting must land on dark');
  assert.equal(normalizePref(null), 'dark');
  assert.equal(normalizePref(''), 'dark');
  assert.equal(normalizePref('sepia'), 'dark');
});

test('appearanceLabel names the preference', () => {
  assert.equal(appearanceLabel('light'), 'Appearance: Light');
  assert.equal(appearanceLabel('dark'), 'Appearance: Dark');
});

test('start() applies the preference to the root element', () => {
  const root = fakeRoot();
  makeAppearance({ store: memStore(), root }).start();
  assert.equal(root.dataset.appearance, 'dark', 'no stored preference means dark');
});

test('the preference persists and is read back on construction', () => {
  const store = memStore();
  makeAppearance({ store, root: fakeRoot() }).set('light');
  assert.equal(store.getItem(PREF_KEY), 'light');

  const root = fakeRoot();
  const a = makeAppearance({ store, root });
  a.start();
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light');
});

test('cycle() flips and returns the new preference', () => {
  const a = makeAppearance({ store: memStore(), root: fakeRoot() });
  assert.equal(a.get(), 'dark');
  assert.equal(a.cycle(), 'light');
  assert.equal(a.cycle(), 'dark');
});

test('onApply reports the resolved mode', () => {
  /** @type {string[]} */
  const seen = [];
  const a = makeAppearance({ store: memStore(), root: fakeRoot(), onApply: (m) => seen.push(m) });
  a.start();
  a.set('light');
  assert.deepEqual(seen, ['dark', 'light']);
});

test('a throwing store degrades to "not remembered" rather than throwing', () => {
  const bad = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  const root = fakeRoot();
  /** @type {ReturnType<typeof makeAppearance>} */
  let a;
  assert.doesNotThrow(() => { a = makeAppearance({ store: bad, root }); });
  assert.equal(a.get(), 'dark');
  assert.doesNotThrow(() => a.set('light'));
  assert.equal(root.dataset.appearance, 'light', 'the setting still applies for this session');
});

test('a null store is accepted and simply does not persist', () => {
  const root = fakeRoot();
  const a = makeAppearance({ store: null, root });
  a.start();
  a.set('light');
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/unit/appearance.test.js`
Expected: FAIL — `PREFS` is still three long, `normalizePref(null)` returns `'system'`.

- [ ] **Step 3: Rewrite the module**

Replace the whole of `src/appearance.js` with:

```js
// Appearance (light / dark). Split like storage.js: the one real decision is a pure
// function any unit test can call, and every side effect goes through an injectable
// dependency, so nothing here needs a browser to exercise.
//
// This module deliberately knows nothing about the header button or the theme-color
// meta tag -- those are page shape, and reach it through the `onApply` callback.
import { defaultStore } from './storage.js';

export const PREF_KEY = 'wordfinder-appearance';
/** The two settings, in the order the header button toggles through them. */
/** @type {readonly ['light','dark']} */
export const PREFS = ['light', 'dark'];

/**
 * @typedef {'light'|'dark'} Pref
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{dataset:{appearance?:string}}} Root
 */

/** @param {string} s @returns {string} */
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Anything unrecognised -- a null read, a hand-edited value, or the `system` setting this
 * app shipped with until 2026-08 -- falls back to `dark`, matching styles.css's bare
 * `:root` and index.html's inline resolver. This fallback IS the migration off `system`;
 * there is deliberately no migration code.
 * @param {string|null|undefined} pref @returns {Pref} */
export function normalizePref(pref) {
  return PREFS.some(p => p === pref) ? /** @type {Pref} */ (pref) : 'dark';
}

/** The other of the two. Total over any input, because it normalizes first.
 * @param {string|null|undefined} pref @returns {Pref} */
export function nextPref(pref) {
  return normalizePref(pref) === 'light' ? 'dark' : 'light';
}

/** Label for the button's aria-label and tooltip.
 * @param {Pref} pref @returns {string} */
export function appearanceLabel(pref) {
  return `Appearance: ${title(pref)}`;
}

/**
 * @param {{store?:PrefStore|null, root?:Root, onApply?:(mode:Pref)=>void}} [deps]
 */
export function makeAppearance(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const root = deps.root || document.documentElement;
  const onApply = deps.onApply || (() => {});

  /** @type {Pref} */
  let pref = 'dark';
  // A disabled, full or throwing store must degrade to "appearance not remembered",
  // never into the game -- same contract as makeStorage.
  try { pref = normalizePref(store ? store.getItem(PREF_KEY) : null); } catch { pref = 'dark'; }

  /** @returns {void} */
  function apply() {
    root.dataset.appearance = pref;
    onApply(pref);
  }

  /** @param {string} p @returns {void} */
  function set(p) {
    pref = normalizePref(p);
    try { if (store) store.setItem(PREF_KEY, pref); } catch { /* not remembered */ }
    apply();
  }

  // Deliberately plain functions closing over `pref` rather than methods using `this`,
  // so a destructured `const {cycle} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    set,
    /** @returns {Pref} */
    cycle() { set(nextPref(pref)); return pref; },
    /** @returns {void} */
    start() { apply(); },
  };
}
```

Note what leaves with it: the `DarkQuery` typedef, `systemQuery`, the `query` dependency, the
`start()` subscription, `resolveAppearance`, and the Safari 13 `addListener` fallback.

- [ ] **Step 4: Run the unit suite**

Run: `node --test tests/unit/appearance.test.js`
Expected: PASS. `main.js` still calls `appearanceLabel(pref, mode)` and will fail `tsc` —
that is expected and is fixed in Task 4. Do not commit yet.

- [ ] **Step 5: Confirm matchMedia did not leave the codebase**

`effects.js` and `main.js` both query `prefers-reduced-motion` and must be untouched.

```bash
grep -rn "matchMedia" src/
```

Expected: exactly two hits, `src/effects.js` and `src/main.js`, both `prefers-reduced-motion`.
No `prefers-color-scheme` anywhere in `src/`.

---

### Task 4: Wire the two-value appearance through the page

**Files:**
- Modify: `src/main.js:363-380`
- Modify: `index.html:6-11` (inline resolver + comment), `index.html:42-46` (the button)
- Modify: `styles.css:127`
- Modify: `README.md`
- Test: `tests/e2e/appearance.spec.js`

**Interfaces:**
- Consumes: `makeAppearance`, `appearanceLabel` from Task 3.
- Produces: nothing new. This completes the appearance commit.

- [ ] **Step 1: Update the inline pre-paint resolver**

`index.html:11` currently reads:

```html
<script>try{var p=null;try{p=localStorage.getItem('wordfinder-appearance')}catch(e){}if(p!=='light'&&p!=='dark')p=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.appearance=p}catch(e){}</script>
```

Replace with:

```html
<script>try{var p=null;try{p=localStorage.getItem('wordfinder-appearance')}catch(e){}if(p!=='light')p='dark';document.documentElement.dataset.appearance=p}catch(e){}</script>
```

And update the comment above it (lines 6-10) — it currently says "Must stay equivalent to
resolveAppearance(normalizePref(p), prefersDark)". It must now say it stays equivalent to
`normalizePref` in `src/appearance.js`, and keep the note about the inner `try` being needed
because a throwing `getItem` on iOS "Block All Cookies" must not abort the script.

- [ ] **Step 2: Remove the System icon**

Delete the `.i-system` SVG line from `index.html` (line 43):

```html
        <svg class="i-system" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="solid" d="M12 3a9 9 0 0 0 0 18z"/></svg>
```

Change the button's initial state on line 42 from `data-pref="system"` and
`title="Appearance: System"` / `aria-label="Appearance: System"` to `data-pref="dark"` and
`Appearance: Dark`.

- [ ] **Step 3: Remove the System CSS rule**

`styles.css:127-129` is a three-selector rule. Delete only the first selector line:

```css
#appearance[data-pref="system"] .i-system,
```

leaving:

```css
#appearance[data-pref="light"] .i-light,
#appearance[data-pref="dark"] .i-dark{display:block}
```

No token values change, so `npm run icons -- --check` stays green.

- [ ] **Step 4: Update main.js**

`src/main.js:367-378` currently destructures `(pref, mode)`. Replace the `makeAppearance`
call with:

```js
const appearance = makeAppearance({
  onApply(mode) {
    els.appearance.dataset.pref = mode;
    const label = appearanceLabel(mode);
    els.appearance.title = label;
    els.appearance.setAttribute('aria-label', label);
    if (themeColorMeta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      themeColorMeta.setAttribute('content', bg);
    }
  },
});
```

- [ ] **Step 5: Verify types**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean. If it reports `appearanceLabel` arity, Step 4 was not applied.

- [ ] **Step 6: Rework the e2e spec**

`tests/e2e/appearance.spec.js` has ten tests. Apply exactly this disposition — do not delete
anything not listed as delete:

| Test (line) | Action |
| --- | --- |
| pill coloured by the stylesheet (17) | leave alone |
| dark palette resolves to shipped colours (36) | leave alone |
| throwing `getItem` falls through to the OS (73) | **rewrite**: a throwing `getItem` now resolves `dark`. Keep the guard that a throwing read must not abort the resolver |
| when `matchMedia` is missing, still dark (95) | **delete**, and replace with: the inline script's text contains no `prefers-color-scheme` |
| invalid stored preference uses the allowlist (125) | keep; expected value becomes `dark` |
| throwing localStorage falls through to the OS (164) | **rewrite** as "resolves dark and does not flip on hydration" |
| button cycles system → light → dark (197) | **rewrite** as a two-step toggle |
| System follows the OS live (218) | **delete** |
| stored preference applies with the module blocked (236) | leave alone |
| status bar colour tracks the background (248) | leave alone |

Remove every `page.emulateMedia({ colorScheme })` call in the tests you rewrite; the OS no
longer influences anything.

Add these three first-paint cases:

```js
test('a first-ever visit paints dark with no OS query', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
});

test('a stored light preference does not flash dark', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('wordfinder-appearance', 'light'); } catch (e) { /* ignore */ }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
});

test('the inline resolver contains no prefers-color-scheme query', async ({ page }) => {
  await page.goto('/');
  const html = await page.content();
  expect(html).not.toContain('prefers-color-scheme');
});
```

The last one is a static assertion and belongs here rather than in the unit suite because it
guards the *shipped* markup, which no unit test loads.

- [ ] **Step 7: Update the README**

Change the `src/appearance.js` row of the file table from
"Light / dark / system preference: resolve, persist, follow the OS." to
"Light / dark: resolve and persist."

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, including the 90% coverage gate from Task 1.

- [ ] **Step 9: Dispatch the cascade-and-cache-reviewer**

`CLAUDE.md` requires it for any change to the inline appearance resolver. Do not skip this;
the resolver is one of the two places in this repo where wrong code renders fine and fails
silently for one class of visitor.

- [ ] **Step 10: Commit**

```bash
git add src/appearance.js src/main.js index.html styles.css README.md tests/unit/appearance.test.js tests/e2e/appearance.spec.js
git commit -m "Drop the System appearance, and default a new visitor to Dark

Three settings become two. resolveAppearance, systemQuery and the
Safari 13 addListener fallback all go, along with the query
dependency and the OS subscription -- with no System there is
nothing left to follow. prefers-reduced-motion is untouched.

A stored 'system' normalizes to 'dark' on next load. normalizePref's
fallback is the migration, so there is no migration code.

Three e2e tests lost their premise rather than just their expected
value: two asserted a fall-through to the OS that no longer exists,
and one asserted behaviour when matchMedia is missing, which the
resolver no longer calls. Replaced with first-paint guards for
stored-light, stored-dark, and a first-ever visit."
```

---

### Task 5: `src/progress.js` — the record and the shuffle bag

**Files:**
- Create: `src/progress.js`
- Modify: `sw.js` (`ASSETS`, `CACHE`)
- Modify: `README.md`
- Test: `tests/unit/progress.test.js`

**Interfaces:**
- Consumes: `defaultStore` from `src/storage.js`.
- Produces, all consumed by Task 7:
  - `KEY = 'wordfinder-progress-v1'`
  - `parseProgress(raw: string|null) -> Progress`
  - `chooseSubject(subjectIds: string[], seen: Map<string,number>, current: string|null, favourLeastSeen: boolean, rand: () => number) -> string`
  - `makeProgress(store?)` with `.get()`, `.bagFor(subjectId, pool) -> Set<string>`,
    `.noteDraw(subjectId, pool, words) -> void`, `.addSolve() -> void`,
    `.noteSize(catId, n) -> void`, `.coverage(subjectId) -> number`,
    `.setFavourLeastSeen(on) -> void`, `.isComplete(catId, subjectIds) -> boolean`
  - Typedef `Progress` = `{v:number, puzzles:number, favourLeastSeen:boolean, bags:Record<string,Bag>, sizes:Record<string,number>}`
  - Typedef `Bag` = `{n:number, c:number, d:string}`

Measured sizes: **28.7 KB** with all 600 bags part-way through a cycle, **9.5 KB** for a
player who has touched 200 subjects. 0.6% of the ~5 MB budget.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/progress.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, parseProgress, chooseSubject, makeProgress } from '../../src/progress.js';
import { memStore } from './helpers.js';

const POOL = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'];

/** A store already holding one record. @param {object} data */
function storeWith(data) {
  const s = memStore();
  s.setItem(KEY, JSON.stringify(data));
  return s;
}

test('an absent key yields a usable default record', () => {
  const p = parseProgress(null);
  assert.equal(p.puzzles, 0);
  assert.equal(p.favourLeastSeen, true);
  assert.deepEqual(p.bags, {});
  assert.deepEqual(p.sizes, {});
});

test('an unparseable blob yields defaults rather than throwing', () => {
  assert.equal(parseProgress('{not json').puzzles, 0);
  assert.equal(parseProgress('null').puzzles, 0);
  assert.equal(parseProgress('[]').puzzles, 0);
});

test('validation is merge-tolerant: one bad field never costs the others', () => {
  const p = parseProgress(JSON.stringify({
    v: 1, puzzles: 'not a number', favourLeastSeen: 'yes',
    bags: { 'a/b': { n: 8, c: 1, d: 'AA==' } }, sizes: { a: 24 },
  }));
  assert.equal(p.puzzles, 0, 'the bad counter falls back');
  assert.equal(p.favourLeastSeen, true, 'the bad flag falls back');
  assert.deepEqual(p.sizes, { a: 24 }, 'the good fields survive');
  assert.equal(p.bags['a/b'].n, 8, 'the bag survives a bad sibling field');
});

test('an individual bad bag is dropped and the rest survive', () => {
  const p = parseProgress(JSON.stringify({
    v: 1, bags: {
      'good/one': { n: 8, c: 0, d: 'AA==' },
      'bad/n': { n: -3, c: 0, d: 'AA==' },
      'bad/d': { n: 8, c: 0, d: 42 },
    },
  }));
  assert.ok(p.bags['good/one'], 'the valid bag survives');
  assert.equal(p.bags['bad/n'], undefined);
  assert.equal(p.bags['bad/d'], undefined);
});

test('a non-object bags or sizes field falls back without throwing', () => {
  assert.deepEqual(parseProgress(JSON.stringify({ bags: 'nope' })).bags, {});
  assert.deepEqual(parseProgress(JSON.stringify({ sizes: [1, 2] })).sizes, {});
});

test('bagFor returns the whole pool when nothing is stored', () => {
  const p = makeProgress(memStore());
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), [...POOL].sort());
});

test('noteDraw removes drawn words from the bag', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, ['AAA', 'BBB']);
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), ['CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH']);
});

test('emptying the bag increments the cycle and refills', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, POOL.slice(0, 4));
  assert.equal(p.coverage('a/b'), 0.5);
  p.noteDraw('a/b', POOL, POOL.slice(4));
  assert.equal(p.get().bags['a/b'].c, 1, 'a full pass increments the cycle');
  assert.equal(p.coverage('a/b'), 1, 'coverage is 1 once a cycle completes');
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), [...POOL].sort(), 'the bag refilled');
});

test('pool drift discards only that subject bag', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, ['AAA', 'BBB']);
  p.noteDraw('c/d', POOL, ['AAA']);
  const grown = [...POOL, 'III'];
  assert.deepEqual([...p.bagFor('a/b', grown)].sort(), [...grown].sort(),
    'a changed pool length starts a fresh cycle');
  assert.equal(p.bagFor('c/d', POOL).has('AAA'), false, 'the other bag is untouched');
});

test('coverage is 0 for a subject never played', () => {
  assert.equal(makeProgress(memStore()).coverage('never/played'), 0);
});

test('addSolve counts puzzles and persists', () => {
  const store = memStore();
  const p = makeProgress(store);
  p.addSolve();
  p.addSolve();
  assert.equal(p.get().puzzles, 2);
  assert.equal(makeProgress(store).get().puzzles, 2, 'it survives a reload');
});

test('noteSize records a category size and setFavourLeastSeen persists', () => {
  const store = memStore();
  const p = makeProgress(store);
  p.noteSize('nature', 24);
  p.setFavourLeastSeen(false);
  const reloaded = makeProgress(store).get();
  assert.equal(reloaded.sizes.nature, 24);
  assert.equal(reloaded.favourLeastSeen, false);
});

test('isComplete needs every subject through a full cycle', () => {
  const p = makeProgress(memStore());
  const ids = ['a/one', 'a/two'];
  p.noteSize('a', 2);
  assert.equal(p.isComplete('a', ids), false, 'nothing played');
  p.noteDraw('a/one', POOL, POOL);
  assert.equal(p.isComplete('a', ids), false, 'one subject short');
  p.noteDraw('a/two', POOL, POOL);
  assert.equal(p.isComplete('a', ids), true);
});

test('isComplete is false when the category size is unknown', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/one', POOL, POOL);
  assert.equal(p.isComplete('a', ['a/one']), false, 'never guess from an unknown size');
});

test('get() returns a copy that cannot mutate the record', () => {
  const p = makeProgress(memStore());
  p.noteSize('nature', 24);
  const snap = p.get();
  snap.sizes.nature = 999;
  snap.puzzles = 999;
  assert.equal(p.get().sizes.nature, 24);
  assert.equal(p.get().puzzles, 0);
});

test('chooseSubject prefers the least-seen subject', () => {
  const seen = new Map([['a/one', 1], ['a/two', 0.25], ['a/three', 0]]);
  assert.equal(chooseSubject(['a/one', 'a/two', 'a/three'], seen, null, true, () => 0), 'a/three');
});

test('chooseSubject ignores coverage when the preference is off', () => {
  const seen = new Map([['a/one', 1], ['a/two', 0]]);
  assert.equal(chooseSubject(['a/one', 'a/two'], seen, null, false, () => 0), 'a/one',
    'with the preference off it is a plain draw over the full list');
});

test('chooseSubject avoids the current subject while an alternative exists', () => {
  const seen = new Map([['a/one', 0], ['a/two', 0]]);
  for (const r of [0, 0.99]) {
    assert.notEqual(chooseSubject(['a/one', 'a/two'], seen, 'a/one', true, () => r), 'a/one');
  }
});

test('chooseSubject returns the only subject even when it is current', () => {
  assert.equal(chooseSubject(['a/one'], new Map(), 'a/one', true, () => 0), 'a/one');
});

test('chooseSubject never returns undefined for a fully-covered category', () => {
  const ids = ['a/one', 'a/two'];
  const seen = new Map([['a/one', 1], ['a/two', 1]]);
  const got = chooseSubject(ids, seen, null, true, () => 0.5);
  assert.ok(ids.includes(got), 'a completed category must still deal something');
});

test('a throwing store degrades silently', () => {
  const bad = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  /** @type {ReturnType<typeof makeProgress>} */
  let p;
  assert.doesNotThrow(() => { p = makeProgress(bad); });
  assert.doesNotThrow(() => p.addSolve());
  assert.doesNotThrow(() => p.noteDraw('a/b', POOL, ['AAA']));
  assert.doesNotThrow(() => p.noteSize('a', 24));
  assert.equal(p.get().puzzles, 1, 'it still works for this session');
});

test('a null store is accepted and simply does not persist', () => {
  const p = makeProgress(null);
  p.addSolve();
  assert.equal(p.get().puzzles, 1);
});

test('a stored record round-trips through the store', () => {
  const store = storeWith({ v: 1, puzzles: 5, favourLeastSeen: false, bags: {}, sizes: { a: 3 } });
  const p = makeProgress(store);
  assert.equal(p.get().puzzles, 5);
  assert.equal(p.get().favourLeastSeen, false);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/unit/progress.test.js`
Expected: FAIL — `Cannot find module '../../src/progress.js'`.

- [ ] **Step 3: Implement the module**

Create `src/progress.js`:

```js
// Word coverage. Pure aside from the store it's handed, like storage.js -- but with the
// OPPOSITE validation rule. A board save is all-or-nothing because half a grid is worse
// than a fresh one; this record is merged field by field, because one bad counter must
// never cost a player 600 shuffle bags.
//
// The unit of progress is word coverage, not "solved". A subject's pool holds 40-105 words
// and a puzzle draws 12, so one win covers 27% of an average subject -- calling it solved
// would claim 105 words on the evidence of 12.
import { defaultStore } from './storage.js';

export const KEY = 'wordfinder-progress-v1';

/**
 * @typedef {{n:number, c:number, d:string}} Bag
 *   n: the pool length this bag was built for -- the drift guard.
 *   c: completed cycles through the whole pool.
 *   d: base64 bitmask of words drawn in the current cycle, indexed by pool position.
 * @typedef {{v:number, puzzles:number, favourLeastSeen:boolean,
 *            bags:Record<string,Bag>, sizes:Record<string,number>}} Progress
 * @typedef {Pick<Storage,'getItem'|'setItem'>} ProgressStore
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** @returns {Progress} */
const empty = () => ({ v: 1, puzzles: 0, favourLeastSeen: true, bags: {}, sizes: {} });

/** @param {unknown} n @returns {n is number} */
const isCount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** @param {unknown} o @returns {o is Record<string, unknown>} */
const isRecord = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

/** Bytes -> base64, without Buffer (this module runs in the browser).
 * @param {Uint8Array} bytes @returns {string} */
function toB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)]
      + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c || 0) >> 6)])
      + (c === undefined ? '=' : B64[c & 63]);
  }
  return out;
}

/** @param {string} s @param {number} bits @returns {Uint8Array} */
function fromB64(s, bits) {
  const out = new Uint8Array(Math.ceil(bits / 8));
  let acc = 0, n = 0, o = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;                 // '=' padding and anything unexpected
    acc = (acc << 6) | v; n += 6;
    if (n >= 8) { n -= 8; if (o < out.length) out[o++] = (acc >> n) & 255; }
  }
  return out;
}

/** @param {Uint8Array} b @param {number} i @returns {boolean} */
const getBit = (b, i) => !!(b[i >> 3] & (1 << (i & 7)));

/** @param {Uint8Array} b @param {number} i @returns {void} */
const setBit = (b, i) => { b[i >> 3] |= 1 << (i & 7); };

/** @param {Uint8Array} b @param {number} bits @returns {number} */
function popcount(b, bits) {
  let n = 0;
  for (let i = 0; i < bits; i++) if (getBit(b, i)) n++;
  return n;
}

/** Merge whatever survived the read onto the defaults. Never returns null: there is no
 * "reject the record" outcome, only fields that could not be trusted. A bag whose `n` or
 * `d` is unusable is dropped individually, so 599 others survive it.
 * @param {string|null} raw @returns {Progress} */
export function parseProgress(raw) {
  const out = empty();
  if (!raw) return out;
  /** @type {unknown} */
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return out; }
  if (!isRecord(parsed)) return out;

  if (isCount(parsed.puzzles)) out.puzzles = parsed.puzzles;
  if (typeof parsed.favourLeastSeen === 'boolean') out.favourLeastSeen = parsed.favourLeastSeen;
  if (isRecord(parsed.sizes)) {
    for (const [k, v] of Object.entries(parsed.sizes)) if (isCount(v) && v > 0) out.sizes[k] = v;
  }
  if (isRecord(parsed.bags)) {
    for (const [k, v] of Object.entries(parsed.bags)) {
      if (!isRecord(v)) continue;
      if (!isCount(v.n) || v.n <= 0) continue;
      if (!isCount(v.c)) continue;
      if (typeof v.d !== 'string') continue;
      out.bags[k] = { n: v.n, c: v.c, d: v.d };
    }
  }
  return out;
}

/** The next subject to deal. With `favourLeastSeen`, draws among those tied for the LOWEST
 * coverage; otherwise draws from the whole list. `current` is dropped last, and only if
 * something else remains -- so a fully-covered category still avoids dealing the same
 * subject twice running.
 *
 * There is deliberately no exhaustion case: a minimum always exists, so unlike a binary
 * "skip what you have solved" filter this can never empty the pool and dead-end.
 * @param {string[]} subjectIds @param {Map<string,number>} seen @param {string|null} current
 * @param {boolean} favourLeastSeen @param {() => number} rand @returns {string} */
export function chooseSubject(subjectIds, seen, current, favourLeastSeen, rand) {
  let pool = subjectIds;
  if (favourLeastSeen) {
    let lowest = Infinity;
    for (const id of pool) lowest = Math.min(lowest, seen.get(id) ?? 0);
    pool = pool.filter(id => (seen.get(id) ?? 0) === lowest);
  }
  const fresh = pool.filter(id => id !== current);
  if (fresh.length) pool = fresh;
  return pool[Math.floor(rand() * pool.length)];
}

/** @param {ProgressStore|null} [store] */
export function makeProgress(store) {
  if (store === undefined) store = defaultStore();

  let data = empty();
  try { data = parseProgress(store ? store.getItem(KEY) : null); } catch { data = empty(); }

  /** @returns {void} */
  const flush = () => {
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(data)); } catch { /* not remembered */ }
  };

  /** The bag for a subject, discarding it if the pool length has changed since it was
   * written. That guard catches an inserted or deleted word; a same-length substitution is
   * accepted as one cycle of slightly-off distribution, which self-corrects at the refill.
   * @param {string} id @param {number} n @returns {Bag} */
  function bagOf(id, n) {
    const b = data.bags[id];
    if (!b || b.n !== n) { data.bags[id] = { n, c: b && b.n === n ? b.c : 0, d: '' }; }
    return data.bags[id];
  }

  return {
    /** @returns {Progress} */
    get: () => ({
      ...data,
      bags: Object.fromEntries(Object.entries(data.bags).map(([k, v]) => [k, { ...v }])),
      sizes: { ...data.sizes },
    }),

    /** Words not yet drawn this cycle. The whole pool when there is no usable bag.
     * @param {string} id @param {string[]} pool @returns {Set<string>} */
    bagFor(id, pool) {
      const b = bagOf(id, pool.length);
      const bits = fromB64(b.d, pool.length);
      return new Set(pool.filter((_, i) => !getBit(bits, i)));
    },

    /** Mark words drawn. When that empties the bag, the cycle count rises and it refills.
     * @param {string} id @param {string[]} pool @param {string[]} words @returns {void} */
    noteDraw(id, pool, words) {
      const b = bagOf(id, pool.length);
      const bits = fromB64(b.d, pool.length);
      for (const w of words) {
        const i = pool.indexOf(w);
        if (i >= 0) setBit(bits, i);
      }
      if (popcount(bits, pool.length) >= pool.length) { b.c += 1; b.d = ''; }
      else b.d = toB64(bits);
      flush();
    },

    /** @returns {void} */
    addSolve() { data.puzzles += 1; flush(); },

    /** @param {string} catId @param {number} n @returns {void} */
    noteSize(catId, n) { if (isCount(n) && n > 0) { data.sizes[catId] = n; flush(); } },

    /** 0..1 within the current cycle; 1 once a full cycle has completed.
     * @param {string} id @returns {number} */
    coverage(id) {
      const b = data.bags[id];
      if (!b) return 0;
      if (b.c > 0) return 1;
      return popcount(fromB64(b.d, b.n), b.n) / b.n;
    },

    /** @param {boolean} on @returns {void} */
    setFavourLeastSeen(on) { data.favourLeastSeen = !!on; flush(); },

    /** Every subject in the category through at least one full cycle. False when the
     * category's size is unknown -- never guess a completion the record cannot support.
     * @param {string} catId @param {string[]} subjectIds @returns {boolean} */
    isComplete(catId, subjectIds) {
      const n = data.sizes[catId];
      if (!n || subjectIds.length < n) return false;
      return subjectIds.every(id => (data.bags[id]?.c ?? 0) > 0);
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/unit/progress.test.js`
Expected: PASS, all 22 tests.

- [ ] **Step 5: Register the module in the service worker**

In `sw.js` line 12, add `'./src/progress.js'` to the `ASSETS` array — after
`'./src/storage.js'` keeps it near its sibling. On line 8, bump
`const CACHE='wordfinder-v10'` to `'wordfinder-v11'`.

**Do not add anything from `src/subjects/`.** Those are routed by directory prefix at
runtime and precaching them would pull all 25 categories into the installed shell.

- [ ] **Step 6: Confirm the hook's ASSETS parity check passes**

Run: `./node_modules/.bin/tsc --noEmit && node --test`
Expected: clean, and coverage above 90%. If the hook complains about ASSETS parity, Step 5
was missed.

- [ ] **Step 7: Add the README row**

In the `src/` file table, after the `src/storage.js` row:

```text
| `src/progress.js` | Word coverage per subject: the shuffle bag, the draw preference. | pure |
```

- [ ] **Step 8: Commit**

```bash
git add src/progress.js tests/unit/progress.test.js sw.js README.md
git commit -m "Add a per-subject shuffle bag for word coverage

A subject's pool holds 40-105 words and a puzzle draws 12, so one win
covers 27% of an average subject. Tracking solved/not-solved would
claim 105 words on the evidence of 12, so the unit is coverage: a bag
of words not yet drawn this cycle, held as a bitmask over pool order.

Validation is merge-tolerant, the opposite of storage.js's
all-or-nothing rule -- an individual bad bag is dropped and the other
599 survive. A stored pool length guards against a word list being
edited under an existing bag.

Measured worst case is 28.7KB, 0.6% of the localStorage budget, which
is why this stays synchronous and pure rather than moving to
IndexedDB."
```

---

### Task 6: Teach `pickWords` to prefer undrawn words

**Files:**
- Modify: `src/puzzle.js` (`pickWords`, `buildPuzzle`)
- Test: `tests/unit/puzzle.test.js`

**Interfaces:**
- Consumes: nothing from Task 5 — the Set arrives as an argument, which is what keeps
  `puzzle.js` pure and independently testable.
- Produces: `pickWords(pool, rng, {count, mix, undrawn?})` and
  `buildPuzzle({name, pool, rng, size, count, mix, undrawn?})`. Task 7 passes `undrawn`.

The bucket constraints still win: a bag is a preference, not an override. A puzzle short a
9-12 letter word must take a drawn one rather than ship a malformed board.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/puzzle.test.js`:

```js
test('pickWords draws only from undrawn while the buckets allow it', () => {
  // 24 words, four per length band, so every bucket can be filled from half the pool.
  const pool = [
    'AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH',
    'IIIIII', 'JJJJJJ', 'KKKKKK', 'LLLLLL', 'MMMMMMM', 'NNNNNNN', 'OOOOOOO', 'PPPPPPP',
    'QQQQQQQQQ', 'RRRRRRRRR', 'SSSSSSSSS', 'TTTTTTTTT',
    'UUUUUUUUUU', 'VVVVVVVVVV', 'WWWWWWWWWW', 'XXXXXXXXXX',
  ];
  const mix = [{ min: 3, max: 5, take: 2 }, { min: 6, max: 8, take: 2 }, { min: 9, max: 12, take: 2 }];
  const undrawn = new Set(pool.filter((_, i) => i % 2 === 0));
  const got = pickWords(pool, makeRng(1), { count: 6, mix, undrawn });
  assert.equal(got.length, 6);
  for (const w of got) assert.ok(undrawn.has(w), `${w} was drawn already and should not be reused`);
});

test('pickWords tops up from drawn words rather than returning a short list', () => {
  const pool = ['AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH'];
  const mix = [{ min: 3, max: 5, take: 4 }];
  const undrawn = new Set(['AAA']);      // one word, but the bucket needs four
  const got = pickWords(pool, makeRng(1), { count: 4, mix, undrawn });
  assert.equal(got.length, 4, 'the bucket must still be filled');
  assert.ok(got.includes('AAA'), 'the undrawn word is used first');
});

test('omitting undrawn reproduces the previous behaviour for a seed', () => {
  const pool = ['AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH'];
  const mix = [{ min: 3, max: 5, take: 2 }, { min: 6, max: 8, take: 2 }];
  const a = pickWords(pool, makeRng(7), { count: 4, mix });
  const b = pickWords(pool, makeRng(7), { count: 4, mix, undrawn: undefined });
  assert.deepEqual(a, b, 'an absent bag must not change the draw');
});

test('an undrawn set holding the whole pool changes nothing', () => {
  const pool = ['AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH'];
  const mix = [{ min: 3, max: 5, take: 2 }, { min: 6, max: 8, take: 2 }];
  assert.deepEqual(
    pickWords(pool, makeRng(7), { count: 4, mix }),
    pickWords(pool, makeRng(7), { count: 4, mix, undrawn: new Set(pool) }),
  );
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/unit/puzzle.test.js`
Expected: FAIL — the first test picks already-drawn words, because `undrawn` is ignored.

- [ ] **Step 3: Implement**

`pickWords` currently shuffles `eligible` in two places (lines 52 and 59). Add the parameter
and a partition helper. Read the existing body before editing — the bucket loop and the
nearest-length fallback both need the same treatment.

```js
/** Shuffle, but with every word from `undrawn` ahead of every word that is not. Ordering
 * rather than filtering is what makes the bag a preference: the bucket still gets filled
 * from drawn words when the bag cannot supply enough, instead of shipping a short board.
 * @template {string} T
 * @param {T[]} arr @param {Rng} rng @param {Set<string>|undefined} undrawn @returns {T[]} */
function shufflePreferring(arr, rng, undrawn) {
  const shuffled = rng.shuffle(arr);
  if (!undrawn) return shuffled;
  return [...shuffled.filter(w => undrawn.has(w)), ...shuffled.filter(w => !undrawn.has(w))];
}
```

Then in `pickWords`, change the signature to
`export function pickWords(pool, rng, { count, mix, undrawn })` and replace each
`rng.shuffle(...)` call in the body with `shufflePreferring(..., rng, undrawn)`. Update the
JSDoc `@param` to `{{count:number, mix:Bucket[], undrawn?:Set<string>}} opts`.

In `buildPuzzle`, thread it through: add `undrawn` to the destructured options and its
JSDoc, then pass it on:

```js
  const chosen = pickWords(fits, rng, { count, mix, undrawn });
```

Leave the `spare` shuffle alone — that is the placement-failure fallback and has nothing to
do with coverage.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/unit/puzzle.test.js`
Expected: PASS, including every pre-existing test. The "omitting undrawn reproduces the
previous behaviour" case is the one that matters most.

- [ ] **Step 5: Commit**

```bash
git add src/puzzle.js tests/unit/puzzle.test.js
git commit -m "Let pickWords prefer words a player has not seen

An optional undrawn Set orders each length bucket so unseen words come
first. Ordering rather than filtering keeps it a preference: a bucket
that cannot be filled from the bag still takes drawn words rather than
shipping a board a word short.

puzzle.js stays pure -- the set is an argument, not a lookup -- and
omitting it reproduces the previous draw for a given seed, which a
test pins."
```

---

### Task 7: Wire coverage into the game

**Files:**
- Modify: `src/main.js`
- Test: `tests/e2e/progress.spec.js` (created here)

**Interfaces:**
- Consumes: `makeProgress`, `chooseSubject` from Task 5; `buildPuzzle`'s `undrawn` option
  from Task 6.
- Produces: the wiring. Task 8 adds the UI that reads it.

**Two traps, both of which fail silently:**

1. **`restore()` must not record a draw.** It rebuilds a board that was already dealt, so
   recording again would advance the bag twice for one puzzle.
2. **An explicit `?seed=` must bypass the bag entirely.** Coverage makes word selection
   depend on player state, which would otherwise mean one seed dealt different grids to
   different players and broke the pinned-puzzle contract the e2e suite rests on. `rng.js`
   already sets this precedent — its comment warns the pinned branches "must NOT touch
   `rng`, or one `?seed=` would deal different grids with and without the parameter".

- [ ] **Step 1: Import and construct**

Add to the imports at the top of `src/main.js`:

```js
import { makeProgress, chooseSubject } from './progress.js';
```

After the `store` construction, add:

```js
const progress = makeProgress();
// Installed status is a documented grant heuristic in both Chrome and WebKit. Optional
// chaining and a swallowed rejection because Safari's support is inconsistent and a
// storage request must never reach the game.
void navigator.storage?.persist?.().catch(() => {});
```

- [ ] **Step 2: Thread `undrawn` through `newPuzzle`**

`newPuzzle` currently calls `buildPuzzle`. Give it a parameter saying whether the bag
applies, defaulting to true, so `restore()` and the pinned-seed path can opt out.

```js
/** @param {number} seed @param {import('./subjects.js').Subject} subject
 *  @param {Preset} shape
 *  @param {boolean} [useBag] false for a restored board and for an explicit ?seed=, both of
 *    which must reproduce a grid rather than consume coverage.
 *  @returns {void} */
function newPuzzle(seed, subject, shape, useBag = true) {
  // ... existing body down to the buildPuzzle call, unchanged ...
  const undrawn = useBag ? progress.bagFor(subject.id, subject.words) : undefined;
  state.puzzle = buildPuzzle({
    name: subject.name, pool: subject.words, rng,
    size: shape.size, count: shape.count, mix: shape.mix, undrawn,
  });
  if (useBag) progress.noteDraw(subject.id, subject.words, state.puzzle.words);
  // ... rest unchanged ...
}
```

**Note the field name:** `Subject` is
`{id, name, category, categoryName, words}` — the word pool is `subject.words`, **not**
`subject.pool`. The existing call already passes `pool: subject.words`; `state.puzzle.words`
is a different thing (the 12 words actually placed), which is what `noteDraw` wants.

Read the existing `newPuzzle` body before editing — it also sets `currentSeed`, `subjectId`,
`state.size`, `state.minCell`, builds its own `rng` from `seed`, resets state, and calls
`layout()`, `list()` and `persist()`. None of that changes.

- [ ] **Step 3: Opt the two reproduction paths out**

In `restore()` (around line 428), pass `false`:

```js
  newPuzzle(saved.seed, await loadSubject(saved.subjectId), {
    size: saved.size, count: saved.count, mix: shape.mix, minCell: shape.minCell,
  }, false);   // a restored board was already dealt; recording it again double-advances the bag
```

In `boot()`, the branch that handles an explicit `?seed=` / `?subject=` / `?category=` must
also pass `false`. Read the branch around lines 396-406 and pass `false` wherever the URL
pinned the puzzle. A random deal with no URL parameters keeps the default `true`.

- [ ] **Step 4: Count a solve**

In the `won` branch of `endDrag` (line 252 area), immediately after `const won = ...`:

```js
    if (won) progress.addSolve();
```

Put it before the `setTimeout` that raises the win card, so the card reads a current count.

- [ ] **Step 5: Record category sizes and use the new draw**

In `newGame`, after `cat = await loadCategory(id);` succeeds:

```js
  progress.noteSize(id, cat.subjectIds.length);
```

Then replace the subject pick at lines 325-327:

```js
  const seen = new Map(cat.subjectIds.map(s => [s, progress.coverage(s)]));
  const pick = chooseSubject(cat.subjectIds, seen, subjectId ?? null,
    progress.get().favourLeastSeen, Math.random);
```

Add the same `noteSize` call to the `?category=` branch in `boot()` after its
`loadCategory`.

- [ ] **Step 6: Verify types and units**

Run: `./node_modules/.bin/tsc --noEmit && node --test`
Expected: clean, coverage above 90%.

- [ ] **Step 7: Write the e2e guards**

Create `tests/e2e/progress.spec.js`. Read `tests/e2e/gameplay.spec.js` first and reuse its
drag helper and its solve-the-board helper rather than writing new ones.

```js
import { test, expect } from '@playwright/test';

const KEY = 'wordfinder-progress-v1';
const read = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

test('a restored board does not advance the bag', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  const before = await read(page);
  await page.reload();
  await page.waitForSelector('#letters .cell');
  const after = await read(page);
  expect(after.bags).toEqual(before.bags);
  expect(after.puzzles).toEqual(before.puzzles);
});

test('an explicit seed neither consumes nor is steered by the bag', async ({ page }) => {
  await page.goto('/?seed=1&subject=nature/birds');
  await page.waitForSelector('#letters .cell');
  const first = await page.locator('#letters').innerText();
  const rec = await read(page);
  expect(rec.bags?.['nature/birds']).toBeUndefined();

  await page.reload();
  await page.waitForSelector('#letters .cell');
  expect(await page.locator('#letters').innerText()).toEqual(first);
});

test('playing a subject twice deals a different word set', async ({ page }) => {
  // Seeded by the clock, so two plays of one subject must differ.
  await page.goto('/?subject=nature/birds');
  await page.waitForSelector('#list .w');
  const first = await page.locator('#list').innerText();
  await page.evaluate((k) => localStorage.removeItem(k), 'wordfinder-save-v1');
  await page.goto('/?subject=nature/birds');
  await page.waitForSelector('#list .w');
  expect(await page.locator('#list').innerText()).not.toEqual(first);
});
```

- [ ] **Step 8: Run the e2e suite**

Run: `npx playwright test tests/e2e/progress.spec.js`
Expected: PASS on `desktop` and `mobile`.

- [ ] **Step 9: Commit**

```bash
git add src/main.js tests/e2e/progress.spec.js
git commit -m "Deal the least-seen subject, and draw its unseen words first

newPuzzle feeds the subject's bag into buildPuzzle and records what
was drawn, so a second play of one subject shows different words. The
subject itself is chosen by lowest coverage rather than at random,
which cycles a player through all 24 before deepening any of them.

Two paths opt out and both fail silently if they do not. A restored
board was already dealt, so recording it again would advance the bag
twice for one puzzle. An explicit ?seed= must reproduce a grid, so it
cannot let player state select the words -- the same reason rng.js
keeps its pinned branches away from the rng."
```

---

### Task 8: The win card counter, the picker mark, and the checkbox

**Files:**
- Modify: `index.html` (win card, picker)
- Modify: `styles.css`
- Modify: `src/picker.js`
- Modify: `src/main.js`
- Modify: `src/view.js` (the `Els` typedef)
- Test: `tests/e2e/progress.spec.js`

**Interfaces:**
- Consumes: `progress.isComplete`, `progress.get().puzzles`,
  `progress.get().favourLeastSeen`, `progress.setFavourLeastSeen` from Tasks 5 and 7.
- Produces: the finished feature.

- [ ] **Step 1: Add the markup**

In `index.html`, inside `#wincard`, after `<p id="winmsg"></p>`:

```html
  <!-- Present and EMPTY at first paint, populated on a win. ARIA22 requires the container
       to exist before the message, and notes role="status" is not treated as atomic by
       default everywhere, hence the explicit aria-atomic. -->
  <p id="winstats" role="status" aria-atomic="true"></p>
```

In `#pickercard`, between `#picker-field` and `#picker-error`:

```html
  <label id="picker-least"><input type="checkbox" id="picker-least-box"><span>Favour subjects I've seen least</span></label>
```

- [ ] **Step 2: Style them**

In `styles.css`, near the other `#pickercard` rules:

```css
#winstats{font-size:14px;color:var(--muted);margin:0 0 16px}
/* One label so the text is part of the hit area, and 48px because that clears Apple's
   44pt, Material's 48dp, WCAG 2.2 AAA's 44px and BBC GEL's 44px all at once. */
#picker-least{display:flex;align-items:center;gap:10px;min-height:48px;margin-bottom:12px;
  font-size:14.5px;color:var(--text);text-align:left;cursor:pointer;text-transform:none;letter-spacing:normal}
#picker-least input{width:20px;height:20px;flex:none;accent-color:var(--accent);cursor:pointer}
```

`#pickercard label` already sets uppercase and letter-spacing for the Category label, which
is why this rule resets both.

Then cap the card's height. Apple HIG says to avoid a dialog that scrolls, and a landscape
phone leaves roughly 375px:

```css
#pickercard{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px);
  display:flex;flex-direction:column}
#picker-field,#picker-least{flex:none}
#pickercard>h2,#picker-warning{flex:none}
#picker-actions{flex:none;margin-top:auto}
```

- [ ] **Step 3: Extend the Els typedef**

`src/view.js` lines 11-16 hold the `Els` typedef. Add `winstats:HTMLElement,` to it, then add
`winstats: must('winstats'),` to the `els` object in `src/main.js`.

- [ ] **Step 4: Fill the win card**

In the `won` branch's `setTimeout` in `endDrag`, alongside the existing `els.winmsg`
assignment:

```js
      const n = progress.get().puzzles;
      els.winstats.textContent = `${n} ${n === 1 ? 'puzzle' : 'puzzles'} solved`;
```

- [ ] **Step 5: Give the picker the two new deps**

In `src/picker.js`, add `least`, `leastBox`, `isComplete` and `onLeast` to the destructured
deps and the JSDoc. Build the option labels in a function rather than once at construction:

```js
  /** Option labels carry a completion mark, refreshed on open and never while the select is
   * focused. Changing a live control's accessible name is not reliably announced -- JAWS and
   * NVDA have both been measured failing on it, and devtools hide the bug by showing the new
   * name while the AT still reports the old one. On open, before focus, this is a fresh
   * render rather than a rename. The suffix is text because <option> permits only text, and
   * a tick glyph is announced inconsistently.
   * @returns {void} */
  function labelOptions() {
    for (const o of select.options) {
      if (!o.value) continue;
      const c = categories.find(x => x.id === o.value);
      if (c) o.textContent = isComplete(o.value) ? `${c.name} (done)` : c.name;
    }
  }
```

Call `labelOptions()` at the top of `open()`, before `select.focus()`. In `open()`, set the
checkbox from the dep — and add a comment saying why it is **not** reset, unlike
`select.value`:

```js
    // select.value resets every open because choosing a category is an act, not a setting.
    // This checkbox is the opposite -- it IS a setting -- so it reflects the stored value.
    leastBox.checked = leastDefault();
```

Wire the change event:

```js
  leastBox.addEventListener('change', () => onLeast(leastBox.checked));
```

- [ ] **Step 6: Pass the deps from main.js**

In the `makePicker` call:

```js
  least: must('picker-least'),
  leastBox: /** @type {HTMLInputElement} */ (must('picker-least-box')),
  leastDefault: () => progress.get().favourLeastSeen,
  isComplete: (id) => {
    const cat = loadedCategories.get(id);
    return !!cat && progress.isComplete(id, cat.subjectIds);
  },
  onLeast: (on) => progress.setFavourLeastSeen(on),
```

`isComplete` needs the category's subject ids, which only exist after `loadCategory`. Add a
module-level `const loadedCategories = new Map();` and populate it wherever `noteSize` is
called in Task 7. A category never loaded shows no mark, which is correct — completion is
unknowable without it, and it cannot be complete if it was never played.

- [ ] **Step 7: Verify the dialog still fits**

This is the check that matters. `CLAUDE.md` records a rail-width change that pushed words
off a landscape phone and passed all 59 e2e tests.

```bash
npm run shots -- landscape --measure
```

Expected: no off-screen warnings. Also open `.shots/` and look at the landscape images —
`#picker-actions` must be visible without the card scrolling.

- [ ] **Step 8: Add the UI e2e guards**

Append to `tests/e2e/progress.spec.js`:

```js
test('the win card counter appears and the checkbox persists', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  await expect(page.locator('#winstats')).toHaveText('');   // empty at first paint

  await page.getByRole('button', { name: /new game/i }).click();
  const box = page.locator('#picker-least-box');
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.reload();
  await page.waitForSelector('#letters .cell');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('#picker-least-box')).not.toBeChecked();
});

test('the picker action buttons stay visible on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.waitForSelector('#letters .cell');
  await page.getByRole('button', { name: /new game/i }).click();
  const start = page.locator('#picker-start');
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y + box.height).toBeLessThanOrEqual(390);
});
```

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: PASS, with coverage above 90%.

- [ ] **Step 10: Dispatch the cascade-and-cache-reviewer**

Required by `CLAUDE.md` — this task changes `styles.css`, and both new rules must be checked
against the light and dark palettes. Muted text and the checkbox's `accent-color` both need
to clear contrast in both, and `styles.css` is one of the two files in this repo that fail
silently.

- [ ] **Step 11: Commit**

```bash
git add index.html styles.css src/picker.js src/main.js src/view.js tests/e2e/progress.spec.js
git commit -m "Show puzzles solved, mark finished categories, and cap the dialog

The win card gains a live region, present and empty at first paint
because ARIA22 requires the container to exist before the message and
notes role=status is not atomic by default everywhere.

The picker marks a fully-covered category in its option text, built on
open and never while the select is focused -- changing a live
control's accessible name is not reliably announced, and devtools hide
it by showing the new name while the screen reader reports the old.
A checkbox rather than a switch, because the setting applies on Start
rather than immediately, in one 48px label so the text is part of the
hit area.

The card is capped against the viewport with its buttons pinned. It
gained a row, and a landscape phone leaves about 375px."
```

---

## Verification before calling this done

- [ ] `npm test` passes, including the 90% coverage gate.
- [ ] `./node_modules/.bin/tsc --noEmit` is clean.
- [ ] `npm run icons -- --check` exits zero — no palette value changed, so it must.
- [ ] `npm run shots -- --measure` reports no off-screen cells or words below the fold.
- [ ] `git log --oneline` shows seven commits, each independently revertible.
- [ ] The cascade-and-cache-reviewer has run for Task 4 and Task 8.
- [ ] **Deploying is the user's call.** `/ship` sets `disable-model-invocation`; ask the user
      to run it. `npm run test:live` only means anything after a push.
