#!/usr/bin/env python3
"""
WhaleTrace Static API Generator
================================
將 whaletrace_scraper.py 的 JSON 輸出轉換為 WhaleTrace 前端需要的 API 格式。
輸出包含分頁、過濾等，直接供 n8n webhook 端點使用。
"""

import json, os, sys
from datetime import datetime
from typing import Optional

SCRAPER_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
API_OUTPUT_DIR = os.path.join(SCRAPER_OUTPUT_DIR, "api")

def load_scraper_data():
    """載入爬蟲輸出的 JSON"""
    snapshots_path = os.path.join(SCRAPER_OUTPUT_DIR, "stock_snapshots.json")
    holdings_path = os.path.join(SCRAPER_OUTPUT_DIR, "institutional_holdings.json")
    
    snapshots = []
    holdings = []
    
    if os.path.exists(snapshots_path):
        with open(snapshots_path) as f:
            snapshots = json.load(f)
    
    if os.path.exists(holdings_path):
        with open(holdings_path) as f:
            holdings = json.load(f)
    
    return snapshots, holdings


def generate_stock_detail(ticker: str, snapshots: list, holdings: list) -> dict:
    """生成單一股票詳細資料（對應 WhaleTrace StockDetail type）"""
    snap = next((s for s in snapshots if s['ticker'] == ticker), {})
    ticker_holdings = [h for h in holdings if h['ticker'] == ticker]
    
    return {
        'ticker': ticker,
        'company_name': snap.get('company_name', ticker),
        'market_cap': snap.get('market_cap', 0),
        'sector': snap.get('sector', ''),
        'industry': snap.get('industry', ''),
        'snapshot': snap,
        'institutional_holdings': ticker_holdings[:20],
        'holdings_count': len(ticker_holdings),
        'data_date': snap.get('data_date', ''),
    }


def paginate(items: list, page: int = 1, page_size: int = 20) -> dict:
    """分頁包裝"""
    total = len(items)
    start = (page - 1) * page_size
    data = items[start:start + page_size]
    return {
        'data': data,
        'total': total,
        'page': page,
        'page_size': page_size,
        'has_more': start + len(data) < total,
    }


def main():
    snapshots, holdings = load_scraper_data()
    
    if not snapshots:
        print("❌ No scraper data found. Run whaletrace_scraper.py first.")
        sys.exit(1)
    
    os.makedirs(API_OUTPUT_DIR, exist_ok=True)
    
    # 1. Stock snapshots list → /api/v1/institutional
    inst_response = paginate(snapshots)
    with open(os.path.join(API_OUTPUT_DIR, "institutional.json"), 'w') as f:
        json.dump(inst_response, f, ensure_ascii=False, indent=2)
    print(f"✅ institutional.json — {len(snapshots)} stocks")
    
    # 2. Individual stock details → /api/v1/stocks/:ticker
    os.makedirs(os.path.join(API_OUTPUT_DIR, "stocks"), exist_ok=True)
    for snap in snapshots:
        ticker = snap['ticker']
        detail = generate_stock_detail(ticker, snapshots, holdings)
        ticker_path = os.path.join(API_OUTPUT_DIR, "stocks", f"{ticker}.json")
        with open(ticker_path, 'w') as f:
            json.dump(detail, f, ensure_ascii=False, indent=2)
    print(f"✅ stocks/*.json — {len(snapshots)} individual stock files")
    
    # 3. Full institutional holdings → /api/v1/institutional-holdings
    holdings_response = paginate(holdings, page=1, page_size=50)
    with open(os.path.join(API_OUTPUT_DIR, "institutional-holdings.json"), 'w') as f:
        json.dump(holdings_response, f, ensure_ascii=False, indent=2)
    print(f"✅ institutional-holdings.json — {len(holdings)} holdings")
    
    # 4. Index file (listing all available endpoints)
    index = {
        'service': 'WhaleTrace API',
        'version': '0.1.0',
        'generated_at': datetime.now().isoformat(),
        'endpoints': {
            '/api/v1/institutional': 'Stock snapshots with positioning data (paginated)',
            '/api/v1/institutional-holdings': 'Institutional holdings detail (paginated)',
            '/api/v1/stocks/{ticker}': 'Stock detail including snapshot + top holders',
        },
        'tickers_available': [s['ticker'] for s in snapshots],
    }
    with open(os.path.join(API_OUTPUT_DIR, "index.json"), 'w') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"✅ index.json — {len(snapshots)} tickers indexed")
    
    print(f"\n📊 API files generated at: {API_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
