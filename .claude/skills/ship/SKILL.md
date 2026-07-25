---
name: ship
description: Use when putting word-finder changes live — commits, pushes to main, waits for the GitHub Pages build to serve the new commit, and verifies the deployed site.
disable-model-invocation: true
---

# Ship

Push to `main` and confirm the change is actually live. There is no CI and no PR
gate: the local suite is the only thing standing between a bad commit and the
public site, and the Pages build is the only thing that decides what visitors get.

Run the steps in order. Stop and report if any step fails — do not continue to the
next one.

## 1. Preflight

```bash
git status --short
npm test
```

`npm test` is unit + e2e (~30s). Run the whole thing, not just `test:unit` — the
PostToolUse hook already covers unit and types on every edit, so e2e is the part
this adds. A failure here means don't ship; report the output.

## 2. Decide whether `CACHE` needs bumping

Usually **no**. [sw.js](sw.js) serves code stale-while-revalidate, so a normal
deploy reaches visitors on their next load without a version change — the version
string exists to force a hard reset, not to publish.

Bump `CACHE` in [sw.js](sw.js) only when visitors must not keep the old build for
even one load: a fix for a bug that corrupts stored state, or a change where the
old and new files together would be broken. If you bump it, re-run `npm test`.

## 3. Commit

Repo git identity is already `BeeBeRBaB <puchkiray@outlook.com>` — do not pass
`-c user.*` overrides. **No `Co-Authored-By` trailer**; `.claude/settings.json`
suppresses it, and no commit in this repo's history has one.

Write the subject the way this repo does: imperative, specific about the change,
often two clauses joined by "and". Look at `git log --oneline -10` and match it.

## 4. Push and wait for the build

```bash
git push origin main
git rev-parse HEAD
```

Then poll until the Pages build reports the commit you just pushed:

```bash
gh api repos/BeeBeRBaB/word-finder/pages/builds/latest \
  --jq '{status,commit:.commit,created:.created_at}'
```

Wait for `status: built` **and** `commit` equal to local `HEAD`. A `built` status
on the *previous* commit is the trap — it looks like success and means the deploy
has not landed. Typically under a minute. If it reports `errored`, stop and report.

## 5. Verify the deployed site

Confirm the origin is really serving the new files. GitHub Pages sends
`max-age=600`, so an uncached fetch is required or you may read a ten-minute-old
copy:

```bash
curl -s "https://beeberbab.github.io/word-finder/sw.js?cb=$(date +%s)" | grep -o "wordfinder-v[0-9]*"
npm run test:live
```

For anything visual, or anything the live smoke suite does not cover, dispatch the
**deploy-verifier** subagent — it clears the service worker and its caches before
judging, which a plain browser reload does not.

## Report

Give the commit SHA, confirm it is the one Pages built, and state the live suite
result with its actual output. If you skipped the visual check, say so.
