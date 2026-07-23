# Responsive layout — design

**Date:** 2026-07-23
**Status:** approved, not yet planned
**Scope:** make the grid and word list fit on modern iPhones and iPads, both orientations.
Second of three specs. Keep it simple — this is a casual game.

## Target devices

**iPhone X and later, plus iPad.** iPhone SE is explicitly out of scope (its very short
landscape height was the only case forcing tiny cells; dropping it keeps the layout simple).

Test checkpoints (real Safari innerHeight, chrome subtracted):

| Device | Portrait | Landscape | Fits today? |
| --- | --- | --- | --- |
| iPhone 13 (390-wide) | 390×664 | 844×300 | no — see below |
| iPhone Pro Max (430-wide) | 430×752 | 932×340 | no |
| iPad Mini | 744×1053 | 1133×664 | portrait no, landscape yes |
| Desktop | — | 1440×900 | yes |

## The problem

`src/layout.js:17`:

```js
const cell = Math.max(24, Math.min(54, Math.floor(Math.min(availW, Math.max(availH, 240)) / size)));
```

Two floors force the grid *larger* than the space it has, and `#app{overflow:hidden}` then
clips the overflow:

- `Math.max(availH, 240)` clamps landscape height back up to 240 even when the screen is
  shorter, so the grid is sized as if there were height that isn't there → **landscape
  grids overflow the bottom** (iPhone 13 by 104px).
- The list is `1fr` (1 column) in landscape and `1fr 1fr` in portrait — **backwards**;
  landscape has spare width, portrait has spare height.
- Portrait reserves a fixed 380px for chrome, slightly too much/little per device, so the
  **hint row clips** by 26–64px.

Also: `viewport-fit=cover` is set but no CSS uses `env(safe-area-inset-*)`, so in landscape
the header can sit under the notch.

## Design (four small changes)

### 1. Fix the grid arithmetic (`computeLayout`, pure + unit-tested)

Size the grid to the scarce dimension and drop the oversize floors:

- **Landscape** (height is scarce): `cell = clamp(22, floor(usableH / 13), 54)`, grid pinned
  left. **Remove the `max(availH, 240)` floor.** List gets the remaining width in **2
  columns**.
- **Portrait** (height is scarce vertically, width fine): `cell = clamp(22, floor(min(usableW,
  remainingH) / 13), 54)`, where `remainingH` reserves the *measured* header + list + hint
  height (not the fixed 380). List stays 2 columns.
- `usableW`/`usableH` are the viewport minus the safe-area insets (§3), so the grid never
  overflows behind the padding.

Cells land ~26–54px on all in-scope devices — comfortably draggable. No dynamic hint
shrinking, no special cases.

### 2. Move the theme header to the right in landscape (CSS)

`#app` becomes a CSS grid; a `landscape` attribute (set by `applyLayout`) swaps the areas —
no markup change, no duplicated elements:

- Portrait: `"hdr" / "grid" / "side"` (header on top, as now).
- Landscape: `"grid hdr" / "grid side"` (grid left, header top-right, list below it).

`applyLayout` sets the two column widths (grid size, side width); CSS does the placement.

### 3. Safe-area insets (CSS + one measurement)

`#app` gets `padding: env(safe-area-inset-top/right/bottom/left)`. `main.js` reads those
inset values once from a probe element and subtracts them when computing `usableW/usableH`,
so nothing hides under the notch or home indicator. Headless Chromium reports 0 for these
(so desktop/CI is unaffected); verified on the real deployed site.

### 4. Remove iPhone SE from the layout guard

Delete the two SE rows from `tests/e2e/layout.spec.js` (out of scope). The remaining guard
has 7 cases: 5 broken today (iPhone 13 P+L, Pro Max P+L, iPad Mini P) that this spec makes
pass, and 2 already passing (iPad Mini L, Desktop).

## Testing (keep it lean)

- **Unit** (`tests/unit/layout.test.js`): replace the "KNOWN DEFECT" tests with a fit check
  across the device table above — for each device/orientation, grid + reserved chrome fits
  the viewport in both axes and `cell ∈ [22, 54]`; landscape returns 2 columns. Plus one
  non-zero-insets case.
- **E2E guard** (`tests/e2e/layout.spec.js`): remove each `test.fail()` as its device goes
  green; drop `mode:'serial'` so all still-broken cases show per run. End state: all pass,
  no annotations.
- **Regression:** the rest of the e2e suite (gameplay, drag, win, regressions, determinism,
  precache) and `npm run typecheck` stay green — layout must not touch gameplay.

## Verification (this one is visible to players)

- Screenshot each device viewport on the **deployed** site, both orientations; confirm the
  grid fits, all 12 words show, header is placed right, nothing clipped.
- Check the safe-area padding on the real Pages URL (headless can't exercise `env()`).

## Success criteria

- Layout guard: all 7 remaining cases pass, no `test.fail()` left, `mode:'serial'` removed.
- `computeLayout` unit tests assert fit across the table (incl. an insets case).
- `npm test` + `npm run typecheck` + live suite green; no gameplay/offline regression.
- Visual confirmation on the deployed site.

## Risks

| Risk | Mitigation |
| --- | --- |
| Reserved portrait chrome constant wrong → still clips | Measure real header/hint heights in the plan; the fit unit test catches a wrong constant before deploy. |
| Safe-area can't be verified headless | Verified on the deployed site; degrades to inset=0 elsewhere. |
| CSS grid reflow conflicts with imperative sizing | `applyLayout` sets track sizes only; placement is pure CSS keyed off the `landscape` attribute. |
