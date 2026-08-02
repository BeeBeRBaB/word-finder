# Progress tracking, and dropping the System appearance — design

**Date:** 2026-08-02
**Status:** approved, not yet planned
**Scope:** two unrelated changes that ship as **two separate commits**. They share no code.
Commit 1 is the appearance change; commit 2 is progress tracking. Keep it simple — casual
game, client-side only, no new deps, no build step.

## Context

The app remembers exactly one thing across games: the board you are mid-way through
(`wordfinder-save-v1`), plus your appearance preference (`wordfinder-appearance`). It has no
memory that a game ever *finished*. Solve all 24 Nature subjects and the picker looks
identical to a first visit, and the random draw can hand you Birds three times running.

This adds a lifetime record — how many puzzles you have solved, how many words you have
found, and which of the 600 subjects you have completed — and lets that record optionally
steer the draw away from subjects you have already done.

**Storage stays client-side, and localStorage is the mechanism.** Measured against the real
corpus: a player with 40 subjects solved stores 766 bytes; every one of the 600 solved
stores 11.1 KB, which is 0.22% of the ~5 MB budget. IndexedDB would buy async complexity for
space that is never needed. A server was considered and rejected — GitHub Pages serves static
files and cannot hold a secret, so a backend means accounts, auth and a privacy policy, and
costs the offline-first property, all to move 11 KB between two devices.

**Rejected: Tailwind CSS.** Raised in the same conversation, recorded here so it is not
revisited. The only no-build path is the Play CDN, which is cross-origin, which `sw.js`
cannot precache — the app would render unstyled offline, the one thing a PWA must not do.
The CLI path is the build step `CLAUDE.md` rules out. There is also nothing to deduplicate:
`styles.css` is 213 lines for a single page whose markup is ID-based, with three `class`
attributes in the whole document. Tailwind's dark mode would additionally duplicate the
`data-appearance` palette mechanism that `tests/unit/tokens.test.js` pins.

---

## Commit 1 — remove the System appearance

Three settings become two. **Light and Dark only**, and a first-time visitor gets **Dark**.

### What changes in `src/appearance.js`

| Export | Now | After |
| --- | --- | --- |
| `PREFS` | `['system','light','dark']` | `['light','dark']` |
| `normalizePref` | unknown → `'system'` | unknown → `'dark'` |
| `nextPref` | 3-step cycle | 2-step toggle; the name stays, the cycle is now a flip |
| `resolveAppearance` | `(pref, prefersDark)` | **deleted** — a pref is already a mode |
| `appearanceLabel` | `(pref, mode)`, branches on `system` | `(pref)` → `Appearance: Light` / `Appearance: Dark` |
| `systemQuery` | `matchMedia` + subscribe | **deleted** |

The whole `DarkQuery` typedef, the `query` dependency of `makeAppearance`, and the
`start()` subscription go with it. `start()` reduces to `apply()`.

**`Pref` and `Mode` become the same type**, which collapses two signatures: the `onApply`
callback drops to `(mode)`, and `appearanceLabel` drops to one argument. `main.js:367-370`
is the only consumer of both and updates with them.

**This deletes the Safari 13 `addListener` fallback** at `appearance.js:68-77` and its
comment. That branch exists only to keep System following the OS on iOS 13.x; with no
System there is nothing to follow.

**`matchMedia` does not leave the codebase** — `effects.js:16` and `main.js:47` both query
`prefers-reduced-motion` and are untouched. Only the `prefers-color-scheme` query goes.

**Existing players holding `'system'`** normalize to `'dark'` on their next load. That is a
one-way change and it is accepted: `'system'` is not a value the new build can honour, and
`normalizePref` already treats any unrecognised stored value as the default. No migration
code — the fallback *is* the migration.

### What changes elsewhere

- **`index.html:11`** — the inline pre-paint resolver drops its `matchMedia` call entirely:

  ```html
  <script>try{var p=null;try{p=localStorage.getItem('wordfinder-appearance')}catch(e){}
  if(p!=='light')p='dark';document.documentElement.dataset.appearance=p}catch(e){}</script>
  ```

  It must stay equivalent to `normalizePref` in `appearance.js`; both sites keep their
  comment pointing at the other.
- **`index.html:43`** — the `.i-system` SVG is removed from the button. Two icons remain.
- **`styles.css`** — the `#appearance[data-pref="system"] .i-system` rule goes. No token
  changes; **no palette values are touched**, so `npm run icons -- --check` stays green and
  `CACHE` needs no bump for the icons' sake (it is bumped anyway — see Housekeeping).
- **`README.md`** — the `src/appearance.js` row reads "Light / dark: resolve and persist",
  dropping "follow the OS".

### Tests for commit 1

`tests/unit/appearance.test.js` loses its `resolveAppearance` matrix and its
`start()`-follows-the-OS case, and gains: `normalizePref('system')` → `'dark'`,
`normalizePref(null)` → `'dark'`, and `nextPref` flips between exactly two values and is
total over `PREFS`.

`tests/e2e/appearance.spec.js` needs more work than it looks — ten of its tests are
affected, and three have their *premise* deleted rather than just their expected value.
Disposition per test, so none is silently dropped:

| Test | Line | Disposition |
| --- | --- | --- |
| a found word paints a pill coloured by the stylesheet | 17 | unchanged |
| the dark palette still resolves to the colours the game shipped with | 36 | unchanged |
| a throwing `localStorage.getItem` falls through to the OS | 73 | **rewrite** — there is no OS to fall through to; a throwing `getItem` now resolves `dark`. The guard it exists for (a throwing read must not abort the resolver) is still essential and must survive the rewrite |
| when `matchMedia` is missing, the app still renders dark | 95 | **delete** — the resolver no longer calls `matchMedia`, so this can no longer fail. Replace with an assertion that the inline script contains no `prefers-color-scheme` query at all, which is the property actually worth pinning |
| an invalid stored preference resolves through the allowlist | 125 | keep; expected value becomes `dark` |
| a throwing `localStorage` falls through to the OS instead of flipping on hydration | 164 | **rewrite** as "resolves `dark` and does not flip on hydration" |
| the button cycles system → light → dark | 197 | **rewrite** as a two-step toggle |
| System follows the OS live; a pinned preference ignores it | 218 | **delete** — nothing left to test |
| a stored preference applies with the module blocked entirely | 236 | unchanged |
| the status bar colour tracks the page background | 248 | unchanged |

The first-paint guard is the one that matters most and must end up covering three cases: a
stored `dark`, a stored `light` (must not flash dark), and a first-ever visit with nothing
stored (must be dark immediately, with no OS query involved).

**The cascade-and-cache-reviewer is required for this commit** — it touches the inline
appearance resolver, which `CLAUDE.md` names explicitly.

---

## Commit 2 — progress tracking

### 1. `src/progress.js` — a new pure module

Sits in the pure set beside `rng`, `puzzle`, `layout`, `storage` and `catalog`: **no DOM**,
every side effect through an injected store. It mirrors `makeStorage`'s idiom so a
disabled, full or throwing `localStorage` degrades to "progress not remembered" and never
throws into the game.

**Key: `wordfinder-progress-v1`.** Deliberately separate from `wordfinder-save-v1`.

```js
{ v: 1, solved: ['nature/birds', 'sports/golf', …], puzzles: 47, words: 564, skipSolved: true }
```

| Field | Meaning | Default |
| --- | --- | --- |
| `v` | record version, for a future export/import | `1` |
| `solved` | subject ids solved at least once, deduped | `[]` |
| `puzzles` | lifetime puzzles solved; repeats count | `0` |
| `words` | lifetime words found, counted per find | `0` |
| `skipSolved` | whether the draw avoids solved subjects | `true` |

**`puzzles` and `words` cannot be derived** and so are stored: solving Birds twice is one
entry in `solved` but two puzzles. **Per-category progress is derived**, by counting the
entries of `solved` whose id prefix matches — never stored. That is the point of the model:
the picker and the win card read the same array, so they cannot drift apart.

**`words` counts every word you find, including in games you abandon.** It increments at the
moment of the find, not at the win. This is deliberate — you did find those words — and it
is also why the two counters move at different sites rather than both at the win.

#### Validation is merge-tolerant — the opposite rule to `storage.js`

`storage.load()` returns `null` if any field is malformed, on the stated principle that "a
save is either complete or it is not a save". That is right for a board and **catastrophic
for a lifetime record**: one bad `puzzles` write would silently discard 600 solved subjects.

So the read path inside `makeProgress` validates each field independently, substitutes the
default for any field it cannot trust, keeps the rest, and **never yields `null`** — there
is no "reject the record" outcome at all. A missing key, a corrupt blob, or a `solved` that
is not an array each yield a usable record. Entries of `solved` that are not strings are
filtered out rather than failing the whole field.

#### Exports

```js
export const KEY = 'wordfinder-progress-v1';
export function makeProgress(store)   // store optional; defaults to defaultStore()
  //  .get()               → the record (a copy; callers cannot mutate the store)
  //  .addWord()           → words + 1, persisted
  //  .addSolve(subjectId) → puzzles + 1, subjectId into solved, persisted
  //  .setSkipSolved(on)   → persisted
  //  .solvedIn(categoryId) → number solved in that category, derived

/** Pure, exported for tests and for main.js's draw. */
export function chooseSubject(subjectIds, solved, current, skipSolved, rand)
```

`chooseSubject` is a plain function of its arguments with `rand` injected, so the draw is
unit-testable without a browser or a live `Math.random`.

### 2. Where it hooks into `main.js` — three sites

| Site | Change |
| --- | --- |
| the `hit` branch, `main.js:249` | `progress.addWord()` |
| the `won` branch, `main.js:252` | `progress.addSolve(subjectId)` |
| the pool filter, `main.js:325-327` | `chooseSubject(...)` replaces the inline pick |

**`restore()` needs no guard.** It was checked: `main.js:431-435` writes `state.found` and
`state.foundOrder` directly and deliberately never pops the win overlay, so replaying a save
passes through neither counting site. Reloading a half-finished game cannot inflate either
counter. *This must stay true* — a future refactor that routes restore through the find
handler would start double-counting silently, so `restore()` gets a comment saying so, and
the e2e suite asserts it (below).

**The draw already has the shape this needs.** `main.js:325-327` filters out the subject
currently on screen and falls back to the full pool when that empties. `chooseSubject`
generalises exactly that, in **this order**, each step undone if it leaves nothing:

1. Start with every id in the category.
2. If `skipSolved`, drop the solved ones. **If that empties the pool, restore it** — the
   category is complete, and the alternative is a dead end with nothing to play.
3. Drop `current`. **If that empties the pool, restore it** — the category has one subject.
4. Pick uniformly at random from what remains, using the injected `rand`.

The order matters and is not interchangeable: dropping `current` last means a completed
category still avoids dealing you the same subject twice in a row.

Order of precedence, unchanged in spirit: **`?subject=` always wins.** An explicit pin
overrides `skipSolved` entirely; that is what the parameter is for.

### 3. UI

#### Win card

One line beneath `#winmsg`, in `--muted`:

> `47 puzzles · 564 words · 9 solved in Nature`

No new screen, no new button — it reuses a card that already appears at exactly the moment
the numbers changed.

#### Picker

**Option labels carry progress, with no denominator:** `Nature — 9 solved`. A category with
nothing solved renders its bare name, so the dropdown does not fill with `" — 0 solved"`.

**There is deliberately no `9/24`.** A denominator would need the category's total, and
there are only two ways to get one, both rejected:

- *Count the module's keys.* `subjectIds` exists only after `loadCategory()`, so labelling
  25 options means importing all 25 word modules — defeating the lazy load that `sw.js`
  routes an entire separate cache to protect.
- *Hardcode 24.* Every category does hold exactly 24 today, but `content.test.js:29-34`
  refuses to pin that as an equality, and gives its reason: adding a subject is documented
  as appending one line to one file, and an equality check "would turn that documented
  one-line change red until 24 more landed elsewhere". A constant the test suite declines
  to guarantee is a label that silently goes wrong — `(25/24)` — the first time the corpus
  grows.

So the numerator is derived from `solved` and displayed alone. This needs **no new
constant, no change to `content.test.js`, and no word modules loaded**, and it keeps
adding a subject a genuine one-line change.

**A checkbox**, *Skip subjects I've solved*, beneath the select, default **on**.

`makePicker` "owns no game state" and that holds: the checkbox's initial value arrives as a
`skipSolved: boolean` dep and changes report out through an `onSkipSolved(on)` callback.
`main.js` owns the persistence.

**One deliberate asymmetry.** `open()` resets `select.value` on every open, on the stated
reasoning that "choosing a category is an act, not a setting". The checkbox is the opposite —
it *is* a setting — so `open()` must **not** reset it; it re-reads the persisted value. The
comment at `picker.js:55-57` is extended to say why the two controls differ, or the next
reader will "fix" it.

Styling uses existing tokens only, no literals, and must be declared in both palettes if any
token is added.

### 4. Failure behavior

Identical to the existing contract. A disabled, full or throwing store degrades to "progress
not remembered": counters read as their defaults, the picker shows `(0/24)`, `skipSolved`
falls back to its default, and **the game plays normally**. iOS "Block All Cookies" already
exercises this path for `storage.js` and `appearance.js`.

### 5. Tests for commit 2

**New `tests/unit/progress.test.js`:**

- Each field corrupted in turn — `solved` not an array, `puzzles` a string, the whole blob
  unparseable, the key absent — yields a usable record with the other fields intact. This is
  the merge-tolerant contract and is the most important test in the file.
- Non-string entries inside `solved` are dropped without failing the field.
- `addWord` / `addSolve` increment and persist; `addSolve` twice on one subject gives
  `puzzles === 2` and `solved.length === 1`.
- `solvedIn` counts by prefix and ignores other categories.
- `chooseSubject`: skips solved when `skipSolved`; ignores solved when not; never returns
  `current` while an alternative exists; **returns a subject rather than `undefined` when
  every id is solved** (the fully-completed-category fallback).
- A throwing store degrades silently — nothing escapes `addWord` or `addSolve`.

**New `tests/e2e/progress.spec.js`:**

- Solving a pinned puzzle increments the win card line.
- Reloading a part-finished board does **not** change the word count — the regression guard
  for the `restore()` path above.
- The checkbox persists across a reload, and across closing and reopening the picker.
- A category with solved subjects renders `— n solved` in the select, and one with none
  renders its bare name.

**`tests/unit/content.test.js` is not touched.** Its `MIN_SUBJECTS_PER_CATEGORY` floor and
the reasoning against turning it into an equality both stand — see the Picker section.

### 6. Housekeeping

- **`sw.js`** — add `'./src/progress.js'` to `ASSETS`, and bump `CACHE` from
  `wordfinder-v10` to `wordfinder-v11`. The PostToolUse hook blocks on the ASSETS parity,
  and `tests/live/smoke.spec.js` asserts every precached asset resolves, so a missed path
  fails loudly after deploy. `src/subjects/*` stays out of `ASSETS`, as always.
- **`README.md`** — a `src/progress.js` row in the file table (`pure`), a `tests/unit`
  mention, and the `src/appearance.js` row edit from commit 1.
- **`tsconfig.json`** — nothing. The `src/**/*.js` glob picks the new module up.

### Out of scope

- **Timing of any kind.** No solve timer, no best/average, no per-word timing. Explicitly
  ruled out: the app has no clock, and adding one changes a deliberately relaxed game.
- **Streaks.** No consecutive-days counter, and so no local-midnight or timezone handling.
- **Per-subject history.** `solved` is a set, not a play count. Model B (a record per
  subject) was considered and rejected as storage written but never read.
- **Export / import, transfer codes, and cross-device sync.** Not built. The record is plain
  versioned JSON specifically so export is a later addition rather than a migration.
- **A dedicated stats screen.** The numbers live where they are relevant — the win card and
  the picker.
- **Analytics or any outbound data.** Nothing leaves the device.
