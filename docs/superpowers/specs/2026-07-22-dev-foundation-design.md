# Dev foundation — design

**Date:** 2026-07-22
**Status:** approved, not yet implemented
**Scope:** test infrastructure, module structure, type checking. First of three specs.

## Context

`word-finder` is a themed word-search PWA: dependency-free ES modules, no build step,
served verbatim from GitHub Pages, deploy is `git push`. It is played mainly on iPhone
and iPad.

Four bugs have been fixed so far: a stale service-worker cache, a stale win-overlay
timer, diagonal drag overshoot, and an over-broad service-worker navigation fallback.
**None of them were type errors.** Every one was a runtime or lifecycle fault, and every
one was found by hand, in a browser, after shipping. That is the gap this spec closes.

Two further constraints come from measurement rather than assumption:

- `game.js` is 204 lines carrying eight responsibilities (puzzle generation, layout
  arithmetic, three kinds of rendering, pointer handling, effects, audio, SW
  registration). The next two specs both land inside it.
- The bug in `snap()` was in a **pure function with no DOM dependency**, yet the only
  way to exercise it was driving a real browser drag.

## Goals

1. A local test suite that catches regressions before they reach the deployed site.
2. Structure that makes the pure game logic testable without a browser.
3. Type checking, without giving up the zero-build-step deploy.
4. Regression coverage pinning all four already-fixed bugs.

## Non-goals

Explicitly out of scope, to keep this spec implementable in one pass:

- Any change to layout, sizing, or responsive behaviour — that is spec 2.
- Any change to game feel, persistence, accessibility, or audio — that is spec 3.
- CI / GitHub Actions. Tests run locally, on purpose.
- Puzzle sharing. The seeded RNG below makes it possible later; this spec does not build it.
- Any user-visible change whatsoever. A player must not be able to tell this shipped.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Types | JSDoc + `tsc --noEmit` | Full editor types and a `typecheck` gate with **zero build step**. The browser runs the exact file authored, so deploy stays `git push` and tests exercise the shipped artifact rather than a compiled one. |
| Structure | `src/`, split on the DOM boundary | Makes pure logic unit-testable in milliseconds. The one bug class already seen in a pure function becomes cheap to pin. |
| Test determinism | Seeded RNG via `?seed=` | Failures replay exactly. Crucially **not** a test-only branch: the seeded path is the shipped path. |
| Test target | Local `webServer` + separate live smoke | Pre-push tests cannot run against production. Playwright owns the server's lifecycle and kills it on exit, which fixes the orphaned-`http.server` problem that motivated the "test on Pages, not localhost" rule. A separate opt-in `test:live` still exercises the real Pages URL. |

## Architecture

### Module layout

```text
index.html   sw.js   styles.css   manifest.webmanifest   icon-*.png
src/
  rng.js        seeded PRNG + seed resolution        PURE
  puzzle.js     placement, snap, hit-detection       PURE
  layout.js     viewport arithmetic -> dimensions    PURE
  view.js       cell / pill / list rendering         DOM
  effects.js    confetti + WebAudio                  DOM
  main.js       wiring, listeners, SW registration   DOM
  themes.js     puzzle content                       DATA (unchanged)
tests/
  server.mjs    tiny static file server for Playwright
  unit/         node:test, no browser
  e2e/          Playwright
  live/         Playwright, opt-in, runs against Pages
```

`index.html`, `sw.js`, `styles.css`, the manifest and the icons **stay at the repo root**.
`sw.js` must be at the served root for its scope to cover the whole app, and `index.html`
must be there for `/` to resolve.

**Refinement to note at review:** the approved sketch had five modules; this splits
`layout.js` (pure arithmetic) from `view.js` (DOM). Spec 2 rewrites exactly that
arithmetic, and keeping it pure is what lets spec 2's fix be unit-tested across a table
of device sizes instead of only through a browser. Merging the two would undercut the
DOM-boundary rationale for the whole split.

### Interfaces

Pure modules — no DOM, no globals, no `Math.random`:

```js
// src/rng.js
makeRng(seed)          -> { random(), int(n), pick(arr), shuffle(arr) }
resolveSeed(search)    -> number            // ?seed= when present, else clock
resolveThemeIndex(search, themeCount, rng) -> number   // ?theme= when present

// src/puzzle.js
buildPuzzle({ themes, themeIdx, rng, size, count })
  -> { name, cells: string[], words: string[], placements: [{word,x0,y0,dx,dy}] }
snap(sx, sy, fx, fy, size)   -> { x1, y1 }
readLine(cells, size, sel)   -> string
matchWord(words, found, str) -> string | null
cap(s)                       -> string

// src/layout.js
computeLayout({ vw, vh, size, pad })
  -> { landscape, cell, gridSize, sideWidth, listColumns }
```

`placements` is retained (today `placed.push(w)` discards the coordinates) solely so a
unit test can assert every word is actually readable in the grid at its recorded
position. It is not a feature.

DOM modules keep their current behaviour, reorganised only.

### Seeded RNG

`mulberry32`, six lines. `?seed=<int>` pins the sequence; `?theme=<int>` pins the theme.
With neither, the seed comes from the clock and behaviour is identical to today. Every
current `Math.random()` call site moves to the injected `rng`.

## Test strategy

**Unit — `node:test`, no browser, no dependency.** Node 24 ships the runner.

- `rng`: same seed reproduces the same sequence; different seeds diverge.
- `snap()`: all eight directions; **the diagonal-overshoot regression** (a k-cell diagonal
  spans `k·√2`, so projection — not Euclidean distance — must set the length); clamping at
  every edge and corner.
- `buildPuzzle()`: every word in `placements` reads back correctly from `cells`; overlaps
  only ever occur on matching letters; the same seed yields an identical grid.
- `matchWord()`: matches forwards and backwards; ignores already-found words.
- `computeLayout()`: **grid and word list both fit** across the device table below. This is
  the guard spec 2 will be held to, written before spec 2 starts.

### Device table

Shared by the `computeLayout()` unit test and the e2e layout guard. Heights are real
Safari `innerHeight` (browser chrome subtracted), since that is what players actually get.
The last column is measured against the current build.

| Device | Portrait | Landscape | Today's failure (both orientations measured) |
| --- | --- | --- | --- |
| iPhone SE | 375×553 | 667×285 | portrait: 8/12 words offscreen; landscape: grid overflows 119px. Both broken. |
| iPhone 13 | 390×664 | 844×300 | portrait: `#app` clips 64px (hint row); landscape: grid overflows 104px, 7/12 offscreen. Both broken. |
| iPhone Pro Max | 430×752 | 932×340 | portrait: `#app` clips 28px; landscape: 3/12 offscreen. Both broken. |
| iPad Mini | 744×1053 | 1133×664 | portrait: `#app` clips 26px (broken); landscape: passes. |
| Desktop | — | 1440×900 | passes |

Pass condition: zero word elements outside the viewport, `#app` clips nothing in either
axis, and the grid's bounding box sits fully inside the viewport. Measured against the
current build, 7 of the 9 orientation cases fail today (everything except iPad-Mini
landscape and Desktop) — the layout guard in Task 4 encodes exactly this split, and
spec 2 must make all 7 pass. Note the failure is not landscape-only: portrait phones and
small-portrait iPad clip the hint row by 26–64px, which counts as a fail under the "clips
nothing" bar.

**End-to-end — Playwright, local server.**

- Boots; renders 169 cells and the full word list.
- Drag along a seeded word's known coordinates finds it: pill drawn, count increments.
- Tapping a found word crosses it out; tapping an unfound word does nothing.
- Finding every word raises the win overlay.
- Regression, [43c8402]: starting a new theme inside the 700 ms win delay must not drop a
  dead overlay over the fresh grid — assert the board is still interactive afterwards.
- Regression, [5e2bbf6]: a diagonal drag selects exactly the intended cells, no overshoot.
- Regression, [d468bd7]: the service worker falls back to `index.html` only for navigation
  requests, not for a failed asset fetch.
- Regression, [121de94] / [60b5099]: a changed code asset is picked up **without** a `CACHE`
  bump, and a cached icon triggers no revalidation request.
- Layout guard: across the device table, no word element is offscreen and `#app` clips
  nothing. This **fails on landscape phones today** — spec 2 is what makes it pass. It is
  written now and annotated `test.fail()`, which keeps `npm test` green while the guard is
  known-broken *and* reports an error the moment it starts passing. Spec 2 therefore ends
  with the suite forcing the annotation off. An objective finish line, not a note to self.

**Live smoke — `npm run test:live`, opt-in.** Against `https://beeberbab.github.io/word-finder/`:
service worker registers and takes control, app boots, stale-while-revalidate refreshes a
code asset. Run after deploying; never part of `npm test`.

## Config

- `package.json` — private, `"type": "module"`, scripts `test` (unit + e2e), `test:unit`,
  `test:e2e`, `test:live`, `typecheck`. One devDependency: `@playwright/test`.
- `tests/server.mjs` — ~15-line `node:http` static server. Avoids `npx serve`, keeping the
  dependency count at one and the suite runnable offline.
- `playwright.config.js` — `webServer` running `node tests/server.mjs`, so Playwright starts
  and reliably kills it. Two projects: `desktop` (1440×900) for the functional suite, and
  `mobile` (iPhone 13 portrait and landscape from the device table) for the layout guard.
- `tsconfig.json` — `allowJs`, `checkJs`, `noEmit`, `strict`, ES2022, DOM libs, covering
  `src/` and `tests/`. Emits nothing, ever.
- `sw.js` `ASSETS` and the `index.html` script tag update to the `src/` paths. Getting this
  wrong breaks offline silently, so an e2e assertion checks every path in `ASSETS` resolves.

## Implementation order

The refactor moves every line of `game.js` before anything protects it. Ordering is the
mitigation, and it is not optional:

1. `package.json`, `playwright.config.js`, `tests/server.mjs`.
2. Write the e2e suite against the **current, unmodified** code. Get it green.
3. Add the seeded RNG in place, still in `game.js`. Point tests at `?seed=`. Still green.
4. Split into `src/` modules. **The suite must stay green throughout** — this is the step the
   tests exist to protect.
5. Add unit tests against the now-pure modules.
6. Add `tsconfig.json` and JSDoc annotations until `typecheck` is clean.
7. Update `sw.js` `ASSETS`, `index.html`, `README.md`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Refactor silently changes behaviour | Steps 2–4: e2e green before, during and after the move. |
| `sw.js` `ASSETS` drifts from real paths; offline breaks with no error | E2E assertion that every `ASSETS` entry resolves. |
| Seeded RNG changes puzzle distribution | Unit test that shuffle and placement stay uniform enough to place 12/12 words; a prior simulation of 20,000 puzzles placed 12/12 every time, so this is the baseline to hold. |
| Playwright pointer events don't reproduce real touch drags | Drag helper uses `mouse.down/move/up` with intermediate move steps, which dispatch pointer events; verified against a known-good drag in step 2 before the suite is built out. |

## Success criteria

- `npm test` green: unit + e2e, including all four regressions.
- `npm run typecheck` reports zero errors.
- `npm run test:live` green against the deployed site.
- The layout guard fails on the 7 measured-broken orientation cases — all phones in both
  orientations plus iPad-Mini portrait — and passes only iPad-Mini landscape and Desktop,
  with each failure stating the overflow in pixels. This is spec 2's acceptance bar: spec 2
  must make all 7 pass, and the guard self-disarms (errors on the unexpected pass) as each
  is fixed.
- No user-visible change: same rendering, same behaviour, same offline support.
