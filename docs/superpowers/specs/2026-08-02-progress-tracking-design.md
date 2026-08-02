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

Worse, it has no memory of which *words* it has shown you. A subject's pool holds 40-105
words and a puzzle draws 12, so the draw re-serves words you have seen while words you have
never seen sit unused — measured, it takes **~70 plays** to see all 105 words of
`nature/birds`.

This adds a durable record of **word coverage per subject** plus a count of puzzles solved,
and uses that record to steer both which subject you are dealt and which words it draws. It
is deliberately **not** called a lifetime record anywhere in the UI; see the storage note
below.

**One rule protects reproducibility: an explicit `?seed=` bypasses the bag entirely.** The
coverage record makes word selection depend on player state, which would otherwise mean the
same `?seed=` produced different grids for different players and broke the pinned-puzzle
contract the e2e suite is built on. `rng.js` already establishes exactly this precedent — its
comment warns that the pinned branches "must NOT touch `rng`, or one `?seed=` would deal
different grids with and without the parameter". A pinned seed deals from the full pool, as
today, and records nothing.

**Storage stays client-side, and localStorage is the mechanism.** Measured against the real
corpus: a player with 40 subjects solved stores 766 bytes; every one of the 600 solved
stores 11.1 KB, which is 0.22% of the ~5 MB budget.

**IndexedDB was rejected on evidence, not size.** WebKit's tracking-prevention policy names
IndexedDB and localStorage in the same sentence when describing the 7-day cap on
script-writable storage, and its 2023 storage policy applies one quota and eviction regime
to both. Switching engines would buy no durability at all — only async complexity for
11 KB. The same policy states that "the first-party domain of home screen web applications
is exempt from ITP's 7-day cap on all script-writable storage", so the record is durable for
an installed player and at risk for someone playing in a Safari tab. That asymmetry is why
`navigator.storage.persist()` is called and why no copy promises permanence.

A server was considered and rejected — GitHub Pages serves static files and cannot hold a
secret, so a backend means accounts, auth and a privacy policy, and costs the offline-first
property, all to move 11 KB between two devices.

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

## Commit 2 — coverage tracking

### Why this is not "solved / not solved"

The obvious model — a set of subject ids you have solved — was designed, then discarded on
measurement. A subject's pool holds **40 to 105 words (median 45)** and a puzzle draws
**12**, so one win covers **27% of an average subject** and 11% of the largest. Marking
`nature/birds` "solved" after one puzzle claims 105 words on the evidence of 12, and a
filter that then skipped it would hide roughly 90 words the player had never seen — the
feature meant to supply fresh content would have been withholding most of it.

Measured on `nature/birds` (105 words): reaching every word by today's random draw takes
**~70 plays**.

So the unit of progress is **word coverage within a subject**, not a boolean.

### 1. The shuffle bag

Each subject gets a bag of the words not yet drawn in the current cycle. A puzzle draws from
the bag; when the bag empties, the cycle count increments and the bag refills.

This is the standard shuffle-bag pattern and it earns its place three times over:

| | Today | With the bag |
| --- | --- | --- |
| Plays to see every word, median 45-word pool | ~24 | **4** |
| Plays to see every word, 105-word pool | ~70 | **9** |
| Spread between most- and least-used word | unbounded | **≤ 1, structurally** |

That last row is the "threshold for max word usage" — it needs no threshold, because no word
can be drawn twice until every word has been drawn once. There is nothing to tune.

### 2. `src/progress.js` — a new pure module

Pure set, no DOM, injected store, and it never throws into the game — the `makeStorage`
idiom. **Key: `wordfinder-progress-v1`**, separate from `wordfinder-save-v1`.

```js
{ v: 1, puzzles: 47, favourLeastSeen: true,
  bags:  { 'nature/birds': { n: 105, c: 1, d: 'AwBRAA==' } },
  sizes: { nature: 24 } }
```

| Field | Meaning | Default |
| --- | --- | --- |
| `puzzles` | puzzles solved, all subjects | `0` |
| `favourLeastSeen` | whether the draw prefers less-seen subjects | `true` |
| `bags[id].n` | the subject's pool length — the drift guard | — |
| `bags[id].c` | completed cycles through the whole pool | `0` |
| `bags[id].d` | base64 bitmask of words drawn this cycle | `''` |
| `sizes[catId]` | the category's subject count, learned on load | `{}` |

**Measured sizes.** Worst case, every one of the 600 subjects part-way through a cycle:
**28.7 KB**, 0.6% of the ~5 MB budget. A heavy player with 200 subjects touched: **9.5 KB**.
The two rejected encodings were a `{WORD: count}` map (319 KB) and a parallel count array
(64.9 KB); the first is what would have forced IndexedDB, since localStorage rewrites the
whole record on every write and 319 KB of synchronous serialisation twelve times a puzzle is
not acceptable on a phone.

**localStorage stays, and IndexedDB is rejected on evidence.** Its supposed durability
advantage does not exist: WebKit's tracking-prevention policy names "Indexed DB,
LocalStorage, Media keys, SessionStorage, Service Worker registrations and cache" together as
the storage subject to the 7-day cap, and applies one eviction regime to both. Its real
advantage — partial updates without a full rewrite — is worth nothing at 29 KB, and would
cost the synchronous, pure, injectable-store design that `storage.js` and this module share.

#### Pool drift: the guard, and why it is only a length check

`d` indexes words by position in the subject's word list, so editing that list would
silently misalign an existing player's bag. `n` is stored alongside and checked on read: **if
the pool length differs, that subject's bag is discarded and a fresh cycle starts.** Only
that one subject's cycle state is lost; `puzzles`, `sizes` and every other bag survive.

This catches insertions and deletions, not a pure reordering or a same-length substitution.
That is a deliberate trade: a hash would catch those too, but the failure it does not catch
is a player seeing one slightly-off distribution for one cycle, which self-corrects at the
next refill. Not worth a hash function and a per-subject digest.

#### Validation is merge-tolerant — the opposite rule to `storage.js`

`storage.load()` returns `null` if any field is malformed, because "a save is either complete
or it is not a save". That is right for a board and **wrong for a long-lived record**: one
bad `puzzles` write must not discard 600 bags.

The read path validates each field independently, substitutes the default for anything it
cannot trust, keeps the rest, and **never yields `null`**. A bag whose `n` is not a positive
number, or whose `d` is not a string, is dropped individually — the other 599 survive.

#### Exports

```js
export const KEY = 'wordfinder-progress-v1';
export function makeProgress(store)   // store optional; defaults to defaultStore()
  //  .get()                      → the record (a copy)
  //  .bagFor(subjectId, pool)    → {undrawn:Set<string>, cycles:number} — refills, guards on length
  //  .noteDraw(subjectId, pool, words) → mark words drawn; refill + c+1 when the bag empties
  //  .addSolve()                 → puzzles + 1
  //  .noteSize(catId, n)         → record a category's subject count
  //  .coverage(subjectId)        → 0..1 within the current cycle; 1 if cycles > 0
  //  .setFavourLeastSeen(on)
  //  .isComplete(catId, ids)     → every subject in the category has cycles >= 1

/** Pure, exported for tests and for main.js's draw. */
export function chooseSubject(subjectIds, seen, current, favourLeastSeen, rand)
```

`seen` is a `Map<subjectId, number>` of coverage. `chooseSubject` picks uniformly at random
among the subjects tied for **lowest** coverage, excluding `current` unless it is the only
option.

**This removes the exhaustion edge case entirely.** The earlier binary-skip design needed a
documented fallback for "every subject in this category is solved", because filtering could
empty the pool. Least-seen never empties: there is always a minimum. There is no dead end to
handle, and no "you have finished everything" state to message.

### 3. Changes to `src/puzzle.js`

`pickWords(pool, rng, {count, mix})` gains an optional `undrawn` Set. Within each length
bucket it partitions the eligible words into undrawn and drawn, shuffles each independently,
and takes undrawn first, topping up from drawn only when a bucket cannot be filled.

The bucket constraints still win. A bag is a preference, not an override — a puzzle that is
short a 9-12 letter word must still take a drawn one rather than ship a malformed board.

**`puzzle.js` stays pure.** `undrawn` is an argument, not a lookup; omitting it reproduces
today's behaviour exactly, which is what keeps the existing unit tests meaningful and lets
the new behaviour be tested with a hand-built Set and no storage at all.

### 4. Where it hooks into `main.js`

| Site | Change |
| --- | --- |
| `newPuzzle`, before `buildPuzzle` | `progress.bagFor(id, pool)` → pass `undrawn` through |
| `newPuzzle`, after `buildPuzzle` | `progress.noteDraw(id, pool, puzzle.words)` |
| the `won` branch, `main.js:252` | `progress.addSolve()` |
| after `loadCategory`, `main.js:316` / `main.js:400` | `progress.noteSize(id, cat.subjectIds.length)` |
| the pool filter, `main.js:325-327` | `chooseSubject(...)` replaces the inline pick |
| boot | `navigator.storage?.persist?.()`, fire-and-forget |

**`noteDraw` fires at deal time, not at win.** The bag records what you were *shown*; solving
is a separate fact counted by `addSolve`. This also means an abandoned puzzle still advances
coverage, which is correct — you saw those words.

**`restore()` must not call `noteDraw`.** It rebuilds a board that was already dealt, so
recording the draw again would double-advance the bag. `restore()` at `main.js:426` calls
`newPuzzle`, so the draw-recording has to sit on the path `newGame` uses and be skipped on
the restore path — this is the one genuine correctness trap in the commit, and it gets both a
comment and a dedicated e2e test.

### 5. UI

#### Win card

One line beneath `#winmsg`, in `--muted`: `48 puzzles solved`. When the win completed a
cycle, a second sentence replaces it: `That's every Nature Birds word at least once.`

**Live region, per ARIA22:** `role="status"` with an explicit `aria-atomic="true"` — ARIA22
notes `role="status"` "is currently not treated as atomic by default in some environments" —
present and **empty** in the initial HTML, populated later. The counter goes in the live
region or in the focused card, never both, or it can be announced twice.

**No progress bar.** Apple HIG defines progress indicators as transient, "appearing only while
an operation is ongoing"; a persistent one contradicts that and a static one reads as stalled.

#### Picker

**A category whose every subject has been fully covered reads `Nature (done)`.** Everything
else renders its bare name — no counts, no fractions.

The suffix is **text, not a tick**: `<option>` permits text content only, and a `✓` is
announced inconsistently. **Labels are refreshed in `open()`, before `select.focus()`** —
never while the select is live. Roselli's tested writeup documents JAWS+Chrome and
NVDA+Firefox failing to announce updated accessible names, and notes devtools *mask* the bug
by showing the new name while the AT reports the old one.

**A checkbox**, *Favour subjects I've seen least*, default **on**. A checkbox and not a
switch: Apple HIG says use a switch "only in a list row", and both HIG and Material 3 tie
switches to settings that take effect immediately, whereas this applies on Start.

Control and text sit in one `<label>` with `min-height: 48px` — clearing Apple's 44pt,
Material's 48dp, WCAG 2.2 AAA's 44px and BBC GEL's 44px at once. ≥12px separates it from the
button row.

`makePicker` still owns no game state: `favourLeastSeen` and an `isComplete(catId)` predicate
arrive as deps, changes report out via `onFavourLeastSeen(on)`, and `main.js` persists.

**One deliberate asymmetry.** `open()` resets `select.value` every time, because "choosing a
category is an act, not a setting". The checkbox *is* a setting and must **not** be reset. The
comment at `picker.js:55-57` gets extended to say why, or the next reader will "fix" it.

#### The dialog must not outgrow the screen

The picker gains a checkbox row. Apple HIG: "avoid displaying an alert that scrolls." A
landscape iPhone leaves ~375px of usable height and WCAG 1.4.4 requires 200% text to work, so
this is the realistic failure, not a theoretical one. `#pickercard` is capped at `100dvh`
minus safe-area insets, its middle scrolls, `#picker-actions` stays visible.
**`npm run shots -- landscape --measure` is the check** — this is the exact bug class
`CLAUDE.md` records as passing all 59 e2e tests.

### 6. Failure behavior

A disabled, full or throwing store degrades to "progress not remembered": every bag reads
empty, so every draw behaves exactly like today's random draw, the counter reads 0, no
category is marked, and **the game plays normally**. iOS "Block All Cookies" already
exercises this path for `storage.js` and `appearance.js`.

### 7. Tests

**New `tests/unit/progress.test.js`:**

- Each field corrupted in turn — `bags` not an object, a bag with a non-numeric `n`, `d` not
  a string, `puzzles` a string, the blob unparseable, the key absent — yields a usable record
  with everything else intact. The merge-tolerant contract; the most important test here.
- **Pool drift:** a bag whose stored `n` differs from the pool length is discarded and starts
  a fresh cycle, and the other bags are untouched.
- `noteDraw` marks words drawn; drawing the last word increments `c` and clears `d`.
- `coverage` is `popcount(d)/n` mid-cycle and `1` once `c > 0`.
- `bagFor` returns every word when there is no stored bag.
- `chooseSubject` returns a lowest-coverage subject, avoids `current` while an alternative
  exists, returns `current` when it is the only id, and **never returns `undefined`**.
- `isComplete` is false when any subject has `c === 0`, and false when `sizes` is unknown.
- A throwing store degrades silently.

**`tests/unit/puzzle.test.js` gains:**

- `pickWords` with an `undrawn` Set draws only from it while it can satisfy the buckets.
- It tops up from drawn words rather than returning a short list when a bucket cannot be
  filled from `undrawn` alone.
- **Omitting `undrawn` reproduces today's output for a given seed** — the guard that the new
  argument did not change existing behaviour.

**New `tests/e2e/progress.spec.js`:**

- Solving a pinned puzzle increments the win card counter.
- **Reloading a part-finished board does not advance the bag or the counter** — the
  `restore()` trap above.
- Playing the same subject twice deals a different word set the second time.
- The checkbox persists across a reload and across reopening the picker.
- With a seeded record, a fully-covered category renders `(done)`.
- A landscape-phone viewport shows the picker's buttons without the card overflowing.

**`tests/unit/content.test.js` is not touched.** Its `MIN_SUBJECTS_PER_CATEGORY` floor stands;
`sizes` is why nothing here needs an equality.

### 8. Housekeeping

- **`sw.js`** — add `'./src/progress.js'` to `ASSETS`, bump `CACHE` to `wordfinder-v11`. The
  PostToolUse hook blocks on ASSETS parity; `tests/live/smoke.spec.js` catches a bad path
  after deploy. `src/subjects/*` stays out, as always.
- **`README.md`** — a `src/progress.js` row (`pure`), the `src/appearance.js` row from commit
  1, and a note in the reproducible-puzzles section that a pinned `?seed=` bypasses the coverage
  bag, so it still reproduces a grid identically for every player.
- **`tsconfig.json`** — nothing; the `src/**/*.js` glob picks it up.

---

## Research findings that shaped this

Four research passes ran before implementation. What changed, and the source:

| Finding | Effect on the design |
| --- | --- |
| Roselli, *Be Careful with Dynamic Accessible Names* — JAWS+Chrome and NVDA+Firefox fail to announce updated names; devtools mask it | No counts in `<option>` text; labels refreshed only in `open()`, before focus |
| Nunes & Drèze, *JCR* 32(4) 2006 (endowed progress); Kivetz et al., *JMR* 43(1) 2006 (goal gradient) | No fractions. "23/24" across 25 rows is the strongest compulsion mechanism available; a done-mark is a record, a fraction is a goal |
| Mekler et al., *CHB* 71:525-534 (2017) — points/levels raised output without reducing intrinsic motivation | A bare counter is safe to ship; the documented harm (Hanus & Fox 2015) comes from social comparison, which this has none of |
| WebKit tracking-prevention policy — "the first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writable storage" | localStorage is durable enough **when installed**; a browser-tab visitor is not exempt, which is why the copy never says "lifetime" |
| ITP names IndexedDB and localStorage in the same sentence; WebKit applies one eviction regime to both | IndexedDB rejected — it would buy no durability, only async complexity |
| Apple HIG Progress indicators — "all progress indicators are transient" | No progress bar |
| Apple HIG Toggles — switch "only in a list row"; HIG and M3 both tie switches to immediate effect | Checkbox, which is also the native control |
| Apple HIG Alerts — "avoid displaying an alert that scrolls" | The picker gets a height cap and a landscape e2e guard |
| ARIA22 — `role="status"` "is currently not treated as atomic by default in some environments"; container must exist before the message | Explicit `aria-atomic="true"`; region rendered empty in initial HTML |
| Apple 44pt / Material 48dp / WCAG 2.2 AA 24px / AAA 44px / GEL 44px — four different minimums | 48px, which clears all of them at once |
| Shuffle bag — draw without replacement, refill when empty — surfaced as the canonical fix for re-serving completed content | The whole coverage model. It also supplies the "max word usage threshold" structurally, so there is nothing to tune |
| Open Trivia DB's session tokens return an explicit "Token Empty, resetting is necessary" state at exhaustion rather than silently repeating | Informed the earlier binary-skip design's fallback; made moot by least-seen selection, which cannot exhaust |

### Measurements taken for this spec

Every number here was produced by running the real corpus, not estimated:

| Measurement | Result |
| --- | --- |
| Pool size per subject | min 40, median 45, max 105, mean 45.2 |
| Coverage of a subject per puzzle | 27% mean, 11% for the 105-word pool |
| Plays to see every word of `nature/birds`, random draw | ~70 |
| Plays to see every word, shuffle bag | 4 (median pool), 9 (largest) |
| Record size, all 600 bags part-way | 28.7 KB — 0.6% of the ~5 MB budget |
| Record size, 200 subjects touched | 9.5 KB |
| Rejected encodings | `{WORD:count}` map 319 KB; parallel count array 64.9 KB |
| Distinct grids from 500 seeds over the *same* 12 words | 500 |
| Distinct 12-word sets from 5000 seeds on a 105-word pool | 5000 |

## Out of scope

- **Timing of any kind.** No solve timer, no best/average, no per-word timing. The app has
  no clock, and adding one changes a deliberately relaxed game.
- **Streaks.** No consecutive-days counter, and so no local-midnight or timezone handling.
- **A words-found counter.** Cut after research: it is a proxy for time spent, only goes up,
  and no player holds a goal expressed in words found.
- **Fractions and percentages** anywhere in the UI, per the endowed-progress finding. The
  coverage number exists in the record and drives the draw; it is never shown.
- **Reset progress.** Considered and deferred. The argument for it is real — without one, a
  player who dislikes their record can only clear site data, which also destroys their
  appearance preference and saved board. Revisit if coverage is ever surfaced as a number.
- **Per-word statistics as a UI.** The bag knows which words you have seen; nothing displays
  it. No "hardest word", no per-word history screen.
- **A hash-based pool-drift guard.** The stored pool length catches insertions and deletions;
  a same-length substitution is accepted as a one-cycle distribution skew that self-corrects.
- **Cross-subject or global word balancing.** The bag is per subject. A word appearing in six
  subjects is tracked six times, independently — that is correct, since it is a different
  puzzle each time.
- **Export / import, transfer codes, and cross-device sync.** The record is plain versioned
  JSON specifically so export is a later addition rather than a migration.
- **A dedicated stats screen**, and any on-screen copy about where progress is stored.
- **Analytics or any outbound data.** Nothing leaves the device.
