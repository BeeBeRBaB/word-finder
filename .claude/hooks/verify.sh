#!/usr/bin/env bash
# PostToolUse hook. Runs after any edit to a shipped source file and fails with
# exit 2, which feeds stderr back to Claude as a blocking error it has to fix —
# rather than exit 1, which only shows the user a red line Claude never sees.
#
# Cost is ~0.7s (unit tests 0.2s, tsc 0.5s), which is why this can afford to run
# on every edit rather than being something you remember to run at the end.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
file=$(jq -r '.tool_input.file_path // empty')

# Only the files that ship. Editing a test, a spec, or a doc skips all of this.
case "$file" in
  "$root"/src/*.js | "$root"/sw.js | "$root"/styles.css | "$root"/index.html) ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0

fail() { printf '%s\n' "$1" >&2; exit 2; }

# 1. Every module under src/ must appear in the service worker's ASSETS array.
#    No test covers this, and the failure is silent: a module missing from the
#    precache list works online and breaks the app offline. Worse once a deploy
#    deletes a file, since a stale cached main.js then imports a path the server
#    no longer serves — see the comments in sw.js.
missing=""
for module in src/*.js; do
  grep -q "'\./$module'" sw.js || missing="$missing $module"
done
if [ -n "$missing" ]; then
  fail "sw.js: ASSETS is missing:$missing
Add each path to the ASSETS array in sw.js, or the app breaks offline."
fi

# 2. The unit suite. Fast, no browser, and it owns the two invariants that are
#    easiest to break by hand: light/dark palette parity (tokens.test.js) and the
#    service worker's reload-mode install (sw.test.js).
if ! out=$(npm run test:unit --silent 2>&1); then
  fail "npm run test:unit failed:

$out"
fi

# 3. Types. The project is plain JS checked through JSDoc, so tsc is the only
#    thing standing between a typo and a runtime error in the browser.
if ! out=$(npm run typecheck --silent 2>&1); then
  fail "npm run typecheck failed:

$out"
fi

exit 0
