#!/usr/bin/env python3
"""
PHASE 3: Download & Parse 13F XML → QoQ Position Changes → Earnings Edge

Process:
1. For each institution with 13F filings, download the XML
2. Extract holdings matching our 54-ticker watchlist
3. Compare QoQ: which stocks had increased positions
4. Cross-reference with earnings: did the NEXT earnings show positive pre-market?
5. Rank institutions by prediction accuracy
"""

import json, os, sys, time, re, gzip
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error

# ============================================================
# CONFIG
# ============================================================
DATA_DIR = "/opt/data/home/whaletrace/data/sec_bulk"
OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_AGENT = 'ResearchBot/3.0 (contact@example.com)'
RATE_LIMIT = 0.25

# Our 54-ticker watchlist
WATCHLIST = {
    "AAPL","MSFT","GOOGL","GOOG","AMZN","META","NVDA","TSLA","BRK-B","BRK.B",
    "JPM","V","MA","BAC","GS","MS","BLK","UNH","JNJ","PFE","MRK","ABBV",
    "LLY","TMO","WMT","COST","HD","PG","KO","PEP","MCD","NKE","SBUX",
    "XOM","CVX","CAT","DE","LMT","BA","GE","HON","UPS","CRM","ADBE",
    "ORCL","CSCO","INTC","AMD","QCOM","TXN","AVGO","DIS","NFLX","UBER",
    "PYPL","ABNB",
}

# CUSIP → Ticker mapping (partial, will expand)
CUSIP_MAP = {
    "03783310": "AAPL", "59491810": "MSFT", "02079K30": "GOOGL",
    "02313510": "AMZN", "30303M10": "META", "67066G10": "NVDA",
    "88160R10": "TSLA", "08467070": "BRK-B", "46625H10": "JPM",
    "92826C83": "V", "57636Q10": "MA", "06050510": "BAC",
    "38141G10": "GS", "61744644": "MS", "09247X10": "BLK",
    "91324P10": "UNH", "47816010": "JNJ", "71708110": "PFE",
    "58933Y10": "MRK", "00287Y10": "ABBV", "53245710": "LLY",
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
}

last_request = 0
def sec_get(url, timeout=30):
    global last_request
    elapsed = time.time() - last_request
    if elapsed < RATE_LIMIT:
        time.sleep(RATE_LIMIT - elapsed)
    last_request = time.time()
    
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return data
    except Exception:
        return None


def parse_13f_xml_holdings(text, ticker_filter=None):
    """Extract holdings from 13F XML text, optionally filtered by ticker."""
    holdings = []
    
    # Find infoTable blocks
    tables = re.findall(r'<infoTable>(.*?)</infoTable>', text, re.DOTALL)
    
    for table in tables:
        name = ''
        nm = re.search(r'<nameOfIssuer>(.*?)</nameOfIssuer>', table)
        if nm: name = nm.group(1)
        
        cusip_match = re.search(r'<cusip>(.*?)</cusip>', table)
        cusip = cusip_match.group(1)[:8].upper() if cusip_match else ''
        
        value_match = re.search(r'<value>(\d+)</value>', table)
        value = int(value_match.group(1)) * 1000 if value_match else 0
        
        shares_match = re.search(r'<sshPrnamt>(\d+)</sshPrnamt>', table)
        shares = int(shares_match.group(1)) if shares_match else 0
        
        put_call_match = re.search(r'<putCall>(.*?)</putCall>', table)
        put_call = put_call_match.group(1) if put_call_match else ''
        
        # Skip options
        if put_call in ('PUT', 'CALL'):
            continue
        
        ticker = CUSIP_MAP.get(cusip, '')
        
        # If we have a filter, only keep matching tickers
        if ticker_filter and ticker and ticker not in ticker_filter:
            continue
        
        holdings.append({
            'issuer': name,
            'cusip': cusip,
            'ticker': ticker,
            'value': value,
            'shares': shares,
        })
    
    return holdings


def download_and_parse_13f(inst_name, cik, filings_url_template):
    """Download and parse all 13F filings for one institution."""
    # Get the full filing list from submissions API
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = sec_get(url)
    if not data:
        return []
    
    try:
        filings_data = json.loads(data)
    except:
        return []
    
    recent = filings_data.get('filings', {}).get('recent', {})
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    primary_docs = recent.get('primaryDocument', [])
    
    cik_num = int(cik)
    quarterly_holdings = {}  # date → holdings
    
    print(f"  Parsing {inst_name}...", end=' ', flush=True)
    count = 0
    
    for i, form in enumerate(forms):
        if form not in ('13F-HR', '13F-HR/A'):
            continue
        if i >= len(acc_numbers):
            break
        if count >= 40:  # Max 40 quarters (10 years)
            break
        
        acc = acc_numbers[i]
        acc_clean = acc.replace('-', '')
        doc = primary_docs[i] if i < len(primary_docs) else ''
        
        # Try multiple URL patterns
        base_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}"
        
        holdings = None
        for suffix in [doc, doc.replace('.htm', '_primary_document.xml'),
                       doc.replace('.html', '.xml'), f"{acc_clean}.txt"]:
            full_url = f"{base_url}/{suffix}"
            data = sec_get(full_url, timeout=20)
            if not data:
                continue
            
            text = data.decode('utf-8', errors='ignore')
            if '<infoTable>' in text or '<informationTable>' in text:
                holdings = parse_13f_xml_holdings(text, WATCHLIST)
                if holdings:
                    break
        
        if holdings:
            date = filing_dates[i] if i < len(filing_dates) else ''
            if date and date not in quarterly_holdings:
                quarterly_holdings[date] = holdings
                count += 1
    
    print(f"{count} quarters parsed")
    
    # Sort by date
    sorted_quarters = sorted(quarterly_holdings.items())
    
    # Compute QoQ changes
    qoq_changes = []
    for i in range(1, len(sorted_quarters)):
        prev_date, prev_holdings = sorted_quarters[i-1]
        curr_date, curr_holdings = sorted_quarters[i]
        
        prev_map = {h['ticker']: h for h in prev_holdings if h['ticker']}
        curr_map = {h['ticker']: h for h in curr_holdings if h['ticker']}
        
        for ticker, curr_h in curr_map.items():
            prev_h = prev_map.get(ticker)
            
            if not prev_h or prev_h['value'] == 0:
                continue  # New position (can't compute % change)
            
            value_change_pct = ((curr_h['value'] - prev_h['value']) / prev_h['value']) * 100
            
            if value_change_pct > 10:  # >10% increase in position value
                qoq_changes.append({
                    'institution': inst_name,
                    'cik': cik,
                    'ticker': ticker,
                    'report_date': curr_date,
                    'prev_date': prev_date,
                    'prev_value': prev_h['value'],
                    'curr_value': curr_h['value'],
                    'value_change_pct': round(value_change_pct, 1),
                })
    
    return qoq_changes


def main():
    print("=" * 80)
    print("PHASE 3: 13F QoQ Analysis → Earnings Edge")
    print("=" * 80)
    
    # Load verified CIKs
    cik_path = os.path.join(DATA_DIR, 'verified_ciks.json')
    if not os.path.exists(cik_path):
        print("No verified CIKs found. Run Phase 1 first.")
        return
    
    with open(cik_path) as f:
        institutions = json.load(f)
    
    print(f"\nProcessing {len(institutions)} institutions with 13F data...")
    
    # Process each institution
    all_qoq = []
    for i, inst in enumerate(institutions):
        name = inst['name']
        cik = inst['cik']
        
        try:
            qoq = download_and_parse_13f(name, cik, '')
            all_qoq.extend(qoq)
            
            # Show progress
            if qoq:
                tickers_found = set(q['ticker'] for q in qoq)
                print(f"    → {len(qoq)} QoQ increases in: {sorted(tickers_found)[:8]}")
        except Exception as e:
            print(f"  {name}: ERROR - {e}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL QoQ position increases (>10%): {len(all_qoq)}")
    print(f"{'='*80}")
    
    # Group by institution
    by_inst = defaultdict(list)
    for q in all_qoq:
        by_inst[q['institution']].append(q)
    
    for name, changes in sorted(by_inst.items(), key=lambda x: -len(x[1])):
        tickers = set(q['ticker'] for q in changes)
        avg_change = sum(q['value_change_pct'] for q in changes) / len(changes)
        print(f"  {name}: {len(changes)} increases, avg +{avg_change:.1f}%, stocks: {sorted(tickers)[:10]}")
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, '13f_qoq_changes.json')
    with open(output_path, 'w') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_changes': len(all_qoq),
            'by_institution': {name: len(changes) for name, changes in by_inst.items()},
            'changes': all_qoq,
        }, f, indent=2, default=str)
    
    print(f"\n📁 Saved QoQ changes to: {output_path}")
    
    return all_qoq


if __name__ == '__main__':
    main()
