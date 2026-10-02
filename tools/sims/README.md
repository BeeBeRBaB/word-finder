# Simulations and reviewer scripts

Dev-only checks that are too slow or too broad for `npm test`. They need nothing beyond the
repo's own devDependencies (Playwright). Each browser script starts its own server on a free
port (`site.mjs`), so nothing needs to be running first. `SITE=<dir>` serves another checkout,
such as a baseline copy or one with a planted bug. Most of them exit 1 when they find a problem.

| Script | What it checks | Run |
| --- | --- | --- |
| `generator/million.mjs` | Million-board check of the generator: about 1M boards per preset (every subject x 1667 seeds, all cores, about 15s). Counts throws, misspellings, touching parallel words, direction balance, coverage and replay drift. | `node tools/sims/generator/million.mjs` (`SEEDS=`, `LEVEL=easy\|normal\|hard`, `PRESETS=`, `SRC=<other src dir>`) |
| `generator/adjacency.mjs` | Independent pairwise check that parallel words never touch. Can test a candidate `puzzle.js`. | `node tools/sims/generator/adjacency.mjs [puzzle.js] [seeds]` |
| `sw/tear.mjs` | Torn-deploy sim. Installs the service worker on the old build, deploys the new one, revisits six times, and reports which build served each file. MIXED means a tear. Runs the new build as-is and again with CACHE flipped. | `node tools/sims/sw/tear.mjs [old=origin/main] [new=WORKTREE]` |
| `appearance/cascade.mjs` | Palette cascade. Classic, absent and unknown palettes match BASE's stylesheet; each shipped palette computes its `tools/palettes/set*.json` values; no-mode matches dark. | `node tools/sims/appearance/cascade.mjs` (`BASE=<ref>`, `CSS=<candidate.css>`) |
| `appearance/resolver.mjs` | Fuzzes the inline resolver in `index.html` against `normalizePalette` with hostile stored values and a throwing `localStorage`. Also checks that theme-color tracks `--bg`. Chromium and WebKit. | `node tools/sims/appearance/resolver.mjs` (`ENGINES=chromium`) |
| `settings/measure.mjs` | Settings card (or picker) geometry per shape: box, overflow, scroll, columns, clipped buttons, wrapped labels. | `node tools/sims/settings/measure.mjs` (`ENGINES=`, `MODES=`, `SHAPES=`, `PANE=picker`, `NOFONTS=1`, `RM=reduce`, `SHOT=tag`) |
| `settings/behave.mjs` | Settings behaviour: reduced-motion paths, the sticky header at scroll bottom, and live resize between card and page. | `node tools/sims/settings/behave.mjs` |
| `settings/safe-area.mjs` | Full-screen Settings under emulated notch and home-bar insets (CDP, Chromium only). | `node tools/sims/settings/safe-area.mjs` |
| `settings/contrast.mjs` | WCAG contrast of every piece of text on every Settings page (main, Theme, Background) against what it sits on, for each theme x palette x mode, phone and desktop. | `node tools/sims/settings/contrast.mjs` (`PALETTES=`, `THEMES=`) |
| `backgrounds/contrast.mjs` | WCAG contrast of the text and icons over every background, area, mode, shape and look, measured in the 2px ring around each glyph, and the highest host opacity that would still pass. About 50 minutes. | `node tools/sims/backgrounds/contrast.mjs` (`ONLY=`, `MODES=`, `AREAS=`, `SHAPES=`, `LOOKS=`, `NOHALO=1`, `CSS=`) |
| `palettes/render.mjs` | Palette contact sheets: 7 themes x 2 modes with four words found, per set JSON, plus a combined sheet. | `node tools/sims/palettes/render.mjs [set.json ...]` (about 100s) |
| `palettes/sheet-all.jpg` | Classic, Jewel, Duotone and Calm side by side, for deciding which palettes to drop (handoff question 6). | open it |

Screenshots go to `.shots/sims/` or `.shots/palettes/`, which git ignores. `OUT=` overrides
that. `npm run shots` wipes `.shots/`.

Before trusting a green run, plant a failure and check that the script catches it. For
example, run million.mjs with `SRC=` pointing at a copy of `src/` whose `puzzle.js` lays words
`'relaxed'`, or run tear.mjs with `fe64d0a f7793e7` (a real deploy that tore without a CACHE bump).
