#!/usr/bin/env python3
"""
PHASE 3 FINAL: Parse 13F HTML Tables → QoQ → Earnings Edge

Working approach:
1. Get 13F filing index page → find info table XML filename
2. Download the XSLT HTML page → parse <tr>/<td> rows
3. Extract: issuer name, CUSIP, value (x$1000), shares
4. Map CUSIP → ticker using our mapping table
5. Compare QoQ: ALL increases and decreases
6. Cross-reference with earnings pre-market movement
7. WIN = increase → UP at earnings, OR decrease → DOWN at earnings
"""

import json, os, sys, time, re
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error
import yfinance as yf

# ============================================================
# CONFIG
# ============================================================
DATA_DIR = "/opt/data/home/whaletrace/data/sec_bulk"
OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_AGENT = 'ResearchBot/3.0 (contact@example.com)'
RATE_LIMIT = 0.3

# CUSIP → Ticker mapping (expanded)
CUSIP_MAP = {
    "03783310": "AAPL", "59491810": "MSFT", "02079K30": "GOOGL",
    "02079K10": "GOOGL", "02313510": "AMZN", "30303M10": "META",
    "67066G10": "NVDA", "88160R10": "TSLA", "08467070": "BRK-B",
    "08467010": "BRK-B", "46625H10": "JPM", "92826C83": "V",
    "57636Q10": "MA", "06050510": "BAC", "38141G10": "GS",
    "61744644": "MS", "09247X10": "BLK", "91324P10": "UNH",
    "47816010": "JNJ", "71708110": "PFE", "58933Y10": "MRK",
    "00287Y10": "ABBV", "53245710": "LLY", "88355610": "TMO",
    "93114210": "WMT", "22160K10": "COST", "43707610": "HD",
    "74271810": "PG", "19121610": "KO", "71344810": "PEP",
    "58013510": "MCD", "65410610": "NKE", "85524410": "SBUX",
    "30231G10": "XOM", "16676410": "CVX", "14912310": "CAT",
    "24419910": "DE", "53983010": "LMT", "09702310": "BA",
    "36960430": "GE", "43851610": "HON", "91131210": "UPS",
    "79466L30": "CRM", "00724F10": "ADBE", "68389X10": "ORCL",
    "17275R10": "CSCO", "45814010": "INTC", "00790310": "AMD",
    "74752510": "QCOM", "88250810": "TXN", "11135F10": "AVGO",
    "25468710": "DIS", "64110L10": "NFLX", "90353T10": "UBER",
    "70450Y10": "PYPL", "00906610": "ABNB",
    # Additional CUSIP variants
    "02079K30": "GOOGL", "02079K10": "GOOG", "02079K20": "GOOG",
    "30303M10": "META", "88160R10": "TSLA",
    "08467070": "BRK-B", "08467010": "BRK-A",
    # Common CUSIPs for major stocks
    "03783310": "AAPL", "59491810": "MSFT",
    # Amazon variants
    "02313510": "AMZN",
    # NVDA  
    "67066G10": "NVDA",
}

last_request = 0
def sec_get(url, timeout=30):
    global last_request
    elapsed = time.time() - last_request
    if elapsed < RATE_LIMIT:
        time.sleep(RATE_LIMIT - elapsed)
    last_request = time.time()
    
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='ignore')
    except:
        return None


def get_13f_filing_urls(cik):
    """Get all 13F-HR filing URLs for an institution."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    text = sec_get(url)
    if not text:
        return []
    
    try:
        data = json.loads(text)
    except:
        return []
    
    recent = data.get('filings', {}).get('recent', {})
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    
    cik_num = int(cik)
    filings = []
    
    for i, form in enumerate(forms):
        if form == '13F-HR' and i < len(acc_numbers):
            acc = acc_numbers[i]
            acc_clean = acc.replace('-', '')
            date = filing_dates[i] if i < len(filing_dates) else ''
            
            # The index page tells us the info table filename
            index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{acc}-index.htm"
            
            filings.append({
                'date': date,
                'acc_clean': acc_clean,
                'index_url': index_url,
                'cik_num': cik_num,
            })
    
    return filings


def find_info_table_url(filing):
    """Get the info table HTML URL from the filing index page."""
    text = sec_get(filing['index_url'])
    if not text:
        return None
    
    # Find links to XML files in xslForm13F_X02 directory
    # IMPORTANT: Skip "primary_doc.xml" which is the cover page
    all_links = re.findall(r'href="([^"]+)"', text)
    
    info_links = []
    for link in all_links:
        if 'xslForm13F_X02' in link and 'primary_doc.xml' not in link and link.endswith('.xml'):
            info_links.append(link)
    
    if info_links:
        raw_path = info_links[0]
        if raw_path.startswith('/Archives/'):
            return f"https://www.sec.gov{raw_path}"
        return f"https://www.sec.gov/Archives/edgar/data/{filing['cik_num']}/{filing['acc_clean']}/{raw_path}"
    
    return None


def parse_13f_html_table(html_text):
    """Parse the XSLT-rendered 13F HTML table into holdings."""
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html_text, re.DOTALL)
    
    holdings = []
    in_data = False
    
    for row_html in rows:
        if '<th>' in row_html or 'COLUMN' in row_html:
            continue
        
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
        if len(tds) < 5:
            continue
        
        # Clean HTML
        cols = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
        
        # Check if this is a header row
        if 'NAME OF ISSUER' in cols[0] or 'CUSIP' in cols[2]:
            in_data = True
            continue
        
        if not in_data:
            continue
        
        # Column layout: [0]=ISSUER, [1]=CLASS, [2]=CUSIP, [3]=FIGI, [4]=VALUE($K), [5]=SHARES, [6]=PRN_AMT, [7]=PUT/CALL
        cusip_raw = cols[2] if len(cols) > 2 else ''
        if not cusip_raw or len(cusip_raw) < 6:
            continue
        
        cusip = cusip_raw.strip().replace(',', '').upper()
        issuer = cols[0] if len(cols) > 0 else ''
        
        # Value is column 4 (in thousands of dollars)
        # Shares is column 5
        value_str = cols[4].replace(',', '').strip() if len(cols) > 4 else '0'
        shares_str = cols[5].replace(',', '').strip() if len(cols) > 5 else '0'
        
        try:
            value = int(value_str) * 1000 if value_str.isdigit() else 0
            shares = int(shares_str) if shares_str.isdigit() else 0
        except:
            continue
        
        ticker = CUSIP_MAP.get(cusip, '')
        
        holdings.append({
            'issuer': issuer,
            'cusip': cusip,
            'ticker': ticker,
            'value': value,
            'shares': shares,
        })
    
    return holdings


def parse_one_institution(name, cik, max_quarters=40):
    """Parse all 13F quarters for one institution."""
    filings = get_13f_filing_urls(cik)
    if not filings:
        return []
    
    quarterly_holdings = {}  # date → holdings
    count = 0
    
    for filing in filings[:max_quarters]:
        info_url = find_info_table_url(filing)
        if not info_url:
            continue
        
        html = sec_get(info_url, timeout=30)
        if not html:
            continue
        
        holdings = parse_13f_html_table(html)
        if holdings:
            date = filing['date']
            if date not in quarterly_holdings:
                quarterly_holdings[date] = holdings
                count += 1
    
    # Sort by date
    sorted_quarters = sorted(quarterly_holdings.items())
    
    # Compute QoQ changes — ALL changes, no threshold
    qoq_changes = []
    for i in range(1, len(sorted_quarters)):
        prev_date, prev_h = sorted_quarters[i-1]
        curr_date, curr_h = sorted_quarters[i]
        
        prev_map = {h['ticker']: h for h in prev_h if h['ticker']}
        curr_map = {h['ticker']: h for h in curr_h if h['ticker']}
        
        # Find all tickers in either quarter
        all_tickers = set(list(prev_map.keys()) + list(curr_map.keys()))
        
        for ticker in all_tickers:
            prev_val = prev_map[ticker]['value'] if ticker in prev_map else 0
            curr_val = curr_map[ticker]['value'] if ticker in curr_map else 0
            
            if prev_val == 0 and curr_val == 0:
                continue
            
            if prev_val == 0:
                direction = 'NEW'
                pct_change = 100
            elif curr_val == 0:
                direction = 'EXIT'
                pct_change = -100
            else:
                pct_change = ((curr_val - prev_val) / prev_val) * 100
                direction = 'INCREASE' if pct_change > 0 else 'DECREASE'
            
            qoq_changes.append({
                'institution': name,
                'cik': cik,
                'ticker': ticker,
                'report_date': curr_date,
                'prev_date': prev_date,
                'prev_value': prev_val,
                'curr_value': curr_val,
                'pct_change': round(pct_change, 1),
                'direction': direction,
            })
    
    return qoq_changes


def cross_reference_with_earnings(all_qoq):
    """Cross-reference each QoQ change with next earnings pre-market movement."""
    # Cache earnings data
    earnings_cache = {}
    tickers_needed = set(q['ticker'] for q in all_qoq if q['ticker'])
    
    print(f"\nFetching earnings data for {len(tickers_needed)} tickers...")
    for ticker in sorted(tickers_needed):
        try:
            stock = yf.Ticker(ticker)
            earnings = stock.earnings_dates
            if earnings is not None and len(earnings) > 0:
                earnings_cache[ticker] = (stock, earnings)
        except:
            pass
        time.sleep(0.1)
    
    print(f"  Earnings data for {len(earnings_cache)} tickers")
    
    # Cross-reference
    results = []
    for q in all_qoq:
        ticker = q['ticker']
        if ticker not in earnings_cache:
            continue
        
        try:
            report_date = datetime.strptime(q['report_date'], '%Y-%m-%d')
        except:
            continue
        
        stock, earnings = earnings_cache[ticker]
        
        # Find the next earnings AFTER the 13F report date
        best_match = None
        for dt, row in earnings.iterrows():
            if hasattr(dt, 'to_pydatetime'):
                dt = dt.to_pydatetime()
            if dt.tzinfo:
                dt = dt.replace(tzinfo=None)
            
            delta = (dt - report_date).days
            if 0 < delta <= 120:  # Within 4 months
                try:
                    prev = stock.history(start=dt-timedelta(days=5), end=dt, interval='1d')
                    day = stock.history(start=dt, end=dt+timedelta(days=1), interval='1d')
                    if len(prev) >= 1 and len(day) >= 1:
                        pc = float(prev['Close'].iloc[-1])
                        do = float(day['Open'].iloc[0])
                        pm = ((do-pc)/pc)*100
                        best_match = {
                            'earnings_date': dt.strftime('%Y-%m-%d'),
                            'days_after_report': delta,
                            'premarket_pct': round(pm, 2),
                            'eps_surprise': float(row.get('Surprise(%)', 0) or 0),
                        }
                except:
                    pass
                break  # Only check first earnings after report
        
        if best_match:
            pm_up = best_match['premarket_pct'] > 0
            
            # WIN logic:
            # - If institution INCREASED or NEW position → WIN if stock went UP
            # - If institution DECREASED or EXIT → WIN if stock went DOWN
            if q['direction'] in ('INCREASE', 'NEW'):
                is_win = pm_up
            else:  # DECREASE, EXIT
                is_win = not pm_up
            
            results.append({
                **q,
                **best_match,
                'is_win': is_win,
                'pm_up': pm_up,
            })
    
    return results


def compute_institution_stats(results):
    """Compute win rate per institution."""
    inst_stats = defaultdict(lambda: {
        'name': '', 'total': 0, 'wins': 0,
        'increases': 0, 'decreases': 0,
        'inc_wins': 0, 'dec_wins': 0,
        'tickers': set()
    })
    
    for r in results:
        name = r['institution']
        inst_stats[name]['name'] = name
        inst_stats[name]['total'] += 1
        inst_stats[name]['tickers'].add(r['ticker'])
        
        if r['is_win']:
            inst_stats[name]['wins'] += 1
        
        if r['direction'] in ('INCREASE', 'NEW'):
            inst_stats[name]['increases'] += 1
            if r['is_win']:
                inst_stats[name]['inc_wins'] += 1
        else:
            inst_stats[name]['decreases'] += 1
            if r['is_win']:
                inst_stats[name]['dec_wins'] += 1
    
    ranked = []
    for s in inst_stats.values():
        if s['total'] >= 3:
            wr = s['wins'] / s['total'] * 100
            inc_wr = s['inc_wins'] / s['increases'] * 100 if s['increases'] > 0 else 0
            dec_wr = s['dec_wins'] / s['decreases'] * 100 if s['decreases'] > 0 else 0
            
            ranked.append({
                'institution': s['name'],
                'total_trades': s['total'],
                'wins': s['wins'],
                'losses': s['total'] - s['wins'],
                'win_rate': round(wr, 1),
                'increase_win_rate': round(inc_wr, 1),
                'decrease_win_rate': round(dec_wr, 1),
                'increases': s['increases'],
                'decreases': s['decreases'],
                'tickers': sorted(s['tickers']),
            })
    
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total_trades']))
    return ranked


def main():
    print("=" * 80)
    print("PHASE 3: 13F HTML Table Parsing → Earnings Cross-Reference")
    print("=" * 80)
    
    # Load verified CIKs
    cik_path = os.path.join(DATA_DIR, 'verified_ciks.json')
    if not os.path.exists(cik_path):
        print("ERROR: No verified CIKs. Run Phase 1 first.")
        return
    
    with open(cik_path) as f:
        institutions = json.load(f)
    
    # Focus on top institutions by 13F count
    institutions.sort(key=lambda x: -x['count'])
    top_institutions = institutions[:15]  # Top 15 for speed
    
    print(f"Processing top {len(top_institutions)} institutions...\n")
    
    all_qoq = []
    for i, inst in enumerate(top_institutions):
        name = inst['name']
        cik = inst['cik']
        print(f"[{i+1}/{len(top_institutions)}] {name}...", end=' ', flush=True)
        
        qoq = parse_one_institution(name, cik, max_quarters=30)
        all_qoq.extend(qoq)
        print(f"{len(qoq)} QoQ changes")
    
    print(f"\n{'='*80}")
    print(f"TOTAL QoQ changes: {len(all_qoq)}")
    print(f"Unique tickers: {len(set(q['ticker'] for q in all_qoq if q['ticker']))}")
    print(f"{'='*80}")
    
    # Cross-reference with earnings
    results = cross_reference_with_earnings(all_qoq)
    print(f"\nTrades matched with earnings: {len(results)}")
    
    # Compute institution stats
    ranked = compute_institution_stats(results)
    
    # Display results
    print(f"\n{'='*80}")
    print(f"INSTITUTION RANKINGS (by overall prediction accuracy)")
    print(f"{'='*80}")
    
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    decent = [r for r in ranked if 70 <= r['win_rate'] < 80]
    
    for cat_name, cat_list in [
        ("🏆 90-100% OVERALL PREDICTION ACCURACY", elite),
        ("📈 80-89%", good),
        ("📊 70-79%", decent),
    ]:
        if cat_list:
            print(f"\n{'─'*80}")
            print(f"  {cat_name}")
            print(f"{'─'*80}")
            for r in cat_list:
                print(f"\n  {r['institution']}")
                print(f"     Total Predictions: {r['total_trades']} | Win Rate: {r['win_rate']}% ({r['wins']}W/{r['losses']}L)")
                print(f"     Increase Accuracy: {r['increase_win_rate']}% ({r['increases']} trades)")
                print(f"     Decrease Accuracy: {r['decrease_win_rate']}% ({r['decreases']} trades)")
                print(f"     Stocks Tracked: {', '.join(r['tickers'][:10])}")
    
    # Save full results
    output_path = os.path.join(OUTPUT_DIR, 'institution_edge_results.json')
    with open(output_path, 'w') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_institutions': len(top_institutions),
            'total_qoq_changes': len(all_qoq),
            'matched_with_earnings': len(results),
            'rankings': ranked,
        }, f, indent=2, default=str)
    
    print(f"\n📁 Saved: {output_path}")


if __name__ == '__main__':
    main()
