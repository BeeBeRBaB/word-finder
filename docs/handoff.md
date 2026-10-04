# Word Finder — handoff (paused 2026-09-27, updated 2026-10-03)

Read this first. It is the state of the work in progress, the decisions waiting on the owner,
and the order to do things in. CLAUDE.md still governs how to work; README has the file map.

## Before doing anything: ask the owner

These are open decisions. Ask them together at the start of the thread (one message, with the
current default marked), and don't build on an assumption.

1. **Branches.** *Answered 2026-10-02: threads merge verified work into `main` themselves.* Project threads work on their own branch, but CLAUDE.md says push to `main`, with no PRs and no feature branches, because `main` is what GitHub Pages serves. After `npm test` passes, should a thread fast-forward its work into `main` itself, or leave the branch for the owner?
2. **Ultracode for every thread.** *Answered 2026-10-02: no.* It is a per-session setting. Adding `"ultracode": true` to the repo's `.claude/settings.json` would turn it on for every thread in this repo, including local sessions, which uses more tokens. Should we add it? Default: no.
3. **Still art on phones.** *Answered 2026-10-02: keep the corner (as shipped).* With Background area = "Word list", should a phone keep today's board-corner art (the owner chose it earlier), or move the art behind the word list? Default: keep the corner.
4. **Streak after a reveal.** Settled 2026-10-02: a reveal restarts the streak from zero (`src/scoring.js` clears `lastFind`).
5. **Animation frame cap.** *Answered 2026-10-02 and done: exactly 30fps at any refresh rate.* Every animation runs on one loop, `src/backgrounds/frame-loop.js`, and draws 30fps at 60, 100 and 165Hz. Measure with `node tools/art-src/prototypes/check.mjs --hz=N`.
6. **Palettes.** *Answered 2026-10-03 and done: there is no palette choice and no light/dark setting. Each theme has its own fixed colours in two flavours, Light and Dark, and the Theme page shows a tile for each (two themes, four tiles, to a phone row). `tools/palettes/check.mjs` checks every look's colours for AA straight from `styles.css`.*
7. **Firebase.** Levels and accounts need the owner's Firebase project. The steps are in the README "Accounts (Firebase)" section. Settled 2026-10-02: the owner sent the config for `word-finder-10f77` and it is in `FIREBASE`. The owner does the console steps and publishes `firestore.rules` themselves, so tell them whenever that file changes.

## What is on main
- **Settings:** a compact two-column card (fits 1366x768), and a full-screen page with Back on phones and short screens. Its Theme and Background rows each open a page inside the card (`subpage.js`). Opening a pane focuses its title, never a dropdown, which an iPhone would open at once.
- **Theme page** (`lookpicker.js`): 7 themes x 2 flavours (Light, Dark) as one choice, each tile previewed in its own colours, read off the stylesheet the first time the page opens. Storage keeps the two keys, `wordfinder-theme` and `wordfinder-appearance`; `wordfinder-palette` from older builds is ignored. Known gaps: that first open spends tens of milliseconds reading the 14 looks, and a tile shows checked and focus only through `:has()` (absent before Firefox 121).
- **Background page** (`bgpicker.js`): Choose (Theme / Random / Manual) with a note on what it does, Area (Word list / Full screen), and a tile per registry background in a Still and an Animated group (by its `animated` flag). The checked tile is the background showing; picking one makes it the Manual pick. Theme shows the theme's own (`THEME_BACKGROUNDS`, both flavours alike) and follows a theme change at once; Random picks by the deal's seed from all but None, never the last pick, and the pick is kept with the board (in Undo's snapshot and the save as `bg`; an older save picks by its seed). A new player gets Theme and Full screen; a stored record from before keeps its area, and is Manual when it had picked anything but Illustrated. The Settings row shows the background showing, tagged Theme or Random. The animations run behind the word list (`#bgside`) or the page (`#bg`), at exactly 30fps. Word-list text over them keeps a 2.5px ring of the ground colour and the Full screen header sits on a plate of it, so every look passes AA over every background (`node tools/sims/backgrounds/contrast.mjs`, about 15 minutes a flavour; `SHAPES=` splits it).
  - In Full screen the background shows through the board: its surface is `--board-solid` of `--surface` (65% dark, 60% light), with no ring or blur on the letters. It stays solid with None, in Word list, and where color-mix is missing. Every pill sits on solid surface, so a find or a drag reads as on a solid board; a later pill covers an earlier one where they cross.
  - Opacities, per look in `styles.css`: `--backdrop-full` / `--backdrop-list` (#bg / #bgside) .6 / .5 dark, 1 / 1 light; `--art-board` / `--art-rail` .18 / .22 dark, .4 / .5 light, and .55 / .65 in Drafting, Grove and Graphite light, whose pastel art still read faint at .4.
  - What limits them, from the sim, which also measures the board's letters over a Full screen background and over the corner art: light hosts are at the maximum, 1. Light `--board-solid` is held at 60% by Aquarium behind Grove light's letters (55% leaves 4.53:1), dark at 65% by Skyline and Aquarium behind Drafting dark's letters in landscape (60% fails at 4.42:1). The light corner art would pass AA up to .8, but past .5 it nears Broadsheet's pill colours and a find blurs into it. Dark is unchanged.
  - The solid pills also fixed a failure the board measure found on main: Drafting dark's found letters over its grid lines were 4.02:1.
- **Subject backgrounds:** Subject scene (still) and Drifting icons (animated) draw the dealt subject's own icons, else its category's (233 icons in `src/backgrounds/icons.js`, mapped in `subject-icons.js`). Both restart on every deal, and the seed picks one of six variants per subject (`icon-scene.js`). With Word list and the list under the board, the Subject scene shows only its main icon in the board corner, like the category art (question 3). None of `src/backgrounds/` is precached, so a change to an export of the shared `icon-scene.js`, `frame-loop.js` or `pixel-stage.js` needs a CACHE bump.
- **Levels and accounts** (owner-approved screens, 2026-10-02): Settings starts with an Account section (Sign in, or the username, level, points and whether they are saved online, with Sign out) and a Sign in page that also creates accounts. New game has Random | Levels; Levels deals the account's level, the header's label line reads "Level N", and the win card becomes "Level N complete" with the score card and "N points in all". main.js holds the level on screen in `levelBoard`; `startLevel` puts a level's finds back and starts its clock, `reconcileLevel` re-links or lets go of the board after a sync or sign-in, and `completeLevel` banks a level the account's finds complete, with its score card. Signing in from New game returns to it. `tests/e2e/levels.spec.js` plays all of it against a stubbed Firebase.
  - Known gaps, each judged too rare to hold the release: two devices finishing the same level at once keep the higher score, but the card on the other one still shows its own total until the next sync; a level started on the large board starts over on a phone, which cannot show that board, and the phone's game then replaces the large board's on every device, finds and all, because of two games of one level on boards of different sizes the one on the smaller board wins (a level is saved with its board size, so Board and other devices otherwise deal it on the board its finds are on; builds before 2026-10-03 drop the size, and a level they save is dealt on whatever board Board picks); two devices that deal one level at different difficulties on boards of one size each save their own game over the other's until one finishes it, and a board of it reloaded meanwhile is timed as the other's difficulty, as 0101aa9 did; a level finished while signed out is banked on signing in again with its clock where its last save left it, as 0101aa9 did; and between 360 and 463px wide and under 360px tall the score card's countdown is cut short (Stay, Next level and the read-out countdown are unaffected). While a sign-in is in flight its buttons dim to 0.6, which takes some looks under 3:1.
- **Known layout gap (not levels):** at about 410x360, a phone in split screen, the board shrinks to about 180px and the header's New game runs off the right edge. No shape that size is in `tests/viewport.js`.
- **Service worker:** the code cache is keyed by path, and CACHE is `wordfinder-v20`. A bump's install fetches again into the new cache, within 20 seconds, the old cache's backgrounds (and any module they newly import), this build's font stylesheet and the files of it the old cache held, so an update does not lose them offline. It touches only `wordfinder-*` caches: every Pages site on the account shares the origin. A first visit's lazy modules are re-fetched through the worker once it takes control (found with Resource Timing, which is unverified in WebKit here).
  - Known gaps: a tab left open across an update runs the old modules, so a background it had not loaded yet, whose imports now need a new export (v18's Subject scene and Drifting icons do), draws nothing until the next launch. An update whose install is cut short can leave the old worker's cache torn for one launch (`tools/sims/sw/tear.mjs`). And a background that failed to load is tried again when the device is back online, but only the module itself: if one of its imports was what failed, the page keeps that failure until the next launch.
- **Tests:** `PORT=<port> npx playwright test` moves the whole e2e run.

## Module and source notes
- **Animated backgrounds** in `src/backgrounds/*.js` stay out of sw.js ASSETS on purpose; the default stale-while-revalidate path caches them on first use. `tools/coverage.mjs` excludes `src/backgrounds/**` from the 90% floor.
  - A new background is one registry entry in `src/backgrounds.js`: its tile, its Settings choice and its place in the contrast sim follow from it. `perDeal: true` restarts it on every deal, and `show()` passes it the subject id and seed.
- **Levels and accounts:**
  - A level is dealt by its seed on every device and every build, so a change to `src/puzzle.js`, a difficulty's mix or the deal order re-deals levels in progress and drops their finds. `tests/unit/puzzle.test.js`, `layout.test.js` and `levels.test.js` pin them in that order.
  - scoring and levels were reviewed clean.
  - cloud had 5 defects, fixed by its reviewer.
  - scorecard was reviewed on 2026-10-02 with no logic defects. Its open layout and contrast findings are in `tools/levels-review/README.md`.
  - The owner publishes `firestore.rules` in the Firebase console themselves: tell them whenever it changes.
- **Art sources:**
  - `tools/art-src/icons/part*.json` hold 233 icons. Run `node tools/art-src/icons/check.mjs <part.json>` to validate one and render a preview.
  - `tools/art-src/iconmap/<category>.json` gives all 600 subjects 4–6 icons each, hero first. Check with `node tools/art-src/iconmap/check.mjs <category>`.
  - `wishlist.json` ranks the icons once missing; all are drawn now (`round2-10.json` became `part10.json`). `node tools/art-src/iconmap/merge.mjs` folds drawn wishlist icons into the maps, and `node tools/art-src/iconmap/emit.mjs` rewrites the two modules (`--check` exits 1 when they are stale; a unit test runs it).
- **Theme colours:** each theme's light and dark blocks in `styles.css` are the source; `node tools/palettes/check.mjs` checks them for AA and that every look is distinct.

## Cloud environment for Project threads
`docs/environment.sh` installs what `npm test` needs on a fresh thread: Node 22.5 or newer, Playwright's Chromium and WebKit with their system libraries, pinned to package-lock's Playwright (bump them together), and `certutil`. Owner steps, on claude.ai/code:
1. Click the cloud icon, then Cloud, then Add cloud environment. Name it `word-finder` and paste the script.
2. Network: Full, or Custom with the default package-manager list ticked plus `cdn.playwright.dev` (browsers) and `beeberbab.github.io` (`npm run test:live`). The `playwright.download.prss.microsoft.com` mirror can stay blocked, and `deb.nodesource.com` is only needed if the image's Node drops below 22.5.
3. In Project settings, under Environment, pick `word-finder`.

The result is cached only if the script finishes in about 5 minutes. A thread whose setup failed resumes without re-running it, so its browsers can be missing: `npx playwright install --with-deps chromium webkit` fetches them in about 30 seconds.

Each cloud thread needs two things before testing, and the `SessionStart` hook [.claude/hooks/cloud-session.sh](../.claude/hooks/cloud-session.sh) does both, printing a line only if one failed:
- `npm ci`: the edit hook runs `tsc`.
- Trust the session's proxy CA in Chromium, which reads its own NSS store rather than the system one: `certutil -A -d sql:$HOME/.local/share/pki/nssdb -n agent-proxy-ca -t C,, -i $HOME/.ccr/agent-proxy-ca.crt` (`apt-get install -y libnss3-tools` first if `certutil` is missing). Without it `npm run test:live` fails with `ERR_CERT_AUTHORITY_INVALID`, and e2e pages fall back from Google Fonts to system fonts, so layout tests measure the wrong text.

## Old scratch archive
`archive/wip-2026-09-27.tar.gz` (32 MB, 642 files) is the whole local `.wip/` folder: about 400 preview images, early drafts and the original HANDOFF. Everything future work needs is already under `tools/` and in this file, so open it only to look at an old preview: `tar -xzf archive/wip-2026-09-27.tar.gz`.

## Dev tools for this work (each folder's README says how to run them)
- `tools/art-src/generators/`: the editable generators behind every `icons/part*.json` and the 25 illustrations in `src/art.js`, plus `icons/round2-report.json` (round-2 skips: map `paint-palette` to `palette` and `envelope` to `invitation-card`).
- `tools/art-src/prototypes/`: a gallery of the animated backgrounds and `check.mjs`, which checks painting, hidden-tab pause, resize, `stop()`, reduced motion and fps.
- `tools/levels-review/`: planted-bug sets and runner, the scoring reference, the levels fuzz, deal and chi-square checks, and the scorecard harness with a contact sheet and open findings. `build-review-notes.md` has integration warnings that are not repeated here; read it before levels mode.
- `tools/sims/`: the million-board generator check, the adjacency check, the torn-deploy sim, the theme cascade and resolver fuzz, and the Settings geometry, behaviour and contrast checks.

## Must fix before accounts ship
- **Done 2026-10-02: sw.js no longer caches cross-origin GETs.** Everything cross-origin except Google Fonts goes straight to the network, `sw.test.js` checks it, and `node tools/levels-review/sw-cloud-probe.mjs` PASSes. Ship it before (not with) the commit that wires `cloud.js`, so the fixed worker already controls the page.
- **Torn deploys:** bump CACHE whenever markup and modules change together. `node tools/sims/sw/tear.mjs <old-ref> <new-ref>` shows whether a deploy tears.

## Next steps, in order
1. **Background picker UI.** Done 2026-10-02 (see What is live).
   - In Settings, a "Background ›" row opens a sub-page:
     - Area: Word list / Full screen
     - radio tiles: glyph, name, and an Animated/Still badge (`name="art"`, `data-setting="art"`)
   - `syncSettings` and the change handler in main.js need radio support.
   - Hosts: `#bgside` positioned absolute inside `#side` for list; `#bg` fixed behind `#app` for full.
   - Call `makeBackdrop().show(id, host, {colors, dark, reducedMotion})` on deal, setting change, appearance change and motion change.
   - Check word-list contrast over the animations, and lower the host opacity if needed.
   - Update art.spec, which drives the old `#settings-art` select.
   - Then run the cascade-and-cache-reviewer and bump CACHE.
2. **Subject art.** Done 2026-10-02 (see What is live).
   - Draw the missing batch from `round2-10.json`: music-notes, snowflake, whistle, flame, invitation-card, bed, stage-spotlight, frog, cupcake, wheelbarrow, spotlight, wifi-signal, easel-canvas, bookshelf, mitten. Its agent stalled, as did two others. Keep icon batches small, and have each agent write partial results as it goes.
   - Script-merge the round-2 icons into the mapping: prepend each new icon on the subjects that asked for it (wishlist `subjects`), capped at 6.
   - Emit lazy `src/backgrounds/icons.js` and `subject-icons.js`.
   - Add a "Subject scene" (still) background and a "Drifting icons" (animated) one. A subject's own icons override its category's, and the puzzle seed picks one of several variants per subject.
3. **Levels mode UI.** Done 2026-10-03 (see What is live).
   - Random play with no login stays as today, with the per-device no-repeat.
   - Signing in gives seeded, unlimited levels that can be continued on any device. Points accumulate, and easy/normal/hard still apply.
   - End of level: the existing win card and its progress bar. The score breakdown wipes in line by line, left to right; then a 10s bar runs forward for a positive total and backward for a negative one, with Next level and Stay.
   - Needs Firebase (question 7) and the sw.js fix above.
4. **Browser-tool comparison.** Done: see [browser-tools.md](browser-tools.md). The pick is Playwright scripts via Bash, at about 2.4x fewer tokens than either MCP server.
   - Candidates: Chrome DevTools MCP, Playwright MCP, the built-in Claude browser pane, and Playwright scripts run via Bash.
   - Measure tokens per task and capability: viewport, reduced motion, service worker and Cache Storage, touch drag, WebKit.
   - Expected so far: Bash scripts cost the fewest tokens and are the only option with WebKit; Playwright MCP opens headed Chrome windows unless started with `--headless`.
   - A peer session (rover, the Mecanum wheel car review, 7173a9) wants the result and will use whichever tool is chosen. It needs viewport emulation at 375 and 1280, screenshots of a file:// page that loads a pinned jsdelivr script, and a WebSocket stub injected before page scripts run (addInitScript). Reduced motion would be nice. It needs no service worker, cache inspection or WebKit. Its headed Chrome windows came from Playwright MCP started by its workflow subagents.

## How this project has been run (owner's standing preferences)
- **Shipping:** push to `main`, without asking for now. Commits are authored as BeeBeRBaB <puchkiray@outlook.com> with no Claude trailer.
- **Verifying:** check on the deployed site with the service worker cleared. Simulate rather than eyeball: million-board runs for the generator, and planted failures to prove a check runs.
- **Showing:** for visual changes, show examples before implementing. Keep the current fonts, with no italics.
- **Code:** best-practice formatting, scripts in .js files with no inline script, no new dependencies, short comments.
- **Agents:** use workflows for independent tracks, and don't waste tokens.
