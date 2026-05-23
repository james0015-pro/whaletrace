#!/usr/bin/env python3
"""
Night Shift: Scrape OpenInsider for our 20 tickers via individual search pages.
The screener pages are dominated by small caps; individual ticker searches are more targeted.
"""
import sys, json, re, time
from datetime import datetime, timezone

sys.path.insert(0, '/opt/data/home/whaletrace/venv/lib/python3.13/site-packages')
from scrapling.fetchers import Fetcher

OUR_TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK.B","JPM","V","UNH","XOM","WMT","JNJ","MA","PG","HD","BAC","DIS","CRM"]

def parse_rows(text):
    """Extract trades from OpenInsider search page."""
    tbodies = re.findall(r'<tbody[^>]*>(.*?)</tbody>', text, re.DOTALL | re.IGNORECASE)
    trades = []
    for tbody in tbodies:
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody, re.DOTALL | re.IGNORECASE)
        for row in rows:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
            if len(tds) < 13:
                continue
            
            clean = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', td).strip()) for td in tds]
            
            ticker = clean[3] if len(clean) > 3 else ""
            if not ticker or ticker in ('Ticker', 'X'):
                continue
            
            def parse_num(s):
                s = s.replace(',','').replace('$','').replace('+','').strip()
                if s in ('','-','N/A'): return 0.0
                try: return float(s)
                except: return 0.0
            
            trade = {
                "ticker": ticker,
                "company": clean[4] if len(clean) > 4 else "",
                "insider_name": clean[5] if len(clean) > 5 else "",
                "title": clean[6] if len(clean) > 6 else "",
                "trade_type": clean[7] if len(clean) > 7 else "",
                "price": parse_num(clean[8]) if len(clean) > 8 else 0.0,
                "qty": parse_num(clean[9]) if len(clean) > 9 else 0.0,
                "owned": parse_num(clean[10]) if len(clean) > 10 else 0.0,
                "delta_own": parse_num(clean[11].replace('%','').replace('>','').replace('New','100')) if len(clean) > 11 else 0.0,
                "value": parse_num(clean[12]) if len(clean) > 12 else 0.0,
                "filing_date": clean[1] if len(clean) > 1 else "",
                "trade_date": clean[2] if len(clean) > 2 else "",
                "_source": "openinsider"
            }
            
            if trade['insider_name'] and trade['insider_name'] not in ('Insider Name', 'Insider'):
                trades.append(trade)
    
    return trades

all_trades = []
errors = []

for i, ticker in enumerate(OUR_TICKERS):
    try:
        # Use ticker search (not screener) for targeted results
        url = f"http://openinsider.com/search?q={ticker}"
        page = Fetcher.get(url, stealthy_headers=True)
        text = str(page.css('body').get())
        trades = parse_rows(text)
        
        # Filter to exact ticker match
        ticker_trades = [t for t in trades if t['ticker'].upper() == ticker.upper()]
        
        print(f"[{i+1}/20] {ticker}: {len(ticker_trades)} trades", file=sys.stderr)
        all_trades.extend(ticker_trades)
        
        if ticker_trades:
            for t in ticker_trades[:2]:
                print(f"  {t['insider_name']}: {t['trade_type']} {t['qty']} @ ${t['price']}", file=sys.stderr)
        
        time.sleep(0.8)
        
    except Exception as e:
        print(f"[{i+1}/20] {ticker}: ERROR {type(e).__name__}: {e}", file=sys.stderr)
        errors.append({"ticker": ticker, "error": str(e)})

# Deduplicate
seen = set()
unique = []
for t in all_trades:
    key = (t['ticker'], t['insider_name'], t['trade_date'], t['qty'], t['price'])
    if key not in seen:
        seen.add(key)
        unique.append(t)

print(f"\nTotal: {len(all_trades)} raw, {len(unique)} unique", file=sys.stderr)

# Count by ticker
from collections import Counter
ticker_cnt = Counter(t['ticker'] for t in unique)
print(f"Ticker breakdown: {dict(ticker_cnt)}", file=sys.stderr)

output = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "source": "openinsider.com",
    "method": "Scrapling Fetcher.get(stealthy_headers=True) — per-ticker search pages",
    "camofox_note": "Unavailable: libgtk-3.so.0 missing on server",
    "tickers_scraped": len(OUR_TICKERS),
    "count": len(unique),
    "errors": errors if errors else None,
    "trades": unique
}

print(json.dumps(output, indent=2, default=str))
