#!/usr/bin/env bash
# PostToolUse hook. Runs after any edit to a shipped source file and fails with
# exit 2, which feeds stderr back to Claude as a blocking error it has to fix —
# rather than exit 1, which only shows the user a red line Claude never sees.
#
# Cost is ~0.7s (unit tests 0.2s, tsc 0.5s), which is why this can afford to run
# on every edit rather than being something you remember to run at the end.
#
# The one thing this script must never do is exit 0 without having run its checks.
# A skip and a pass are indistinguishable to the caller, so anything that stops it
# from deciding — unreadable input, a path it cannot place — is a hard failure.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
payload=$(cat)

fail() { printf '%s\n' "$1" >&2; exit 2; }

# node, not jq: this is a Node project, so node is already required, while jq was an
# undeclared dependency whose absence made `file` empty and sent every edit down the
# "not a shipped file" path — reporting success having checked nothing. realpath
# normalises a relative file_path, a trailing slash on CLAUDE_PROJECT_DIR, an embedded
# "./" and macOS's /tmp -> /private/tmp symlink onto one repo-relative string; before
# it, three of five spellings skipped silently with a real violation planted.
#
# Empty output means the payload named no file, which is not our business. A non-zero
# exit means we could not tell, and that is a hard failure rather than a skip.
rel=$(printf '%s' "$payload" | node -e '
  const path = require("path"), fs = require("fs");
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    let file;
    try { file = JSON.parse(s)?.tool_input?.file_path; } catch { process.exit(1); }
    if (!file) return;
    const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
    const root = real(process.argv[1]);
    process.stdout.write(path.relative(root, real(path.resolve(root, file))));
  });
' "$root") || fail "verify.sh: could not read a file path from the hook payload. Refusing to report success without running the checks."
[ -n "$rel" ] || exit 0

# Only the files that ship. Editing a test, a spec, or a doc skips all of this.
# `*` matches slashes in a case pattern, so src/subjects/<cat>.js lands here too —
# deliberate: a word pool still has to pass the content contract in the unit suite.
case "$rel" in
  src/*.js | sw.js | styles.css | index.html) ;;
  *) exit 0 ;;
esac

cd "$root" || fail "verify.sh: could not enter $root"

# The unit suite. Fast, no browser, and it owns the invariants that are easiest to
# break by hand: light/dark palette parity (tokens.test.js), the service worker's
# reload-mode install, and the ASSETS precache list in both directions (sw.test.js).
#
# That last one used to be re-implemented here, parsing sw.js a second time. It is a
# test's job: sw.test.js already read the same file and already owned one of the three
# rules, and as a test it also runs under `npm test` and `/ship` — which is what
# catches a module deleted with `rm`, something this hook never sees.
# node/tsc directly, not `npm run`: the npm wrapper costs ~150ms of the ~700ms this
# takes, on a hook that fires after every edit. The scripts in package.json stay the
# documented entry points for humans; this is the same two commands without the shell
# npm spawns to reach them.
if ! out=$(node --test 2>&1); then
  fail "unit tests failed (npm run test:unit):

$out"
fi

# Types. The project is plain JS checked through JSDoc, so tsc is the only
# thing standing between a typo and a runtime error in the browser.
if ! out=$(./node_modules/.bin/tsc --noEmit 2>&1); then
  fail "typecheck failed (npm run typecheck):

$out"
fi

exit 0
