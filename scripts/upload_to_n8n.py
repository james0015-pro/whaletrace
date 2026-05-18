#!/usr/bin/env python3
"""
WhaleTrace → n8n 資料推送
=========================
讀取爬蟲輸出 JSON，POST 到 n8n WhaleTrace Data API 的 /whaletrace-update 端點。
由 cron job 在爬蟲完成後自動呼叫。

用法:
  python upload_to_n8n.py
  python upload_to_n8n.py --webhook https://n8n-james0015.zeabur.app/webhook/whaletrace-update
"""

import json, os, sys, argparse
import urllib.request
from datetime import datetime

SCRAPER_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
DEFAULT_WEBHOOK = "https://n8n-james0015.zeabur.app/webhook/whaletrace-update"


def load_and_upload(webhook_url: str):
    """載入爬蟲 JSON 並 POST 到 n8n"""
    snapshots_path = os.path.join(SCRAPER_OUTPUT_DIR, "stock_snapshots.json")
    holdings_path = os.path.join(SCRAPER_OUTPUT_DIR, "institutional_holdings.json")
    
    if not os.path.exists(snapshots_path):
        print(f"❌ 找不到 {snapshots_path}，先跑 whaletrace_scraper.py")
        return False
    
    with open(snapshots_path) as f:
        snapshots = json.load(f)
    
    holdings = []
    if os.path.exists(holdings_path):
        with open(holdings_path) as f:
            holdings = json.load(f)
    
    payload = {
        "snapshots": snapshots,
        "holdings": holdings,
        "generated_at": datetime.now().isoformat(),
    }
    
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    
    print(f"📤 推送 {len(snapshots)} 檔快照 + {len(holdings)} 筆機構持股...")
    print(f"   目標: {webhook_url}")
    
    try:
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            print(f"✅ 成功: {result}")
            return True
    except Exception as e:
        print(f"❌ 失敗: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="推送 WhaleTrace 資料到 n8n")
    parser.add_argument("--webhook", type=str, default=DEFAULT_WEBHOOK, help="n8n webhook URL")
    args = parser.parse_args()
    
    success = load_and_upload(args.webhook)
    sys.exit(0 if success else 1)
