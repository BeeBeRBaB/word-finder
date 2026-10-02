# Background prototypes

Dev tools for the animated backgrounds in `src/backgrounds/`. They load the committed modules
directly, so nothing here can drift from what ships. Run from the repo root.

| File | What it is | Run |
| --- | --- | --- |
| `check.mjs` | Checks every animated background on its own server: it paints, pauses while hidden and resumes, re-sizes after a resize, `stop()` empties the host, and reduced motion draws no frames. Prints fps and per-frame cost; exits 1 on any failure. `--hz=N` fakes an N Hz display, `--big` adds 1920x1080 and 4K cost plus main-thread busy %, `--shots[=dir]` saves dark/light/rm/phone PNGs (default `.shots/backgrounds/`), `--webkit` runs WebKit, `--src=<url>` loads a planted copy instead. | `node tools/art-src/prototypes/check.mjs [file...] [flags]` |
| `gallery.html` + `.js` + `.css` | All animated registry entries live side by side, behind a stand-in board card. Add `?light`, `?rm`. | `node tools/art-src/prototypes/check.mjs --serve`, then open the printed URL |
| `preview.html` + `.js` + `.css` | One background full-page behind a 12x12 letter board: `?name=<file>&light&rm`. This is the page `check.mjs` drives. | the `--serve` URL |

`--serve` uses a new port each run, so no service worker from an app visit can answer.

Measured 2026-10-02 with `--hz` (handoff question 5): all nine draw 30fps at 60Hz and 120Hz.
At 100Hz and 165Hz, starfield, skyline, aquarium, confetti and constellation draw 33fps, while
shimmer-grid, aurora-drift, silk-bokeh and letter-bubbles draw 25fps and 27.5fps.
