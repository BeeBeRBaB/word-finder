# UX polish — design

**Date:** 2026-07-23
**Status:** approved, not yet planned
**Scope:** four independent interaction fixes from the UX audit. Third of three specs.
Keep it simple — casual game, client-side only, no new deps, no build step.

## Context

The audit found 12 interaction gaps. The user selected four to fix now; the rest
(full keyboard/screen-reader support, a hint/reveal system, audio mute) are explicitly
deferred. All four below are client-side and lean on infrastructure spec 1 already built
(seeded RNG, `src/` modules, the test suite).

## 1. Found-word and wrong-drag feedback

**Problem:** A word you just found looks identical to an unfound one in the list for 10
seconds — until a `GLOW_MS` timer makes it pulse, prompting a tap to cross it out. A wrong
drag produces no feedback at all, so a miss is indistinguishable from an unregistered touch.

**Fix:**
- **Cross the word out the instant it is found.** On find, mark it done in the list
  immediately. **Remove the `GLOW_MS` timer, the `glow` state, and the tap-to-cross-out
  click handler entirely** — finding a word is the completion signal; no manual bookkeeping
  step. (Approved behaviour change: the list is no longer tappable.)
- **Flash the selection red on a miss.** When a drag ends on no word, briefly show the
  attempted selection as a red "miss" pill (a short fade/shake) before clearing, so a
  wrong guess is visibly different from nothing happening.

This *removes* code (timer, glow class, tap handler) — a simplification.

## 2. Guard "New theme" and make the win overlay dismissable

**Problem:** "New theme" is a one-tap, unconfirmed, irreversible wipe on a ~38px target;
an accidental tap mid-game destroys progress. The win overlay's only control also wipes the
finished board, so you can't stop to look at what you solved.

**Fix:**
- **Confirm "New theme" only when a puzzle is in progress** (`0 < found < total`) — a fresh
  or fully-solved board starts a new one immediately. The confirm is a small in-page dialog
  reusing the win-overlay styling (not the browser `confirm`, which is ugly and blocked in
  some standalone PWA contexts): "Start a new puzzle? Your progress will be lost." with
  Cancel / New puzzle.
- **Enlarge `#newbtn`** to a ≥44px min tap target.
- **Dismissable win overlay:** add a close (×) button, backdrop tap, and Escape key that
  hide `#win` and leave the solved board on screen.

## 3. Persist the game across reloads

**Problem:** Backgrounding the app on iOS or reloading destroys the puzzle *and* rerolls to
a random new theme — a player returns to a different game with progress lost.

**Fix (small, thanks to the seeded RNG):** Because the seed regenerates the exact grid, we
persist only `{ seed, themeIdx, found: [{word, x0, y0, x1, y1}] }` in `localStorage` — not
the 169 cells. `found` carries each solved word plus its grid selection (so its pill
redraws without a re-search).

- New module `src/storage.js`: `save(state)`, `load()`, `clear()`, each wrapped in
  `try/catch` (private mode / quota / disabled storage must degrade to "no persistence",
  never throw).
- `main.js` captures the resolved seed actually used (from `resolveSeed`), saves after every
  find and after starting a new theme.
- On boot: an explicit `?seed=`/`?theme=` in the URL wins (deliberate override). Otherwise,
  if saved state exists, regenerate the puzzle from the saved seed + themeIdx and re-apply
  the found words (redraw pills, cross them out). If a restored game is already complete,
  show the solved board without popping the win overlay. Otherwise start a fresh random
  puzzle and save it.
- "New theme" clears nothing extra — it just saves the new `{seed, themeIdx, found:[]}`.

## 4. Accessibility basics (all small)

**Fix:**
- **Unlock zoom:** remove `maximum-scale=1,user-scalable=no` from the viewport meta in
  `index.html` (keep `width=device-width, initial-scale=1, viewport-fit=cover`).
- **`prefers-reduced-motion`:** under `reduce`, disable the win-card `popIn` animation and
  skip the confetti burst (`burst()` checks `matchMedia('(prefers-reduced-motion: reduce)')`
  and no-ops). The pulsing `glowPulse` is removed anyway by fix 1.
- **Contrast:** raise the found-word pill visibility (higher alpha and/or a solid 1px
  stroke — measured ~2:1 today, target ≥3:1 non-text) and lighten `.w.done` crossed-out text
  from `rgba(223,233,229,.35)` (2.77:1) to ≥4.5:1.

## Testing (lean)

- **E2E** (`tests/e2e/`): a word crosses out immediately on find (no 10s wait); a miss flashes
  and clears without marking anything found; "New theme" mid-game shows the confirm, Cancel
  keeps the board, confirm wipes; the win overlay can be dismissed and the board remains;
  persistence — find a word, reload, the same grid returns (seed) with that word still crossed
  out.
- **Unit** (`tests/unit/`): `storage.js` save/load/clear round-trips and degrades safely when
  `localStorage` throws (inject a throwing stub — keep the (de)serialization logic pure and
  testable without a real `localStorage`).
- **Regression:** the full existing suite (gameplay, layout guard, regressions, determinism,
  precache) and `npm run typecheck` stay green. Note: the gameplay e2e test that taps a word
  to cross it out must be updated to the new auto-cross-out behaviour.

## Success criteria

- Found words cross out on find; misses flash; no `GLOW_MS`/glow/tap-handler code remains.
- "New theme" guarded mid-game; `#newbtn` ≥44px; win overlay dismissable (×, backdrop, Esc).
- Reload/restore returns the same puzzle with progress intact; URL seed/theme still overrides;
  storage failure degrades silently.
- Zoom unlocked; reduced-motion honoured; found-pill and crossed-out contrast meet the targets.
- `npm test` + `npm run typecheck` + live suite green; no new dependency, no build step.

## Risks

| Risk | Mitigation |
| --- | --- |
| `localStorage` unavailable (private mode / disabled) | All access in `try/catch`; absence just means no persistence, game still works. |
| Restored `found` selections don't match the regenerated grid (seed drift) | The seed is deterministic (spec 1, unit-guarded); a restore-round-trip e2e test catches drift. |
| Auto-cross-out breaks the existing tap-to-cross-out e2e test | That test is updated as part of fix 1 (called out above). |
| Custom confirm dialog adds complexity | Reuse the existing `#win` overlay markup/CSS pattern; it's one small dialog, not a system. |
