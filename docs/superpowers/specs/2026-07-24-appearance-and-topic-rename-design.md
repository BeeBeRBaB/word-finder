# Appearance modes and the `theme` → `topic` rename — design

**Date:** 2026-07-24
**Status:** approved, not yet planned
**Scope:** one vocabulary rename plus one new feature. They ship together because the
feature is what makes the old vocabulary ambiguous.
Keep it simple — casual game, client-side only, no new deps, no build step.

## Context

`theme` currently means the word list a puzzle is drawn from (Ocean, Space, Farm…). It is
that in `src/themes.js`, the `#theme` header element, the `↻ New theme` button, the
`?theme=N` URL parameter, and the `themeIdx` field of the save format.

Adding a light/dark appearance setting makes that name wrong twice over: it collides with
the near-universal meaning of "theme" in a UI, and `<meta name="theme-color">` /
`manifest.theme_color` already use the word in the platform sense. After this change,
**"theme" means only how the UI looks.**

Second problem: `styles.css` has no custom properties at all. Roughly thirty hex and rgba
literals are written directly into the rules, and two more color sets live in JavaScript
(`PAL` in `view.js`, the confetti array in `effects.js`). There is nothing to switch. The
token layer is the bulk of the work here, not the toggle.

## 1. Rename `theme` → `topic`

Player-facing buttons say **"New game"** — what the button does, not what the data is
called. `topic` is the internal name: code, URL parameter, filename. It is never shown.

| Where | Before | After |
| --- | --- | --- |
| Data module | `src/themes.js`, `THEMES` | `src/topics.js`, `TOPICS` |
| Puzzle builder | `buildPuzzle({themes, themeIdx, …})` | `buildPuzzle({topics, topicIdx, …})` |
| Seeding | `resolveThemeIndex(…)`, `?theme=N` | `resolveTopicIndex(…)`, `?topic=N` |
| Header element | `#theme` | `#topic` |
| Save format | `{seed, themeIdx, found}` | `{seed, topicIdx, found}` |
| `main.js` | `newTheme()`, `requestNewTheme()`, `themeIdx` | `newGame()`, `requestNewGame()`, `topicIdx` |

Use `git mv` for `src/themes.js` so the file's history follows it.

**Visible strings:**

| Before | After |
| --- | --- |
| `↻ New theme` | `↻ New game` |
| `Play a new theme →` | `Play a new game →` |
| `Start a new puzzle? Your progress will be lost.` | `Start a new game? Your progress will be lost.` |
| `New puzzle` (confirm button) | `New game` |

**Title:** "Themed Word Finder" becomes **"Word Finder"**. "Themed" was pointing at the
topic and now misdirects. Changes `<title>`, the `#kicker` text, `manifest.name`, and the
README heading. `manifest.short_name` is already "Word Finder" and stays.

**Save migration.** `storage.load()` reads `topicIdx ?? themeIdx`, so a game in progress at
deploy time survives. The storage key stays `wordfinder-save-v1`; `save()` only ever writes
`topicIdx`. This is one expression and it prevents a silent mid-game wipe.

**`?theme=` is dropped, not aliased.** Nothing external links to it, and keeping it alive
would reintroduce exactly the ambiguity this rename removes. `?topic=N` behaves identically,
including the existing rule that an explicit value must not draw from the rng.

## 2. Token layer

Every color in `styles.css` becomes a custom property. Both palettes live in exactly two
blocks, selected by a `data-appearance` attribute on `<html>` that is always a *resolved*
concrete value — `light` or `dark`, never `system`:

```css
:root, :root[data-appearance="light"] { --bg: #eef3f1; … }
:root[data-appearance="dark"]         { --bg: #16262f; … }
```

Resolving in JS rather than CSS is what keeps this to two blocks. The alternative — a
`prefers-color-scheme` media query *plus* explicit overrides — states the dark palette
twice and invites the two copies to drift.

**Dark is the current palette, value for value.** No part of this change alters the look
the game already has. Light is a new counterpart in the same hue family, with the accent
darkened from `#4fd1a5` to `#17876a` so that both white-on-accent (the primary buttons) and
accent-on-paper (links, the outlined button) stay legible.

| Token | Dark | Light | Used by |
| --- | --- | --- | --- |
| `--bg` | `#16262f` | `#eef3f1` | page background |
| `--surface` | `#1d2f3a` | `#ffffff` | grid box, win card, confirm card |
| `--border` | `#2c4250` | `#cfdcd7` | grid box border |
| `--text` | `#dfe9e5` | `#1c3a31` | grid letters, word list |
| `--text-strong` | `#eef6f2` | `#10241d` | topic name, win heading |
| `--muted` | `#9fb8ae` | `#5a736a` | found count, card body, close × |
| `--label` | `#6fa899` | `#3f7d68` | kicker, WORDS header |
| `--hint` | `#7d968c` | `#6b8479` | hint text |
| `--accent` | `#4fd1a5` | `#17876a` | button fills and borders |
| `--accent-text` | `#8fe8c8` | `#12684f` | text on outlined buttons, links |
| `--accent-hover` | `#b8f5dd` | `#0d5741` | link hover |
| `--accent-ink` | `#0b2c20` | `#ffffff` | text on a filled accent button |
| `--accent-wash` | `rgba(79,209,165,.12)` | `rgba(23,135,106,.10)` | outlined button hover |
| `--scrim` | `rgba(10,20,26,.72)` | `rgba(20,40,34,.45)` | overlay backdrops |
| `--shadow` | `0 6px 20px rgba(6,20,28,.35)` | `0 6px 20px rgba(30,60,52,.14)` | grid box |
| `--card-shadow` | `0 10px 40px rgba(0,0,0,.5)` | `0 10px 40px rgba(30,60,52,.22)` | win/confirm cards |
| `--found-text` | `#eafff6` | `#0b3a2c` | word mid-glow |
| `--done-text` | `rgba(223,233,229,.6)` | `rgba(28,58,49,.55)` | struck-through word |
| `--glow` | `rgba(79,209,165,.42)` | `rgba(23,135,106,.30)` | `foundGlow` keyframe peak |

The `foundGlow` keyframe currently fades between the same rgba at 0% and 42% alpha. Only the
peak becomes a token; the 0% and 100% stops become the keyword `transparent`, since a custom
property cannot carry two alphas of one color without a second token for no benefit.

**Colors that must move out of JavaScript.** Both sets are tuned for a dark surface and
break outright on light:

- **`PAL` in `view.js:18`** — four pale translucent pastels at 33–38% alpha. On white they
  are close to invisible. Fix: `pillDiv` takes a class name instead of a color string, so
  pills render as `.pill.p1`…`.p4`, `.pill.sel`, `.pill.miss` and CSS owns the color
  entirely. This deletes `PAL` and every color literal from `view.js`.
- **confetti in `effects.js:20`** — the six-color array includes `#eef6f2`, invisible on
  light paper. Fix: read `--confetti-1`…`--confetti-6` off the computed style at burst time.

| Token | Dark | Light |
| --- | --- | --- |
| `--pill-1` | `rgba(240,196,90,.38)` | `rgba(224,160,20,.34)` |
| `--pill-2` | `rgba(120,220,255,.33)` | `rgba(40,150,210,.30)` |
| `--pill-3` | `rgba(255,140,150,.35)` | `rgba(230,90,110,.30)` |
| `--pill-4` | `rgba(190,150,255,.36)` | `rgba(150,100,225,.30)` |
| `--pill-sel` | `rgba(79,209,165,.30)` | `rgba(23,135,106,.28)` |
| `--pill-miss` | `rgba(255,90,90,.5)` | `rgba(220,50,50,.38)` |
| `--pill-edge` | `rgba(255,255,255,.25)` | `rgba(20,50,42,.16)` |
| `--confetti-1…6` | `#4fd1a5 #f0c45a #78dcff #ff8c96 #be96ff #eef6f2` | `#17876a #e0a014 #2896d2 #e65a6e #9664e1 #6b8479` |

`--pill-edge` is the `.pill` inset ring, currently a hardcoded white at 25% — it has to
invert to a dark hairline on light, or every pill loses its edge.

**No-flash.** `src/main.js` is a module, so it is deferred; by the time it runs the browser
has already painted. A dark-mode player would see a white flash on every single load. A
short inline script in `<head>`, before the stylesheet, sets `data-appearance` synchronously:

```html
<script>try{var p=localStorage.getItem('wordfinder-appearance')||'system';
document.documentElement.dataset.appearance=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p}catch(e){}</script>
```

This is the standard pattern and there is no module-based equivalent, but it does duplicate
the resolution rule that `src/appearance.js` also implements. The duplication is deliberate
and small; both sites carry a comment pointing at the other, and the e2e test below covers
it (a stored `dark` preference must be in effect at first paint, not after hydration).

It also breaks the README's "`index.html` — markup only" rule. Update that row to say
"markup, plus the inline no-flash script" rather than leaving the README quietly wrong.

## 3. The appearance control

A 44px icon button immediately left of "New game" in `#hdr`, which needs the two buttons
wrapped in a flex container since `#hdr` currently uses `justify-content: space-between`
against a single child.

One tap cycles:

```text
System ◑  →  Light ☀  →  Dark ☾  →  System ◑
```

Default is **System**.

Icons are **inline SVG, not `☀`/`☾` text glyphs** — iOS renders those characters as color
emoji, which would look wrong next to the flat outlined button beside it. All three SVGs sit
in the markup; CSS shows one based on the button's `data-pref`:

```css
#appearance svg { display: none }
#appearance[data-pref="light"] .i-light { display: block }
```

`aria-label` and `title` both read `Appearance: System (Dark)` — the preference plus, when
it is System, the mode that resolved to. They update on every cycle.

`<meta name="theme-color">` is rewritten to the resolved `--bg` so the iOS status bar tracks
the app instead of staying pinned to the dark surface color.

**`src/appearance.js`** follows the `makeStorage()` idiom already in the codebase: pure
exports that unit-test without a browser, plus a factory whose dependencies are injectable.

```js
export const PREFS = ['system', 'light', 'dark'];   // also the cycle order
export function nextPref(pref)                       // → the next pref in the cycle
export function resolveAppearance(pref, prefersDark) // → 'light' | 'dark'
export function makeAppearance({ store, root, media, meta })  // all optional
  //  .get()    → current preference
  //  .set(p)   → persist + apply
  //  .cycle()  → advance one step, returns the new preference
  //  .start()  → subscribe to OS changes; re-applies only while pref is 'system'
```

Preference key is **`wordfinder-appearance`**, deliberately separate from
`wordfinder-save-v1` — clearing a stuck game must not reset the player's appearance, and
vice versa. As with `makeStorage`, every storage access is wrapped so a disabled or full
store degrades to "appearance not remembered" rather than throwing into the game.

**Landscape risk.** Landscape phones give the right-hand rail only ~280–320px of total
height and the header already wraps; `#hint` is hidden there for exactly this reason. A
second 44px button may push `#newbtn` onto a second row and steal list height. The existing
`tests/e2e/layout.spec.js` overflow assertions will catch it. If they fail, the fallback is
to drop the "New game" label to its `↻` glyph in landscape only — the confirm dialog already
explains what it does.

## 4. Tests

**Updated** — six files reference the old vocabulary: `tests/unit/rng.test.js`,
`tests/unit/puzzle.test.js`, `tests/unit/storage.test.js`, `tests/e2e/gameplay.spec.js`,
`tests/e2e/ux.spec.js`, `tests/e2e/smoke.spec.js`, plus a stale comment in
`tests/e2e/regressions.spec.js`.

**New `tests/unit/appearance.test.js`:**

- `nextPref` cycles system → light → dark → system and is total over `PREFS`.
- `resolveAppearance` maps each preference against both `prefersDark` values.
- `makeAppearance` persists the preference and reads it back through an injected store.
- A throwing store degrades silently — no exception escapes `set()`.
- `start()` re-applies on an OS change while `system`, and ignores it while `light`/`dark`.

**New `tests/e2e/appearance.spec.js`:**

- Cycling the button steps `data-appearance` on `<html>` and swaps the computed `--bg`.
- The preference survives a reload.
- With `page.emulateMedia({ colorScheme })`, System follows the OS both ways.
- A stored `dark` preference is already applied on first paint (guards the inline script).
- Found-word pills and grid letters resolve to different computed colors in each mode —
  a regression guard against a token that was only defined in one palette.

**Added to `tests/unit/storage.test.js`:** a legacy save written with `themeIdx` loads with
the right `topicIdx`, and a save written with `topicIdx` is unaffected by the fallback.

## 5. Housekeeping

- **`sw.js`:** `./src/themes.js` → `./src/topics.js` in `ASSETS`, add `./src/appearance.js`,
  bump `CACHE` from `wordfinder-v6` to `wordfinder-v7`. `tests/live/smoke.spec.js` asserts
  every precached asset resolves, so a missed path fails loudly after deploy.
- **`README.md`:** file table (`src/topics.js`, `src/appearance.js`, the `index.html` row),
  the reproducible-puzzles section (`?seed=` / `?topic=`), "Adding a theme" → "Adding a
  topic", and the "Themed Word Finder" heading.
- **`manifest.webmanifest`:** `name` → "Word Finder". `theme_color` and `background_color`
  stay at their dark values — they are the install-time and splash-screen colors, read
  before any script runs, and cannot follow a runtime preference.

## Out of scope

- Any third palette (high contrast, sepia, per-topic coloring).
- A settings panel. One setting does not need one; if a second arrives, revisit.
- Reworking `manifest` colors per appearance — not something the platform supports.
