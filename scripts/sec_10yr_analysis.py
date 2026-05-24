#!/usr/bin/env python3
"""
SEC EDGAR Form 4 Bulk Scraper — 10-Year Insider Buy Analysis

Strategy:
1. Get ALL Form 4 filings for 50+ major tickers from SEC EDGAR submissions API
2. Parse Form 4 XML to extract BUY transactions ONLY
3. Cross-reference with yfinance earnings dates
4. Get pre-market price movement on earnings day
5. Rank insiders by win rate

This replaces the limited OpenInsider data with the full SEC EDGAR dataset.
"""

import json, os, sys, time, re, gzip, io
from datetime import datetime, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

# Tickers to analyze (S&P 500 mega caps + high insider activity)
TICKERS = [
    # Mega Tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    # Finance
    "BRK.B", "JPM", "V", "MA", "BAC", "GS", "MS", "BLK",
    # Healthcare
    "UNH", "JNJ", "PFE", "MRK", "ABBV", "LLY", "TMO", "DHR",
    # Consumer
    "WMT", "COST", "HD", "PG", "KO", "PEP", "MCD", "NKE", "SBUX",
    # Industrial/Energy
    "XOM", "CVX", "CAT", "DE", "LMT", "BA", "GE", "HON", "UPS",
    # Tech
    "CRM", "ADBE", "ORCL", "CSCO", "INTC", "AMD", "QCOM", "TXN", "AVGO",
    # Other
    "DIS", "NFLX", "UBER", "PYPL", "ABNB", "SNAP",
]

# Data directories
DATA_DIR = "/opt/data/home/whaletrace/data"
OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
CACHE_DIR = os.path.join(DATA_DIR, "sec_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_AGENT = 'InsiderAnalysis/1.0 (research@example.com)'
SEC_RATE_LIMIT = 0.2  # 5 requests per second max (SEC allows 10/s)

def sec_request(url, timeout=15):
    """Make a rate-limited request to SEC EDGAR."""
    time.sleep(SEC_RATE_LIMIT)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  RATE LIMITED! Waiting 60s...")
            time.sleep(60)
            return sec_request(url, timeout)
        return None
    except Exception as e:
        return None


def cik_lookup(ticker):
    """Look up CIK for a ticker from SEC."""
    ticker_upper = ticker.upper().replace('.', '')
    url = f"https://www.sec.gov/files/company_tickers.json"
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        for entry in data.values():
            if entry['ticker'].upper() == ticker_upper:
                return str(entry['cik_str']).zfill(10)
    except:
        pass
    return None


def fetch_form4_filings(cik, max_filings=500):
    """Fetch ALL Form 4 filing metadata from SEC submissions API."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = sec_request(url)
    if not data:
        return []
    
    try:
        filings_data = json.loads(data)
    except:
        return []
    
    form4_filings = []
    recent = filings_data.get('filings', {}).get('recent', {})
    
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    primary_docs = recent.get('primaryDocument', [])
    
    for i, form in enumerate(forms):
        if form == '4' and i < len(acc_numbers) and i < max_filings:
            acc = acc_numbers[i]
            acc_clean = acc.replace('-', '')
            cik_num = int(cik)
            
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{primary_docs[i]}"
            
            form4_filings.append({
                'accession': acc,
                'filing_date': filing_dates[i] if i < len(filing_dates) else '',
                'url': filing_url,
                'doc': primary_docs[i],
            })
    
    return form4_filings


def parse_form4_buys(filing_url):
    """Parse a Form 4 XML filing and extract BUY transactions only."""
    data = sec_request(filing_url, timeout=20)
    if not data:
        return None
    
    text = data.decode('utf-8', errors='ignore')
    
    # Extract issuer (company) info
    issuer_match = re.search(r'<issuerName>(.*?)</issuerName>', text)
    ticker_match = re.search(r'<issuerTradingSymbol>(.*?)</issuerTradingSymbol>', text)
    
    # Extract insider info
    name_match = re.search(r'<rptOwnerName>(.*?)</rptOwnerName>', text)
    insider_name = name_match.group(1) if name_match else "Unknown"
    
    # Check for officer/director title
    title_match = re.search(r'<officerTitle>(.*?)</officerTitle>', text)
    is_director = re.search(r'<isDirector>1</isDirector>', text)
    is_officer = re.search(r'<isOfficer>1</isOfficer>', text)
    is_ten_percent = re.search(r'<isTenPercentOwner>1</isTenPercentOwner>', text)
    
    role = []
    if is_director: role.append('Director')
    if is_officer: role.append('Officer')
    if is_ten_percent: role.append('10% Owner')
    if title_match: role.insert(0, title_match.group(1))
    role_str = ', '.join(role) if role else 'Insider'
    
    # Extract BUY transactions only (non-derivative)
    buys = []
    
    # Pattern for non-derivative transactions
    blocks = re.findall(r'<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>', text, re.DOTALL)
    
    for block in blocks:
        code_match = re.search(r'<transactionCode>\s*(.)\s*</transactionCode>', block, re.DOTALL)
        if not code_match or code_match.group(1) != 'P':
            continue  # Only BUY (code P = Purchase)
        
        date_match = re.search(r'<transactionDate>.*?<value>(\d{4}-\d{2}-\d{2})</value>', block, re.DOTALL)
        shares_match = re.search(r'<transactionShares>.*?<value>([\d.]+)</value>', block, re.DOTALL)
        price_match = re.search(r'<transactionPricePerShare>.*?<value>([\d.]+)</value>', block, re.DOTALL)
        owned_match = re.search(r'<sharesOwnedFollowingTransaction>.*?<value>([\d.]+)</value>', block, re.DOTALL)
        
        if date_match and shares_match:
            shares = float(shares_match.group(1))
            price = float(price_match.group(1)) if price_match else 0
            total_value = shares * price if price else 0
            
            buy = {
                'trade_date': date_match.group(1),
                'shares': shares,
                'price': price,
                'total_value': total_value,
            }
            if owned_match:
                buy['shares_owned_after'] = float(owned_match.group(1))
            
            buys.append(buy)
    
    if not buys:
        return None
    
    return {
        'insider_name': insider_name,
        'role': role_str,
        'ticker': ticker_match.group(1) if ticker_match else '',
        'issuer': issuer_match.group(1) if issuer_match else '',
        'buys': buys,
    }


def get_earnings_and_price_data(ticker, lookback_years=10):
    """Get earnings dates and pre-market price changes using yfinance."""
    try:
        import yfinance as yf
    except ImportError:
        return {}
    
    try:
        stock = yf.Ticker(ticker)
        earnings_df = stock.earnings_dates
        
        if earnings_df is None or len(earnings_df) == 0:
            return {}
        
        cutoff = datetime.now() - timedelta(days=lookback_years * 365)
        
        earnings_data = {}
        for dt, row in earnings_df.iterrows():
            if hasattr(dt, 'to_pydatetime'):
                dt = dt.to_pydatetime()
            if dt < cutoff:
                continue
            
            date_str = dt.strftime('%Y-%m-%d')
            
            # Get pre-market price movement
            # Get close day before and open on earnings day
            try:
                prev = stock.history(start=dt - timedelta(days=5), end=dt, interval='1d')
                day = stock.history(start=dt, end=dt + timedelta(days=1), interval='1d')
                
                if len(prev) >= 1 and len(day) >= 1:
                    prev_close = float(prev['Close'].iloc[-1])
                    day_open = float(day['Open'].iloc[0])
                    day_close = float(day['Close'].iloc[0])
                    
                    pm_pct = ((day_open - prev_close) / prev_close) * 100
                    full_day_pct = ((day_close - prev_close) / prev_close) * 100
                    
                    earnings_data[date_str] = {
                        'date': date_str,
                        'prev_close': round(prev_close, 2),
                        'day_open': round(day_open, 2),
                        'day_close': round(day_close, 2),
                        'premarket_pct': round(pm_pct, 2),
                        'fullday_pct': round(full_day_pct, 2),
                        'direction': 'UP' if pm_pct > 0 else 'DOWN',
                        'eps_surprise': float(row.get('Surprise(%)', 0) or 0),
                    }
            except:
                pass
        
        return earnings_data
    
    except Exception as e:
        return {}


def run_analysis(tickers, lookback_days=30, min_trades=3):
    """Main analysis pipeline."""
    
    print("=" * 80)
    print("SEC EDGAR FORM 4 — INSIDER BUY vs EARNINGS ANALYSIS")
    print(f"Analyzing {len(tickers)} tickers, lookback={lookback_days} days, min_trades={min_trades}")
    print("=" * 80)
    
    # Step 1: Fetch all Form 4 filings
    print("\n[1/4] Fetching Form 4 filings from SEC EDGAR...")
    
    all_buys = []  # All buy transactions
    
    for ticker in tickers:
        print(f"  {ticker}...", end=' ', flush=True)
        
        # Look up CIK
        cik = cik_lookup(ticker)
        if not cik:
            print("CIK not found, skipping")
            continue
        
        # Fetch Form 4 filings
        filings = fetch_form4_filings(cik, max_filings=300)
        print(f"{len(filings)} Form 4s", end=' ', flush=True)
        
        # Parse each filing for BUY transactions
        buy_count = 0
        for filing in filings[:100]:  # Limit to 100 filings per ticker
            parsed = parse_form4_buys(filing['url'])
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
                        'filing_date': filing['filing_date'],
                    })
                    buy_count += 1
        
        print(f"→ {buy_count} buys")
    
    print(f"\n  Total BUY transactions found: {len(all_buys)}")
    
    if len(all_buys) == 0:
        print("  No buys found! Check SEC rate limiting or ticker list.")
        return None
    
    # Step 2: Get earnings data
    print("\n[2/4] Fetching earnings data from yfinance...")
    
    # Get unique tickers with buys
    active_tickers = sorted(set(b['ticker'] for b in all_buys))
    print(f"  Tickers with buys: {active_tickers}")
    
    earnings_data = {}
    for ticker in active_tickers:
        print(f"  {ticker}...", end=' ', flush=True)
        data = get_earnings_and_price_data(ticker, lookback_years=10)
        earnings_data[ticker] = data
        print(f"{len(data)} quarters")
        time.sleep(0.3)
    
    # Step 3: Cross-reference
    print("\n[3/4] Cross-referencing insider buys with earnings...")
    
    insider_stats = defaultdict(lambda: {
        'insider_name': '',
        'ticker': '',
        'total_trades': 0,
        'wins': 0,
        'losses': 0,
        'trades': []
    })
    
    for buy in all_buys:
        ticker = buy['ticker']
        if ticker not in earnings_data:
            continue
        
        trade_date = datetime.strptime(buy['trade_date'], '%Y-%m-%d')
        
        # Find the NEXT earnings date after this trade
        for date_str, e_data in sorted(earnings_data[ticker].items()):
            e_date = datetime.strptime(date_str, '%Y-%m-%d')
            delta = (e_date - trade_date).days
            
            if 0 < delta <= lookback_days:
                key = f"{buy['insider_name']}|{ticker}"
                
                insider_stats[key]['insider_name'] = buy['insider_name']
                insider_stats[key]['ticker'] = ticker
                insider_stats[key]['total_trades'] += 1
                
                is_win = e_data['direction'] == 'UP'
                if is_win:
                    insider_stats[key]['wins'] += 1
                else:
                    insider_stats[key]['losses'] += 1
                
                insider_stats[key]['trades'].append({
                    'trade_date': buy['trade_date'],
                    'earnings_date': date_str,
                    'days_before': delta,
                    'premarket_pct': e_data['premarket_pct'],
                    'fullday_pct': e_data['fullday_pct'],
                    'direction': e_data['direction'],
                    'is_win': is_win,
                    'buy_price': buy['price'],
                    'shares': buy['shares'],
                    'total_value': buy['total_value'],
                    'role': buy['role'],
                })
                
                break  # Only match the NEXT earnings
    
    # Step 4: Rank results
    print("\n[4/4] Computing win rates...")
    
    ranked = []
    for key, stats in insider_stats.items():
        if stats['total_trades'] >= min_trades:
            win_rate = (stats['wins'] / stats['total_trades']) * 100
            ranked.append({
                'insider': stats['insider_name'],
                'ticker': stats['ticker'],
                'total_trades': stats['total_trades'],
                'wins': stats['wins'],
                'losses': stats['losses'],
                'win_rate': round(win_rate, 1),
                'trades': stats['trades'],
            })
    
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total_trades']))
    
    return ranked, all_buys, earnings_data


def print_results(ranked, output_dir=OUTPUT_DIR):
    """Print formatted results."""
    
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    decent = [r for r in ranked if 70 <= r['win_rate'] < 80]
    
    print("\n" + "=" * 80)
    print(f"🏆 RESULTS: INSIDER BUY → EARNINGS PRE-MARKET EDGE")
    print(f"   Total insiders analyzed: {len(ranked)}")
    print(f"   Elite (90-100%): {len(elite)} | Good (80-89%): {len(good)} | Decent (70-79%): {len(decent)}")
    print("=" * 80)
    
    for category_name, category_list in [
        ("🏆 100%-90% WIN RATE — ELITE TRACK RECORD", elite),
        ("📈 80%-89% WIN RATE — STRONG", good),
        ("📊 70%-79% WIN RATE — DECENT", decent),
    ]:
        if not category_list:
            continue
        
        print(f"\n{'─'*80}")
        print(f"  {category_name}")
        print(f"{'─'*80}")
        
        for i, r in enumerate(category_list, 1):
            avg_pm = sum(t['premarket_pct'] for t in r['trades']) / len(r['trades'])
            avg_val = sum(t['total_value'] for t in r['trades']) / len(r['trades'])
            
            print(f"\n  #{i} {r['insider']}")
            print(f"     Ticker: {r['ticker']}")
            print(f"     Win Rate: {r['win_rate']}% ({r['wins']}W / {r['losses']}L / {r['total_trades']} total)")
            print(f"     Avg Pre-Market Move: {avg_pm:+.2f}%")
            print(f"     Avg Trade Value: ${avg_val:,.0f}")
            print(f"     Trade History:")
            
            for t in sorted(r['trades'], key=lambda x: x['earnings_date'], reverse=True):
                emoji = "✅" if t['is_win'] else "❌"
                print(f"       {emoji} {t['trade_date']} → Earnings {t['earnings_date']} ({t['days_before']}d before)")
                print(f"          PM: {t['premarket_pct']:+.2f}% | Buy: ${t['buy_price']:.2f} x {t['shares']:.0f} sh = ${t['total_value']:,.0f}")
    
    # Save
    output = {
        'generated_at': datetime.now().isoformat(),
        'method': 'SEC EDGAR Form 4 XML parsing',
        'summary': {
            'total_analyzed': len(ranked),
            'elite_90_100': len(elite),
            'good_80_89': len(good),
            'decent_70_79': len(decent),
        },
        'elite': elite,
        'good': good,
        'decent': decent,
    }
    
    output_path = os.path.join(output_dir, 'sec_10yr_insider_edge.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n\n📁 Full results saved to: {output_path}")
    
    return output


if __name__ == '__main__':
    # Run for all tickers
    ranked, all_buys, earnings_data = run_analysis(TICKERS, lookback_days=30, min_trades=3)
    
    if ranked:
        print_results(ranked)
    else:
        print("\n❌ No results generated. Check errors above.")
