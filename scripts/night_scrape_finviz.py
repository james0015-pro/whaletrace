#!/usr/bin/env python3
"""
Night Shift: Scrape Finviz institutional holdings for all 20 WhaleTrace tickers.
Uses Scrapling Fetcher.get() with stealthy_headers=True.
Camofox unavailable — server lacks libgtk-3.so.0.
"""
import sys, json, re, time, os
from datetime import datetime, timezone

# Add user packages path
sys.path.insert(0, os.path.expanduser('~/.local/lib/python3.*/site-packages'))

try:
    from scrapling.fetchers import Fetcher
except ImportError:
    # Try alternative import path
    import importlib
    try:
        Fetcher = importlib.import_module('scrapling.fetchers').Fetcher
    except ImportError as e:
        print(json.dumps({"error": f"Scrapling import failed: {e}"}))
        sys.exit(1)

TICKERS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META",
    "TSLA", "BRK.B", "JPM", "V", "UNH", "XOM",
    "WMT", "JNJ", "MA", "PG", "HD", "BAC", "DIS", "CRM"
]

def extract_val(label, text, default=None):
    """Extract numeric value from Finviz snapshot table using proven regex."""
    # Pattern from scrapling-web-scraper skill
    pat = rf'{re.escape(label)}</(?:div|a)></td>\s*<td[^>]*>\s*<div[^>]*>\s*(?:<a[^>]*>)?\s*(?:<b>)?\s*(?:<span[^>]*>)?\s*([\d.,]+[%BMK]?)'
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        val = m.group(1).replace(',', '')
        if val in ('-', 'N/A', ''):
            return default if default is not None else 0.0
        if val.endswith('%'):
            return float(val[:-1])
        if val.endswith('B'):
            return float(val[:-1]) * 1e9
        if val.endswith('M'):
            return float(val[:-1]) * 1e6
        if val.endswith('K'):
            return float(val[:-1]) * 1e3
        try:
            return float(val)
        except ValueError:
            pass
    return default if default is not None else 0.0

def extract_str(label, text, default=""):
    """Extract string value."""
    pat = rf'{re.escape(label)}</(?:div|a)></td>\s*<td[^>]*>\s*<div[^>]*>\s*(?:<a[^>]*>)?\s*(?:<b>)?\s*(?:<span[^>]*>)?\s*([^<]+)'
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return default

results = {}
successful = 0
failed = 0
errors = {}

for i, ticker in enumerate(TICKERS):
    url = f"https://finviz.com/quote.ashx?t={ticker}"
    try:
        print(f"[{i+1}/{len(TICKERS)}] Fetching {ticker}...", file=sys.stderr)
        page = Fetcher.get(url, stealthy_headers=True)
        text = str(page.css('body').get())
        
        if len(text) < 2000:
            print(f"  WARNING: Short response ({len(text)} chars) for {ticker}", file=sys.stderr)
            failed += 1
            errors[ticker] = f"Short response: {len(text)} chars"
            continue
        
        # Check for Cloudflare block
        if 'cf-browser-verification' in text.lower():
            print(f"  BLOCKED: Cloudflare challenge for {ticker}", file=sys.stderr)
            failed += 1
            errors[ticker] = "Cloudflare challenge"
            continue
        
        data = {
            "ticker": ticker,
            "inst_own_pct": extract_val("Inst Own", text),
            "insider_own_pct": extract_val("Insider Own", text),
            "insider_trans_pct": extract_val("Insider Trans", text),
            "short_float_pct": extract_val("Short Float", text),
            "short_ratio": extract_val("Short Ratio", text),
            "market_cap": extract_val("Market Cap", text),
            "shares_outstanding": extract_val("Shs Outstand", text),
            "shares_float": extract_val("Shs Float", text),
        }
        
        results[ticker] = data
        successful += 1
        print(f"  OK: Inst={data['inst_own_pct']}%, MktCap={data['market_cap']:.0f}", file=sys.stderr)
        
        # Rate limit: 0.5s between requests
        time.sleep(0.5)
        
    except Exception as e:
        print(f"  ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        failed += 1
        errors[ticker] = str(e)

output = {
    "source": "Finviz",
    "scraped_at": datetime.now(timezone.utc).isoformat(),
    "method": "Scrapling Fetcher.get(stealthy_headers=True)",
    "camofox_note": "Unavailable: libgtk-3.so.0 missing on server",
    "tickers_scraped": len(TICKERS),
    "tickers_successful": successful,
    "tickers_failed": failed,
    "errors": errors if errors else None,
    "data": results
}

# Print JSON to stdout
print(json.dumps(output, indent=2, default=str))
