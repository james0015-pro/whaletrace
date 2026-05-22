#!/usr/bin/env bash
# ============================================================
# WhaleTrace — init.sh (Harness Engineering)
# ============================================================
# 在每次 agent session 開始時執行，驗證環境健康。
#
# 使用方式:
#   bash init.sh
#
# 驗證項目:
#   1. Node.js >= 18
#   2. npm dependencies 已安裝
#   3. TypeScript 編譯通過
#   4. Vite build 可完成
#   5. Git repo 狀態乾淨（可 commit）
# ============================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== WhaleTrace Harness Init ==="
echo ""

# 1. Node.js check
echo "[1/5] Checking Node.js..."
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1) || true
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo "  ❌ Node.js >= 18 required. Current: $(node -v 2>/dev/null || echo 'not found')"
  exit 1
fi
echo "  ✅ Node.js $(node -v)"

# 2. npm dependencies
echo "[2/5] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  ⚠️  node_modules not found. Running npm install..."
  npm install
else
  echo "  ✅ node_modules exists"
fi

# 3. TypeScript check
echo "[3/5] TypeScript type-check..."
if npx tsc --noEmit 2>&1 | tail -5; then
  echo "  ✅ TypeScript passes"
else
  echo "  ❌ TypeScript errors found"
  exit 1
fi

# 4. Vite build
echo "[4/5] Vite build..."
if npm run build:prod 2>&1 | tail -5; then
  echo "  ✅ Build succeeds"
else
  echo "  ❌ Build failed"
  exit 1
fi

# 5. Git status
echo "[5/5] Git status..."
if git diff --quiet && git diff --cached --quiet; then
  echo "  ✅ Working tree clean"
else
  echo "  ⚠️  Uncommitted changes:"
  git status --short | head -10
fi

echo ""
echo "=== Harness Init Complete ==="
echo "Next: Read progress.md → pick next feature → implement"
