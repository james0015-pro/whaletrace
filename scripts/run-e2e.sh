#!/usr/bin/env bash
# WhaleTrace E2E Smoke Test Runner
# Usage: ./scripts/run-e2e.sh
# Requires: PLAYWRIGHT_BROWSERS_PATH or PLAYWIGHT_CHROMIUM_EXECUTABLE_PATH

set -euo pipefail
cd "$(dirname "$0")/.."

# Auto-detect chromium location
if [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]; then
  # Try headless shell from common Playwright paths
  for candidate in \
    /opt/hermes/.playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell \
    ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome \
    /usr/bin/chromium \
    /usr/bin/chromium-browser; do
    if ls $candidate >/dev/null 2>&1; then
      export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(ls -d $candidate | head -1)"
      break
    fi
  done
fi

echo "→ Using Chromium: ${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-auto}"

npx playwright test --project=chromium "$@"
