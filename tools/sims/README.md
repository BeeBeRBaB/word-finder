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
| `appearance/cascade.mjs` | Theme cascade. Every theme x flavour, and an absent or unknown theme or flavour, computes exactly what its look's own block in `styles.css` declares (unknown theme as the default, no flavour as dark). | `node tools/sims/appearance/cascade.mjs` (`CSS=<candidate.css>`) |
| `appearance/resolver.mjs` | Fuzzes the inline resolver in `index.html` against `normalizeTheme` and `normalizePref` with hostile stored values and a throwing `localStorage`. Also checks that theme-color tracks `--bg` through look changes on the Theme page. Chromium and WebKit. | `node tools/sims/appearance/resolver.mjs` (`ENGINES=chromium`) |
| `settings/measure.mjs` | Settings card (or picker, or one of its pages) geometry per shape: box, overflow, scroll, columns, clipped buttons, wrapped labels. | `node tools/sims/settings/measure.mjs` (`ENGINES=`, `MODES=`, `SHAPES=`, `PANE=picker`, `PAGE=bg\|theme`, `NOFONTS=1`, `RM=reduce`, `SHOT=tag`) |
| `settings/behave.mjs` | Settings behaviour: reduced-motion paths, the sticky header at scroll bottom, and live resize between card and page. | `node tools/sims/settings/behave.mjs` |
| `settings/safe-area.mjs` | Full-screen Settings under emulated notch and home-bar insets (CDP, Chromium only). | `node tools/sims/settings/safe-area.mjs` |
| `settings/contrast.mjs` | WCAG contrast of every piece of text on every Settings page (main, Theme, Background) against what it sits on, for each theme in each flavour, phone and desktop. | `node tools/sims/settings/contrast.mjs` (`THEMES=`, `MODES=`) |
| `backgrounds/contrast.mjs` | WCAG contrast of the text and icons over every background, area, shape and look (`MODES=` keeps the looks of those flavours), measured in the 2px ring around each glyph, and the highest host opacity that would still pass. About 15 minutes. | `node tools/sims/backgrounds/contrast.mjs` (`ONLY=`, `MODES=`, `AREAS=`, `SHAPES=`, `LOOKS=`, `NOHALO=1`, `CSS=`) |

Screenshots go to `.shots/sims/`, which git ignores. `OUT=` overrides
that. `npm run shots` wipes `.shots/`.

Before trusting a green run, plant a failure and check that the script catches it. For
example, run million.mjs with `SRC=` pointing at a copy of `src/` whose `puzzle.js` lays words
`'relaxed'`, or run tear.mjs with `fe64d0a f7793e7` (a real deploy that tore without a CACHE bump).
