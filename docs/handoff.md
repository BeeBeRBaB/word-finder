# Word Finder — handoff (finished 2026-10-06)

Every item on the owner's list has shipped and is live. This file records the owner's decisions,
what is on main, and the gaps left open on purpose, with why. CLAUDE.md still governs how to
work; README has the file map.

## Owner decisions

All answered; none is open. A new question goes here, asked in one message with the default marked.

1. **Branches.** *Answered 2026-10-02: threads merge verified work into `main` themselves.* Project threads work on their own branch, but CLAUDE.md says push to `main`, with no PRs and no feature branches, because `main` is what GitHub Pages serves. After `npm test` passes, should a thread fast-forward its work into `main` itself, or leave the branch for the owner?
2. **Ultracode for every thread.** *Answered 2026-10-02: no.* It is a per-session setting. Adding `"ultracode": true` to the repo's `.claude/settings.json` would turn it on for every thread in this repo, including local sessions, which uses more tokens. Should we add it? Default: no.
3. **Still art on phones.** *Answered 2026-10-02: keep the corner (as shipped).* With Background area = "Word list", should a phone keep today's board-corner art (the owner chose it earlier), or move the art behind the word list? Default: keep the corner.
4. **Streak after a reveal.** Settled 2026-10-02: a reveal restarts the streak from zero (`src/scoring.js` clears `lastFind`).
5. **Animation frame cap.** *Answered 2026-10-02 and done: exactly 30fps at any refresh rate.* Every animation runs on one loop, `src/backgrounds/frame-loop.js`, and draws 30fps at 60, 100 and 165Hz. Measure with `node tools/art-src/prototypes/check.mjs --hz=N`.
6. **Palettes.** *Answered 2026-10-03 and done: there is no palette choice and no light/dark setting. Each theme has its own fixed colours in two flavours, Light and Dark, and the Theme page shows a tile for each (two themes, four tiles, to a phone row). `tools/palettes/check.mjs` checks every look's colours for AA straight from `styles.css`.*
7. **Firebase.** Levels and accounts need the owner's Firebase project. The steps are in the README "Accounts (Firebase)" section. Settled 2026-10-02: the owner sent the config for `word-finder-10f77` and it is in `FIREBASE`. The owner does the console steps and publishes `firestore.rules` themselves, so tell them whenever that file changes.

## What is on main
- **Settings:** a compact two-column card (fits 1366x768), and a full-screen page with Back on phones and short screens. Its Theme and Background rows each open a page inside the card (`subpage.js`). Opening a pane focuses its title, never a dropdown, which an iPhone would open at once.
- **Theme page** (`lookpicker.js`): 7 themes x 2 flavours (Light, Dark) as one choice, each tile previewed in its own colours, read off the stylesheet the first time the page opens. Storage keeps the two keys, `wordfinder-theme` and `wordfinder-appearance`; `wordfinder-palette` from older builds is ignored.
- **Background page** (`bgpicker.js`): Choose (Theme / Random / Manual) with a note on what it does, Area (Word list / Full screen), and a tile per registry background in a Still and an Animated group (by its `animated` flag). The checked tile is the background showing; picking one makes it the Manual pick. Theme shows the theme's own (`THEME_BACKGROUNDS`, both flavours alike) and follows a theme change at once; Random picks by the deal's seed from all but None, never the last pick, and the pick is kept with the board (in Undo's snapshot and the save as `bg`; an older save picks by its seed). A new player gets Theme and Full screen; a stored record from before keeps its area, and is Manual when it had picked anything but Illustrated. The Settings row shows the background showing, tagged Theme or Random. The animations run behind the word list (`#bgside`) or the page (`#bg`), at exactly 30fps. Word-list text over them keeps a 2.5px ring of the ground colour and the Full screen header sits on a plate of it, so every look passes AA over every background (`node tools/sims/backgrounds/contrast.mjs`, about 15 minutes a flavour; `SHAPES=` splits it).
  - In Full screen the background shows through the board: its surface is `--board-solid` of `--surface` (65% dark, 60% light), with no ring or blur on the letters. It stays solid with None, in Word list, and where color-mix is missing. Every pill sits on solid surface, so a find or a drag reads as on a solid board; a later pill covers an earlier one where they cross.
  - Opacities, per look in `styles.css`: `--backdrop-full` / `--backdrop-list` (#bg / #bgside) .6 / .5 dark, 1 / 1 light; `--art-board` / `--art-rail` .18 / .22 dark, .4 / .5 light, and .55 / .65 in Drafting, Grove and Graphite light, whose pastel art still read faint at .4.
  - What limits them, from the sim, which also measures the board's letters over a Full screen background and over the corner art: light hosts are at the maximum, 1. Light `--board-solid` is held at 60% by Aquarium behind Grove light's letters (55% leaves 4.53:1), dark at 65% by Skyline and Aquarium behind Drafting dark's letters in landscape (60% fails at 4.42:1). The light corner art would pass AA up to .8, but past .5 it nears Broadsheet's pill colours and a find blurs into it. Dark is unchanged.
  - The solid pills also fixed a failure the board measure found on main: Drafting dark's found letters over its grid lines were 4.02:1.
- **Subject backgrounds:** Subject scene (still), Drifting icons, Parade, Bloom, Wallpaper, Carousel and Subject motion (animated) draw the dealt subject's own icons, else its category's (397 icons in `src/backgrounds/icons.js`, mapped in `subject-icons.js`). Subject motion runs the motion its subject is mapped to, else its category's (`tools/art-src/iconmap/subject-motion.json`), out of eleven: those five plus Swim, Flutter, Fall, Bounce, Rise and Pulse, which have no tile of their own. Icons listed in `tools/art-src/icons/facing.json` are side-on, so the motions mirror them to face the way they move. All of them restart on every deal, and the seed picks one of six variants per subject (`icon-scene.js`). With Word list and the list under the board, the Subject scene shows only its main icon in the board corner, like the category art (question 3). None of `src/backgrounds/` is precached, so a change to an export of the shared `icon-scene.js`, `frame-loop.js` or `pixel-stage.js` needs a CACHE bump.
- **Levels and accounts** (owner-approved screens, 2026-10-02): Settings starts with an Account section (Sign in, or the username, level, points and whether they are saved online, with Sign out) and a Sign in page that also creates accounts. New game has Random | Levels; Levels deals the account's level, the header's label line reads "Level N", and the win card becomes "Level N complete" with the score card and "N points in all". main.js holds the level on screen in `levelBoard`; `startLevel` puts a level's finds back and starts its clock, `reconcileLevel` re-links or lets go of the board after a sync or sign-in, and `completeLevel` banks a level the account's finds complete, with its score card. Signing in from New game returns to it. `tests/e2e/levels.spec.js` plays all of it against a stubbed Firebase.
  - A level started on the large board starts over on a phone, which cannot show that board. The larger board's game stays the level until the phone finds or reveals a word, so opening it there ends nothing; from that find on, the phone's game is the level on every device (a level is saved with its board size, and of two games of one level the one on the smaller board wins). Builds before 2026-10-03 drop the size, and a level they save is dealt on whatever board Board picks.
  - While a sign-in is in flight its button reads "Signing in…" or "Creating account…" at full colour (dimming it took some looks under 3:1).
- **Service worker:** the code cache is keyed by path, and CACHE is `wordfinder-v20`. A bump's install fetches again into the new cache, within 20 seconds, the old cache's backgrounds (and any module they newly import), this build's font stylesheet and the files of it the old cache held, so an update does not lose them offline. It touches only `wordfinder-*` caches: every Pages site on the account shares the origin. A first visit's lazy modules are re-fetched through the worker once it takes control (found with Resource Timing, which is unverified in WebKit here).
  - A page an update takes over keeps running its old modules, and a background it had not loaded yet can need an export they lack (v18's Subject scene and Drifting icons did). So main.js reloads such a page the next time it is hidden, as an evicted app is, once a level's save has landed, and not while a pane, the win card or a toast (Undo) is up.
- **Tests:** `PORT=<port> npx playwright test` moves the whole e2e run.

## Module and source notes
- **Animated backgrounds** in `src/backgrounds/*.js` stay out of sw.js ASSETS on purpose; the default stale-while-revalidate path caches them on first use. `tools/coverage.mjs` excludes `src/backgrounds/**` from the 90% floor.
  - A new background is one registry entry in `src/backgrounds.js`: its tile, its Settings choice and its place in the contrast sim follow from it. `perDeal: true` restarts it on every deal, and `show()` passes it the subject id and seed.
- **Levels and accounts:**
  - A level is dealt by its seed on every device and every build, so a change to `src/puzzle.js`, a difficulty's mix or the deal order re-deals levels in progress and drops their finds. `tests/unit/puzzle.test.js`, `layout.test.js` and `levels.test.js` pin them in that order.
  - scoring and levels were reviewed clean.
  - cloud had 5 defects, fixed by its reviewer.
  - scorecard was reviewed on 2026-10-02 with no logic defects; `tools/levels-review/README.md` has the review.
  - The owner publishes `firestore.rules` in the Firebase console themselves: tell them whenever it changes.
- **Art sources:**
  - `tools/art-src/icons/part*.json` hold 397 icons; 164 of them (parts 15–17) are subject heroes, which `iconmap/subject-heroes.json` puts first in their subjects. `src/backgrounds/icons.js` is now about 650KB (about 180KB gzipped), loaded only by the icon backgrounds. Run `node tools/art-src/icons/check.mjs <part.json>` to validate one and render a preview.
  - `tools/art-src/iconmap/<category>.json` gives all 600 subjects 4–6 icons each, hero first. Check with `node tools/art-src/iconmap/check.mjs <category>`.
  - `wishlist.json` ranks the icons once missing; all are drawn now (`round2-10.json` became `part10.json`). `node tools/art-src/iconmap/merge.mjs` folds drawn wishlist icons into the maps, and `node tools/art-src/iconmap/emit.mjs` rewrites the two modules (`--check` exits 1 when they are stale; a unit test runs it).
- **Theme colours:** each theme's light and dark blocks in `styles.css` are the source; `node tools/palettes/check.mjs` checks them for AA and that every look is distinct.

## Cloud environment for Project threads
`docs/environment.sh` installs what `npm test` needs on a fresh thread: Node 22.5 or newer, Playwright's Chromium and WebKit with their system libraries, pinned to package-lock's Playwright (bump them together), and `certutil`. Owner steps, on claude.ai/code:
1. Click the cloud icon, then Cloud, then Add cloud environment. Name it `word-finder` and paste the script.
2. Network: Full, or Custom with the default package-manager list ticked plus `cdn.playwright.dev` (browsers) and `beeberbab.github.io` (`npm run test:live`). The `playwright.download.prss.microsoft.com` mirror can stay blocked, and `deb.nodesource.com` is only needed if the image's Node drops below 22.5.
3. In Project settings, under Environment, pick `word-finder`.

The result is cached only if the script finishes in about 5 minutes. A thread whose setup failed resumes without re-running it, so its browsers can be missing: `npx playwright install --with-deps chromium webkit` fetches them in about 30 seconds.

The script runs in whichever session starts first after a change, which can be the project chat with no checkout, so it must make no repo steps: `npm ci` there fails with `npm error code EUSAGE` and no session starts (2026-10-04). The failure notice shows none of the script's output, so it keeps a copy in `/tmp/setup-script.log`, ending in `SETUP OK` or in `SETUP FAILED:` and the command that failed. The failed session's disk is kept, so Claude there can read it once a message resumes it. The runner hands the script to `/bin/sh`, which is dash, whatever its first line says, so it must be plain sh: a bash-only line (`exec > >(tee …)`) stopped the next new session 11 ms in (2026-10-04). `sh -n docs/environment.sh` checks an edit.

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

## Done, in order
1. **sw.js stops caching cross-origin GETs**, before accounts shipped (2026-10-02). Everything cross-origin except Google Fonts goes straight to the network; `sw.test.js` checks it, and `node tools/levels-review/sw-cloud-probe.mjs` PASSes.
2. **Background picker** (2026-10-02, 52cad50).
3. **Subject art** (2026-10-02, 06bd47a), then more icons and motions (2026-10-04, 4c92ca6).
4. **Levels and accounts** (2026-10-03, 0101aa9).
5. **Browser-tool comparison** (2026-10-02, ef70176): [browser-tools.md](browser-tools.md) picks Playwright scripts via Bash, at about 2.4x fewer tokens than either MCP server, and the only option with WebKit.
6. **Themes rework, crisp text and whole-app review rounds** (2026-10-03, 95b9e9e and 1af5d0d), then the header fixes (2026-10-04, e0364a2).
7. **Known gaps closed** (2026-10-06): a phone no longer ends a larger board's level game by opening it, sign-in's busy state keeps its contrast, and a page an update took over reloads when next hidden.

Standing rule: bump CACHE whenever markup and modules change together. `node tools/sims/sw/tear.mjs <old-ref> <new-ref>` shows whether a deploy tears.

## Left open on purpose
The owner's targets are current iPhones, iPad and laptops (2026-10-03: not the iPhone SE or other small screens), so gaps on other shapes and browsers stay. Each of the rest was judged too rare, or too small, to be worth the code.
- **Other shapes and browsers:** at about 410x360, a phone in split screen, the board shrinks to about 180px and the header's New game runs off the right edge. Between 360 and 463px wide and under 360px tall the score card's countdown is cut short (Stay, Next level and the read-out countdown are unaffected). A Theme tile shows checked and focus only through `:has()`, absent before Firefox 121.
- **Theme page:** its first open spends tens of milliseconds reading the 14 looks off the stylesheet, once a page.
- **A level on two devices at once:** two devices finishing the same level together keep the higher score, but the card on the other one shows its own total until the next sync. Two devices that deal one level at different difficulties on boards of one size each save their own game over the other's until one finishes it, and a board of it reloaded meanwhile is timed as the other's difficulty.
- **A level across board sizes:** once a phone's find takes a level over from the large board, the large board's finds and time do not carry to it. Before that find, a reload starts the phone's clock again from zero, since its time is not saved until it has a find.
- **Signed out mid-level:** a level finished while signed out is banked on signing in again, with its clock where its last save left it.
- **Service worker:** an update whose install is cut short can leave the old worker's cache torn for one launch (`tools/sims/sw/tear.mjs`). A background that failed to load is tried again when the device is back online, but only the module itself: if one of its imports was what failed, the page keeps that failure until the next launch.
- **Real devices:** the sign-in fields were typed into and selected on Playwright's WebKit with the iPhone 15 profile (2026-10-06), and WebKit runs the layout suite, but no check ran on a real iPhone.

## How this project has been run (owner's standing preferences)
- **Shipping:** push to `main` without asking (owner, 2026-10-03). Commits are authored as BeeBeRBaB <puchkiray@outlook.com> with no Claude trailer.
- **Verifying:** check on the deployed site with the service worker cleared. Simulate rather than eyeball: million-board runs for the generator, and planted failures to prove a check runs.
- **Showing:** for visual changes, show examples before implementing. Keep the current fonts, with no italics.
- **Code:** best-practice formatting, scripts in .js files with no inline script, no new dependencies, short comments.
- **Agents:** use workflows for independent tracks, and don't waste tokens.
