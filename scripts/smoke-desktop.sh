#!/usr/bin/env bash
# Build the desktop main bundle, launch the actual built app for a few seconds,
# capture stderr, and fail if any Error / Uncaught lines appear.
#
# Catches:
#  - Missing modules (dotenv-style)
#  - Throws-on-init (Supabase WebSocket-style)
#  - Crashes during initial IPC handlers
# Doesn't catch:
#  - electron-builder packaging issues (use `npm run package:mac` for that)
#  - In-game flow bugs (require a real LoL client)

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building desktop bundles"
npm run build -w packages/desktop >/dev/null

echo "==> Verifying bundled requires resolve"
npx tsx scripts/verify-desktop-bundle.ts

echo "==> Launching built app for 8s and capturing stderr"
LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

cd packages/desktop
# Unset ELECTRON_RUN_AS_NODE so electron actually runs as a desktop app
# rather than as a plain Node process (matches the `dev` script).
env -u ELECTRON_RUN_AS_NODE npx electron . >"$LOG" 2>&1 &
PID=$!
sleep 8

# If the process exited on its own before our timeout, that's a crash.
if ! kill -0 "$PID" 2>/dev/null; then
  echo "==> App crashed during startup. Last 30 lines:"
  tail -30 "$LOG" | sed 's/^/   /'
  exit 1
fi

# Still alive — kill it and look for fatal patterns in the output.
# We only fail on:
#  - Cannot find module (missing bundled dep)
#  - Synchronous throws that crash the main process before showing the window
# Background async errors (e.g. Supabase fetch failure when offline) are OK —
# the app handles them and stays running.
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

echo "==> Last 20 lines of app output:"
tail -20 "$LOG" | sed 's/^/   /'

FATAL=$(grep -E "(Cannot find module|app\.whenReady|Uncaught Exception)" "$LOG" || true)
if [ -n "$FATAL" ]; then
  echo ""
  echo "FAIL: app emitted fatal startup errors:"
  echo "$FATAL"
  exit 1
fi

echo ""
echo "OK — app stayed alive for 8s without fatal startup errors."
