# Levels review tools

These are the checks used to build and review `src/scoring.js`, `src/levels.js`, `src/cloud.js`,
`src/scorecard.js` and `src/levelplay.js`, which are parked on main and not wired in yet (see `docs/handoff.md`).
They are dev-only: nothing imports them and they add no dependency. Run them from the repo root.

- `mutate.mjs` with `mutants/<set>.json` plants one bug at a time in a temp copy of the repo and runs that module's unit tests. It exits 1 on any MISSED, SKIP (an anchor no longer matches) or HUNG result. Run `node tools/levels-review/mutate.mjs <scorecard|scoring|levels|cloud|levelplay> [name filter]`. On 2026-10-02 it caught all 29 scorecard, 49 scoring, 43 cloud and 34 levelplay mutants, and 88 of the 91 levels mutants. The other 3 are marked equivalent in the JSON.
- `scoring-ref.mjs` is an independent reference for `scoreLevel`, written from the spec and compared over 200k seeded random levels. Run `node tools/levels-review/scoring-ref.mjs`. Update its `ref()` along with any change to the scoring rules.
- `levels-fuzz.mjs` sends 200k random records through normalize, merge, `recordLevel` and `saveCurrent`, and checks that nothing throws, every output is well-formed and normalizing is idempotent. Run `node tools/levels-review/levels-fuzz.mjs`.
- `levels-deal.mjs` checks for back-to-back categories with 1 to 30 categories, the spread of first categories and the seed avalanche, then prints how huge levels behave. Run `node tools/levels-review/levels-deal.mjs`.
- `levels-chi2.mjs` runs chi-square tests on how evenly categories and subjects are dealt, and exits 1 past p = 0.001. Run `node tools/levels-review/levels-chi2.mjs`.
- `scorecard-drive.mjs` is a Playwright harness that mounts the score card in the real `#wincard` and screenshots and measures it. It writes to `.shots/scorecard/`, or to `SHOTS_DIR`. Use it for the pending scorecard review. Run `node tools/levels-review/scorecard-drive.mjs --mode=shots|behaviour|wipe|extra [--themes=default,grove]`.
- `scorecard-contrast.mjs` checks every text role on the score card for 4.5:1 against the win card, and the countdown bar for 3:1 against its track, in every palette, theme and mode. It exits 1 on any failure. Run `node tools/levels-review/scorecard-contrast.mjs`.
- `sw-cloud-probe.mjs` checks in the browser whether `sw.js` serves an authenticated cross-origin GET from its cache (this is the "must fix before accounts ship" bug). It FAILs on today's `sw.js` and PASSes once the fix is in. Run `node tools/levels-review/sw-cloud-probe.mjs`.
- `token-distance.mjs` prints the colour distance (ΔE) of tokens from `--accent` and `--bg` for every palette, theme and mode, with the cascade resolved. It is how `--pill-miss` was chosen for the negative bar. Run `node tools/levels-review/token-distance.mjs [--pill-miss ...]`.
- `build-review-notes.md` holds each module's build and review reports, verbatim. Some open questions and integration warnings in it are not in the handoff.
- `shots/scorecard-contact.jpg` shows the score card as built, on a phone, a landscape phone and a 320x568 screen. To regenerate the screenshots, run `scorecard-drive.mjs`.

Scorecard review (2026-10-02): no logic defects found in `src/scorecard.js`, and the harness's countdown, Stay, reduced-motion, hidden-tab and focus checks all behave. Open, all in `styles.css`:
- At 320px wide, `#wincard` (min-width 260px plus 42px padding a side) spills off both sides of the screen, with or without the score card, and a positive score card is 594px tall on a 568px screen. A fix is shown to the owner but not applied yet.
- In Duotone light, the countdown bar's fill is 2.3–2.8:1 against its track on every theme, under the 3:1 non-text minimum. All score card text passes 4.5:1 in all 56 looks.
