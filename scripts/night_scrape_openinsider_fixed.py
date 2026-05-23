#!/usr/bin/env python3
"""Fixed OpenInsider scraper — correct field mapping for search pages (no ticker column)."""
import sys, json, re, time
from datetime import datetime, timezone
from collections import Counter

sys.path.insert(0, '/opt/data/home/whaletrace/venv/lib/python3.13/site-packages')
from scrapling.fetchers import Fetcher

TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK.B","JPM","V","UNH","XOM","WMT","JNJ","MA","PG","HD","BAC","DIS","CRM"]

def parse_search_page(text, search_ticker):
    """
    Parse OpenInsider search page (/search?q=TICKER).
    These pages have NO ticker column — fields shift left by 1 vs screener.
    Columns: X, Filing Date, Trade Date, Company, Insider Name, Title, Trade Type, Price, Qty, Owned, ΔOwn, Value
    """
    tbodies = re.findall(r'<tbody[^>]*>(.*?)</tbody>', text, re.DOTALL | re.IGNORECASE)
    trades = []
    for tbody in tbodies:
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody, re.DOTALL | re.IGNORECASE)
        for row in rows:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
            if len(tds) < 12:
                continue
            
            clean = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', td).strip()) for td in tds]
            
            # Search page columns (ticker is search query):
            # 1: filing_date, 2: trade_date, 3: company, 4: insider_name
            # 5: title, 6: trade_type, 7: price, 8: qty
            # 9: owned, 10: delta_own, 11: value
            filing_date = clean[1]
            trade_date = clean[2]
            company = clean[3]
            insider_name = clean[4]
            title = clean[5]
            trade_type = clean[6]
            
            def parse_num(s):
                s = s.replace(',','').replace('$','').replace('+','').strip()
                if s in ('','-','N/A'): return 0.0
                try: return float(s)
                except: return 0.0
            
            price = parse_num(clean[7])
            qty = parse_num(clean[8])
            owned = parse_num(clean[9])
            delta_raw = clean[10].replace('%','').replace('>','').replace('New','100').strip()
            delta_own = parse_num(delta_raw)
            value = parse_num(clean[11])
            
            if not insider_name or insider_name in ('Insider Name', 'Insider'):
                continue
            
            trade = {
                "ticker": search_ticker,
                "company": company,
                "insider_name": insider_name,
                "title": title,
                "trade_type": trade_type,
                "price": price,
                "qty": qty,
                "owned": owned,
                "delta_own": delta_own,
                "value": value,
                "filing_date": filing_date,
                "trade_date": trade_date,
                "_source": "openinsider"
            }
            trades.append(trade)
    
    return trades

all_trades = []
errors = []

for i, ticker in enumerate(TICKERS):
    try:
        url = f"http://openinsider.com/search?q={ticker}"
        page = Fetcher.get(url, stealthy_headers=True)
        text = str(page.css('body').get())
        trades = parse_search_page(text, ticker)
        
        # Filter to this ticker's company (some results may be for other tickers)
        ticker_trades = [t for t in trades if ticker.upper() in t['company'].upper() 
                         or t['company'].upper().startswith(ticker.upper()[:4])]
        if not ticker_trades:
            ticker_trades = trades[:30]  # fallback: take first 30
        
        print(f"[{i+1}/20] {ticker}: {len(ticker_trades)} trades", file=sys.stderr)
        if ticker_trades:
            t = ticker_trades[0]
            print(f"  {t['insider_name']} ({t['title']}): {t['trade_type']} {t['qty']} @ ${t['price']}", file=sys.stderr)
        
        all_trades.extend(ticker_trades)
        time.sleep(0.8)
        
    except Exception as e:
        print(f"[{i+1}/20] {ticker}: ERROR {e}", file=sys.stderr)
        errors.append({"ticker": ticker, "error": str(e)})

# Deduplicate
seen = set()
unique = []
for t in all_trades:
    key = (t['ticker'], t['insider_name'], t['trade_date'], abs(t['qty']), t['price'])
    if key not in seen:
        seen.add(key)
        unique.append(t)

ticker_cnt = Counter(t['ticker'] for t in unique)
print(f"\nTotal: {len(all_trades)} raw, {len(unique)} unique", file=sys.stderr)
print(f"Tickers: {dict(ticker_cnt)}", file=sys.stderr)

output = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "source": "openinsider.com",
    "method": "Scrapling Fetcher.get — per-ticker search pages, corrected field mapping",
    "camofox_note": "Unavailable: libgtk-3.so.0 missing. Scrapling works for OpenInsider.",
    "tickers_scraped": len(TICKERS),
    "count": len(unique),
    "errors": errors if errors else None,
    "trades": unique
}

print(json.dumps(output, indent=2, default=str))
