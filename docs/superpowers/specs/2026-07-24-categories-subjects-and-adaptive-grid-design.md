# Categories, subjects, deep word pools and an adaptive grid — design

**Status:** design approved in conversation; this document awaiting review
**Supersedes the data model in:** `2026-07-24-appearance-and-topic-rename-design.md` (the `theme` → `topic` rename; `topic` now becomes `subject`)

## Goal

Turn the flat list of 105 twelve-word topics into a two-level catalog — **Category → Subject** — where each subject carries a pool of 100+ words and each puzzle draws a length-mixed sample from it. Let the player choose a category when starting a new game, and give phones a grid sized for a phone.

## Why

Three problems, one shape:

- **The phone grid is unplayable-small.** `size` is already a parameter through `computeLayout`, `buildPuzzle` and `renderGrid`; only `main.js` pins `const N = 13`. On an iPhone 13 in portrait that yields `floor(256 / 13)` = **19px cells**.
- **A subject is exhausted after one game.** Twelve words drawn from a twelve-word list is not a draw. Replaying "Birds" gives the same twelve words forever; only the placement differs.
- **105 flat topics have no shape.** There is nothing to choose between, and nothing to hang 600 subjects off.

## Scope

This spec is **Spec A**: the engine, the UI and the data contract, shipping with **3 fully-written categories** (~72 subjects × 100+ words). That is enough to exercise every path end to end — lazy loading, the picker, both grid presets, offline behaviour — and it is independently shippable.

**Spec B**, outlined at the end, fills the remaining ~22 categories against the validation contract this spec defines. It is a content project, not an engineering one, and it gets its own plan.

### Non-goals

- No build step, no bundler, no runtime dependencies. What is in the repo is what GitHub Pages serves.
- No cross-device sync. `localStorage` is per-origin and per-device; that is the whole persistence story.
- No difficulty setting. Grid size follows the device, not a preference.
- No second-level subject picker. A category is chosen; the subject inside it is drawn at random.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Name below Category | **Subject** | Nests naturally under Category and does not collide with the existing `Puzzle` type in `puzzle.js`. |
| Catalog size | **25 categories × ~24 subjects ≈ 600 subjects**, 100+ words each | Depth over breadth: a pool deep enough that a subject stays fresh for many games beats twice as many shallow ones. |
| Grid | Two presets: **13×13 / 12 words**, **10×10 / 8 words** | Two cases to test and one threshold to justify. Adaptive-to-pixels multiplies states without a matching gain. |
| Preset key | `min(screen.width, screen.height) < 480` — **device, not window** | A device's preset must be fixed. Screen dimensions survive window resizes, rotation and iPad Slide Over; viewport dimensions do not. |
| Length mix | **3 short / 5 medium / 4 long** (12 words); **2 / 3 / 3** (8 words) | Weighted toward the hunt rather than toward freebies. |
| Picker | Header `New game` always opens it; win card stays instant random | A winning streak should not be interrupted by a dialog. |
| Picker control | Native `<select>` + Start | 25 chips is 8–12 rows on a phone. A `<select>` is compact at any count, renders as a wheel picker on iOS, and is accessible for free. |
| Picker depth | Category only → random subject inside it | A 24-item second screen is friction for no information gain. |
| Resume | **The save always wins**; the preset governs only the next new game | Progress must never be destroyed by a refresh. With the preset fixed per device this is a safety net rather than a live path. |
| Offline | Precache shell + catalog; cache category modules as played | Keeps install at ~40 KB instead of ~700 KB. |

## Architecture

### Data model

Three modules replace `src/topics.js`:

| Module | Loaded | Holds | Size |
|---|---|---|---|
| `src/catalog.js` | eagerly | `[{id, name, subjects: [{id, name}]}]` — **names only, no words** | ~12 KB |
| `src/subjects/<category>.js` | lazily, via `import()` | `export const WORDS = {'nature/birds': 'EAGLE,SPARROW,…', …}` | ~25 KB each |
| `src/subjects.js` | eagerly | `loadSubject(id)`, memoising each category module after first load | tiny |

Subject ids are slugs (`nature/birds`), never array indices. An index is invalidated by every insertion and reorder; with 600 subjects across 25 files being edited independently, that is a guaranteed source of silently-wrong saves and dead URLs.

`catalog.js` exists so the picker can render 600 names without downloading 600 word pools. It is the only content that loads unconditionally.

**Why this makes 600 subjects affordable:** the full corpus is ~500–700 KB. Loading it all to play one subject is indefensible; loading a ~12 KB index plus the one ~25 KB category you chose is not.

### `src/subjects.js` — the loader

```js
loadSubject(id: string): Promise<{id, name, category, categoryName, words: string[]}>
```

Splits the id at `/`, dynamically imports `./subjects/<category>.js`, memoises the module in a `Map`, and returns the parsed pool. `import('./subjects/' + cat + '.js')` resolves at runtime in the browser with no bundler involved, which is what keeps the no-build-step constraint intact.

Rejects with a typed error when the module cannot be fetched (offline, uncached) so callers can distinguish "no network" from "no such subject".

### `src/puzzle.js` — content-agnostic

`buildPuzzle` currently reaches into the topics table and indexes it. It changes to take the resolved pool:

```js
buildPuzzle({name, pool, rng, size, count, mix}) -> Puzzle
```

The generator loses all knowledge of where words come from, and a unit test can hand it a synthetic pool instead of a real subject.

**Length-mixed selection.** A new pure export:

```js
pickWords(pool, rng, {count, mix}) -> string[]
```

`mix` is a list of `{min, max, take}` buckets. Words are bucketed by length, each bucket is shuffled and drawn from. A bucket short of candidates backfills from the nearest bucket by length distance, so the function always returns exactly `count` words or throws if the pool cannot supply them at all.

```
13×13, 12 words              10×10, 8 words
  short  3–5 letters   × 3     short  3–4 letters   × 2
  medium 6–8 letters   × 5     medium 5–6 letters   × 3
  long   9–12 letters  × 4     long   7–9 letters   × 3
```

Maximum word length stays `size - 1`, as today: 12 for the full preset, 9 for the compact one.

**Placement retry.** Today a word that fails 400 placement attempts is *silently dropped* — the board quietly comes up with 11 words and the player is never told. With a deep pool there is a better answer: draw a replacement from the same length bucket and retry, up to a bounded number of swaps. This turns "all `count` words are placed" from luck into a guarantee, which matters most at 10×10 where fill density is highest.

`placements` continues to record where each word landed, so the existing "every placed word is readable in the grid" test still holds.

### `src/layout.js` — presets

A new pure export:

```js
pickPreset({screenW, screenH}) -> {size: 13, count: 12} | {size: 10, count: 8}
```

Compact when `Math.min(screenW, screenH) < 480`, full otherwise.

**The inputs are `screen.width`/`screen.height`, not the viewport.** The preset is a property of the *device*, so it must not move when the window does. Screen dimensions survive a resized desktop window, a rotation, and an iPad in Slide Over; viewport dimensions survive none of them.

| Device | `screen` | `min` | Preset |
|---|---|---|---|
| iPhone 13 | 390 × 844 | 390 | compact |
| iPhone Pro Max | 430 × 932 | 430 | compact |
| iPad mini | 744 × 1133 | 744 | full |
| Desktop | 1440 × 900 | 900 | full |
| Desktop, window dragged to 300px wide | 1440 × 900 | 900 | **full** — unchanged |

`min()` rather than a fixed axis because platforms disagree about rotation: iOS Safari reports the portrait-orientation values whatever way the device is held, while Chrome on Android swaps them. Taking the smaller edge is correct under both.

The preset is resolved **once, on load**. `resize` continues to recompute cell size only; it never re-picks a preset and never rebuilds a board. Since `screen` is fixed for a device, a given install always plays one preset.

**`RESERVE_PORTRAIT` becomes a function of word count.** Eight words is four list rows, not six, and every row the list does not draw is a row the grid can have:

```js
reservePortrait(count) = RESERVE_BASE + Math.ceil(count / 2) * ROW_H
```

`RESERVE_BASE` and `ROW_H` are pinned so that `reservePortrait(12) === 366` exactly — the value in the file today. That makes the full preset a provable no-op and confines all risk to the compact case, which the existing e2e layout device table covers. The derived value for 8 words is ~298, taking iPhone 13 portrait cells from **19px to ~32px**.

### `src/storage.js` — save shape

```js
{seed, subjectId, size, count, found: [{word, x0, y0, x1, y1}]}
```

`topicIdx` is gone. `size` and `count` are recorded so a board is reproducible from the save alone, without consulting the device that reopens it.

**Restore rule: the save always wins.** A saved board is rebuilt exactly as snapshotted, whatever the current preset says; the preset governs only the next new game. Progress is never destroyed by a refresh.

Because the preset is keyed on `screen` rather than the viewport, a device's preset is fixed, so a saved `size` should always match. The rule is therefore a safety net — for a browser migrated between machines with its profile, or a future third preset — not a live path. It is written this way because the alternative fails destructively: silently discarding a board is not something the player can undo.

**Legacy saves are discarded, once.** A save written before this ships has no `size` field, and its board is unreproducible anyway: it was built by drawing 12 words from a 12-word list, and that pool no longer exists. Absence of `size` is therefore the whole detection rule — no migration code, no frozen legacy pool. One board is lost, once, for anyone mid-game at deploy.

### `src/rng.js` — URL resolution

`resolveTopicIndex` is replaced by:

```js
resolveSubject(search, catalog, rng) -> string   // a subject id
```

- `?subject=nature/birds` — that subject, when it exists in the catalog.
- `?category=nature` — a random subject within that category.
- neither — a random subject across the whole catalog.

The existing asymmetry is preserved and is not decoration: **the fully-explicit branch must not touch `rng`**, or pinning a subject would shift the sequence and `?seed=` would stop reproducing its grid. `?topic=N` is retired rather than aliased.

### Boot flow

Loading a pool is now asynchronous, so boot becomes a promise chain (top-level `await` in `main.js`; ES modules support it and there is no bundler to appease):

1. Resolve the preset from `screen`.
2. If `?seed=` / `?subject=` / `?category=` is present, that wins — load and deal.
3. Otherwise, if a save with a `size` field exists, load its subject and restore it.
4. Otherwise deal a random subject at the current preset.

Steps 2–4 are alternatives, not stages. If whichever one applies fails to load (offline, category not cached, subject since removed), fall back to a random subject from an already-cached category, and only then to an inline error state.

`#subject` shows `Loading…` until boot resolves, as the markup already does.

## The picker

A new `#picker` dialog, built on the existing `#confirm` markup and styling so it inherits the scrim, card, `popIn` animation and Escape handling already in place.

```
+-- New game ------------------------+
| ! Your progress will be lost       |   <- only when a board is in progress
|                                    |
|  Category                          |
|  [ Surprise me                v ]  |   <- <select>, 25 options + Surprise me
|                                    |
|        [Cancel]      [Start]       |
+------------------------------------+
```

A native `<select>` rather than a grid of chips: 25 chips is eight to twelve rows on a phone, while a `<select>` is one control at any count, renders as a wheel picker on iOS, and brings keyboard and screen-reader support for free.

- Header `New game` always opens the dialog. The mid-board warning line is shown or hidden; the dialog itself is unconditional, which replaces today's "confirm only when progress exists" branch.
- The `<select>` is populated from `catalog.js` at startup, with **Surprise me** as the first option and the default selection. **Start** loads the chosen category and deals a random subject inside it; Surprise me picks a random category first.
- The selection is not remembered between games — the dialog reopens on Surprise me every time. Choosing a category is an act, not a setting.
- The win card's `Play a new game →` bypasses the dialog entirely and deals an instant random game.
- `#confirm` is deleted; the picker absorbs its job.

**Offline degradation.** A category whose module is not cached fails its `import()`. The dialog stays open, the failure is reported inline, and that option is marked `disabled` so it cannot be chosen again in the same session — it must not close the dialog or leave the board in a half-built state. Surprise me picks only among options that are not disabled.

In practice there is no cold-start gap: the first visit must be online for the service worker to install at all, and that visit loads and caches one category. Offline play therefore always has at least one category available.

### Header

```
WORD FINDER
Nature · Birds
```

`#topicline` becomes `#subjectline`, holding `<span id="category">` and `<span id="subject">`. The separator is a CSS `::after` on `#category`, not text, for the same reason the `Topic:` label was a sibling rather than a `::before`: `#subject`'s `textContent` must stay the bare subject name, because tests compare it across two loads of one seed, and the per-subject accent underline must mark the name alone.

`accentSlot()` continues to hash the name — now the subject name — so a subject keeps its colour across reorderings of the catalog.

## Service worker

- **Precached at install**, in the versioned `CACHE`: the shell — `index.html`, `styles.css`, every `src/*.js` including `src/catalog.js`, icons, manifest. ~40 KB. `CACHE` is bumped, as every deploy does.
- **Runtime-cached, cache-first**, in a **separate, unversioned cache** (`wordfinder-subjects`): `src/subjects/*.js`, on first successful fetch.

The second cache must not be versioned alongside the shell. If category modules lived in `CACHE`, the activate-time sweep that deletes old versions would throw away every category the player had downloaded on every deploy — up to ~700 KB re-fetched to fix a one-line CSS change, and an offline player left with nothing to play. Word data changes only when its own file does, so it is versioned by filename and evicted only when a category is removed from the catalog.

## Content contract

Enforced by a unit test over every subject module. A subject that cannot meet it does not ship — with 600 to write, cutting a weak one is cheaper than shipping filler.

| Rule | Value |
|---|---|
| Words per subject | ≥ 100 |
| Word charset | `A–Z` only, uppercase, no spaces, hyphens or digits |
| Word length | 3–12 letters |
| Duplicates within a subject | none |
| Subject names | unique across the whole catalog |
| Category ids | lowercase slug, matching the module filename |
| Catalog ↔ modules | every catalog subject id exists in its module, and vice versa |
| Bucket floors | ≥ 8 words in each of 3–5, 6–8, 9–12, 5–6 and 7–9; **≥ 6** in 3–4 |

The 3–4 letter bucket is the binding constraint — short on-topic words are the scarce ones — so its floor is 6 rather than 8. The compact preset draws only 2 from it, leaving headroom for placement retries.

## Testing

**Unit (`node:test`)**

- `catalog.test.js` — ids unique and well-formed; catalog and modules agree in both directions.
- `content.test.js` — the contract table above, over every subject in every module.
- `puzzle.test.js` — `pickWords` honours the mix; backfills a short bucket; every subject builds a full board at **both** presets with every word placed and readable.
- `layout.test.js` — `pickPreset` returns the same preset for a device's portrait and landscape `screen` values, and is unchanged by viewport size; `reservePortrait(12) === 366` exactly; compact fits every in-scope device.
- `storage.test.js` — the new shape round-trips; a save without `size` is discarded; a save with a mismatched `size` is still restored.
- `subjects.test.js` — the loader memoises, and surfaces a typed error on import failure.
- `rng.test.js` — `resolveSubject` for all three forms; the explicit branch does not consume `rng`; `?topic=` is ignored.
- `sw.test.js` — `src/catalog.js` is in the precache list and `src/subjects/*` is not; the activate-time sweep spares `wordfinder-subjects`.

**e2e (Playwright)**

- Picker opens from the header, closes on Cancel and Escape, and shows the warning line only mid-board.
- Selecting a category and pressing Start begins a game whose header shows that category.
- Surprise me (the default selection) starts a game.
- The win card deals a game without opening the picker.
- Mobile project renders 10×10 with 8 words; desktop renders 13×13 with 12.
- Resizing the desktop viewport below 480px does **not** change the board or the preset.
- A board restores across a preset mismatch with progress intact (forced by writing a mismatched save directly, since a real device cannot reach this state).
- Offline: an uncached category reports inline, is disabled, and the dialog survives it.
- The existing determinism, layout, appearance and service-worker suites, updated for `?subject=`.

**One Playwright config change is load-bearing.** The `mobile` project sets `viewport` but not `screen`, so `screen.width` would report the desktop default and the mobile project would silently test the *full* preset. It must gain `screen: {width: 390, height: 844}` alongside its viewport. Without it, the compact preset has no e2e coverage at all — and the failure is silent, which is the dangerous kind.

## Spec B — content (follow-on)

The remaining ~22 categories, ~24 subjects each, 100+ words per subject: roughly 53,000 words. Generated per category, each batch gated by `content.test.js` before it lands, then spot-reviewed for on-topic accuracy — a word that passes the charset and length rules can still simply not be about the subject, and no test catches that.

Its plan should decide batch size, review sampling rate, and what happens to a subject that cannot reach 100 genuine words.
