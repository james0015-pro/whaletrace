#!/usr/bin/env python3
"""
Night Shift Scraper — 內線專案研究爬蟲
========================================
爬取 Finviz 機構持股 + OpenInsider 內部人交易 + SEC EDGAR Form 4

來源：
  1. Finviz — 機構持股%、內部人%、放空% (Scrapling, stealthy_headers=True)
  2. OpenInsider — 跨公司內部人交易 (Scrapling, screener page tbody[1])
  3. SEC EDGAR — Form 4 內部人交易 XML (urllib, 3.0s delay)

Camofox 不可用（無 GTK3）→ 全部使用 Scrapling HTTP 模式。
"""

from scrapling.fetchers import Fetcher
from urllib.request import Request, urlopen
import json, re, time, os, sys
from datetime import datetime, date, timezone

# ─── 設定 ───
OUTPUT_DIR = "/opt/data/home/whaletrace/data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TRACKED_TICKERS = [
    'AAPL','MSFT','NVDA','GOOGL','AMZN','META',
    'TSLA','BRK.B','JPM','V','UNH','XOM','WMT',
    'JNJ','MA','PG','HD','BAC','DIS','CRM',
]

# CIK mapping (10-digit padded)
TICKER_CIK = {
    "AAPL": "0000320193", "MSFT": "0000789019", "NVDA": "0001045810",
    "GOOGL": "0001652044", "AMZN": "0001018724", "META": "0001326801",
    "TSLA": "0001318605", "BRK.B": "0001067983", "JPM": "0000019617",
    "V": "0001403161", "UNH": "0000731766", "XOM": "0000034088",
    "WMT": "0000104169", "JNJ": "0000200406", "MA": "0001141391",
    "PG": "0000080424", "HD": "0000354950", "BAC": "0000070858",
    "DIS": "0001744489", "CRM": "0001108524",
}

UA = 'WhaleTrace/1.0 (whaletrace@example.com)'


# ═══════════════════════════════════════════
# 1. Finviz — 機構持股快照
# ═══════════════════════════════════════════

def scrape_finviz_all(tickers):
    """Scrape Finviz snapshot table for all tickers."""
    results = {}
    success = 0
    fail = 0

    for i, ticker in enumerate(tickers):
        url_ticker = ticker.replace('.', '-')
        url = f"https://finviz.com/quote.ashx?t={url_ticker}"
        try:
            page = Fetcher.get(url, stealthy_headers=True, timeout=20)
            text = str(page.css('body').get())
            if not text or len(text) < 1000:
                print(f"  [{i+1}/{len(tickers)}] {ticker}: EMPTY")
                fail += 1
                continue

            def extract_val(label, default=0.0):
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

            results[ticker] = {
                'ticker': ticker,
                'inst_own_pct': extract_val('Inst Own'),
                'insider_own_pct': extract_val('Insider Own'),
                'insider_trans_pct': extract_val('Insider Trans'),
                'short_float_pct': extract_val('Short Float'),
                'short_ratio': extract_val('Short Ratio'),
                'market_cap': extract_val('Market Cap'),
                'pe_trailing': extract_val('P/E'),
                'pe_forward': extract_val('Forward P/E'),
                'shares_outstanding': extract_val('Shs Outstand'),
                'shares_float': extract_val('Shs Float'),
            }
            success += 1
            print(f"  [{i+1}/{len(tickers)}] {ticker}: OK (inst={results[ticker]['inst_own_pct']}%, short={results[ticker]['short_float_pct']}%)")

        except Exception as e:
            print(f"  [{i+1}/{len(tickers)}] {ticker}: FAIL ({e})")
            fail += 1

        time.sleep(0.5)  # Rate limit protection

    print(f"Finviz: {success}/{len(tickers)} success, {fail} failed")
    return results, success, fail


# ═══════════════════════════════════════════
# 2. OpenInsider — 跨公司內部人交易
# ═══════════════════════════════════════════

def scrape_openinsider():
    """Scrape OpenInsider screener page for recent insider trades across all tickers.

    OpenInsider screener page has the data in tbody[1] (second tbody).
    17 columns as of May 2026:
      cell[0]=filing_label, cell[1]=filing_date, cell[2]=trade_date,
      cell[3]=ticker, cell[4]=company, cell[5]=insider_name, cell[6]=title,
      cell[7]=trade_type, cell[8]=price, cell[9]=quantity, cell[10]=shares_owned,
      cell[11]=delta_ownership%, cell[12]=value, cells[13-16]=empty
    """
    url = "http://openinsider.com/screener?s=&o=&pl=&ph=&ll=&lh=&fd=730&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=200&page=1"
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=30)
        text = str(page.css('body').get())
        if not text or len(text) < 5000:
            print(f"OpenInsider: EMPTY response ({len(text) if text else 0} chars)")
            return [], 0

        # Extract all table rows from the data tbody
        # Strategy: find <tbody> blocks, use the second one (index 1)
        tbody_matches = re.findall(r'<tbody>(.*?)</tbody>', text, re.DOTALL)
        print(f"OpenInsider: Found {len(tbody_matches)} tbody blocks")

        data_html = ""
        if len(tbody_matches) >= 2:
            data_html = tbody_matches[1]
        elif len(tbody_matches) >= 1:
            # Maybe only one tbody — try it
            data_html = tbody_matches[0]
        else:
            # Fallback: find table directly
            table_match = re.search(r'<table[^>]*class="tinytable"[^>]*>(.*?)</table>', text, re.DOTALL)
            if table_match:
                data_html = table_match.group(1)

        if not data_html:
            print("OpenInsider: No data tbody found")
            return [], 0

        # Extract rows — must use <tr[^>]*> pattern (not <tr>)
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', data_html, re.DOTALL)
        print(f"OpenInsider: Found {len(rows)} rows in data table")

        trades = []
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            if len(cells) < 10:
                continue

            # Clean HTML tags from cells
            clean = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]

            # Parse 17-column format (cells[3]=ticker)
            try:
                ticker = clean[3] if len(clean) > 3 else ''
                if not ticker or not re.match(r'^[A-Z]+$', ticker):
                    continue  # Skip non-ticker rows (header etc)

                trade_type_str = clean[7] if len(clean) > 7 else ''
                is_sale = '-S' in trade_type_str or 'Sale' in trade_type_str or 'S -' in trade_type_str

                qty_raw = clean[9] if len(clean) > 9 else '0'
                qty = int(qty_raw.replace(',', '')) if qty_raw.replace(',', '').replace('-', '').isdigit() else 0

                price_raw = clean[8] if len(clean) > 8 else '0'
                price = float(price_raw.replace(',', '').replace('$', '')) if price_raw.replace(',', '').replace('$', '').replace('.', '').isdigit() or '.' in price_raw else 0.0

                value_raw = clean[12] if len(clean) > 12 else '0'
                value = float(value_raw.replace(',', '').replace('$', '')) if value_raw.replace(',', '').replace('$', '').replace('.', '').isdigit() or '.' in value_raw else 0.0

                owned_raw = clean[10] if len(clean) > 10 else '0'
                owned = int(owned_raw.replace(',', '')) if owned_raw.replace(',', '').isdigit() else 0

                trades.append({
                    'ticker': ticker,
                    'filing_date': clean[1] if len(clean) > 1 else '',
                    'trade_date': clean[2] if len(clean) > 2 else '',
                    'company': clean[4] if len(clean) > 4 else '',
                    'insider_name': clean[5] if len(clean) > 5 else '',
                    'title': clean[6] if len(clean) > 6 else '',
                    'trade_type': trade_type_str,
                    'is_sale': is_sale,
                    'price': price,
                    'qty': qty if not is_sale else -qty,
                    'owned': owned,
                    'value': value,
                    '_source': 'openinsider',
                })
            except (ValueError, IndexError) as e:
                continue

        # Filter to tracked tickers only
        tracked_set = set(TRACKED_TICKERS)
        tracked_trades = [t for t in trades if t['ticker'] in tracked_set]
        print(f"OpenInsider: {len(trades)} total, {len(tracked_trades)} in tracked tickers")

        return tracked_trades, len(tracked_trades)

    except Exception as e:
        print(f"OpenInsider: FAIL ({e})")
        return [], 0


# ═══════════════════════════════════════════
# 3. SEC EDGAR — Form 4 XML Parsing
# ═══════════════════════════════════════════

def http_get_sec(url, timeout=20):
    """HTTP GET with SEC-required User-Agent."""
    req = Request(url, headers={'User-Agent': UA})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        return 0, str(e)


def _tag(xml, tag):
    """Extract tag text (case-insensitive)."""
    m = re.search(f'<{tag}>(.*?)</{tag}>', xml, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None


def _val(xml, tag):
    """Extract tag value from <tag><value>...</value></tag> wrapper."""
    m = re.search(f'<{tag}>\\s*<value>(.*?)</value>', xml, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None


def parse_edgar_filing(filing_text):
    """Parse a single SEC EDGAR raw filing .txt for Form 4 XML."""
    text_lower = filing_text.lower()
    xml_start = text_lower.find('<xml>')
    xml_end = text_lower.find('</xml>', xml_start) if xml_start >= 0 else -1

    if xml_start < 0 or xml_end <= xml_start:
        return []

    xml = filing_text[xml_start:xml_end + 6]

    insider = _tag(xml, 'rptOwnerName') or ''
    ticker = _tag(xml, 'issuerTradingSymbol') or ''
    issuer_name = _tag(xml, 'issuerName') or ''
    is_director = _tag(xml, 'isDirector') or '0'
    is_officer = _tag(xml, 'isOfficer') or '0'
    filing_date = _tag(xml, 'periodOfReport') or ''

    trades = []

    # Non-derivative transactions
    nd_blocks = re.findall(
        r'<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>',
        xml, re.DOTALL | re.IGNORECASE)

    for nd in nd_blocks:
        code = _tag(nd, 'transactionCode')
        if not code or code not in ('P', 'S', 'A', 'F', 'G'):
            continue

        shares_str = _val(nd, 'transactionShares') or '0'
        price_str = _val(nd, 'transactionPricePerShare') or '0'
        acq_str = _val(nd, 'transactionAcquiredDisposedCode') or ''
        trade_date = _val(nd, 'transactionDate') or ''
        security = _val(nd, 'securityTitle') or 'Common Stock'
        shares_after = _val(nd, 'sharesOwnedFollowingTransaction') or '0'

        try:
            shares = float(shares_str.replace(',', ''))
            price = float(price_str.replace(',', ''))
            shares_after_val = float(shares_after.replace(',', ''))
        except ValueError:
            continue

        is_buy = code in ('P', 'A')
        is_sell = code in ('S', 'F')

        trades.append({
            'ticker': ticker,
            'company_name': issuer_name,
            'insider_name': insider,
            'role': 'Director & Officer' if is_director == '1' and is_officer == '1' else
                   ('Director' if is_director == '1' else ('Officer' if is_officer == '1' else '')),
            'filing_period': filing_date,
            'transaction_date': trade_date,
            'security': security,
            'type': 'BUY' if is_buy else ('SELL' if is_sell else code),
            'code': code,
            'shares': shares,
            'price': price,
            'total_value': shares * price,
            'shares_owned_after': shares_after_val,
            'is_derivative': False,
            '_source': 'sec_edgar',
        })

    # Derivative transactions (option exercises, RSU vesting)
    d_blocks = re.findall(
        r'<derivativeTransaction>(.*?)</derivativeTransaction>',
        xml, re.DOTALL | re.IGNORECASE)

    for d in d_blocks:
        code = _tag(d, 'transactionCode')
        if not code or code not in ('M', 'A', 'F'):
            continue

        shares_str = _val(d, 'transactionShares') or '0'
        price_str = _val(d, 'transactionPricePerShare') or '0'
        acq_str = _val(d, 'transactionAcquiredDisposedCode') or ''
        trade_date = _val(d, 'transactionDate') or ''
        underlying = _val(d, 'underlyingSecurityTitle') or _val(d, 'securityTitle') or 'Common Stock'
        shares_after = _val(d, 'sharesOwnedFollowingTransaction') or '0'

        try:
            shares = float(shares_str.replace(',', ''))
            price = float(price_str.replace(',', ''))
            shares_after_val = float(shares_after.replace(',', ''))
        except ValueError:
            continue

        # M = exercise (insider BUY signal), A = grant
        is_buy = code in ('M', 'A')

        trades.append({
            'ticker': ticker,
            'company_name': issuer_name,
            'insider_name': insider,
            'role': 'Director & Officer' if is_director == '1' and is_officer == '1' else
                   ('Director' if is_director == '1' else ('Officer' if is_officer == '1' else '')),
            'filing_period': filing_date,
            'transaction_date': trade_date,
            'security': underlying,
            'type': 'BUY' if is_buy else code,
            'code': code,
            'shares': shares,
            'price': price,
            'total_value': shares * price,
            'shares_owned_after': shares_after_val,
            'is_derivative': True,
            '_source': 'sec_edgar',
        })

    return trades


def scrape_sec_edgar_all(tickers, max_filings=3, delay=3.0):
    """Scrape SEC EDGAR Form 4 filings for all tracked tickers.

    Uses 3.0s delay between raw filing fetches to avoid 429 rate limiting.
    Saves incrementally after each ticker for timeout resilience.
    """
    all_trades = []
    tickers_done = 0
    tickers_429 = 0

    # Incremental save file
    incr_path = os.path.join(OUTPUT_DIR, 'sec_insider_trades_incremental.json')

    for i, ticker in enumerate(tickers):
        cik = TICKER_CIK.get(ticker, '')
        if not cik:
            continue

        print(f"  [{i+1}/{len(tickers)}] SEC EDGAR {ticker}...")

        # Step 1: Get submissions list
        sub_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        status, body = http_get_sec(sub_url)
        if status != 200:
            print(f"    Submissions API: HTTP {status}")
            tickers_done += 1
            continue
        time.sleep(0.5)

        # Parse JSON (SEC wraps in HTML body tags)
        json_match = re.search(r'<body>(.*?)</body>', body, re.DOTALL)
        if json_match:
            body = json_match.group(1)
        try:
            submissions = json.loads(body)
        except json.JSONDecodeError:
            print(f"    Submissions JSON parse failed")
            tickers_done += 1
            continue

        # Filter Form 4 filings
        filings = submissions.get('filings', {}).get('recent', {})
        forms = filings.get('form', [])
        accessions = filings.get('accessionNumber', [])
        prim_docs = filings.get('primaryDocument', [])
        filing_dates = filings.get('filingDate', [])

        form4_indices = [j for j, f in enumerate(forms) if f == '4']

        if not form4_indices:
            print(f"    No Form 4 filings found")
            tickers_done += 1
            continue

        # Step 2: Fetch raw filings (up to max_filings)
        filings_fetched = 0
        ticker_429 = False

        company_cik_num = cik.lstrip('0')

        for j in form4_indices[:max_filings*2]:  # Check more for fallback
            if filings_fetched >= max_filings:
                break

            accession = accessions[j]
            acc_no_dash = accession.replace('-', '')
            raw_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik_num}/{acc_no_dash}/{accession}.txt"

            status, raw_text = http_get_sec(raw_url, timeout=25)
            time.sleep(delay)

            if status == 429:
                print(f"    ⚠️ HTTP 429 rate limit on filing #{filings_fetched+1} — waiting 90s")
                ticker_429 = True
                time.sleep(90)
                # Retry once
                status, raw_text = http_get_sec(raw_url, timeout=25)
                time.sleep(delay)
                if status == 429:
                    print(f"    ❌ Still 429 after retry — skipping rest of {ticker}")
                    break

            if status != 200 or not raw_text or len(raw_text) < 100:
                continue

            trades = parse_edgar_filing(raw_text)
            if trades:
                all_trades.extend(trades)
                filings_fetched += 1
                buy_count = sum(1 for t in trades if t['type'] == 'BUY')
                sell_count = sum(1 for t in trades if t['type'] == 'SELL')
                print(f"    Filing {filings_fetched}: {len(trades)} trades ({buy_count}B/{sell_count}S)")

        if ticker_429:
            tickers_429 += 1

        tickers_done += 1

        # Incremental save
        try:
            with open(incr_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'scraped_at': datetime.now(timezone.utc).isoformat(),
                    'tickers_done': tickers_done,
                    'tickers_total': len(tickers),
                    'trade_count': len(all_trades),
                    'trades': all_trades,
                }, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        if tickers_done >= len(tickers):
            break

    print(f"SEC EDGAR: {len(all_trades)} trades from {tickers_done} tickers ({tickers_429} rate-limited)")

    # Cleanup: filter tracked tickers, deduplicate
    tracked_set = set(tickers)
    filtered = [t for t in all_trades if t['ticker'] in tracked_set]

    # Deduplicate by (ticker, insider, type, shares, price)
    seen = set()
    deduped = []
    for t in filtered:
        key = (t['ticker'], t['insider_name'], t['type'],
               int(t.get('shares', 0)), int(t.get('price', 0)))
        if key not in seen:
            seen.add(key)
            deduped.append(t)

    print(f"  After dedup: {len(deduped)} unique trades")
    return deduped, tickers_done, tickers_429


# ═══════════════════════════════════════════
# 主管線
# ═══════════════════════════════════════════

def save_json(filename, data):
    fpath = os.path.join(OUTPUT_DIR, filename)
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(fpath) / 1024
    print(f"  ✅ Saved: {filename} ({size_kb:.1f} KB, {len(data) if isinstance(data, list) else 'obj'})")
    return fpath


def main():
    start = time.time()
    print(f"=== Night Shift Scraper ===")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"Target: {len(TRACKED_TICKERS)} tickers")
    print(f"Camofox: UNAVAILABLE (no GTK3) — using Scrapling HTTP mode")
    print()

    results = {}

    # ─── 1. Finviz Institution Holdings ───
    print("─── 1. Finviz Institution Holdings ───")
    finviz_data, finviz_ok, finviz_fail = scrape_finviz_all(TRACKED_TICKERS)
    finviz_output = {
        'source': 'Finviz',
        'scraped_at': datetime.now(timezone.utc).isoformat(),
        'tickers_scraped': len(TRACKED_TICKERS),
        'tickers_successful': finviz_ok,
        'tickers_failed': finviz_fail,
        'data': finviz_data,
    }
    save_json('finviz_institutions.json', finviz_output)
    results['finviz'] = f"{finviz_ok}/{len(TRACKED_TICKERS)} success"

    # ─── 2. OpenInsider Insider Trades ───
    print("\n─── 2. OpenInsider Insider Trades ───")
    oi_trades, oi_count = scrape_openinsider()
    oi_output = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': 'openinsider.com',
        'count': oi_count,
        'trades': oi_trades,
    }
    save_json('openinsider_trades.json', oi_output)
    results['openinsider'] = f"{oi_count} trades"

    # ─── 3. SEC EDGAR Form 4 ───
    print("\n─── 3. SEC EDGAR Form 4 ───")
    sec_trades, sec_tickers, sec_429 = scrape_sec_edgar_all(TRACKED_TICKERS, max_filings=3, delay=3.0)
    sec_output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': 'SEC EDGAR',
        'count': len(sec_trades),
        'tickers_scraped': sec_tickers,
        'tickers_rate_limited': sec_429,
        'trades': sec_trades,
    }
    save_json('sec_insider_trades.json', sec_output)
    results['sec_edgar'] = f"{len(sec_trades)} trades from {sec_tickers} tickers (429 on {sec_429})"

    # ─── Summary ───
    elapsed = time.time() - start
    print(f"\n=== DONE in {elapsed:.0f}s ===")
    for k, v in results.items():
        print(f"  {k}: {v}")

    # Write summary for night_chat.md
    summary_path = os.path.join(OUTPUT_DIR, 'data_summary.json')
    summary = {
        'scraped_at': datetime.now(timezone.utc).isoformat(),
        'elapsed_seconds': round(elapsed, 1),
        'camofox_available': False,
        'camofox_reason': 'libgtk-3.so.0 not available on headless server',
        'finviz': results['finviz'],
        'openinsider': results['openinsider'],
        'sec_edgar': results['sec_edgar'],
    }
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    return results


if __name__ == '__main__':
    main()
