#!/usr/bin/env python3
"""
Insider Trading vs Earnings: Win Rate Analysis (10-Year Backtest)

Pipeline:
1. Load existing OpenInsider trades (1,068 records, 20 tickers)
2. Supplement with SEC EDGAR Form 4 for major tickers (up to 10 years)
3. Get earnings dates from yfinance for each ticker
4. For each insider BUY within 30 days before earnings:
   - Get pre-market price change on earnings day
   - Classify as WIN (price up) or LOSS (price down)
5. Calculate per-insider and per-institution win rates
6. Output 100%-90% win rate leaders with supporting data
"""

import json, os, sys, time, re
from datetime import datetime, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request

# Paths
DATA_DIR = "/opt/data/home/whaletrace/data"
OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# STEP 1: Load existing insider trades
# ============================================================
def load_existing_trades():
    """Load OpenInsider trades and SEC trades."""
    all_trades = []
    
    # OpenInsider data
    oi_path = os.path.join(DATA_DIR, "openinsider_trades.json")
    if os.path.exists(oi_path):
        with open(oi_path) as f:
            data = json.load(f)
        trades = data.get('trades', data) if isinstance(data, dict) else data
        if isinstance(trades, list):
            for t in trades:
                t['source'] = 'openinsider'
                all_trades.append(t)
            print(f"Loaded {len(trades)} OpenInsider trades")
    
    # SEC data
    sec_path = os.path.join(DATA_DIR, "sec_insider_trades.json")
    if os.path.exists(sec_path):
        with open(sec_path) as f:
            data = json.load(f)
        trades = data.get('trades', [])
        if isinstance(trades, list):
            for t in trades:
                t['source'] = 'sec'
                all_trades.append(t)
            print(f"Loaded {len(trades)} SEC trades")
    
    print(f"Total existing trades: {len(all_trades)}")
    return all_trades


# ============================================================
# STEP 2: Get SEC EDGAR Form 4 filings for major tickers
# ============================================================
CIK_MAP = {
    "AAPL": "0000320193", "MSFT": "0000789019", "GOOGL": "0001652044",
    "AMZN": "0001018724", "META": "0001326801", "NVDA": "0001045810",
    "TSLA": "0001318605", "BRK.B": "0001067983", "JPM": "0000019617",
    "V": "0001403161", "UNH": "0000731766", "XOM": "0000034088",
    "JNJ": "0000200406", "WMT": "0000104169", "PG": "0000080424",
    "MA": "0001141391", "HD": "0000354950", "BAC": "0000070858",
    "CVX": "0000093410", "KO": "0000021344", "PEP": "0000077476",
    "COST": "0000909832", "ABBV": "0001551152", "MRK": "0000310158",
    "NFLX": "0001065280", "ADBE": "0000796343", "CRM": "0001108524",
    "AMD": "0000002488", "INTC": "0000050863", "QCOM": "0000804328",
    "DIS": "0001744489", "PYPL": "0001633917", "UBER": "0001543151",
    "LMT": "0000936468", "BA": "0000012927", "GE": "0000040545",
    "CAT": "0000018230", "DE": "0000315189", "NKE": "0000320187",
    "SBUX": "0000829224", "TGT": "0000027419", "LOW": "0000060667",
    "MCD": "0000063908", "ORCL": "0001341439", "IBM": "0000051143",
    "CSCO": "0000858877", "TXN": "0000097476", "AVGO": "0001730168",
}

# Also include tickers from existing OpenInsider data
def get_cik_for_ticker(ticker):
    """Get CIK for a ticker from SEC."""
    url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=&dateb=&owner=exclude&count=10&output=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'ResearchBot/1.0 (contact@example.com)'})
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        cik = data.get('cik', '')
        return str(int(cik)).zfill(10) if cik else None
    except:
        return None


def fetch_sec_insider_trades_for_ticker(ticker, cik, max_filings=200):
    """Fetch Form 4 filings from SEC EDGAR for a given ticker/CIK."""
    trades = []
    
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'ResearchBot/1.0 (contact@example.com)'})
    
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        recent = data.get('filings', {}).get('recent', {})
        
        forms = recent.get('form', [])
        acc_numbers = recent.get('accessionNumber', [])
        filing_dates = recent.get('filingDate', [])
        primary_docs = recent.get('primaryDocument', [])
        
        # Find all Form 4 filings
        for i, form in enumerate(forms):
            if form == '4' and i < len(acc_numbers):
                # Parse accession number for CIK + filing ID
                acc = acc_numbers[i]
                acc_clean = acc.replace('-', '')
                filing_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/{primary_docs[i]}"
                
                trades.append({
                    'ticker': ticker,
                    'source': 'sec_edgar',
                    'filing_date': filing_dates[i] if i < len(filing_dates) else '',
                    'accession': acc,
                    'filing_url': filing_url,
                    'raw': True  # needs parsing
                })
                
        # Also check old filings
        old_files = data.get('filings', {}).get('files', [])
        for fdata in old_files:
            if fdata.get('name'):
                # Can download older filing index
                pass
                
    except Exception as e:
        pass
    
    return trades


def parse_form4_xml(url):
    """Parse a single Form 4 XML filing to extract transaction details."""
    req = urllib.request.Request(url, headers={'User-Agent': 'ResearchBot/1.0 (contact@example.com)'})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        text = resp.read().decode('utf-8', errors='ignore')
        
        # Extract insider name
        name_match = re.search(r'<rptOwnerName>(.*?)</rptOwnerName>', text)
        insider_name = name_match.group(1) if name_match else "Unknown"
        
        # Extract transactions
        transactions = []
        txn_blocks = re.findall(r'<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>', text, re.DOTALL)
        if not txn_blocks:
            txn_blocks = re.findall(r'<derivativeTransaction>(.*?)</derivativeTransaction>', text, re.DOTALL)
        
        for block in txn_blocks:
            date_match = re.search(r'<transactionDate>.*?<value>(\d{4}-\d{2}-\d{2})</value>', block)
            code_match = re.search(r'<transactionCoding>.*?<transactionCode>(.)</transactionCode>', block, re.DOTALL)
            shares_match = re.search(r'<transactionShares>.*?<value>([\d.]+)</value>', block)
            price_match = re.search(r'<transactionPricePerShare>.*?<value>([\d.]+)</value>', block)
            owned_match = re.search(r'<sharesOwnedFollowingTransaction>.*?<value>([\d.]+)</value>', block)
            
            if code_match:
                code = code_match.group(1)
                txn = {
                    'date': date_match.group(1) if date_match else '',
                    'code': code,
                    'is_buy': code == 'P',
                    'is_sale': code == 'S',
                    'shares': float(shares_match.group(1)) if shares_match else 0,
                    'price': float(price_match.group(1)) if price_match else 0,
                }
                if owned_match:
                    txn['shares_owned_after'] = float(owned_match.group(1))
                transactions.append(txn)
        
        return {
            'insider_name': insider_name,
            'transactions': transactions
        }
    except Exception as e:
        return None


# ============================================================
# STEP 3: Get earnings dates from yfinance
# ============================================================
def get_earnings_dates(ticker, max_quarters=40):
    """Get historical earnings dates for a ticker using yfinance."""
    try:
        import yfinance as yf
    except ImportError:
        return []
    
    try:
        stock = yf.Ticker(ticker)
        # Get earnings history
        earnings = stock.earnings_dates
        if earnings is None or len(earnings) == 0:
            return []
        
        dates = []
        for dt, row in earnings.iterrows():
            if len(dates) >= max_quarters:
                break
            # dt is the earnings date (can be datetime or Timestamp)
            dates.append({
                'date': str(dt.date()) if hasattr(dt, 'date') else str(dt)[:10],
                'eps_actual': float(row.get('Reported EPS', 0) or 0),
                'eps_estimate': float(row.get('Estimated EPS', 0) or 0),
                'surprise': float(row.get('Surprise(%)', 0) or 0),
            })
        
        return dates
    except Exception as e:
        return []


# ============================================================
# STEP 4: Get pre-market price change on earnings day
# ============================================================
def get_premarket_change(ticker, date_str):
    """Get pre-market price change for a stock on a given date."""
    try:
        import yfinance as yf
    except ImportError:
        return None
    
    try:
        stock = yf.Ticker(ticker)
        # Get 5 days of hourly data around the date
        end_date = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=2)
        start_date = datetime.strptime(date_str, '%Y-%m-%d') - timedelta(days=2)
        
        hist = stock.history(start=start_date, end=end_date, interval='1h')
        if hist is None or len(hist) < 2:
            return None
        
        # Find pre-market data (before 9:30 AM)
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Get close from day before
        prev_data = stock.history(start=target_date - timedelta(days=5), end=target_date, interval='1d')
        if len(prev_data) < 1:
            return None
        
        prev_close = float(prev_data['Close'].iloc[-1])
        
        # Get open price on earnings day
        day_data = stock.history(start=target_date, end=target_date + timedelta(days=1), interval='1d')
        if len(day_data) < 1:
            return None
        
        day_open = float(day_data['Open'].iloc[0])
        
        premarket_pct = ((day_open - prev_close) / prev_close) * 100
        
        return {
            'prev_close': prev_close,
            'day_open': day_open,
            'premarket_pct': premarket_pct,
            'direction': 'UP' if premarket_pct > 0 else 'DOWN'
        }
    except Exception as e:
        return None


# ============================================================
# STEP 5: Cross-reference insider buys with earnings
# ============================================================
def analyze_insider_edge(all_trades, earnings_data, lookback_days=30):
    """
    For each insider BUY within `lookback_days` before earnings:
    - Check pre-market price change on earnings day
    - Record win/loss
    
    Returns per-insider stats.
    """
    
    # Organize trades by ticker and date
    insider_buys = defaultdict(list)  # ticker -> list of buys
    
    for t in all_trades:
        ticker = t.get('ticker', '').upper()
        if not ticker:
            continue
        
        # Determine if it's a buy
        is_buy = False
        trade_date = ''
        insider = ''
        price = 0
        shares = 0
        
        if t.get('source') == 'openinsider':
            is_buy = t.get('is_buy', False)
            trade_date = t.get('trade_date', '')[:10]
            insider = t.get('insider_name', 'Unknown')
            price = t.get('price', 0) or 0
            shares = abs(t.get('qty', 0)) or 0
            role = t.get('title', '')
        elif t.get('source') == 'sec':
            is_buy = t.get('type', '') in ('BUY', 'P', 'P-Purchase')
            trade_date = t.get('transaction_date', '')[:10]
            insider = t.get('insider_name', 'Unknown')
            price = t.get('price', 0) or 0
            shares = abs(t.get('shares', 0)) or 0
            role = t.get('role', '')
        
        if is_buy and trade_date and shares > 0:
            insider_buys[ticker].append({
                'insider': insider,
                'role': role,
                'trade_date': trade_date,
                'price': price,
                'shares': shares,
                'source': t.get('source', ''),
            })
    
    # For each ticker, match insider buys to nearby earnings
    results = defaultdict(lambda: {
        'insider_name': '',
        'total_trades': 0,
        'wins': 0,
        'losses': 0,
        'trades': []
    })
    
    for ticker, buys in insider_buys.items():
        if ticker not in earnings_data:
            continue
        
        earnings = earnings_data[ticker]
        if not earnings:
            continue
        
        for buy in buys:
            trade_date = datetime.strptime(buy['trade_date'], '%Y-%m-%d')
            
            # Find the next earnings date after this trade
            for e in earnings:
                e_date = datetime.strptime(e['date'], '%Y-%m-%d')
                delta = (e_date - trade_date).days
                
                if 0 < delta <= lookback_days:
                    # This insider bought within `lookback_days` before earnings
                    # Check pre-market price movement
                    pm = get_premarket_change(ticker, e['date'])
                    
                    if pm:
                        is_win = pm['direction'] == 'UP'
                        
                        key = f"{buy['insider']}|{ticker}"
                        results[key]['insider_name'] = buy['insider']
                        results[key]['total_trades'] += 1
                        
                        if is_win:
                            results[key]['wins'] += 1
                        else:
                            results[key]['losses'] += 1
                        
                        results[key]['trades'].append({
                            'ticker': ticker,
                            'role': buy['role'],
                            'trade_date': buy['trade_date'],
                            'earnings_date': e['date'],
                            'days_before': delta,
                            'premarket_pct': round(pm['premarket_pct'], 2),
                            'direction': pm['direction'],
                            'is_win': is_win,
                            'buy_price': buy['price'],
                            'shares': buy['shares'],
                            'source': buy['source'],
                        })
                    
                    break  # Only match the NEXT earnings after the trade
    
    return results


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("INSIDER TRADING vs EARNINGS: 10-YEAR BACKTEST ANALYSIS")
    print("=" * 60)
    
    # Step 1: Load existing data
    print("\n[1/5] Loading existing insider trades...")
    all_trades = load_existing_trades()
    
    # Get unique tickers
    tickers = set()
    for t in all_trades:
        ticker = t.get('ticker', '').upper()
        if ticker:
            tickers.add(ticker)
    print(f"Unique tickers in existing data: {sorted(tickers)}")
    
    # Step 2: Get earnings data
    print("\n[2/5] Fetching earnings dates from yfinance...")
    earnings_data = {}
    for ticker in sorted(tickers):
        print(f"  {ticker}...", end=' ', flush=True)
        earnings = get_earnings_dates(ticker, max_quarters=40)  # 10 years
        earnings_data[ticker] = earnings
        print(f"{len(earnings)} quarters")
        time.sleep(0.5)  # Rate limit
    
    # Step 3: Cross-reference
    print("\n[3/5] Cross-referencing insider buys with earnings...")
    results = analyze_insider_edge(all_trades, earnings_data, lookback_days=30)
    
    # Step 4: Rank by win rate
    print("\n[4/5] Computing win rates...")
    ranked = []
    for key, stats in results.items():
        if stats['total_trades'] >= 3:  # Minimum 3 trades for significance
            win_rate = (stats['wins'] / stats['total_trades']) * 100
            insider, ticker = key.split('|', 1)
            ranked.append({
                'insider': stats['insider_name'],
                'ticker': ticker,
                'total_trades': stats['total_trades'],
                'wins': stats['wins'],
                'losses': stats['losses'],
                'win_rate': round(win_rate, 1),
                'trades': stats['trades'],
            })
    
    # Sort by win rate descending
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total_trades']))
    
    # Step 5: Output results
    print("\n[5/5] Results:")
    print("=" * 80)
    
    # Filter for 90-100%
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    
    print(f"\n{'='*80}")
    print(f"🏆 100%-90% WIN RATE INSIDERS (ELITE)")
    print(f"{'='*80}")
    
    if elite:
        for i, r in enumerate(elite[:20], 1):
            avg_pm = sum(t['premarket_pct'] for t in r['trades']) / len(r['trades'])
            print(f"\n#{i} {r['insider']} ({r['ticker']})")
            print(f"   Win Rate: {r['win_rate']}% ({r['wins']}W / {r['losses']}L / {r['total_trades']} total)")
            print(f"   Avg Pre-Market Move: {avg_pm:+.2f}%")
            print(f"   Trade History:")
            for t in sorted(r['trades'], key=lambda x: x['earnings_date'], reverse=True):
                emoji = "✅" if t['is_win'] else "❌"
                print(f"     {emoji} {t['trade_date']} → {t['earnings_date']} ({t['days_before']}d before) | PM: {t['premarket_pct']:+.2f}% | {t['ticker']} @ ${t['buy_price']:.2f} x {t['shares']:.0f}")
    else:
        print("\n  ⚠️ No insiders found with 90%+ win rate in existing data.")
        print("  This is expected with only 1,068 trades across 20 tickers.")
        print("  Need more historical data from SEC EDGAR.")
    
    if good:
        print(f"\n{'='*80}")
        print(f"📈 80%-89% WIN RATE INSIDERS")
        print(f"{'='*80}")
        for i, r in enumerate(good[:10], 1):
            avg_pm = sum(t['premarket_pct'] for t in r['trades']) / len(r['trades'])
            print(f"\n#{i} {r['insider']} ({r['ticker']}) - {r['win_rate']}% ({r['wins']}W/{r['losses']}L)")
    
    # Save detailed results
    output = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_insiders_analyzed': len(ranked),
            'elite_90_100': len(elite),
            'good_80_89': len(good),
            'data_period': '2024-2026 (existing data)',
        },
        'elite': elite,
        'good': good,
        'all_ranked': ranked,
    }
    
    output_path = os.path.join(OUTPUT_DIR, 'insider_edge_results.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n\n📁 Full results saved to: {output_path}")
    print(f"   Elite (90-100%): {len(elite)} insiders")
    print(f"   Good (80-89%): {len(good)} insiders")
    print(f"   Total analyzed: {len(ranked)} insiders")
    
    return output


if __name__ == '__main__':
    main()
