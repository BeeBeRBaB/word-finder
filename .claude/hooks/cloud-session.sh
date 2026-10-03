#!/usr/bin/env bash
# SessionStart hook for cloud (Project) threads; a local checkout skips it.
# Prints only when something needs the thread's attention, since its stdout joins the context.
# Every network step is time-boxed and nothing exits non-zero, so a blocked host never stalls a start.
set -u
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# The edit hook runs tsc, and the setup script cannot run npm ci for the checkout.
if [ ! -d "$root/node_modules" ]; then
  (cd "$root" && timeout 90 npm ci --no-audit --no-fund >/dev/null 2>&1) ||
    echo "cloud-session: npm ci failed; run it before editing, or the edit hook cannot typecheck."
fi

# Chromium reads its own NSS store, not the system one, and the proxy's CA is written at session start.
# Untrusted, npm run test:live fails with ERR_CERT_AUTHORITY_INVALID and e2e pages lose Google Fonts.
ca="$HOME/.ccr/agent-proxy-ca.crt"
[ -f "$ca" ] || exit 0
if ! command -v certutil >/dev/null && [ "$(id -u)" -eq 0 ]; then
  timeout 60 sh -c 'apt-get install -y -qq libnss3-tools || { apt-get update -qq && apt-get install -y -qq libnss3-tools; }' >/dev/null 2>&1
fi
if ! command -v certutil >/dev/null; then
  echo "cloud-session: certutil (libnss3-tools) is missing, so Chromium does not trust the proxy: npm run test:live fails with ERR_CERT_AUTHORITY_INVALID and e2e pages render without Google Fonts."
  exit 0
fi
db="$HOME/.local/share/pki/nssdb"
[ -f "$db/cert9.db" ] || { mkdir -p "$db" && certutil -N -d "sql:$db" --empty-password; }
certutil -A -d "sql:$db" -n agent-proxy-ca -t C,, -i "$ca" ||
  echo "cloud-session: could not add the proxy CA to $db; npm run test:live will fail with ERR_CERT_AUTHORITY_INVALID."
exit 0
