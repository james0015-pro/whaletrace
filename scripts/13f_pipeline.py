#!/usr/bin/env python3
"""SEC 13F Pipeline — with retry logic for intermittent blocking."""
import json, re, time, urllib.request, os
from collections import defaultdict

USER_AGENT = 'SECresearch/2.0 (admin@example.com)'
DELAY = 2.0  # Longer delay to avoid rate limiting

CUSIP_MAP = {
    "03783310":"AAPL","59491810":"MSFT","02079K10":"GOOGL","02079K30":"GOOGL",
    "02313510":"AMZN","30303M10":"META","67066G10":"NVDA","88160R10":"TSLA",
    "46625H10":"JPM","92826C83":"V","57636Q10":"MA","06050510":"BAC",
    "38141G10":"GS","61744644":"MS","09247X10":"BLK","91324P10":"UNH",
    "47816010":"JNJ","71708110":"PFE","58933Y10":"MRK","00287Y10":"ABBV",
    "53245710":"LLY","88355610":"TMO","93114210":"WMT","22160K10":"COST",
    "43707610":"HD","74271810":"PG","19121610":"KO","71344810":"PEP",
    "58013510":"MCD","65410610":"NKE","85524410":"SBUX","30231G10":"XOM",
    "16676410":"CVX","14912310":"CAT","24419910":"DE","53983010":"LMT",
    "09702310":"BA","36960430":"GE","43851610":"HON","91131210":"UPS",
    "79466L30":"CRM","00724F10":"ADBE","68389X10":"ORCL","17275R10":"CSCO",
    "45814010":"INTC","00790310":"AMD","74752510":"QCOM","88250810":"TXN",
    "11135F10":"AVGO","25468710":"DIS","64110L10":"NFLX","90353T10":"UBER",
    "70450Y10":"PYPL","00906610":"ABNB",
}

KNOWN_CIKS = {
    "BAUPOST":"0001061768","BERKSHIRE":"0001067983",
    "PERSHING SQUARE":"0001336528","GREENLIGHT":"0001079114",
    "TIGER GLOBAL":"0001167483",
}

def get(url, retries=3):
    for attempt in range(retries):
        time.sleep(DELAY)
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt == retries - 1:
                return None
            time.sleep(5 * (attempt + 1))

print("SEC 13F Pipeline — Retry Mode")
print("=" * 60)

all_qoq = []

for name, cik in KNOWN_CIKS.items():
    print(f"\n{name}...", end=' ', flush=True)
    
    # Step 1: Get filing list
    data = get(f"https://data.sec.gov/submissions/CIK{cik}.json")
    if not data:
        print("API FAIL")
        continue
    
    try:
        filings = json.loads(data)
    except:
        print("JSON FAIL")
        continue
    
    recent = filings.get('filings', {}).get('recent', {})
    forms = recent.get('form', [])
    accs = recent.get('accessionNumber', [])
    dates = recent.get('filingDate', [])
    docs = recent.get('primaryDocument', [])
    
    cik_num = int(cik)
    quarters = {}
    count = 0
    
    for i, form in enumerate(forms):
        if form != '13F-HR' or i >= len(accs) or count >= 12:
            continue
        
        acc = accs[i]
        acc_clean = acc.replace('-', '')
        doc = docs[i] if i < len(docs) else ''
        
        # Step 2: Find info table filename from index page
        idx_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{acc}-index.htm"
        idx_html = get(idx_url, retries=5)
        
        info_url = None
        if idx_html:
            links = re.findall(r'href="([^"]+)"', idx_html)
            for l in links:
                if 'xslForm13F_X02' in l and 'primary_doc.xml' not in l and l.endswith('.xml'):
                    info_url = f"https://www.sec.gov{l}" if l.startswith('/Archives/') else l
                    break
        
        if not info_url:
            # Fallback: try constructing URL from primary doc name
            # The info table is often in the same directory with a different name
            base_dir = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/xslForm13F_X02"
            # Skip this filing
            continue
        
        # Step 3: Download info table
        html = get(info_url, retries=3)
        if not html:
            continue
        
        # Step 4: Parse holdings
        if 'NAME OF ISSUER' not in html and 'infoTable' not in html:
            continue
        
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
        holdings = []
        in_data = False
        
        for row in rows:
            if '<th>' in row or 'COLUMN' in row:
                continue
            tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(tds) < 5:
                continue
            cols = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
            
            if 'NAME OF ISSUER' in cols[0]:
                in_data = True
                continue
            if not in_data:
                continue
            
            cusip = cols[2].replace(',','').strip().upper() if len(cols) > 2 else ''
            if len(cusip) < 6:
                continue
            ticker = CUSIP_MAP.get(cusip, '')
            if not ticker:
                continue
            
            val_str = cols[4].replace(',','').strip() if len(cols) > 4 else '0'
            sh_str = cols[5].replace(',','').strip() if len(cols) > 5 else '0'
            
            try:
                holdings.append({
                    'ticker': ticker,
                    'issuer': cols[0] if cols else '',
                    'value': int(val_str) * 1000 if val_str.isdigit() else 0,
                    'shares': int(sh_str) if sh_str.isdigit() else 0,
                })
            except:
                pass
        
        if holdings and dates[i] not in quarters:
            quarters[dates[i]] = holdings
            count += 1
    
    print(f"{count} quarters", end=' ', flush=True)
    
    # Step 5: QoQ comparison
    sorted_q = sorted(quarters.items())
    qoq_count = 0
    for i in range(1, len(sorted_q)):
        prev_map = {h['ticker']: h['value'] for h in sorted_q[i-1][1]}
        curr_map = {h['ticker']: h['value'] for h in sorted_q[i][1]}
        
        for ticker in set(list(prev_map.keys()) + list(curr_map.keys())):
            pv = prev_map.get(ticker, 0)
            cv = curr_map.get(ticker, 0)
            if pv == 0 and cv == 0:
                continue
            pct = ((cv - pv) / pv * 100) if pv > 0 else 100
            direction = 'INCREASE' if pct > 0 else 'DECREASE'
            
            all_qoq.append({
                'institution': name, 'ticker': ticker,
                'report_date': sorted_q[i][0],
                'prev_value': pv, 'curr_value': cv,
                'pct_change': round(pct, 1), 'direction': direction,
            })
            qoq_count += 1
    
    print(f"-> {qoq_count} QoQ changes")

print(f"\n{'='*60}")
print(f"TOTAL QoQ changes: {len(all_qoq)}")
print(f"{'='*60}")

if all_qoq:
    # Show summary
    inst_counts = defaultdict(int)
    for q in all_qoq:
        inst_counts[q['institution']] += 1
    
    for name, cnt in sorted(inst_counts.items(), key=lambda x: -x[1]):
        tickers = set(q['ticker'] for q in all_qoq if q['institution'] == name)
        inc = sum(1 for q in all_qoq if q['institution'] == name and q['direction'] == 'INCREASE')
        print(f"  {name}: {cnt} changes ({inc} increases) in {sorted(tickers)}")
    
    # Save
    out = {'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'count': len(all_qoq), 'changes': all_qoq}
    with open('/opt/data/home/whaletrace/scripts/output/13f_qoq.json', 'w') as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\nSaved: 13f_qoq.json")
else:
    print("\nNo QoQ changes found. SEC blocking may still be active.")
    print("Run from your local machine: python3 scripts/run_institution_analysis.py")
