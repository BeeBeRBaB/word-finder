# Amber phosphor — design

Supersedes the palette tables in `2026-07-24-appearance-and-topic-rename-design.md`.
That document's *structure* still holds in full — two blocks, `data-appearance` resolved
in JS, no color literals in JavaScript. Only the values below changed, plus four
additions described in §3–§6.

## 1. Why

The game shipped on a deep-water teal. The request was for something warmer and orange.
Rather than tint the existing palette, the direction is named: **amber phosphor**.

The teal palette had been sitting on an unnamed sonar metaphor — `#16262f` deep water,
`#4fd1a5` a phosphor return, an app called Word *Finder*, a chime on find, and pills
drawn as continuous strokes rather than per-cell tiles. Early monochrome terminals used
amber (P3) phosphor, so going warm keeps every one of those readings and only changes the
temperature. Nothing about the instrument register had to be abandoned.

Kept implied, never literal: no range rings, no radar arc, no crosshairs, and no
instrument vocabulary in player-facing copy.

## 2. Palette

Both palettes are asserted value-for-value by `tests/e2e/appearance.spec.js`, so a change
here is always a deliberate three-file edit: stylesheet, spec, this table.

Every value was checked against WCAG AA (4.5:1) rather than chosen by eye. Ratios are
against `--bg` unless noted.

| Token | Dark | Light | Used by |
| --- | --- | --- | --- |
| `--bg` | `#100a05` | `#f2e3d5` | page background |
| `--surface` | `#241a15` | `#fffaf5` | grid box, win card, confirm card |
| `--border` | `#3d2b21` | `#dfc9b5` | grid box border |
| `--text` | `#f0e0d2` | `#3a2418` | grid letters, word list |
| `--text-strong` | `#fdf4ea` | `#24140b` | topic name, win heading |
| `--muted` | `#bfa694` | `#775b47` | found count, card body, close × |
| `--label` | `#e0913f` | `#9e4a0c` | kicker, WORDS header |
| `--hint` | `#a89283` | `#725847` | hint text |
| `--accent` | `#ff8c3a` | `#b84e0d` | button fills and borders |
| `--accent-text` | `#ffa869` | `#a3450b` | text on outlined buttons, links |
| `--accent-hover` | `#ffc79a` | `#7d3406` | link hover |
| `--accent-ink` | `#2b1508` | `#ffffff` | text on a filled accent button |
| `--accent-wash` | `rgba(255,140,58,.12)` | `rgba(184,78,13,.10)` | outlined button hover |
| `--scrim` | `rgba(8,5,3,.75)` | `rgba(45,25,14,.45)` | overlay backdrops |
| `--shadow` | `0 6px 20px rgba(12,6,3,.40)` | `0 6px 20px rgba(90,55,30,.16)` | grid box |
| `--card-shadow` | `0 10px 40px rgba(0,0,0,.5)` | `0 10px 40px rgba(90,55,30,.24)` | win/confirm cards |
| `--found-text` | `#fff1e0` | `#3d1c06` | word mid-glow, **and now found grid letters** |
| `--done-text` | `rgba(240,224,210,.6)` | `rgba(58,36,24,.76)` | struck-through word |
| `--glow` | `rgba(255,140,58,.42)` | `rgba(184,78,13,.28)` | `foundGlow` peak, **and the sweep** |

| Token | Dark | Light |
| --- | --- | --- |
| `--pill-1` | `rgba(255,183,77,.34)` | `rgba(224,150,20,.34)` |
| `--pill-2` | `rgba(120,205,200,.30)` | `rgba(30,150,145,.28)` |
| `--pill-3` | `rgba(255,130,140,.34)` | `rgba(225,80,100,.28)` |
| `--pill-4` | `rgba(200,155,255,.32)` | `rgba(150,95,220,.28)` |
| `--pill-sel` | `rgba(255,140,58,.30)` | `rgba(184,78,13,.26)` |
| `--pill-miss` | `rgba(255,80,70,.5)` | `rgba(210,45,40,.36)` |
| `--pill-edge` | `rgba(255,255,255,.25)` | `rgba(60,35,20,.16)` |
| `--confetti-1…6` | `#ff8c3a #ffc14d #78cdc8 #ff828c #c89bff #fdf4ea` | `#b84e0d #e0a014 #1e9691 #e1506e #965fdc #8a6a55` |

Two pill slots stay cool (teal, violet) on purpose. Four warm strokes on a warm ground
stop being distinguishable from each other, which is the one job the pill palette has.

### Contrast notes

- **Light `--accent` is measured as white `--accent-ink` on it** (5.08:1), not against
  `--bg`. That is the pairing it is actually read in, and the same value then does duty
  as the outlined-button and card border. An orange light enough to feel warm on paper
  is too light to carry white button text; this is the binding constraint on the whole
  light palette.
- **Light `--label` needs the full 4.5:1** — it is the 11px kicker, far under the
  18.66px-bold large-text threshold. A first pass at `#a8500e` measured 4.38 and was
  rejected; `#9e4a0c` clears at 4.86.
- **`--done-text`** clears 4.5:1 in both modes while still reading as visibly struck out
  next to `--text` (dark 5.75 vs 14.24; light 5.85 vs 11.57).
- **Dark `--bg` is near-black, not brown.** Revised from `#1a1310` after review. `R>G>B`
  is what keeps an orange cast readable at that luminance. Everything on the page ground
  gains contrast (`--text` 15.27, `--done-text` 5.85), and `--surface` deliberately did
  *not* move with it — dropping only the ground widens the grid panel's lift from 1.09:1
  to 1.16:1, which is the separation the layout wanted anyway.
- **Letters over pills.** Letters paint on top of pills, so every pill tint becomes an
  effective background for a grid letter. Worst case is 5.80:1 (dark, `--pill-1`) and
  7.93:1 (light, `--pill-miss`). Every pill also stays visible against bare `--surface`,
  worst case 1.33:1 — the regression noted in the original spec, where pills tuned for a
  dark surface went nearly invisible on white, does not recur.

## 3. Type

Three roles, one Google Fonts request. Both new faces fall back to Hyperlegible.

| Role | Face | Rationale |
| --- | --- | --- |
| Grid, word list | Atkinson Hyperlegible | Unchanged. Disambiguating `I`/`l`/`1` and `O`/`0` at speed is the grid's whole demand, and this is the face designed for it. |
| Display — topic name, win heading | Space Grotesk | Technical letterforms against Hyperlegible's wide humanist ones. |
| Utility — kicker, WORDS header, count | Space Mono | `#count` rewrites on every find; proportional digits make it jitter sideways as the score climbs. |

Grotesk and Mono are a designed pair from one superfamily, so the header reads as one
voice rather than two borrowed ones.

`--display` and `--utility` are the only non-color tokens in the stylesheet, so they sit
in their own `:root` block rather than being duplicated into both palettes — a typeface
does not change with the appearance setting. That block must stay first in the file;
`tests/unit/tokens.test.js` asserts it.

The faces are cross-origin, so `sw.js` cannot precache them at install. They land in the
cache on first load exactly as Hyperlegible always has, and `display=swap` keeps first
paint on the fallback rather than blank. No service worker change was needed.

## 4. The grid shows its own progress

`.cell.found` colors a found word's letters `--found-text`. Until now a found word was
marked only by the pill behind it and its letters read exactly like the filler around
them.

`renderGrid` rebuilds every cell, so `renderFoundCells` reapplies from state after any
layout rather than tracking anything. It is deliberately **not** folded into
`renderPills`, which runs on every `pointermove` during a drag; found-ness only changes
on a find.

`lineIndices(size, sel)` moves to `puzzle.js` and `readLine` is rewritten on top of it,
so walking a selection is written once.

## 5. Signature: the solved shape

The win card opened with `&#127881;`, a party-popper emoji. It now opens with the
finished puzzle's own strokes — every found word's pill, letters stripped, drawn into a
148px plate.

Puzzles are seeded, so the same seed always draws the same mark and different seeds draw
different ones. That is the entire argument for it: the card shows you something about
*your* puzzle rather than a generic celebration.

`pillDiv` gains a `thick` parameter (default `0.82`, the grid's value). The shape passes
`0.62` — twelve strokes at grid thickness in a 148px box read as one blob.

`SOLVED_BOX` in `view.js` and `#solved`'s size in `styles.css` must agree or the mark is
cropped or floats.

## 6. Per-topic identity

`#topic` underlines itself in one of the four pill hues, chosen by `accentSlot()` hashing
the topic *name*. Hashed rather than drawn from the rng so a topic keeps its color across
sessions, and from the name rather than `topicIdx` so reordering `TOPICS` doesn't
reshuffle all 100.

Deliberately a `text-decoration` underline rather than a rule element: text-decoration
draws inside the line box and adds no height. The landscape rail has none to give — the
existing notes on `#hdr` record it overflowing by 19–38px on iPhone-class landscape. For
the same reason the topic stays at 28px; Space Grotesk changes the voice, not the metrics.

## 7. Motion

One phosphor pass across the grid as a puzzle appears — the page-load moment, and the
only motion added.

Animating `background-position` rather than a transform keeps the gradient inside the
element, so `#gridbox` needs no `overflow:hidden` that could clip a pill. The sweep paints
above the letters (a generated `::after` is last in paint order) and is
`pointer-events:none`, so it cannot swallow the first drag.

`main.js` skips calling `sweep()` under reduced motion, and the reduced-motion block also
kills the animation outright — belt and braces, since the class is applied from JS.

Restarting the animation needs class-off, forced reflow, class-on. Without the reflow the
browser coalesces remove+add into no change and a second new game is still.

## 8. Follow-up: legibility and the word-list columns

Sizes went up across the small type — `#kicker` 11→13px, `#listhdr b` 12→13px, `#count`
13→14px, `#hint` 12→13px, and `.w` 17→19px. The word list is a fixed-height block in
portrait, so every px the type grows is a px the grid gives back: `RESERVE_PORTRAIT` rose
340→366 and the portrait cell drops ~2px as a result. In landscape there was no height to
give at all, so `.w` keeps the larger size and surrenders vertical padding instead
(4px→2px, which is 24px back over six rows). The e2e device table is what proved both.

`#topic` gains a `Topic:` label as a **sibling**, not a `::before`. Two reasons: `#topic`'s
textContent has to stay the bare topic name, since `gameplay.spec.js` compares it across
two loads of one seed; and the per-topic underline is set on `#topic`, so a pseudo-element
would drag the rule under the label too.

The count moves from the far edge of the list header to directly after `WORDS`, separated
by an em dash. `justify-content: space-between` had parked it hundreds of px away in
landscape. The dash is a `::before` so `#count`'s textContent stays the bare
`"n of 12 found"` the specs match on.

**`listColumns` is `max-content max-content`, not `1fr 1fr`.** Fractional tracks split the
*whole* rail, and in landscape the rail is every pixel left over after the grid — so on a
wide window the second column sat hundreds of px from the first and slid on every resize.
Measured before/after at rail widths 388 / 678 / 998px: the inter-column gap went from
~194 / ~339 / ~499px to a constant 119px. Both orientations share one constant so they
cannot drift. `layout.test.js` asserts the track never varies with the viewport, which is
the invariant — the literal string is not.

## 9. Follow-up: one left edge for the rail

`WORD FINDER`, `Topic:`, `WORDS`, the word text and the hint all sit on a single left
edge, verified at 1440×900, 390×664, 844×300 and 744×1053.

Two separate things were pushing them apart:

- **`.w` carries horizontal pill padding** for the found-glow, so its *text* starts 12px
  (10px in landscape) inside wherever `#list` sits. `#list` is pulled back by exactly
  that padding, which puts the glyphs on the edge and lets `#listhdr` and `#hint` sit at
  a plain `0` instead of being nudged to chase them. The two values must move together.
- **In portrait `#hdr` is the full app width while the grid is centred and narrower**, so
  a rail pinned to the grid's width left the list indented from the header above it.
  `#side` goes full width in portrait instead.

The rejected fix was the mirror of that one — shrink `#hdr` to the grid's width so the
header meets the list. On a 390px phone the topic block plus both buttons need ~340px and
the grid is 293px, so the header **wrapped onto a second row and cost 48px** of exactly
the height the portrait grid is short of. The grid stays centred and is simply not part
of this alignment; it is a separate object.

Vertical separation between the topic block and the list comes from `row-gap` in
landscape, where they are stacked rows of one column and read as a single blob at 4px,
and from `#listhdr`'s top margin in portrait.

## Cut

A faint plotted field ruled behind the letters. It was the most decorative item in the
plan and the only one that could cost legibility in a Hyperlegible-first app.

## Out of scope

- Per-topic *palettes*. 100 topics get one accent hue each, drawn from tokens that
  already exist; they do not get 100 themes.
- A third appearance. Unchanged from the original spec.
- Precaching the fonts. Would mean either vendoring the woff2 files into the repo or
  teaching `sw.js` about cross-origin install-time fetches; the first-load-then-cached
  behaviour is what Hyperlegible has always had and it is good enough.
