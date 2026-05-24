#!/usr/bin/env python3
"""
Focused SEC EDGAR Form 4 Scraper — Target stocks with known insider buys
Expands the yfinance data (2-3 years) to 10 years via SEC EDGAR

Strategy:
1. For 27 tickers that already have insider buys, fetch ALL Form 4 filings
2. Parse XML for BUY transactions (code='P')
3. Cross-reference with earnings for win rates
4. Minimum 3 trades for statistical significance
"""

import json, os, time, re, gzip
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error

# Focus on tickers that had insider buys in our earlier analysis
TARGET_TICKERS = [
    'MSFT', 'TSLA', 'GS', 'UNH', 'CRM', 'DIS', 'NKE', 'HD', 'XOM',
    'JNJ', 'MRK', 'LLY', 'KO', 'TMO', 'UPS', 'AVGO', 'UBER', 'MS',
    'ADBE', 'AMD', 'BA', 'CAT', 'INTC', 'ORCL', 'PFE', 'SBUX', 'BRK-B',
]

OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_AGENT = 'InsiderResearch/2.0 (contact@example.com)'
RATE_LIMIT = 0.25  # 4 req/s (SEC allows 10/s, we're conservative)

last_request_time = 0
def sec_request(url, timeout=20):
    """Rate-limited SEC request."""
    global last_request_time
    elapsed = time.time() - last_request_time
    if elapsed < RATE_LIMIT:
        time.sleep(RATE_LIMIT - elapsed)
    last_request_time = time.time()
    
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return data
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    RATE LIMITED (429), waiting 30s...")
            time.sleep(30)
            return sec_request(url, timeout)
        if e.code == 404:
            return None
        return None
    except Exception as e:
        return None


def get_cik(ticker):
    """Get CIK from SEC company_tickers.json."""
    # Cache the CIK lookup
    cache_path = os.path.join(OUTPUT_DIR, 'cik_cache.json')
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            cache = json.load(f)
    
    if ticker in cache:
        return cache[ticker]
    
    # Fix BRK-B -> BRK.B for lookup
    lookup = ticker.upper().replace('-', '.')
    
    url = "https://www.sec.gov/files/company_tickers.json"
    data = sec_request(url)
    if not data:
        return None
    
    try:
        companies = json.loads(data)
        for entry in companies.values():
            if entry['ticker'].upper() == lookup:
                cik = str(entry['cik_str']).zfill(10)
                cache[ticker] = cik
                with open(cache_path, 'w') as f:
                    json.dump(cache, f)
                return cik
    except:
        pass
    
    return None


def fetch_form4_list(cik, max_filings=500):
    """Get list of Form 4 filings from SEC submissions API."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = sec_request(url)
    if not data:
        return []
    
    try:
        filings_data = json.loads(data)
    except:
        return []
    
    form4_list = []
    recent = filings_data.get('filings', {}).get('recent', {})
    
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    primary_docs = recent.get('primaryDocument', [])
    
    cik_num = int(cik)
    
    for i, form in enumerate(forms):
        if form == '4' and i < len(acc_numbers) and i < max_filings:
            acc = acc_numbers[i]
            acc_clean = acc.replace('-', '')
            
            # Check if it's an .xml document
            doc = primary_docs[i] if i < len(primary_docs) else ''
            if not doc.endswith('.xml'):
                # Try to find the XML version
                doc = doc.replace('.htm', '_primary_document.xml')
            
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{doc}"
            
            form4_list.append({
                'accession': acc,
                'filing_date': filing_dates[i] if i < len(filing_dates) else '',
                'url': filing_url,
                'doc': doc,
            })
    
    return form4_list


def parse_form4_buys(filing_url):
    """Parse Form 4 XML and extract ONLY buy (Purchase) transactions."""
    data = sec_request(filing_url, timeout=30)
    if not data:
        return None
    
    try:
        text = data.decode('utf-8', errors='ignore')
    except:
        return None
    
    # Check if it's a Form 4
    if 'Form 4' not in text[:500] and 'FORM 4' not in text[:500]:
        return None
    
    # Extract insider info
    name_match = re.search(r'<rptOwnerName>(.*?)</rptOwnerName>', text)
    if not name_match:
        return None
    
    insider_name = name_match.group(1)
    
    # Extract issuer ticker
    ticker_match = re.search(r'<issuerTradingSymbol>(.*?)</issuerTradingSymbol>', text)
    ticker = ticker_match.group(1).upper() if ticker_match else ''
    
    # Extract officer/director info
    title_match = re.search(r'<officerTitle>(.*?)</officerTitle>', text)
    is_dir = bool(re.search(r'<isDirector>1</isDirector>', text))
    is_off = bool(re.search(r'<isOfficer>1</isOfficer>', text))
    is_10p = bool(re.search(r'<isTenPercentOwner>1</isTenPercentOwner>', text))
    
    roles = []
    if title_match: roles.append(title_match.group(1))
    if is_dir: roles.append('Director')
    if is_off: roles.append('Officer')
    if is_10p: roles.append('10% Owner')
    role = ', '.join(roles) if roles else 'Insider'
    
    # Find BUY transactions
    buys = []
    
    # Non-derivative transactions
    nd_blocks = re.findall(r'<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>', text, re.DOTALL)
    
    for block in nd_blocks:
        code_match = re.search(r'<transactionCode>\s*P\s*</transactionCode>', block, re.DOTALL)
        if not code_match:
            continue
        
        date_match = re.search(r'<transactionDate>.*?<value>(\d{4}-\d{2}-\d{2})</value>', block, re.DOTALL)
        shares_match = re.search(r'<transactionShares>.*?<value>([\d.]+)</value>', block, re.DOTALL)
        price_match = re.search(r'<transactionPricePerShare>.*?<value>([\d.]+)</value>', block, re.DOTALL)
        
        if date_match and shares_match:
            shares = float(shares_match.group(1))
            price = float(price_match.group(1)) if price_match else 0
            
            buys.append({
                'trade_date': date_match.group(1),
                'shares': shares,
                'price': price,
                'total_value': shares * price,
            })
    
    if not buys:
        return None
    
    return {
        'insider_name': insider_name,
        'role': role,
        'ticker': ticker,
        'buys': buys,
    }


def main():
    print("=" * 80)
    print("SEC EDGAR FORM 4 — INSIDER BUY ANALYSIS (10-YEAR)")
    print(f"Target tickers: {len(TARGET_TICKERS)}")
    print("=" * 80)
    
    all_buys = []
    
    for ticker in TARGET_TICKERS:
        print(f"\n{ticker}: ", end='', flush=True)
        
        # Get CIK
        cik = get_cik(ticker)
        if not cik:
            print("CIK lookup FAILED")
            continue
        
        print(f"CIK={cik}", end=' ', flush=True)
        
        # Get Form 4 list
        form4s = fetch_form4_list(cik, max_filings=300)
        print(f"→ {len(form4s)} Form 4s", end=' ', flush=True)
        
        if not form4s:
            print()
            continue
        
        # Parse each Form 4 (limit to 50 per ticker for speed)
        buy_count = 0
        for f4 in form4s[:50]:
            parsed = parse_form4_buys(f4['url'])
            if parsed:
                for buy in parsed['buys']:
                    all_buys.append({
                        'ticker': parsed['ticker'] or ticker,
                        'insider_name': parsed['insider_name'],
                        'role': parsed['role'],
                        'trade_date': buy['trade_date'],
                        'shares': buy['shares'],
                        'price': buy['price'],
                        'total_value': buy['total_value'],
                        'filing_date': f4['filing_date'],
                        'source': 'sec_edgar',
                    })
                    buy_count += 1
        
        print(f"→ {buy_count} buys")
    
    print(f"\n\n{'='*80}")
    print(f"TOTAL SEC EDGAR BUYS: {len(all_buys)}")
    print(f"{'='*80}")
    
    # Show results
    if all_buys:
        # Group by ticker
        by_ticker = defaultdict(list)
        for b in all_buys:
            by_ticker[b['ticker']].append(b)
        
        for ticker, buys in sorted(by_ticker.items()):
            print(f"\n{ticker}: {len(buys)} buys")
            for b in sorted(buys, key=lambda x: x['trade_date'], reverse=True)[:5]:
                print(f"  {b['trade_date']} | {b['insider_name']} | {b['role']} | ${b['price']:.2f} x {b['shares']:.0f} = ${b['total_value']:,.0f}")
        
        # Save
        output = {
            'generated_at': datetime.now().isoformat(),
            'source': 'SEC EDGAR Form 4 XML',
            'total_buys': len(all_buys),
            'tickers': sorted(set(b['ticker'] for b in all_buys)),
            'buys': all_buys,
        }
        
        output_path = os.path.join(OUTPUT_DIR, 'sec_form4_buys.json')
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2, default=str)
        
        print(f"\n📁 Saved to: {output_path}")
    
    return all_buys


if __name__ == '__main__':
    main()
