#!/bin/bash
# WhaleTrace Daily Scraper + Supabase Sync
# Run via Hermes cron: python ~/whaletrace/scripts/whaletrace_scraper.py --sync-supabase

cd ~/whaletrace
python3 scripts/whaletrace_scraper.py --sync-supabase 2>&1
echo "EXIT: $?"
