#!/usr/bin/env python3
"""
WhaleTrace 完整籌碼爬蟲 v3
==========================
爬取 7 個資料源，輸出 WhaleTrace 相容 JSON：
  Finviz (籌碼快照) + yfinance (基本面/機構) + Nasdaq (機構明細)
  + MarketBeat (內部人/評級) + SEC EDGAR (Form 4) + Fintel (放空)

用法:
  python whaletrace_scraper.py                          # 全部 21 檔
  python whaletrace_scraper.py --tickers AAPL,NVDA,MSFT # 指定
  python whaletrace_scraper.py --quick                   # 僅 Finviz+yfinance (快速模式)
"""

from scrapling.fetchers import Fetcher
import yfinance as yf
import json, re, time, sys, os, argparse
from datetime import datetime, date
from typing import Optional
from dataclasses import dataclass, field, asdict

# ─── 設定 ───
TRACKED_TICKERS = [
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META',
    'TSLA','JPM','V','WMT','JNJ','PG','MA','UNH',
    'HD','BAC','DIS','ADBE','NFLX','CRM',
]
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

SUPABASE_URL = "https://vihxecnwonwmqclaxubn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaHhlY253b253bXFjbGF4dWJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4NTY4OCwiZXhwIjoyMDk1MTYxNjg4fQ.-Tsme1Yakhfrj_nms3fG3TPvoblYS4WBSzO-Ejw5fK0"

SUPER_INVESTORS = {
    'berkshire hathaway','baillie gifford','renaissance technologies',
    'vanguard group','blackrock','state street','t. rowe price',
    'tiger global','coatue','ark invest','pershing square',
    'point72','citadel','de shaw','two sigma','bridgewater',
    'soros','third point','lone pine','viking global',
}

# ═══════════════════════════════════════════
# 1. Finviz — 籌碼快照 (v2 fix)
# ═══════════════════════════════════════════

def scrape_finviz(ticker: str) -> Optional[dict]:
    """Finviz: 機構持股%、內部人%、放空%、估值、技術面"""
    url = f"https://finviz.com/quote.ashx?t={ticker}"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=15)
        text = str(page.css('body').get())
        if not text or len(text) < 1000:
            return None

        def extract_val(label: str, default=0.0):
            """Extract numeric value from Finviz snapshot table.
            Handles: <b>VALUE</b>, <b><span>VALUE</span></b>, <a><b>VALUE</b></a>"""
            # Match from label to the next numeric value in the adjacent td
            pat = rf'{re.escape(label)}</(?:div|a)></td>\s*<td[^>]*>\s*<div[^>]*>\s*(?:<a[^>]*>)?\s*(?:<b>)?\s*(?:<span[^>]*>)?\s*([\d.,]+[%BMK]?)'
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).replace(',', '')
                if val.endswith('%'): return float(val[:-1])
                if val.endswith('B'): return float(val[:-1]) * 1e9
                if val.endswith('M'): return float(val[:-1]) * 1e6
                if val.endswith('K'): return float(val[:-1]) * 1e3
                try: return float(val)
                except: pass
            return default

        def extract_str(label: str, default=""):
            """Extract string after label"""
            m = re.search(rf'{re.escape(label)}\s+([A-Za-z][\w\s]+?)(?:\s*<|$)', text)
            return m.group(1).strip() if m else default

        name_m = re.search(r'<title>([^(]+)', text)
        name = name_m.group(1).strip() if name_m else ticker
        return {
            'ticker': ticker, 'company_name': name,
            'market_cap': extract_val('Market Cap'),
            'price': extract_val('Price'),
            'pe_trailing': extract_val('P/E'),
            'pe_forward': extract_val('Forward P/E'),
            'peg': extract_val('PEG'),
            'inst_own_pct': extract_val('Inst Own'),
            'insider_own_pct': extract_val('Insider Own'),
            'insider_trans_pct': extract_val('Insider Trans'),
            'short_float_pct': extract_val('Short Float'),
            'short_ratio': extract_val('Short Ratio'),
            'roe': extract_val('ROE'),
            'beta': extract_val('Beta'),
            'rsi14': extract_val('RSI (14)'),
            'debt_equity': extract_val('Debt/Eq'),
            'profit_margin': extract_val('Profit Margin'),
            'data_date': date.today().isoformat(),
        }
    except Exception as e:
        print(f"  ⚠️ Finviz {ticker}: {e}")
        return None

# ═══════════════════════════════════════════
# 2. yfinance — 基本面擴充 + 機構持股
# ═══════════════════════════════════════════

def scrape_yfinance(ticker: str) -> tuple[Optional[dict], list[dict]]:
    """yfinance: 營收成長、分析師目標、技術指標、機構持股清單"""
    try:
        tk = yf.Ticker(ticker)
        info = tk.info
        hist = tk.history(period="1y")
        if hist.empty or not info:
            return None, []

        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = float(100 - (100 / (1 + rs.iloc[-1]))) if loss.iloc[-1] != 0 else 50
        sma50 = float(hist['Close'].rolling(50).mean().iloc[-1])
        sma200 = float(hist['Close'].rolling(200).mean().iloc[-1]) if len(hist) >= 200 else sma50

        fundamentals = {
            'revenue_growth': (info.get('revenueGrowth') or 0) * 100,
            'analyst_target': info.get('targetMeanPrice') or 0,
            'recommendation': info.get('recommendationKey') or '',
            'sma50': sma50, 'sma200': sma200, 'rsi14': rsi,
        }

        holders = []
        try:
            inst_df = tk.institutional_holders
            if inst_df is not None and not inst_df.empty:
                for _, row in inst_df.head(30).iterrows():
                    name = str(row.get('Holder', ''))
                    holders.append({
                        'ticker': ticker,
                        'institution_name': name,
                        'quarter': date.today().strftime('%YQ') + str((date.today().month-1)//3 + 1),
                        'shares': int(row.get('Shares', 0)),
                        'market_value': float(row.get('Value', 0)),
                        'change_direction': 'UNKNOWN',
                        'change_shares': 0,
                        'pct_of_portfolio': float(row.get('pctOfPortfolio', 0)) if 'pctOfPortfolio' in row else 0,
                        'is_super_investor': any(si in name.lower() for si in SUPER_INVESTORS),
                    })
        except Exception:
            pass

        return fundamentals, holders
    except Exception as e:
        print(f"  ⚠️ yfinance {ticker}: {e}")
        return None, []

# ═══════════════════════════════════════════
# 3. Nasdaq.com — 機構持股明細
# ═══════════════════════════════════════════

def scrape_nasdaq_institutional(ticker: str) -> list[dict]:
    """Nasdaq.com institutional holdings page"""
    url = f"https://www.nasdaq.com/market-activity/stocks/{ticker.lower()}/institutional-holdings"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20)
        text = page.css('body').get()
        if not text or len(text) < 500:
            return []

        holders = []
        # Nasdaq renders data in a table; extract institution rows
        rows = re.findall(r'<tr[^>]*data-row[^>]*>(.*?)</tr>', text, re.DOTALL)
        if not rows:
            # Fallback: look for any table with holder data
            rows = re.findall(r'institutional-holdings__row[^>]*>(.*?)</tr>', text, re.DOTALL)
        
        for row in rows[:30]:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if len(clean) >= 3 and clean[0]:
                try:
                    shares_str = clean[1].replace(',', '') if len(clean) > 1 else '0'
                    value_str = clean[2].replace('$', '').replace(',', '') if len(clean) > 2 else '0'
                    holders.append({
                        'ticker': ticker,
                        'institution_name': clean[0],
                        'quarter': date.today().strftime('%YQ') + str((date.today().month-1)//3 + 1),
                        'shares': int(float(shares_str)) if shares_str.replace('.','').isdigit() else 0,
                        'market_value': float(value_str) if value_str.replace('.','').isdigit() else 0,
                        'change_direction': 'UNKNOWN',
                        'change_shares': 0,
                        'pct_of_portfolio': 0,
                        'is_super_investor': any(si in clean[0].lower() for si in SUPER_INVESTORS),
                    })
                except (ValueError, IndexError):
                    continue
        return holders
    except Exception as e:
        print(f"  ⚠️ Nasdaq {ticker}: {e}")
        return []

# ═══════════════════════════════════════════
# 4. MarketBeat — 內部人交易 + 分析師評級
# ═══════════════════════════════════════════

def scrape_marketbeat(ticker: str) -> list[dict]:
    """MarketBeat insider trades for a ticker"""
    url = f"https://www.marketbeat.com/stocks/NASDAQ/{ticker}/insider-trades/"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20)
        text = page.css('body').get()
        if not text or len(text) < 500:
            return []

        trades = []
        # MarketBeat insider trade rows
        trade_blocks = re.findall(r'<tr[^>]*>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>', text)
        
        for t in trade_blocks[:20]:
            try:
                trade_date, insider, title, trade_type, shares_str = t[0], t[1], t[2], t[3], t[4]
                is_buy = 'buy' in trade_type.lower() or 'purchase' in trade_type.lower()
                trades.append({
                    'ticker': ticker,
                    'insider_name': insider.strip(),
                    'title': title.strip(),
                    'transaction_type': 'BUY' if is_buy else 'SELL',
                    'shares': int(re.sub(r'[^0-9]', '', shares_str) or '0'),
                    'trade_date': trade_date.strip(),
                    'filing_date': trade_date.strip(),
                    'source': 'MarketBeat',
                })
            except (ValueError, IndexError):
                continue
        return trades
    except Exception as e:
        print(f"  ⚠️ MarketBeat {ticker}: {e}")
        return []

# ═══════════════════════════════════════════
# 5. SEC EDGAR — Form 4 內部人交易 (原始)
# ═══════════════════════════════════════════

def scrape_sec_edgar(ticker: str) -> list[dict]:
    """SEC EDGAR latest Form 4 filings via RSS feed"""
    cik_map = {'AAPL':'320193','MSFT':'789019','NVDA':'1045810','GOOGL':'1652044',
               'AMZN':'1018724','META':'1326801','TSLA':'1318605','JPM':'19617',
               'V':'1403161','WMT':'104169','JNJ':'200406','PG':'80424','MA':'1141391',
               'UNH':'731766','HD':'354950','BAC':'70858','DIS':'1744489','ADBE':'796343',
               'NFLX':'1065280','CRM':'1108524'}
    cik = cik_map.get(ticker, '')
    if not cik:
        return []
    
    url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK={cik}&type=4&count=10"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20, 
                          headers={'User-Agent': 'WhaleTrace/1.0 (whaletrace@example.com)'})
        text = page.css('body').get()
        if not text:
            return []

        filings = []
        # Parse SEC filing table
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.DOTALL)
        for row in rows:
            if 'Form 4' not in row:
                continue
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if len(clean) >= 4:
                filings.append({
                    'ticker': ticker,
                    'filing_type': 'Form 4',
                    'filing_date': clean[3] if len(clean) > 3 else '',
                    'description': clean[1] if len(clean) > 1 else '',
                    'filing_url': '',
                    'source': 'SEC EDGAR',
                })
        return filings
    except Exception as e:
        print(f"  ⚠️ SEC EDGAR {ticker}: {e}")
        return []

# ═══════════════════════════════════════════
# 6. Fintel — 放空利息 (Short Squeeze data)
# ═══════════════════════════════════════════

def scrape_fintel_short(ticker: str) -> Optional[dict]:
    """Fintel short interest data"""
    url = f"https://fintel.io/ss/us/{ticker.lower()}"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=20)
        text = page.css('body').get()
        if not text or len(text) < 500:
            return None

        def extract_num(label: str, default=0.0):
            m = re.search(rf'{re.escape(label)}[:\s]*([\d.,]+[%BMK]?)', text, re.IGNORECASE)
            if m:
                val = m.group(1).replace(',', '')
                if val.endswith('%'): return float(val[:-1])
                if val.endswith('M'): return float(val[:-1]) * 1e6
                try: return float(val)
                except: pass
            return default

        return {
            'ticker': ticker,
            'short_float_pct': extract_num('Short% of Float'),
            'short_ratio': extract_num('Days to Cover'),
            'short_interest': extract_num('Short Interest'),
            'source': 'Fintel',
            'data_date': date.today().isoformat(),
        }
    except Exception as e:
        print(f"  ⚠️ Fintel {ticker}: {e}")
        return None

# ═══════════════════════════════════════════
# 主管線
# ═══════════════════════════════════════════

@dataclass
class WhaleTraceData:
    generated_at: str = ""
    tickers_scraped: list = field(default_factory=list)
    stock_snapshots: list = field(default_factory=list)
    institutional_holdings: list = field(default_factory=list)
    insider_trades: list = field(default_factory=list)
    sec_filings: list = field(default_factory=list)
    fintel_shorts: list = field(default_factory=list)

def scrape_all(tickers: list[str] = TRACKED_TICKERS, quick: bool = False) -> WhaleTraceData:
    data = WhaleTraceData(
        generated_at=datetime.now().isoformat(),
        tickers_scraped=list(tickers),
    )

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] {ticker} " + "="*40)
        
        # Core: Finviz + yfinance (always run)
        snap = scrape_finviz(ticker)
        yf_fund, yf_holders = scrape_yfinance(ticker)
        
        if snap:
            if yf_fund:
                snap.update(yf_fund)
            data.stock_snapshots.append(snap)
        if yf_holders:
            data.institutional_holdings.extend(yf_holders)
        
        status = f"Finviz:{'OK' if snap else '✗'} yfinance:{len(yf_holders)}h"
        
        if not quick:
            # Extended scraping
            nasdaq_h = scrape_nasdaq_institutional(ticker)
            if nasdaq_h:
                data.institutional_holdings.extend(nasdaq_h)
                status += f" Nasdaq:+{len(nasdaq_h)}"
            
            mb_trades = scrape_marketbeat(ticker)
            if mb_trades:
                data.insider_trades.extend(mb_trades)
                status += f" MB:{len(mb_trades)}"
            
            sec_f = scrape_sec_edgar(ticker)
            if sec_f:
                data.sec_filings.extend(sec_f)
                status += f" SEC:{len(sec_f)}"
            
            fintel_s = scrape_fintel_short(ticker)
            if fintel_s:
                data.fintel_shorts.append(fintel_s)
                status += f" Fintel:OK"
        
        print(f"    {status}")
        time.sleep(1.5)

    return data

def save_output(data: WhaleTraceData, out_dir: str = OUTPUT_DIR):
    os.makedirs(out_dir, exist_ok=True)
    
    files = {
        'whaletrace_full.json': asdict(data),
        'stock_snapshots.json': data.stock_snapshots,
        'institutional_holdings.json': data.institutional_holdings,
        'insider_trades.json': data.insider_trades,
        'sec_filings.json': data.sec_filings,
        'fintel_shorts.json': data.fintel_shorts,
    }
    
    paths = {}
    for fname, content in files.items():
        fpath = os.path.join(out_dir, fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        paths[fname] = fpath
    
    print(f"\n📊 Output ({out_dir}):")
    for fname, fpath in paths.items():
        size_kb = os.path.getsize(fpath) / 1024
        print(f"   {fname} — {size_kb:.1f} KB")
    
    return paths


# ═══════════════════════════════════════════
# Supabase Sync — DELETE + INSERT
# ═══════════════════════════════════════════

def _supabase_request(method: str, path: str, body=None, timeout=30):
    """Make a Supabase REST API request (service_role)."""
    import urllib.request, urllib.error
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def sync_to_supabase(data: WhaleTraceData, tickers: list[str]) -> dict:
    """DELETE existing rows for tickers, then INSERT fresh data into Supabase."""
    ticker_list = ",".join(tickers)
    ticker_filter = f"?ticker=in.({ticker_list})"
    results = {}

    # ─── 1. stock_snapshots ───
    if data.stock_snapshots:
        rows = []
        for s in data.stock_snapshots:
            rows.append({
                "ticker": s.get("ticker", ""),
                "snapshot_date": s.get("data_date", date.today().isoformat()),
                "inst_ownership_pct": s.get("inst_own_pct"),
                "insider_ownership_pct": s.get("insider_own_pct"),
                "short_float_pct": s.get("short_float_pct"),
                "short_ratio": s.get("short_ratio"),
                "market_cap": s.get("market_cap"),
                "pe_ratio": s.get("pe_trailing"),
                "analyst_recommendation": s.get("recommendation", ""),
            })
        code, _ = _supabase_request("DELETE", f"/rest/v1/stock_snapshots{ticker_filter}")
        code2, _ = _supabase_request("POST", "/rest/v1/stock_snapshots", rows)
        results["stock_snapshots"] = f"deleted={code} inserted={code2} rows={len(rows)}"

    # ─── 2. insider_trades ───
    if data.insider_trades:
        rows = []
        for t in data.insider_trades:
            rows.append({
                "ticker": t.get("ticker", ""),
                "insider_name": t.get("insider_name", ""),
                "role": t.get("title", ""),
                "transaction_date": t.get("trade_date", ""),
                "filing_date": t.get("filing_date", ""),
                "security": "Common Stock",
                "transaction_type": t.get("transaction_type", ""),
                "shares": t.get("shares", 0),
                "price": 0,
                "value": 0,
                "shares_held": 0,
                "filing_url": t.get("filing_url", ""),
            })
        code, _ = _supabase_request("DELETE", f"/rest/v1/insider_trades{ticker_filter}")
        code2, _ = _supabase_request("POST", "/rest/v1/insider_trades", rows)
        results["insider_trades"] = f"deleted={code} inserted={code2} rows={len(rows)}"

    # ─── 3. institutional_holdings ───
    if data.institutional_holdings:
        rows = []
        for h in data.institutional_holdings:
            # Convert "2026Q2" → "2026-04-01"
            quarter = h.get("quarter", "")
            if quarter and "Q" in quarter:
                try:
                    yr, q = quarter.split("Q")
                    month = {"1": "01", "2": "04", "3": "07", "4": "10"}.get(q, "01")
                    filing_date = f"{yr}-{month}-01"
                except:
                    filing_date = ""
            else:
                filing_date = quarter
            rows.append({
                "ticker": h.get("ticker", ""),
                "institution_name": h.get("institution_name", ""),
                "shares": h.get("shares", 0),
                "market_value": h.get("market_value", 0),
                "change_shares": h.get("change_shares", 0),
                "change_pct": 0,
                "portfolio_pct": h.get("pct_of_portfolio", 0),
                "filing_date": filing_date,
                "source": "whaletrace-scraper",
            })
        code, _ = _supabase_request("DELETE", f"/rest/v1/institutional_holdings{ticker_filter}")
        code2, _ = _supabase_request("POST", "/rest/v1/institutional_holdings", rows)
        results["institutional_holdings"] = f"deleted={code} inserted={code2} rows={len(rows)}"

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WhaleTrace 完整籌碼爬蟲")
    parser.add_argument("--tickers", type=str, help="股票代碼，逗號分隔")
    parser.add_argument("--output", type=str, default=OUTPUT_DIR)
    parser.add_argument("--quick", action="store_true", help="快速模式（僅 Finviz+yfinance）")
    parser.add_argument("--sync-supabase", action="store_true", help="爬取後同步至 Supabase")
    args = parser.parse_args()

    tickers = [t.strip().upper() for t in args.tickers.split(",")] if args.tickers else TRACKED_TICKERS

    print(f"🕷️ WhaleTrace Scraper v4 — {len(tickers)} tickers")
    print(f"   {'快速模式: Finviz + yfinance' if args.quick else '完整模式: Finviz + yfinance + Nasdaq + MarketBeat + SEC + Fintel'}")
    print(f"   輸出: {args.output}")
    if args.sync_supabase:
        print(f"   Supabase: ✅ 啟用同步\n")
    else:
        print()

    data = scrape_all(tickers, quick=args.quick)
    save_output(data, args.output)

    print(f"\n✅ Done. {len(data.stock_snapshots)} snapshots, {len(data.institutional_holdings)} holdings, {len(data.insider_trades)} insider trades, {len(data.sec_filings)} SEC filings, {len(data.fintel_shorts)} short data")

    # ─── Supabase Sync ───
    if args.sync_supabase:
        print(f"\n🔄 Syncing to Supabase...")
        try:
            results = sync_to_supabase(data, tickers)
            for table, status in results.items():
                print(f"   {table}: {status}")
            print(f"✅ Supabase sync complete!")
        except Exception as e:
            print(f"❌ Supabase sync failed: {e}")
