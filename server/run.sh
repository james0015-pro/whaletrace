#!/bin/bash
# WhaleTrace Data Server — launcher
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Installing dependencies …"
pip install -r requirements.txt -q

echo "==> Starting WhaleTrace data server on port ${WHALETRACE_PORT:-8765} …"
exec python data_server.py
