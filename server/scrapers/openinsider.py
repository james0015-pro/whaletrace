#!/usr/bin/env python3
"""
OpenInsider scraper for insider trading data.
Site: http://openinsider.com
No API key required. Parses the HTML screener table.
"""
import re
import json
import urllib.request
import urllib.error
from html.parser import HTMLParser
from datetime import datetime
from typing import Optional

OPENINSIDER_URL = "http://openinsider.com/screener"
TIMEOUT = 15

# Mock data for fallback
MOCK_INSIDER_TRADES = [
    {"ticker":"AAPL","insider_name":"Williams Jeffrey E","title":"COO","trade_type":"S-Sale","price":187.32,"qty":50000,"owned":389412,"delta_own":-11,"value":9366000.0,"filing_date":"2026-05-15","trade_date":"2026-05-14"},
    {"ticker":"NVDA","insider_name":"Stevens Mark A","title":"Director","trade_type":"S-Sale","price":1420.50,"qty":8000,"owned":5230000,"delta_own":-0.2,"value":11364000.0,"filing_date":"2026-05-12","trade_date":"2026-05-11"},
    {"ticker":"MSFT","insider_name":"Nadella Satya","title":"CEO","trade_type":"S-Sale","price":465.78,"qty":30000,"owned":867000,"delta_own":-3,"value":13973400.0,"filing_date":"2026-05-10","trade_date":"2026-05-09"},
    {"ticker":"META","insider_name":"Zuckerberg Mark","title":"CEO","trade_type":"S-Sale","price":628.15,"qty":45000,"owned":345600000,"delta_own":-0.01,"value":28266750.0,"filing_date":"2026-05-08","trade_date":"2026-05-07"},
    {"ticker":"AMZN","insider_name":"Jassy Andrew","title":"CEO","trade_type":"S-Sale","price":218.90,"qty":20000,"owned":1200000,"delta_own":-1.6,"value":4378000.0,"filing_date":"2026-05-05","trade_date":"2026-05-04"},
    {"ticker":"GOOGL","insider_name":"Pichai Sundar","title":"CEO","trade_type":"S-Sale","price":195.44,"qty":25000,"owned":2100000,"delta_own":-1.2,"value":4886000.0,"filing_date":"2026-05-03","trade_date":"2026-05-02"},
    {"ticker":"TSLA","insider_name":"Taneja Vaibhav","title":"CFO","trade_type":"S-Sale","price":342.67,"qty":12000,"owned":85000,"delta_own":-12,"value":4112040.0,"filing_date":"2026-05-01","trade_date":"2026-04-30"},
    {"ticker":"JPM","insider_name":"Dimon Jamie","title":"CEO","trade_type":"P-Purchase","price":245.30,"qty":150000,"owned":8600000,"delta_own":1.8,"value":36795000.0,"filing_date":"2026-04-28","trade_date":"2026-04-27"},
    {"ticker":"V","insider_name":"McInerney Ryan","title":"CEO","trade_type":"S-Sale","price":345.12,"qty":10000,"owned":250000,"delta_own":-3.8,"value":3451200.0,"filing_date":"2026-04-25","trade_date":"2026-04-24"},
    {"ticker":"BAC","insider_name":"Moynihan Brian","title":"CEO","trade_type":"P-Purchase","price":47.89,"qty":50000,"owned":3200000,"delta_own":1.6,"value":2394500.0,"filing_date":"2026-04-22","trade_date":"2026-04-21"},
]


class InsiderTableParser(HTMLParser):
    """Parse OpenInsider HTML table rows."""
    
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_cell = ""
        self.current_row = []
        self.rows = []
        self._cell_count = 0
    
    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.in_table = True
        elif tag == "tr" and self.in_table:
            self.in_row = True
            self.current_row = []
            self._cell_count = 0
        elif tag == "td" and self.in_row:
            self.in_cell = True
            self.current_cell = ""
    
    def handle_endtag(self, tag):
        if tag == "table":
            self.in_table = False
        elif tag == "tr" and self.in_row:
            self.in_row = False
            if len(self.current_row) >= 10:
                self.rows.append(self.current_row)
        elif tag == "td" and self.in_cell:
            self.in_cell = False
            self.current_row.append(self.current_cell.strip())
            self._cell_count += 1
    
    def handle_data(self, data):
        if self.in_cell:
            self.current_cell += data


def _parse_openinsider_row(row: list[str]) -> Optional[dict]:
    """Parse a single OpenInsider table row into structured data."""
    if len(row) < 12:
        return None
    
    try:
        # Row format: [filing_date, trade_date, ticker, company, insider_name, title,
        #              trade_type, price, qty, owned, delta_own, value, ...]
        filing_date = row[0].strip()
        trade_date = row[1].strip() if len(row) > 1 else filing_date
        ticker = row[2].strip().upper()
        insider_name = row[4].strip()
        title = row[5].strip()
        trade_type = row[6].strip()  # P-Purchase, S-Sale, A-Award
        price = float(row[7].replace("$","").replace(",","") or 0)
        qty = int(row[8].replace(",","") or 0)
        owned = int(row[9].replace(",","") or 0)
        delta_own = float(row[10].replace("%","").replace(",","") or 0)
        value = float(row[11].replace("$","").replace(",","") or 0)
        
        return {
            "ticker": ticker,
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
        }
    except (ValueError, IndexError):
        return None


def fetch_insider_trades(ticker: Optional[str] = None, limit: int = 50) -> list[dict]:
    """
    Fetch insider trades from OpenInsider.
    
    Args:
        ticker: Stock ticker filter (None = all)
        limit: Maximum number of results
    
    Returns:
        List of insider trade dicts
    """
    try:
        # Build URL
        params = {
            "s": ticker or "",
            "o": "", "pl": "", "ph": "", "ll": "", "lh": "",
            "fd": "730",  # Last 2 years
            "fdr": "", "td": "0", "tdr": "",
            "fdlyl": "", "fdlyh": "", "daysago": "",
            "xp": "1", "xs": "1",
            "vl": "", "vh": "", "ocl": "", "och": "",
            "sic1": "-1", "sicl": "100", "sich": "9999",
            "grp": "0", "nfl": "", "nfh": "", "nil": "", "nih": "",
            "nol": "", "noh": "", "v2l": "", "v2h": "",
            "oc2l": "", "oc2h": "",
            "sortcol": "0", "cnt": str(min(limit, 100)), "page": "1",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{OPENINSIDER_URL}?{query}"
        
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        
        parser = InsiderTableParser()
        parser.feed(html)
        
        results = []
        for row in parser.rows:
            parsed = _parse_openinsider_row(row)
            if parsed:
                results.append(parsed)
                if len(results) >= limit:
                    break
        
        if results:
            return results
    except Exception as e:
        print(f"[openinsider] Scrape failed: {e}")
    
    # Fallback to mock
    print("[openinsider] Using mock data")
    trades = MOCK_INSIDER_TRADES
    if ticker:
        trades = [t for t in trades if t["ticker"].upper() == ticker.upper()]
    return trades[:limit]


if __name__ == "__main__":
    print("=== OpenInsider Scraper Test ===\n")
    data = fetch_insider_trades(limit=5)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\nTotal: {len(data)} trades")
