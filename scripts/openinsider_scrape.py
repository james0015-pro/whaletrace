#!/usr/bin/env python3
"""OpenInsider per-ticker scraper — CORRECTED column mapping for search page."""
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

    Per-ticker SEARCH page has 16 columns (different from screener!):
      cell[0]=filing_label (D=derivative or empty)
      cell[1]=filing_date
      cell[2]=trade_date
      cell[3]=ticker
      cell[4]=insider_name
      cell[5]=title
      cell[6]=trade_type  ("S - Sale", "P - Purchase", "S - Sale+OE")
      cell[7]=price
      cell[8]=qty
      cell[9]=owned
      cell[10]=delta%
      cell[11]=value
      cells[12-15]=empty
    """
    url = f"http://openinsider.com/search?q={ticker}"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20)
        text = str(page.css('body').get())
        if not text or len(text) < 2000:
            return []

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

            # Search page: 16 cols
            # cell[6]=trade_type, cell[7]=price, cell[8]=qty, cell[9]=owned, cell[11]=value
            try:
                trade_type_str = clean[6] if len(clean) > 6 else ''

                # Skip non-trade rows (headers, empty types)
                if not trade_type_str or trade_type_str in ('Trade Type', 'Trade'):
                    continue

                # Detect buy vs sell from trade type
                # "S - Sale", "S - Sale+OE" → sale
                # "P - Purchase" → buy
                is_sale = 'S -' in trade_type_str or 'Sale' in trade_type_str
                is_buy = 'P -' in trade_type_str or 'Purchase' in trade_type_str

                # Price at cell[7]
                price_raw = clean[7] if len(clean) > 7 else '0'
                try:
                    price = float(price_raw.replace(',', '').replace('$', ''))
                except (ValueError, AttributeError):
                    price = 0.0

                # Qty at cell[8]
                qty_raw = clean[8] if len(clean) > 8 else '0'
                try:
                    qty = float(qty_raw.replace(',', '').replace('+', ''))
                except (ValueError, AttributeError):
                    qty = 0.0

                # Owned at cell[9]
                owned_raw = clean[9] if len(clean) > 9 else '0'
                try:
                    owned = float(owned_raw.replace(',', ''))
                except (ValueError, AttributeError):
                    owned = 0.0

                # Value at cell[11]
                value_raw = clean[11] if len(clean) > 11 else '0'
                try:
                    value = float(value_raw.replace(',', '').replace('$', ''))
                except (ValueError, AttributeError):
                    value = abs(qty) * price if price and qty else 0.0

                trades.append({
                    'ticker': ticker,
                    'filing_label': clean[0] if len(clean) > 0 else '',
                    'filing_date': clean[1] if len(clean) > 1 else '',
                    'trade_date': clean[2] if len(clean) > 2 else '',
                    'ticker_display': clean[3] if len(clean) > 3 else '',
                    'insider_name': clean[4] if len(clean) > 4 else '',
                    'title': clean[5] if len(clean) > 5 else '',
                    'trade_type': trade_type_str,
                    'is_sale': is_sale,
                    'is_buy': is_buy,
                    'price': price,
                    'qty': qty,
                    'qty_signed': -abs(qty) if is_sale else abs(qty),
                    'owned': owned,
                    'value': value,
                    '_source': 'openinsider',
                })
            except (ValueError, IndexError) as e:
                continue

        return trades
    except Exception as e:
        print(f"  ⚠️ {ticker}: {e}")
        return []


def main():
    print("=== OpenInsider Per-Ticker Scraper (CORRECTED) ===")
    all_trades = []

    for i, ticker in enumerate(TRACKED_TICKERS):
        trades = scrape_openinsider_ticker(ticker)
        all_trades.extend(trades)
        buys = sum(1 for t in trades if t['is_buy'])
        sells = sum(1 for t in trades if t['is_sale'])
        print(f"  [{i+1}/{len(TRACKED_TICKERS)}] {ticker}: {len(trades)} trades ({buys}B/{sells}S)")
        time.sleep(0.5)

    output = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': 'openinsider.com (per-ticker search)',
        'count': len(all_trades),
        'trades': all_trades,
    }

    fpath = os.path.join(OUTPUT_DIR, 'openinsider_trades.json')
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    buys = sum(1 for t in all_trades if t['is_buy'])
    sells = sum(1 for t in all_trades if t['is_sale'])
    total_buy_value = sum(t['value'] for t in all_trades if t['is_buy'] and t['value'] > 0)
    total_sell_value = sum(abs(t['value']) for t in all_trades if t['is_sale'] and t['value'] != 0)
    print(f"\nTotal: {len(all_trades)} trades ({buys}B/{sells}S)")
    print(f"  Buy value: ${total_buy_value:,.0f}")
    print(f"  Sell value: ${total_sell_value:,.0f}")
    print(f"  Saved to {fpath}")

if __name__ == '__main__':
    main()
