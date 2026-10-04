#!/bin/bash
# Cloud environment setup for word-finder's Project threads. Paste into the environment's setup
# script. It runs as root on Ubuntu 24.04 when the environment changes or its cache expires, in the session that starts
# first: that can be the project chat, which has no checkout, so nothing here may need the repo
# (npm ci there stops every session from starting; the SessionStart hook runs it in each thread).
# Its result is cached only if it finishes in about 5 minutes, so keep it lean.
# Installs what `npm test` needs that `npm ci` cannot: a new enough Node, and the Playwright
# browsers with their system libraries (--with-deps needs root).
set -eu
# The failure notice shows none of this output, so keep it. A failed session's disk is kept, so
# Claude there can read the file once a message resumes it.
exec > >(tee /tmp/setup-script.log) 2>&1
trap 'rc=$?; echo "SETUP FAILED: \"$BASH_COMMAND\" exited $rc (line $LINENO)"' ERR
SUDO=; [ "$(id -u)" -eq 0 ] || SUDO=sudo
# tools/coverage.mjs passes --test-coverage-exclude, added in Node 22.5.0. The image ships Node 22.
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)' 2>/dev/null; then
  $SUDO apt-get update
  $SUDO apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup_22.sh
  $SUDO bash /tmp/nodesource_setup_22.sh
  $SUDO apt-get install -y nodejs
fi
# Chromium and WebKit (playwright.config.js has a Desktop Safari project), pinned to
# package-lock's Playwright: bump this with it, or the test run downloads its own builds.
# The pin also means it needs no checkout.
# The cloud image sets PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers, where threads look; the
# fallback is a shared path for an image that doesn't.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/ms-playwright}"
npx -y playwright@1.61.1 install --with-deps chromium webkit
$SUDO chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"
# certutil, for trusting each session's proxy CA in Chromium's own NSS store (docs/handoff.md).
$SUDO apt-get install -y libnss3-tools
node --version && npx -y playwright@1.61.1 --version
echo "SETUP OK"
