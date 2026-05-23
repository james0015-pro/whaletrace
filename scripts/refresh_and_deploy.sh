#!/bin/bash
# ============================================================
# WhaleTrace 數據刷新 & 部署一鍵腳本
# ============================================================
# 執行順序:
#   1. 執行 Python 爬蟲 (Finviz + SEC EDGAR + yfinance)
#   2. 複製 data/ → public/data/
#   3. npm run build
#   4. 部署到 GitHub Pages (gh-pages branch)
#
# 用法:
#   bash scripts/refresh_and_deploy.sh           # 完整跑
#   bash scripts/refresh_and_deploy.sh --skip-scrape  # 只用既有 data 重建
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "============================================================"
echo " WhaleTrace Refresh & Deploy"
echo " $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"

# ─── STEP 1: Scrape ───
if [[ "${1:-}" != "--skip-scrape" ]]; then
  echo ""
  echo "▶ STEP 1/4: Running scrapers..."
  python3 scripts/night_shift_scrape.py
  echo "✅ Scrape complete"
else
  echo ""
  echo "▶ STEP 1/4: Skipping scrape (--skip-scrape)"
fi

# ─── STEP 2: Copy to public/data/ ───
echo ""
echo "▶ STEP 2/4: Copying data to public/data/..."

FILES=(
  "finviz_institutions.json"
  "sec_insider_trades.json"
  "institution_holdings.json"
  "stock_snapshots.json"
)

for f in "${FILES[@]}"; do
  if [ -f "data/$f" ]; then
    cp "data/$f" "public/data/$f"
    echo "  ✅ $f ($(wc -c < "public/data/$f") bytes)"
  else
    echo "  ⚠️  $f not found, skipped"
  fi
done

echo "✅ Copy complete"

# ─── STEP 3: Build ───
echo ""
echo "▶ STEP 3/4: Building..."

npm run build

echo "✅ Build complete"

# ─── STEP 4: Deploy to gh-pages ───
echo ""
echo "▶ STEP 4/4: Deploying to GitHub Pages..."

OWNER="james0015-pro"
REPO="whaletrace"
GH_DIR="/tmp/gh-pages-deploy"

# Clean and prepare temp dir
rm -rf "$GH_DIR"
mkdir -p "$GH_DIR"

# Copy dist contents
cp -r dist/* "$GH_DIR/"

# Add .nojekyll (prevents Jekyll processing)
touch "$GH_DIR/.nojekyll"

# Init and push
git -C "$GH_DIR" init
git -C "$GH_DIR" config credential.helper store
git -C "$GH_DIR" add -A
git -C "$GH_DIR" commit -m "deploy: auto refresh $(date -u '+%Y-%m-%d %H:%M:%S')"
git -C "$GH_DIR" push "https://${OWNER}@github.com/${OWNER}/${REPO}.git" master:gh-pages --force

# Cleanup
rm -rf "$GH_DIR"

echo "✅ Deploy pushed"

# ─── Trigger GitHub Pages rebuild ───
echo ""
echo "▶ Triggering Pages rebuild..."
TOKEN=$(python3 -c "
import os, re
try:
    with open(os.path.expanduser('~/.git-credentials')) as f:
        for line in f:
            m = re.search(r'https://([^:]+):([^@]+)@', line.strip())
            if m:
                print(m.group(2))
                break
except: pass
")

if [ -n "$TOKEN" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${OWNER}/${REPO}/pages/builds")
  echo "  Pages build trigger: HTTP $STATUS"
else
  echo "  ⚠️  No git credentials found, skipping Pages rebuild trigger"
fi

echo ""
echo "============================================================"
echo " ALL DONE — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo " Live: https://${OWNER}.github.io/${REPO}/"
echo "============================================================"
