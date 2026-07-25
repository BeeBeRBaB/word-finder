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
  `storage`, `appearance` touch no DOM, which is the only reason they are cheap to
  unit-test. Reaching for `document` in one of those files costs that.

## Deploying

Push to `main` and it is live. No CI, no PRs, no feature branches — the local
suite is the only gate. Use the **`/ship`** skill rather than doing it by hand; it
sequences the steps and waits for the Pages build to actually serve your commit.

`npm test` is deploy-independent and proves nothing about the deployed site.
`npm run test:live` runs against the real thing and only makes sense after a push.

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

**A topic:** append `["Name","WORD1,WORD2,..."]` to [src/topics.js](src/topics.js).
Uppercase, 12 letters or fewer; 12 words are drawn per puzzle.

## Automation in this repo

A `PostToolUse` hook ([.claude/hooks/verify.sh](.claude/hooks/verify.sh)) runs after
every edit to `src/*.js`, `sw.js`, `styles.css`, or `index.html`: it checks the
`ASSETS` parity above, then runs the unit suite and `tsc`. It takes about 0.7s and
blocks on failure, so those three things do not need running by hand.

Commits are authored as `BeeBeRBaB <puchkiray@outlook.com>` from repo git config —
no `-c` overrides needed — and carry no `Co-Authored-By` trailer. Match the
existing subject style: imperative, specific, often two clauses joined by "and".
