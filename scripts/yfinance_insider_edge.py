#!/usr/bin/env python3
"""
Insider BUY → Earnings Pre-Market Edge Analysis
Uses yfinance insider_transactions (Text column to identify buys)
+ earnings_dates for backtesting

Data sources:
- yfinance: insider transactions + earnings dates + price data
- OpenInsider (existing): supplemental buy data with correct classification
"""

import json, os, time
from datetime import datetime, timedelta
from collections import defaultdict
import yfinance as yf
import pandas as pd

# 50+ major US stocks
TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "BLK",
    "UNH", "JNJ", "PFE", "MRK", "ABBV", "LLY", "TMO",
    "WMT", "COST", "HD", "PG", "KO", "PEP", "MCD", "NKE", "SBUX",
    "XOM", "CVX", "CAT", "DE", "LMT", "BA", "GE", "HON", "UPS",
    "CRM", "ADBE", "ORCL", "CSCO", "INTC", "AMD", "QCOM", "TXN", "AVGO",
    "DIS", "NFLX", "UBER", "PYPL", "ABNB",
]

OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def is_buy_transaction(text):
    """Determine if an insider transaction is a BUY based on the Text description."""
    if not text or not isinstance(text, str):
        return False
    
    text_lower = text.lower()
    
    # Keywords that indicate a BUY
    buy_keywords = ['purchase', 'buy', 'bought', 'acquired', 'acquisition']
    # Keywords that indicate NOT a buy
    not_buy = ['sale', 'sell', 'sold', 'gift', 'grant', 'award', 'exercise', 
               'option', 'exchange', 'conversion', 'redemption', 'tender',
               'disposed', 'disposition', 'expire', 'withholding', 'tax']
    
    # Check for NOT buy first
    for kw in not_buy:
        if kw in text_lower:
            return False
    
    # Then check for buy
    for kw in buy_keywords:
        if kw in text_lower:
            return True
    
    return False


def fetch_insider_buys(ticker):
    """Fetch insider BUY transactions for a ticker using yfinance."""
    try:
        stock = yf.Ticker(ticker)
        ins = stock.insider_transactions
        
        if ins is None or len(ins) == 0:
            return []
        
        buys = []
        for _, row in ins.iterrows():
            text = str(row.get('Text', '') or '')
            
            if is_buy_transaction(text):
                # Extract price from text: "Purchase at price 290.00 per share."
                import re
                price_match = re.search(r'at price \$?([\d,.]+)', text)
                price = float(price_match.group(1).replace(',', '')) if price_match else 0
                
                buys.append({
                    'ticker': ticker,
                    'insider_name': str(row.get('Insider', 'Unknown')),
                    'position': str(row.get('Position', '')),
                    'shares': int(row.get('Shares', 0)),
                    'price': price,
                    'value': float(row.get('Value', 0) or 0),
                    'trade_date': str(row.get('Start Date', ''))[:10],
                    'description': text,
                })
        
        return buys
    
    except Exception as e:
        return []


def fetch_earnings_with_premarket(ticker, lookback_years=10):
    """Fetch earnings dates with pre-market price change calculation."""
    try:
        stock = yf.Ticker(ticker)
        earnings = stock.earnings_dates
        
        if earnings is None or len(earnings) == 0:
            return {}
        
        cutoff = datetime.now() - timedelta(days=lookback_years * 365)
        earnings_data = {}
        
        for dt, row in earnings.iterrows():
            if hasattr(dt, 'to_pydatetime'):
                dt = dt.to_pydatetime()
            if dt.tzinfo:
                dt = dt.replace(tzinfo=None)
            if dt < cutoff:
                continue
            
            date_str = dt.strftime('%Y-%m-%d')
            
            # Get pre-market price change
            try:
                prev = stock.history(start=dt - timedelta(days=5), end=dt, interval='1d')
                day = stock.history(start=dt, end=dt + timedelta(days=1), interval='1d')
                
                if len(prev) >= 1 and len(day) >= 1:
                    prev_close = float(prev['Close'].iloc[-1])
                    day_open = float(day['Open'].iloc[0])
                    day_close = float(day['Close'].iloc[0])
                    
                    pm_pct = ((day_open - prev_close) / prev_close) * 100
                    full_pct = ((day_close - prev_close) / prev_close) * 100
                    
                    earnings_data[date_str] = {
                        'date': date_str,
                        'prev_close': round(prev_close, 2),
                        'day_open': round(day_open, 2),
                        'day_close': round(day_close, 2),
                        'premarket_pct': round(pm_pct, 2),
                        'fullday_pct': round(full_pct, 2),
                        'direction': 'UP' if pm_pct > 0 else 'DOWN',
                        'eps_surprise': float(row.get('Surprise(%)', 0) or 0),
                    }
            except:
                pass
        
        return earnings_data
    
    except Exception as e:
        return {}


def load_openinsider_buys():
    """Load buy trades from existing OpenInsider data."""
    path = "/opt/data/home/whaletrace/data/openinsider_trades.json"
    if not os.path.exists(path):
        return []
    
    with open(path) as f:
        data = json.load(f)
    
    trades = data.get('trades', data) if isinstance(data, dict) else data
    if not isinstance(trades, list):
        return []
    
    buys = []
    for t in trades:
        if t.get('is_buy'):
            buys.append({
                'ticker': t.get('ticker', '').upper(),
                'insider_name': t.get('insider_name', 'Unknown'),
                'position': t.get('title', ''),
                'shares': abs(int(t.get('qty', 0))),
                'price': float(t.get('price', 0) or 0),
                'value': abs(float(t.get('qty', 0) or 0)) * float(t.get('price', 0) or 0),
                'trade_date': str(t.get('trade_date', ''))[:10],
                'description': f"OpenInsider: {t.get('trade_type', '')}",
            })
    
    return buys


def cross_reference(all_buys, earnings_data, lookback_days=60, min_trades=3):
    """Cross-reference insider buys with earnings pre-market movements."""
    
    insider_stats = defaultdict(lambda: {
        'insider_name': '',
        'positions': set(),
        'tickers': set(),
        'total_trades': 0,
        'wins': 0,
        'losses': 0,
        'trades': []
    })
    
    matched = 0
    unmatched = 0
    
    for buy in all_buys:
        ticker = buy['ticker'].replace('.', '-')
        if ticker not in earnings_data:
            unmatched += 1
            continue
        
        try:
            trade_date = datetime.strptime(buy['trade_date'], '%Y-%m-%d')
        except:
            unmatched += 1
            continue
        
        # Find the NEXT earnings date after this trade
        best_match = None
        best_delta = 999
        
        for date_str, e_data in sorted(earnings_data[ticker].items()):
            try:
                e_date = datetime.strptime(date_str, '%Y-%m-%d')
            except:
                continue
            
            delta = (e_date - trade_date).days
            
            if 0 < delta <= lookback_days and delta < best_delta:
                best_match = (date_str, e_data, delta)
                best_delta = delta
        
        if not best_match:
            # Check if there's an earnings event on the SAME day
            for date_str, e_data in sorted(earnings_data[ticker].items()):
                try:
                    e_date = datetime.strptime(date_str, '%Y-%m-%d')
                except:
                    continue
                if e_date.date() == trade_date.date():
                    best_match = (date_str, e_data, 0)
                    break
            
            if not best_match:
                unmatched += 1
                continue
        
        date_str, e_data, delta = best_match
        matched += 1
        
        # Create insider key
        key = f"{buy['insider_name']}|{ticker}"
        
        insider_stats[key]['insider_name'] = buy['insider_name']
        insider_stats[key]['positions'].add(buy['position'])
        insider_stats[key]['tickers'].add(ticker)
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
            'value': buy['value'],
            'position': buy['position'],
            'description': buy['description'],
        })
    
    print(f"  Matched: {matched}, Unmatched: {unmatched}")
    
    # Rank by win rate
    ranked = []
    for key, stats in insider_stats.items():
        if stats['total_trades'] >= min_trades:
            win_rate = (stats['wins'] / stats['total_trades']) * 100
            ranked.append({
                'insider': stats['insider_name'],
                'tickers': sorted(stats['tickers']),
                'positions': sorted(stats['positions']),
                'total_trades': stats['total_trades'],
                'wins': stats['wins'],
                'losses': stats['losses'],
                'win_rate': round(win_rate, 1),
                'trades': stats['trades'],
            })
    
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total_trades']))
    
    return ranked


def main():
    print("=" * 80)
    print("INSIDER BUY → EARNINGS PRE-MARKET EDGE (10-YEAR BACKTEST)")
    print(f"Analyzing {len(TICKERS)} tickers")
    print("=" * 80)
    
    # Step 1: Fetch insider buys from yfinance
    print("\n[1/3] Fetching insider BUY transactions from yfinance...")
    
    all_buys = []
    for ticker in TICKERS:
        buys = fetch_insider_buys(ticker)
        if buys:
            all_buys.extend(buys)
            # Show notable buys
            big_buys = [b for b in buys if b['value'] > 1000000]
            if big_buys:
                for b in big_buys[:3]:
                    print(f"  💰 {ticker}: {b['insider_name']} bought ${b['value']:,.0f} on {b['trade_date']}")
        time.sleep(0.2)
    
    print(f"\n  Total yfinance buys: {len(all_buys)}")
    
    # Add OpenInsider buys
    oi_buys = load_openinsider_buys()
    print(f"  OpenInsider buys: {len(oi_buys)}")
    
    # Combine, deduplicate
    seen = set()
    combined = []
    for b in all_buys + oi_buys:
        key = f"{b['ticker']}|{b['insider_name']}|{b['trade_date']}|{b['shares']}"
        if key not in seen:
            seen.add(key)
            combined.append(b)
    
    print(f"  Combined unique buys: {len(combined)}")
    
    # Show tickers with buys
    buy_tickers = set(b['ticker'].replace('.', '-') for b in combined)
    print(f"  Tickers with buys: {sorted(buy_tickers)}")
    
    # Step 2: Fetch earnings data
    print("\n[2/3] Fetching earnings data from yfinance...")
    
    # Only fetch for tickers that have buys
    active_tickers = list(buy_tickers)
    earnings_data = {}
    
    for ticker in active_tickers:
        print(f"  {ticker}...", end=' ', flush=True)
        data = fetch_earnings_with_premarket(ticker, lookback_years=10)
        earnings_data[ticker] = data
        print(f"{len(data)} quarters")
        time.sleep(0.3)
    
    # Step 3: Cross-reference
    print("\n[3/3] Cross-referencing insider buys with earnings...")
    ranked = cross_reference(combined, earnings_data, lookback_days=60, min_trades=3)
    
    # Print results
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    decent = [r for r in ranked if 70 <= r['win_rate'] < 80]
    
    print(f"\n{'='*80}")
    print(f"RESULTS SUMMARY")
    print(f"  Total insiders with >=3 matched trades: {len(ranked)}")
    print(f"  Elite (90-100%): {len(elite)}")
    print(f"  Good (80-89%): {len(good)}")
    print(f"  Decent (70-79%): {len(decent)}")
    print(f"{'='*80}")
    
    for category_name, category_list in [
        ("🏆 100%-90% WIN RATE — ELITE", elite),
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
            avg_val = sum(t['value'] for t in r['trades']) / len(r['trades'])
            
            print(f"\n  #{i} {r['insider']}")
            print(f"     Tickers: {', '.join(r['tickers'])}")
            print(f"     Positions: {', '.join(r['positions'][:3])}")
            print(f"     Win Rate: {r['win_rate']}% ({r['wins']}W / {r['losses']}L / {r['total_trades']} total)")
            print(f"     Avg Pre-Market Move: {avg_pm:+.2f}%")
            print(f"     Avg Trade Value: ${avg_val:,.0f}")
            print(f"     Trade History:")
            
            for t in sorted(r['trades'], key=lambda x: x['earnings_date'], reverse=True):
                emoji = "✅" if t['is_win'] else "❌"
                print(f"       {emoji} {t['trade_date']} → Earnings {t['earnings_date']} ({t['days_before']}d before)")
                print(f"          PM: {t['premarket_pct']:+.2f}% | ${t['buy_price']:.2f} x {t['shares']:,}sh = ${t['value']:,.0f}")
    
    # Save results
    output = {
        'generated_at': datetime.now().isoformat(),
        'method': 'yfinance insider_transactions + OpenInsider',
        'summary': {
            'total_insiders_analyzed': len(ranked),
            'elite_90_100': len(elite),
            'good_80_89': len(good),
            'decent_70_79': len(decent),
            'total_buy_transactions': len(combined),
        },
        'elite': [(r['insider'], r['tickers'], r['win_rate'], r['total_trades']) for r in elite],
        'good': [(r['insider'], r['tickers'], r['win_rate'], r['total_trades']) for r in good],
        'decent': [(r['insider'], r['tickers'], r['win_rate'], r['total_trades']) for r in decent],
        'all_details': ranked,
    }
    
    output_path = os.path.join(OUTPUT_DIR, 'yfinance_insider_edge.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n📁 Full results saved to: {output_path}")
    
    return output


if __name__ == '__main__':
    main()
