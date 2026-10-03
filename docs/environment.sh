# Cloud environment setup for word-finder's Project threads. Paste into the environment's
# setup script on claude.ai/code. It runs as root on Ubuntu 24.04, and threads start from its
# cached result, which is only cached if it finishes in about 5 minutes, so keep it lean.
# Installs what `npm test` needs that `npm ci` cannot: a new enough Node, and the Playwright
# browsers with their system libraries (--with-deps needs root).
set -eu
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
# A shared path, readable by any user: the docs don't say which user threads run as. Set the
# environment variable PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright so threads look here.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/ms-playwright}"
npx -y playwright@1.61.1 install --with-deps chromium webkit
$SUDO chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"
# Last line: its status is the script's.
node --version && npx -y playwright@1.61.1 --version
