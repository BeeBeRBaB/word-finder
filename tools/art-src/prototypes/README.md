# Background prototypes

Dev tools for the animated backgrounds in `src/backgrounds/`. They load the committed modules
directly, so nothing here can drift from what ships. Run from the repo root.

| File | What it is | Run |
| --- | --- | --- |
| `check.mjs` | Checks every animated background on its own server: it paints, pauses while hidden and resumes, re-sizes after a resize, `stop()` empties the host, and reduced motion draws no frames. Prints fps and per-frame cost; exits 1 on any failure. `--hz=N` fakes an N Hz display, `--big` adds 1920x1080 and 4K cost plus main-thread busy %, `--shots[=dir]` saves dark/light/rm/phone PNGs (default `.shots/backgrounds/`), `--webkit` runs WebKit, `--src=<url>` loads a planted copy instead. | `node tools/art-src/prototypes/check.mjs [file...] [flags]` |
| `gallery.html` + `.js` + `.css` | All animated registry entries live side by side, behind a stand-in board card. Add `?light`, `?rm`. | `node tools/art-src/prototypes/check.mjs --serve`, then open the printed URL |
| `preview.html` + `.js` + `.css` | One background full-page behind a 12x12 letter board: `?name=<file>&light&rm`. This is the page `check.mjs` drives. | the `--serve` URL |

`--serve` uses a new port each run, so no service worker from an app visit can answer.

All nine are capped at exactly 30fps at any refresh rate (handoff question 5, answered yes on
2026-10-02): each draw books the next 1/30s slot. With `--hz=N` the check fails any module that
draws more than 1fps away from 30. Measured at 60, 100, 120, 144 and 165Hz, all draw 30fps; run
one `--hz` at a time, since parallel runs starve the first module of frames.
