#!/usr/bin/env python3
"""Incremental SEC EDGAR scraper — saves after each ticker to survive timeouts."""
import json, re, time, sys, os
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError

DATA_DIR = "/opt/data/home/whaletrace/data"
TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK.B","JPM","V",
           "UNH","XOM","WMT","JNJ","MA","PG","HD","BAC","DIS","CRM"]

TICKER_CIK = {
    "AAPL": "0000320193", "MSFT": "0000789019", "NVDA": "0001045810",
    "GOOGL": "0001652044", "AMZN": "0001018724", "META": "0001326801",
    "TSLA": "0001318605", "BRK.B": "0001067983", "JPM": "0000019617",
    "V": "0001403161", "UNH": "0000731766", "XOM": "0000034088",
    "WMT": "0000104169", "JNJ": "0000200406", "MA": "0001141391",
    "PG": "0000080424", "HD": "0000354950", "BAC": "0000070858",
    "DIS": "0001744489", "CRM": "0001108524",
}

now_utc = datetime.now(timezone.utc).isoformat()

def http_get(url, timeout=25):
    h = {'User-Agent': 'WhaleTrace/1.0 (night-shift@whaletrace.app)'}
    try:
        req = Request(url, headers=h)
        with urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        return 0, str(e)

def _tag(xml, tag):
    m = re.search(f'<{tag}>(.*?)</{tag}>', xml, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None

def _val(xml, tag):
    m = re.search(f'<{tag}>\\s*<value>(.*?)</value>', xml, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None

def extract_ticker_name(text):
    """Extract uppercase ticker symbols from security title for cross-holding detection."""
    # Match 1-5 char uppercase words, optionally with dot
    words = re.findall(r'\b([A-Z]{1,5}(?:\.[A-Z])?)\b', text)
    return words

# Load existing trades if any
existing_file = f"{DATA_DIR}/sec_insider_trades.json"
existing_trades = []
if os.path.exists(existing_file):
    try:
        with open(existing_file) as f:
            existing = json.load(f)
            if existing.get('count', 0) > 0:
                existing_trades = existing.get('trades', [])
                print(f"Loaded {len(existing_trades)} existing trades")
    except: pass

all_trades = list(existing_trades)
sec_success = 0
sec_fail = 0
MAX_FILINGS_PER_TICKER = 3  # Reduced from 5 to survive timeouts

print(f"SEC EDGAR Incremental Scraper — {len(TICKERS)} tickers, {MAX_FILINGS_PER_TICKER} filings each")
print(f"Started: {now_utc}")
sys.stdout.flush()

for ti, ticker in enumerate(TICKERS):
    cik = TICKER_CIK.get(ticker)
    if not cik:
        print(f"  [{ti+1}/20] FAIL {ticker}: no CIK")
        sec_fail += 1
        continue
    
    try:
        print(f"  [{ti+1}/20] {ticker}...", end=' ', flush=True)
        status, raw = http_get(f"https://data.sec.gov/submissions/CIK{cik}.json")
        if status != 200:
            print(f"FAIL (status {status})")
            sec_fail += 1
            time.sleep(0.5)
            continue
        
        body_match = re.search(r'<body>(.*?)</body>', raw, re.DOTALL)
        if body_match:
            raw = body_match.group(1)
        
        data = json.loads(raw)
        company_name = data.get("name", ticker)
        filings = data.get("filings", {}).get("recent", {})
        
        form_types = filings.get("form", [])
        accessions = filings.get("accessionNumber", [])
        filing_dates = filings.get("filingDate", [])
        
        form4_indices = [i for i, ft in enumerate(form_types) if ft == "4"][:MAX_FILINGS_PER_TICKER]
        
        if not form4_indices:
            print(f"SKIP (no Form 4)")
            time.sleep(0.5)
            continue
        
        ticker_trades = 0
        for idx in form4_indices:
            accession = accessions[idx]
            filing_date = filing_dates[idx]
            
            company_cik_num = cik.lstrip('0')
            acc_no_dash = accession.replace('-', '')
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik_num}/{acc_no_dash}/{accession}.txt"
            
            time.sleep(3.0)  # 3.0s minimum to avoid 429
            
            status2, text = http_get(filing_url)
            # Retry on 429
            if status2 == 429:
                sys.stderr.write(f" 429! ")
                sys.stderr.flush()
                time.sleep(90)
                status2, text = http_get(filing_url)
            if status2 != 200:
                continue
            
            text_lower = text.lower()
            xml_start = text_lower.find('<xml>')
            xml_end = text_lower.find('</xml>', xml_start)
            if xml_start < 0 or xml_end <= xml_start:
                continue
            
            xml = text[xml_start:xml_end + 6]
            
            insider_name = _tag(xml, 'rptOwnerName')
            issuer_name = _tag(xml, 'issuerName')
            issuer_ticker = _tag(xml, 'issuerTradingSymbol')
            is_director = _tag(xml, 'isDirector')
            is_officer = _tag(xml, 'isOfficer')
            is_ten_pct = _tag(xml, 'isTenPercentOwner')
            officer_title = _tag(xml, 'officerTitle')
            
            roles = []
            if is_director == '1': roles.append("Director")
            if is_officer == '1': roles.append("Officer")
            if is_ten_pct == '1': roles.append("10%+ Owner")
            role = " & ".join(roles) if roles else officer_title or "Insider"
            
            # Non-derivative
            nd_matches = re.findall(
                r'<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>',
                xml, re.DOTALL | re.IGNORECASE)
            
            for nd in nd_matches:
                code = _tag(nd, 'transactionCode')
                if code not in ('P', 'S', 'A', 'G', 'F'):
                    continue
                
                shares_str = _val(nd, 'transactionShares') or '0'
                price_str = _val(nd, 'transactionPricePerShare') or '0'
                trade_date = _val(nd, 'transactionDate')
                security = _val(nd, 'securityTitle') or 'Common Stock'
                shares_after = _val(nd, 'sharesOwnedFollowingTransaction')
                
                try: shares = float(shares_str.replace(',',''))
                except: shares = 0
                try: price = float(price_str.replace(',',''))
                except: price = 0
                
                # Cross-holding detection
                issuer_tck = (issuer_ticker or ticker).upper()
                sec_words = extract_ticker_name(security)
                known_tickers = set(TICKERS) | {'BRK.B','BRK'}
                cross_tickers = [w for w in sec_words if w in known_tickers and w != issuer_tck]
                is_cross = len(cross_tickers) > 0
                
                type_map = {'S':'SELL','P':'BUY','A':'GRANT','G':'GIFT','F':'TAX_WITHHOLDING'}
                
                all_trades.append({
                    "ticker": issuer_tck,
                    "company_name": issuer_name or company_name,
                    "insider_name": insider_name,
                    "role": role,
                    "filing_date": filing_date,
                    "filing_url": filing_url,
                    "transaction_date": trade_date,
                    "security": security,
                    "type": type_map.get(code, code),
                    "code": code,
                    "shares": shares,
                    "price": price,
                    "total_value": shares * price,
                    "shares_owned_after": shares_after,
                    "is_derivative": False,
                    "is_cross_holding": is_cross,
                })
                ticker_trades += 1
            
            # Derivative
            d_matches = re.findall(
                r'<derivativeTransaction>(.*?)</derivativeTransaction>',
                xml, re.DOTALL | re.IGNORECASE)
            
            for d in d_matches:
                code = _tag(d, 'transactionCode')
                if code not in ('M', 'A', 'F'):
                    continue
                
                shares_str = _val(d, 'transactionShares') or '0'
                price_str = _val(d, 'transactionPricePerShare') or '0'
                trade_date = _val(d, 'transactionDate')
                security = _val(d, 'underlyingSecurityTitle') or _val(d, 'securityTitle') or 'Common Stock'
                shares_after = _val(d, 'sharesOwnedFollowingTransaction')
                
                try: shares = float(shares_str.replace(',',''))
                except: shares = 0
                try: price = float(price_str.replace(',',''))
                except: price = 0
                
                type_map = {'M':'EXERCISE','A':'GRANT','F':'TAX_WITHHOLDING'}
                
                all_trades.append({
                    "ticker": (issuer_ticker or ticker).upper(),
                    "company_name": issuer_name or company_name,
                    "insider_name": insider_name,
                    "role": role,
                    "filing_date": filing_date,
                    "filing_url": filing_url,
                    "transaction_date": trade_date,
                    "security": security,
                    "type": type_map.get(code, code),
                    "code": code,
                    "shares": shares,
                    "price": price,
                    "total_value": shares * price,
                    "shares_owned_after": shares_after,
                    "is_derivative": True,
                    "is_cross_holding": False,
                })
                ticker_trades += 1
        
        if ticker_trades > 0:
            sec_success += 1
            print(f"OK ({ticker_trades} trades)")
        else:
            print(f"SKIP (0 parseable trades)")
        
    except Exception as e:
        print(f"FAIL: {e}")
        sec_fail += 1
    
    time.sleep(0.5)
    
    # Save incrementally after each ticker
    all_trades.sort(key=lambda t: (t.get('filing_date') or ''), reverse=True)
    buys = sum(1 for t in all_trades if t['code'] in ('P', 'M', 'A') and t['type'] in ('BUY','EXERCISE','GRANT'))
    sells = sum(1 for t in all_trades if t['code'] == 'S')
    
    sec_result = {
        "source": "SEC EDGAR Form 4 (raw .txt XML parsing)",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(all_trades),
        "buys": buys,
        "sells": sells,
        "tickers_scanned": len(TICKERS),
        "date_range": "pending",
        "trades": all_trades,
    }
    with open(existing_file, "w") as f:
        json.dump(sec_result, f, indent=2)
    sys.stdout.flush()

# Final save
dates = sorted(set(t.get('transaction_date') or t.get('filing_date','') for t in all_trades if t.get('filing_date')))
date_range = f"{dates[0]} to {dates[-1]}" if dates else "N/A"

print(f"\n{'='*60}")
print(f"SEC EDGAR: {len(all_trades)} trades ({buys} buys, {sells} sells) from {sec_success}/{len(TICKERS)} tickers")
print(f"Date range: {date_range}")
print(f"{'='*60}")
