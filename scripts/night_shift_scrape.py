#!/usr/bin/env python3
"""Night Shift: Scrape Finviz + SEC EDGAR + yfinance for WhaleTrace."""
import json, re, time, sys
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

def http_get(url, timeout=20):
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

# ─── PART 1: Finviz ───
print("="*60)
print("PART 1: Finviz Institution Ownership")
print("="*60)

from scrapling.fetchers import Fetcher

finviz_data = {}
finviz_success = 0
finviz_fail = 0

for ticker in TICKERS:
    try:
        url = f"https://finviz.com/quote.ashx?t={ticker}"
        page = Fetcher.get(url, stealthy_headers=True)
        text = str(page.css('body').get())
        
        def extract_val(label, default=0.0):
            pat = rf'{re.escape(label)}</(?:div|a)></td>\s*<td[^>]*>\s*<div[^>]*>\s*(?:<a[^>]*>)?\s*(?:<b>)?\s*(?:<span[^>]*>)?\s*([\d.,]+[%BMK]?)'
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).replace(',','')
                if val.endswith('%'): return float(val[:-1])
                if val.endswith('B'): return float(val[:-1])*1e9
                if val.endswith('M'): return float(val[:-1])*1e6
                if val.endswith('K'): return float(val[:-1])*1e3
                try: return float(val)
                except: pass
            return default
        
        inst_own = extract_val('Inst Own')
        insider_own = extract_val('Insider Own')
        insider_trans = extract_val('Insider Trans')
        short_float = extract_val('Short Float')
        short_ratio = extract_val('Short Ratio')
        market_cap = extract_val('Market Cap')
        
        shares_out = 0.0
        m = re.search(r'Shs Outstand</div></td>\s*<td[^>]*>\s*<div[^>]*>\s*<b>\s*([\d.,]+[BM]?)', text)
        if m:
            val = m.group(1).replace(',','')
            if 'B' in val: shares_out = float(val.replace('B','')) * 1e9
            elif 'M' in val: shares_out = float(val.replace('M','')) * 1e6
            else: shares_out = float(val)
        
        shares_float = 0.0
        m = re.search(r'Shs Float</div></td>\s*<td[^>]*>\s*<div[^>]*>\s*<b>\s*([\d.,]+[BM]?)', text)
        if m:
            val = m.group(1).replace(',','')
            if 'B' in val: shares_float = float(val.replace('B','')) * 1e9
            elif 'M' in val: shares_float = float(val.replace('M','')) * 1e6
            else: shares_float = float(val)
        
        finviz_data[ticker] = {
            "inst_own_pct": inst_own,
            "insider_own_pct": insider_own,
            "insider_trans_pct": insider_trans,
            "short_float_pct": short_float,
            "short_ratio": short_ratio,
            "market_cap": market_cap,
            "shares_outstanding": shares_out,
            "shares_float": shares_float,
            "ticker": ticker,
        }
        finviz_success += 1
        print(f"  OK {ticker}: Inst={inst_own}%, Insider={insider_own}%, Short={short_float}%")
    except Exception as e:
        finviz_fail += 1
        print(f"  FAIL {ticker}: {e}")
    time.sleep(0.5)

finviz_result = {
    "source": "Finviz",
    "scraped_at": now_utc,
    "tickers_scraped": len(TICKERS),
    "tickers_successful": finviz_success,
    "tickers_failed": finviz_fail,
    "data": finviz_data,
}
with open(f"{DATA_DIR}/finviz_institutions.json", "w") as f:
    json.dump(finviz_result, f, indent=2)
print(f"\nFinviz: {finviz_success}/{len(TICKERS)} successful\n")
sys.stdout.flush()

# ─── PART 2: SEC EDGAR ───
print("="*60)
print("PART 2: SEC EDGAR Insider Trades")
print("="*60)

all_trades = []
sec_success = 0
sec_fail = 0

for ticker in TICKERS:
    cik = TICKER_CIK.get(ticker)
    if not cik:
        print(f"  FAIL {ticker}: no CIK")
        sec_fail += 1
        continue
    
    try:
        status, raw = http_get(f"https://data.sec.gov/submissions/CIK{cik}.json")
        if status != 200:
            print(f"  FAIL {ticker}: status {status}")
            sec_fail += 1
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
        
        form4_indices = [i for i, ft in enumerate(form_types) if ft == "4"][:5]
        
        if not form4_indices:
            print(f"  SKIP {ticker}: no Form 4")
            continue
        
        ticker_trades = 0
        for idx in form4_indices:
            accession = accessions[idx]
            filing_date = filing_dates[idx]
            
            company_cik_num = cik.lstrip('0')
            acc_no_dash = accession.replace('-', '')
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik_num}/{acc_no_dash}/{accession}.txt"
            
            time.sleep(2.0)  # SEC rate limit: 2.0s minimum per raw filing fetch
            
            status2, text = http_get(filing_url)
            # Retry on 429 with 60s backoff
            if status2 == 429:
                print(f"    ⚠️  429 rate limited, waiting 60s...")
                time.sleep(60)
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
                
                type_map = {'S':'SELL','P':'BUY','A':'GRANT','G':'GIFT','F':'TAX_WITHHOLDING'}
                
                all_trades.append({
                    "ticker": issuer_ticker or ticker,
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
                    "ticker": issuer_ticker or ticker,
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
                })
                ticker_trades += 1
        
        if ticker_trades > 0:
            sec_success += 1
            print(f"  OK {ticker} ({company_name}): {ticker_trades} trades from {len(form4_indices)} filings")
        else:
            print(f"  SKIP {ticker}: no parseable trades in {len(form4_indices)} filings")
        
    except Exception as e:
        print(f"  FAIL {ticker}: {e}")
        sec_fail += 1
    
    time.sleep(0.5)  # 0.5s between submissions API calls

all_trades.sort(key=lambda t: (t.get('filing_date') or ''), reverse=True)

buys = sum(1 for t in all_trades if t['code'] in ('P', 'M'))
sells = sum(1 for t in all_trades if t['code'] == 'S')
dates = sorted(set(t.get('transaction_date') or t.get('filing_date','') for t in all_trades if t.get('filing_date')))
date_range = f"{dates[0]} to {dates[-1]}" if dates else "N/A"

sec_result = {
    "source": "SEC EDGAR Form 4 (raw .txt XML parsing)",
    "scraped_at": now_utc,
    "count": len(all_trades),
    "buys": buys,
    "sells": sells,
    "tickers_scanned": len(TICKERS),
    "date_range": date_range,
    "trades": all_trades,
}
with open(f"{DATA_DIR}/sec_insider_trades.json", "w") as f:
    json.dump(sec_result, f, indent=2)

print(f"\nSEC EDGAR: {len(all_trades)} trades ({buys} buys, {sells} sells) from {sec_success} tickers\n")
sys.stdout.flush()

# ─── PART 3: yfinance ───
print("="*60)
print("PART 3: yfinance Institution Holdings")
print("="*60)

import yfinance as yf

all_holdings = []
yh_success = 0
yh_fail = 0

for ticker in TICKERS:
    try:
        tk = yf.Ticker(ticker)
        holders = tk.institutional_holders
        
        if holders is not None and len(holders) > 0:
            top10 = holders.head(10)
            for _, row in top10.iterrows():
                all_holdings.append({
                    "ticker": ticker,
                    "holder": str(row.get("Holder", "")),
                    "shares": float(row.get("Shares", 0)) if row.get("Shares") is not None else 0,
                    "date_reported": str(row.get("Date Reported", "")),
                    "pct_out": float(row.get("% Out", 0)) if row.get("% Out") is not None else 0,
                    "value": float(row.get("Value", 0)) if row.get("Value") is not None else 0,
                })
            yh_success += 1
            print(f"  OK {ticker}: {len(top10)} holders")
        else:
            print(f"  SKIP {ticker}: no holders")
            yh_fail += 1
    except Exception as e:
        print(f"  FAIL {ticker}: {e}")
        yh_fail += 1

yh_result = {
    "source": "yfinance institutional_holders",
    "scraped_at": now_utc,
    "total_records": len(all_holdings),
    "tickers_scanned": len(TICKERS),
    "tickers_with_data": yh_success,
    "tickers_without_data": yh_fail,
    "data": all_holdings,
}
with open(f"{DATA_DIR}/institution_holdings.json", "w") as f:
    json.dump(yh_result, f, indent=2)

print(f"\nyfinance: {len(all_holdings)} records from {yh_success} tickers\n")

# ─── PART 4: Summary ───
summary = {
    "last_updated": now_utc,
    "files": {
        "finviz_institutions": {
            "source": "finviz.com (Scrapling stealthy_headers)",
            "tickers": len(TICKERS),
            "successful": finviz_success,
            "failed": finviz_fail,
        },
        "sec_insider_trades": {
            "source": "SEC EDGAR Form 4 (raw .txt XML parsing)",
            "trades": len(all_trades),
            "buys": buys,
            "sells": sells,
            "tickers_scanned": len(TICKERS),
            "date_range": date_range,
        },
        "institution_holdings": {
            "source": "yfinance institutional_holders",
            "total_records": len(all_holdings),
            "tickers": yh_success,
        },
    },
    "camofox_note": "Not available: server lacks libgtk-3.so.0. Used Scrapling stealthy_headers for Finviz (Cloudflare bypass successful). OpenInsider skipped (requires JS execution).",
}
with open(f"{DATA_DIR}/data_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

print("="*60)
print("ALL DONE")
print(f"Finviz: {finviz_success}/{len(TICKERS)}")
print(f"SEC EDGAR: {len(all_trades)} trades ({buys} buy, {sells} sell)")
print(f"yfinance: {len(all_holdings)} holdings ({yh_success} tickers)")
print("="*60)
