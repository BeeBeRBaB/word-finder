# Word Finder — PWA

A fully client-side word search game. No build step, no dependencies, no server code.

## Project layout
The old single-file `index.html` has been split into focused modules — same zero-build deploy, easier to read and extend:

| File | Purpose |
| --- | --- |
| `index.html` | Markup, plus a short inline script that resolves the appearance before first paint. |
| `styles.css` | All styling. |
| `sw.js` | Service worker for offline caching. Must stay at the served root for its scope. |
| `manifest.webmanifest` | PWA manifest. |
| `icon-192.png`, `icon-512.png` | App icons. |

The engine lives in `src/`, split on the pure-logic / DOM boundary. The pure modules
have no DOM access at all, which is what makes them cheap to unit-test:

| File | Purpose | |
| --- | --- | --- |
| `src/rng.js` | Seeded PRNG and `?seed=` / `?subject=` / `?category=` resolution. | pure |
| `src/puzzle.js` | Word placement, grid fill, drag snapping, hit-detection. | pure |
| `src/layout.js` | Screen arithmetic → grid dimensions. | pure |
| `src/view.js` | Renders cells, selection pills and the word list. | DOM |
| `src/effects.js` | Confetti and the WebAudio chime. | DOM |
| `src/picker.js` | The category dialog. Reports a category id; owns no game state. | DOM |
| `src/main.js` | Entry point: owns game state, wires events, registers the SW. | DOM |
| `src/catalog.js` | The 25 category names. No subjects, no words — loads on every visit. | data |
| `src/subjects/*.js` | One category's word pools, 40+ words per subject. Lazily imported. | data |
| `src/subjects.js` | Resolves a subject id to its pool, memoising each category module. | pure-ish |
| `src/appearance.js` | Light / dark / system preference: resolve, persist, follow the OS. | DOM |

### Reproducible puzzles

`?seed=N` pins the puzzle, `?subject=<id>` pins the subject, `?category=<id>` pins the
category and picks a subject inside it — e.g. `/?seed=1&subject=nature/birds`. With
none of them, the clock seeds it and a random subject is chosen.

### Board sizes

Two presets, chosen from `screen` rather than the viewport so a device always plays one
board: **13×13 with 12 words**, or **10×10 with 8 words** when the screen's smaller edge
is under 480px. Resizing a window or rotating a phone never changes it. A saved board is
always restored at the size it was saved at.

### Adding a subject

Add `'<category>/<slug>': 'WORD1,WORD2,...'` to `src/subjects/<category>.js`. That is the
whole change — nothing registers a subject anywhere else. Its category is the slug's
prefix and its display name is the slug title-cased, so `sports/card-games` is `Card
Games` in `Sports & Games` without a line of configuration.

The word list must hold **40+ words**, bare uppercase A–Z, 3–12 letters, no duplicates,
with at least 6 words of 3–4 letters and 8 in each of 3–5, 5–6, 6–8, 7–9 and 9–12.
No word may appear in more than **6 of its own category's 24 subjects** — that is what a
player notices, since picking a category deals a random subject inside it. Across the
whole corpus the ceiling is a far looser 40, a regression guard rather than a quality bar:
reuse at that range is mostly polysemy, and a music scale, a fish scale and a map scale
are three words that only look alike.

`npm run test:unit` enforces all of it and names the subject, bucket or word that failed.
`npm run words` queries the same content as SQLite when you want to explore rather than
assert. Short words are the scarce ones — write those first, and never count letters by
eye.

### Adding a category

Add the entry to `CATEGORIES` in `src/catalog.js`, create `src/subjects/<id>.js`
exporting a `WORDS` record, and add **nothing** to `sw.js` — word modules are cached at
runtime by directory, not listed. The picker reads its options from the catalog.

## Tests

| Path | Purpose |
| --- | --- |
| `tests/unit/` | `node:test` specs for the pure `src/` modules (`rng`, `puzzle`, `layout`, `storage`, `appearance`, `catalog`, `subjects`), the word-list contract every subject must meet (`content`) and a deal of every subject at both presets (`deal`), a token-parity check on the stylesheet (`tokens`), and a static assertion on the service worker (`sw`). No browser. |
| `tests/e2e/` | Playwright specs (`smoke`, `gameplay`, `layout`, `regressions`, `ux`, `appearance`) against a local static server (`tests/server.mjs`), on `desktop` and `mobile` viewport projects. |
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

See [Reproducible puzzles](#reproducible-puzzles) above for `?seed=` / `?subject=` /
`?category=` — the same URL parameters the tests pin puzzles with.

## Host on GitHub Pages

1. Create a repo (e.g. `word-finder`) — or name it `<username>.github.io` to serve at the root.
2. Copy all the files above into the repo root.
3. Push, then in the repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. Open `https://<username>.github.io/word-finder/` (or `https://<username>.github.io/`).

> Note: the app uses native ES modules, so open it over `http(s)://` (GitHub Pages or any local server), not via `file://`.

Works on iPad, phone, laptop. On iPad/iPhone: Share → **Add to Home Screen** to install. On Chrome/Edge: install icon in the address bar. Runs offline after the first visit.
