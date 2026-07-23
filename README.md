# Themed Word Finder — PWA

A fully client-side word search game. No build step, no dependencies, no server code.

## Project layout
The old single-file `index.html` has been split into focused modules — same zero-build deploy, easier to read and extend:

| File | Purpose |
| --- | --- |
| `index.html` | Markup only — the app shell. |
| `styles.css` | All styling. |
| `sw.js` | Service worker for offline caching. Must stay at the served root for its scope. |
| `manifest.webmanifest` | PWA manifest. |
| `icon-192.png`, `icon-512.png` | App icons. |

The engine lives in `src/`, split on the pure-logic / DOM boundary. The pure modules
have no DOM access at all, which is what makes them cheap to unit-test:

| File | Purpose | |
| --- | --- | --- |
| `src/rng.js` | Seeded PRNG and `?seed=` / `?theme=` resolution. | pure |
| `src/puzzle.js` | Word placement, grid fill, drag snapping, hit-detection. | pure |
| `src/layout.js` | Viewport arithmetic → grid dimensions. | pure |
| `src/view.js` | Renders cells, selection pills and the word list. | DOM |
| `src/effects.js` | Confetti and the WebAudio chime. | DOM |
| `src/main.js` | Entry point: owns game state, wires events, registers the SW. | DOM |
| `src/themes.js` | The 100 themed word lists (content, not logic). Add a theme here. | data |

### Reproducible puzzles

`?seed=N` pins the puzzle, `?theme=N` pins the theme — e.g. `/?seed=1&theme=0`. With
neither, the clock seeds it and a random theme is chosen.

### Adding a theme

Append `["Name","WORD1,WORD2,..."]` to the array in `src/themes.js`. Words should be uppercase and ≤ 12 letters; 12 are drawn per puzzle.

## Tests

| Path | Purpose |
| --- | --- |
| `tests/unit/` | `node:test` specs for the pure `src/` modules (`rng`, `puzzle`, `layout`). No browser. |
| `tests/e2e/` | Playwright specs (`smoke`, `gameplay`, `layout`, `regressions`) against a local static server (`tests/server.mjs`), on `desktop` and `mobile` viewport projects. |
| `tests/live/` | Playwright smoke test against the real deployed GitHub Pages site — see [Development](#development). |

## Development

No build step. The files in this repo are exactly what GitHub Pages serves.

```bash
npm install                 # one-time; also run: npx playwright install chromium
npm test                    # unit + end-to-end, against a local server
npm run test:unit           # fast, no browser
npm run test:e2e            # Playwright, against a local server started for you
npm run typecheck           # JSDoc types via tsc --noEmit; emits nothing
npm run test:live           # against the deployed site, AFTER pushing
```

`npm test` (unit + e2e) is fast, offline, and deploy-independent — it's the one
to run on every change. `npm run test:live` is separate and opt-in: it drives a
real browser against `https://beeberbab.github.io/word-finder/` to check the
things only production can — that the service worker actually registers and
takes control there, and that every asset the service worker precaches actually
resolves on the live site. Run it manually after `git push`, once the Pages
build has finished (usually 1–3 minutes); it is never invoked by `npm test`.

See [Reproducible puzzles](#reproducible-puzzles) above for `?seed=` / `?theme=`
— the same URL parameters the tests pin puzzles with.

## Host on GitHub Pages

1. Create a repo (e.g. `word-finder`) — or name it `<username>.github.io` to serve at the root.
2. Copy all the files above into the repo root.
3. Push, then in the repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. Open `https://<username>.github.io/word-finder/` (or `https://<username>.github.io/`).

> Note: the app uses native ES modules, so open it over `http(s)://` (GitHub Pages or any local server), not via `file://`.

Works on iPad, phone, laptop. On iPad/iPhone: Share → **Add to Home Screen** to install. On Chrome/Edge: install icon in the address bar. Runs offline after the first visit.
