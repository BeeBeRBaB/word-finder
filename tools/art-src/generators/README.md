# Art generators

Editable sources for the subject icons and the category illustrations. Every SVG is
inner markup for a 64x64 viewBox, using only the classes `t-a`, `t-b`, `t-c` and `ln`.
Run everything from any directory; paths resolve from each script.

## Icons (`../icons/part*.json`)

| File | What it is | Run |
| --- | --- | --- |
| `icons/gen1.mjs`–`gen14.mjs` | One generator per committed `partN.json` (round 1 is 1–6, round 2 is 7–14). Each rebuilds its part byte-for-byte. | `node tools/art-src/generators/icons/gen7.mjs [out.json]` (no arg overwrites `../icons/part7.json`) |
| `icons/p2lib.mjs` | Geometry helpers that `gen2.mjs` imports. | — |
| `icons/round2-report.json` | The round-2 drawing agents' reports: skips (`paint-palette` = `palette`, `envelope` = `invitation-card`; map those subjects to the drawn icon when merging), near-duplicate calls, and faint-preview tips. | read it |

To add icons, copy the shape of a round-2 generator into a new `icons/genN.mjs`, write
`../icons/partN.json`, validate with `node tools/art-src/icons/check.mjs tools/art-src/icons/partN.json`,
then run the two `iconmap` scripts below.

## Category illustrations (shipped as `ILLUSTRATIONS` in `src/art.js`)

| File | What it is | Run |
| --- | --- | --- |
| `illo/gen1.mjs`–`gen4.mjs` | Generators for the 25 category illustrations, in four groups. Each writes `illo/groupN.json` (git-ignored). | `node tools/art-src/generators/illo/gen1.mjs` |
| `illo/compare.mjs` | Diffs the generated groups against `src/art.js` and exits 1 on a mismatch. All 25 match today. Paste a changed group's `svg` into `src/art.js` by hand. | `node tools/art-src/generators/illo/compare.mjs` |

## Shared helpers (both need Playwright's Chromium)

| File | What it is | Run |
| --- | --- | --- |
| `zoom.mjs` | A large preview: full colour, the faint app tint on dark, and 20% and 45% tints on light. Writes `<file>-zoom.png` next to the JSON. Don't commit it. | `node tools/art-src/generators/zoom.mjs <file.json> [ids...]` |
| `bbox.mjs` | Geometry bounding box per item, with a flag on anything within 0.5 of the 64x64 edge. | `node tools/art-src/generators/bbox.mjs <file.json>` |

## Subject map and icon modules (`../iconmap/`)

| File | What it is | Run |
| --- | --- | --- |
| `iconmap/<category>.json` | Each category's icons and each subject's 4–6 icons, hero first. | `node tools/art-src/iconmap/check.mjs <category>` |
| `iconmap/merge.mjs` | Puts every newly drawn wishlist icon in front of the icons of the subjects that asked for it (most-requested first, capped at 6), and rebuilds `index.txt`. Re-running changes nothing. | `node tools/art-src/iconmap/merge.mjs` |
| `iconmap/emit.mjs` | Writes the lazy `src/backgrounds/icons.js` (every mapped icon) and `subject-icons.js` (the maps). `--check` exits 1 when they are stale; the unit suite runs it. | `node tools/art-src/iconmap/emit.mjs [--check]` |
