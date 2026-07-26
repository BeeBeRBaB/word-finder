# Word Finder

A client-side word search PWA. **No build step** — the files in this repo are
byte-for-byte what GitHub Pages serves. There is nothing to compile, bundle, or
transpile, and adding a step that would change that is out of scope.

[README.md](README.md) has the file-by-file map and the topic format. This file
covers what the README does not: how the project fails, and how to work on it
without causing that.

## Constraints

- **No new dependencies.** The only devDependencies are `@playwright/test` and
  `typescript`, and both are dev-only. This is a deliberate constraint, not an
  oversight — see the comments in [tsconfig.json](tsconfig.json), which chooses to
  leave the Node-only test files unchecked rather than install `@types/node`.
  Don't "fix" that by installing it.
- **Types come from JSDoc**, checked with `tsc --noEmit`. `checkJs` and `strict`
  are on. There is no TypeScript source.
- **`src/` is split on the pure / DOM boundary.** `rng`, `puzzle`, `layout`,
  `storage`, `catalog` touch no DOM, which is the only reason they are cheap to
  unit-test. Reaching for `document` in one of those files costs that.
  (`appearance` is *not* in that set — it resolves and writes `data-appearance` on
  the root element.)

## Deploying

Push to `main` and it is live. No CI, no PRs, no feature branches — the local
suite is the only gate. **`/ship` is user-invoked** — Claude cannot launch it (the
skill sets `disable-model-invocation`, deliberately: deploying is the user's call).
Ask the user to run it, or follow its steps in `.claude/skills/ship/SKILL.md` by
hand and say that is what you did. It
sequences the steps and waits for the Pages build to actually serve your commit.

`npm test` is deploy-independent and proves nothing about the deployed site.
`npm run test:live` runs against the real thing and only makes sense after a push.

## How much to check

Match the check to what the change can break. The hook already covers the cheap
ground continuously, so re-running everything after every edit buys nothing and is
the main way a small change turns into a long session.

| When | Run | Cost |
| --- | --- | --- |
| Every edit | the PostToolUse hook — automatic, nothing to type | 0.7s |
| Before committing | the one e2e spec covering what you touched | ~5s |
| Before pushing | `npm test` in full, **once** | ~50s |
| After pushing | `npm run test:live` | ~4s |
| Reviewer subagents | on request, **or** any change to `styles.css` / `sw.js` | minutes |

The last row is not padding. Those two files are the ones that fail silently (see
below), and the suite structurally cannot catch some of it: `layout.spec.js` pins
one short subject name, so a rail-width change that wrapped the header for 230 of
the 600 subjects — pushing words off the bottom of a landscape phone — passed all
59 e2e tests. A reviewer found it. Everywhere else, failures are loud and the hook
plus one spec is genuinely enough.

**For anything visual, `npm run shots` beats describing it.** It renders every shape
in `tests/viewport.js` to `.shots/`, and `--measure` prints the geometry and
shouts about off-screen cells or words below the fold:

```bash
npm run shots -- --measure          # all shapes, with numbers
npm run shots -- landscape          # just the short-landscape ones
npm run shots -- --dark --subject=sports/golf
```

Its default subject is deliberately a long name, because a short one hides exactly
the header-wrapping class of bug the suite already misses.

## Verifying a change

**A normal browser reload lies to you.** The service worker serves code
stale-while-revalidate, so a reload shows the *previous* build while the new one
downloads in the background. Judging a visual change without first unregistering
the service worker and clearing its caches produces a confident wrong answer.

Prefer the deployed site over localhost for anything about appearance, caching, or
first paint. The **deploy-verifier** subagent does the clearing correctly.

## The two files that fail silently

Everywhere else a mistake throws or fails a test. In these two it renders wrong for
one class of visitor, or serves a stale build, with no error anywhere:

- **[styles.css](styles.css)** — a three-block token layer. The bare `:root` block
  holds type tokens and must stay first in the file; `:root, :root[data-appearance="dark"]`
  is the default-and-dark palette; `:root[data-appearance="light"]` is light. Both
  palettes must declare identical token names, and new colours must be tokens
  rather than literals.
- **[sw.js](sw.js)** — code is stale-while-revalidate, icons and fonts are
  cache-first, requests are re-issued with `no-cache` to defeat Pages' `max-age=600`,
  and install uses `{cache:'reload'}`. Each of those exists because of a specific
  failure; the comments in the file explain which.

Dispatch the **cascade-and-cache-reviewer** subagent when a change touches either,
or the inline appearance resolver in [index.html](index.html).

**Don't reason about CSS cascade, browser API behaviour, or cache semantics from
first principles — check them.** That is where confident plans in this repo have
been wrong, and all three are cheap to verify directly.

## Adding things

**A module:** create it in `src/`, then add its path to the `ASSETS` array in
[sw.js](sw.js) — a module missing there works online and breaks the app offline.
The PostToolUse hook blocks on this, so you will be told. `tsconfig.json` picks the
file up automatically via its `src/**/*.js` glob. Add a unit test if the module is
pure, and a row to the README's file table.

**This does not apply to `src/subjects/*.js`.** Word pools are the one thing that
must stay *out* of `ASSETS` — precaching them would pull all 25 categories into the
installed shell and defeat the lazy load. `sw.js` routes that directory to its own
runtime cache by prefix, so nothing there is ever listed. The hook won't catch a
mistake either way: its glob is `src/*.js` and does not descend.

**A subject:** append `'<category>/<slug>': 'WORD1,WORD2,...'` to
`src/subjects/<category>.js`. That is the whole change — the category comes from the
slug prefix and the display name from the slug title-cased, so nothing else
registers it. 40+ words, uppercase A–Z, 3–12 letters, and six length-bucket floors
that [tests/unit/content.test.js](tests/unit/content.test.js) enforces by name. 12
words are drawn per puzzle on the full board, 8 on the compact one.

**Never count letters by eye when writing content.** It was the single largest
source of wasted time in the session that wrote all 600 subjects — every agent that
hand-counted got lengths wrong. Run the pools through a script and read the failures.

## Automation in this repo

A `PostToolUse` hook ([.claude/hooks/verify.sh](.claude/hooks/verify.sh)) runs after
every edit to `src/*.js`, `sw.js`, `styles.css`, or `index.html`: it checks the
`ASSETS` parity above, then runs the unit suite and `tsc`. It takes about 0.7s and
blocks on failure, so those three things do not need running by hand.

Commits are authored as `BeeBeRBaB <puchkiray@outlook.com>` from repo git config —
no `-c` overrides needed — and carry no `Co-Authored-By` trailer. Match the
existing subject style: imperative, specific, often two clauses joined by "and".
