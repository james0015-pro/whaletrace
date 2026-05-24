#!/usr/bin/env python3
"""OpenInsider per-ticker scraper — fix for global screener having 0 tracked tickers."""
from scrapling.fetchers import Fetcher
import json, re, time, os
from datetime import datetime, timezone

TRACKED_TICKERS = [
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META',
    'TSLA','BRK.B','JPM','V','UNH','XOM','WMT',
    'JNJ','MA','PG','HD','BAC','DIS','CRM',
]
OUTPUT_DIR = "/opt/data/home/whaletrace/data"

def scrape_openinsider_ticker(ticker):
    """Scrape OpenInsider search page for a single ticker.
    
    Per-ticker search pages have DIFFERENT column layout than screener:
      cell[0]=filing_date, cell[1]=trade_date, cell[2]=company,
      cell[3]=insider_name, cell[4]=title, cell[5]=trade_type,
      cell[6]=price, cell[7]=qty
    """
    url = f"http://openinsider.com/search?q={ticker}"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20)
        text = str(page.css('body').get())
        if not text or len(text) < 2000:
            return []

        # Find data tbody
        tbody_matches = re.findall(r'<tbody>(.*?)</tbody>', text, re.DOTALL)
        data_html = ""
        for tb in tbody_matches:
            if tb.strip() and len(tb.strip()) > 100:
                data_html = tb
                break

        if not data_html:
            return []

        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', data_html, re.DOTALL)
        trades = []

        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if len(clean) < 8:
                continue

            # Per-ticker search layout (no ticker column, no filing label)
            # cell[0]=filing_date, cell[1]=trade_date, cell[2]=company, cell[3]=insider_name
            # cell[4]=title, cell[5]=trade_type, cell[6]=price, cell[7]=qty
            try:
                trade_type_str = clean[5] if len(clean) > 5 else ''
                is_sale = '-S' in trade_type_str or 'Sale' in trade_type_str or 'S -' in trade_type_str

                qty_raw = clean[7] if len(clean) > 7 else '0'
                qty = int(qty_raw.replace(',', '')) if qty_raw.replace(',', '').replace('-', '').isdigit() else 0

                price_raw = clean[6] if len(clean) > 6 else '0'
                try:
                    price = float(price_raw.replace(',', '').replace('$', ''))
                except (ValueError, AttributeError):
                    price = 0.0

                value = abs(qty) * price if price and qty else 0.0

                trades.append({
                    'ticker': ticker,
                    'filing_date': clean[0] if len(clean) > 0 else '',
                    'trade_date': clean[1] if len(clean) > 1 else '',
                    'company': clean[2] if len(clean) > 2 else '',
                    'insider_name': clean[3] if len(clean) > 3 else '',
                    'title': clean[4] if len(clean) > 4 else '',
                    'trade_type': trade_type_str,
                    'is_sale': is_sale,
                    'price': price,
                    'qty': qty if not is_sale else -qty,
                    'owned': 0,
                    'value': value,
                    '_source': 'openinsider',
                })
            except (ValueError, IndexError):
                continue

        return trades
    except Exception as e:
        print(f"  ⚠️ {ticker}: {e}")
        return []


def main():
    print("=== OpenInsider Per-Ticker Scraper ===")
    all_trades = []
    
    for i, ticker in enumerate(TRACKED_TICKERS):
        trades = scrape_openinsider_ticker(ticker)
        all_trades.extend(trades)
        print(f"  [{i+1}/{len(TRACKED_TICKERS)}] {ticker}: {len(trades)} trades")
        time.sleep(0.5)
    
    # Save
    output = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': 'openinsider.com (per-ticker search)',
        'count': len(all_trades),
        'trades': all_trades,
    }
    
    fpath = os.path.join(OUTPUT_DIR, 'openinsider_trades.json')
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal: {len(all_trades)} trades saved to {fpath}")

if __name__ == '__main__':
    main()
