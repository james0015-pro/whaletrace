#!/usr/bin/env python3
"""Final comprehensive insider buy vs earnings analysis."""
import json, time, os
from datetime import datetime, timedelta
from collections import defaultdict
import yfinance as yf
import re

OUTPUT_DIR = "/opt/data/home/whaletrace/scripts/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def is_buy(text):
    if not text or not isinstance(text, str): return False
    t = text.lower()
    not_buy = ['sale','sell','sold','gift','grant','award','exercise','option',
               'exchange','conversion','redemption','tender','disposed','disposition',
               'expire','withholding','tax']
    for kw in not_buy:
        if kw in t: return False
    for kw in ['purchase','buy','bought','acquired','acquisition']:
        if kw in t: return True
    return False

TICKERS = [
    "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","BRK-B","JPM","V",
    "MA","BAC","GS","MS","BLK","UNH","JNJ","PFE","MRK","ABBV","LLY","TMO",
    "WMT","COST","HD","PG","KO","PEP","MCD","NKE","SBUX","XOM","CVX","CAT",
    "DE","LMT","BA","GE","HON","UPS","CRM","ADBE","ORCL","CSCO","INTC",
    "AMD","QCOM","TXN","AVGO","DIS","NFLX","UBER","PYPL","ABNB",
]

print("=" * 80)
print("FINAL INSIDER BUY → EARNINGS PRE-MARKET ANALYSIS")
print(f"Data: yfinance + OpenInsider, {len(TICKERS)} tickers")
print("=" * 80)

# Step 1: Fetch yfinance insider buys
print("\n[1/3] Fetching yfinance insider buys...")
yf_buys = []
for ticker in TICKERS:
    try:
        stock = yf.Ticker(ticker)
        ins = stock.insider_transactions
        if ins is not None:
            for _, row in ins.iterrows():
                text = str(row.get('Text','') or '')
                if is_buy(text):
                    pm = re.search(r'at price \$?([\d,.]+)', text)
                    price = float(pm.group(1).replace(',','')) if pm else 0
                    yf_buys.append({
                        'ticker': ticker, 'insider': str(row.get('Insider','?')),
                        'position': str(row.get('Position','')),
                        'shares': int(row.get('Shares',0)),
                        'price': price,
                        'value': float(row.get('Value',0) or 0),
                        'date': str(row.get('Start Date',''))[:10],
                        'source': 'yfinance',
                    })
    except: pass
    time.sleep(0.05)

print(f"  yfinance buys: {len(yf_buys)}")

# Step 2: Load OpenInsider buys
oi_path = "/opt/data/home/whaletrace/data/openinsider_trades.json"
oi_buys = []
if os.path.exists(oi_path):
    with open(oi_path) as f:
        oi_data = json.load(f)
    trades = oi_data.get('trades', oi_data)
    for t in (trades if isinstance(trades,list) else []):
        if t.get('is_buy'):
            oi_buys.append({
                'ticker': t.get('ticker','').upper(),
                'insider': t.get('insider_name','?'),
                'position': t.get('title',''),
                'shares': abs(int(t.get('qty',0))),
                'price': float(t.get('price',0) or 0),
                'value': abs(float(t.get('qty',0) or 0)) * float(t.get('price',0) or 0),
                'date': str(t.get('trade_date',''))[:10],
                'source': 'openinsider',
            })

print(f"  OpenInsider buys: {len(oi_buys)}")

# Combine
all_buys = yf_buys + oi_buys
seen = set()
unique_buys = []
for b in all_buys:
    key = f"{b['ticker']}|{b['insider']}|{b['date']}|{b['shares']}"
    if key not in seen:
        seen.add(key)
        unique_buys.append(b)

print(f"  Unique buys: {len(unique_buys)}")

# Step 3: Cross-reference with earnings
print("\n[2/3] Cross-referencing with earnings (60-day window)...")
results = []
buy_tickers = set(b['ticker'] for b in unique_buys)
earnings_cache = {}

for ticker in buy_tickers:
    try:
        stock = yf.Ticker(ticker)
        earnings = stock.earnings_dates
        if earnings is not None:
            earnings_cache[ticker] = (stock, earnings)
    except: pass
    time.sleep(0.1)

print(f"  Earnings data for {len(earnings_cache)} tickers")

for buy in unique_buys:
    ticker = buy['ticker']
    if ticker not in earnings_cache: continue
    
    stock, earnings = earnings_cache[ticker]
    
    try: trade_date = datetime.strptime(buy['date'], '%Y-%m-%d')
    except: continue
    
    best = None
    for dt, row in earnings.iterrows():
        if hasattr(dt, 'to_pydatetime'): dt = dt.to_pydatetime()
        if dt.tzinfo: dt = dt.replace(tzinfo=None)
        
        delta = (dt - trade_date).days
        if 0 <= delta <= 60:
            try:
                prev = stock.history(start=dt-timedelta(days=5), end=dt, interval='1d')
                day = stock.history(start=dt, end=dt+timedelta(days=1), interval='1d')
                if len(prev)>=1 and len(day)>=1:
                    pc = float(prev['Close'].iloc[-1])
                    do = float(day['Open'].iloc[0])
                    pm = ((do-pc)/pc)*100
                    if not best or delta < best['days_before']:
                        best = {
                            'earnings_date': dt.strftime('%Y-%m-%d'),
                            'days_before': delta,
                            'premarket_pct': round(pm,2),
                            'is_win': pm > 0,
                            'eps_surprise': float(row.get('Surprise(%)',0) or 0),
                        }
            except: pass
            break
    
    if best:
        results.append({**buy, **best})

print(f"  Matched trades: {len(results)}")

# Step 4: Analyze
print("\n[3/3] Computing win rates...")
insider_stats = defaultdict(lambda: {'wins':0,'total':0,'trades':[],'tickers':set(),'positions':set()})
for r in results:
    key = f"{r['insider']}|{r['ticker']}"
    insider_stats[key]['insider'] = r['insider']
    insider_stats[key]['tickers'].add(r['ticker'])
    insider_stats[key]['positions'].add(r['position'])
    insider_stats[key]['total'] += 1
    if r['is_win']: insider_stats[key]['wins'] += 1
    insider_stats[key]['trades'].append(r)

ranked = []
for key, s in insider_stats.items():
    wr = s['wins']/s['total']*100
    ranked.append({
        'insider': s['insider'], 'tickers': sorted(s['tickers']),
        'positions': sorted(s['positions']),
        'total': s['total'], 'wins': s['wins'],
        'losses': s['total']-s['wins'],
        'win_rate': wr,
        'trades': s['trades'],
    })

ranked.sort(key=lambda x: (-x['win_rate'], -x['total']))

# Display
elite = [r for r in ranked if r['win_rate'] >= 90]
good = [r for r in ranked if 80 <= r['win_rate'] < 90]

print(f"\n{'='*80}")
print(f"RESULTS")
print(f"  Insiders with matched trades: {len(ranked)}")
print(f"  Elite (90-100%): {len(elite)}")
print(f"  Good (80-89%): {len(good)}")
print(f"{'='*80}")

for cat_name, cat_list in [
    ("100%-90% WIN RATE", elite),
    ("80%-89% WIN RATE", good),
]:
    if not cat_list:
        print(f"\n{cat_name}: NONE FOUND")
        continue
    
    print(f"\n{'─'*80}")
    print(f"  {cat_name}")
    print(f"{'─'*80}")
    
    for i, r in enumerate(cat_list, 1):
        avg_pm = sum(t['premarket_pct'] for t in r['trades'])/len(r['trades'])
        avg_val = sum(t['value'] for t in r['trades'])/len(r['trades'])
        
        print(f"\n  #{i} {r['insider']}")
        print(f"     Stock: {', '.join(r['tickers'])}")
        print(f"     Role: {', '.join(r['positions'])}")
        print(f"     Record: {r['win_rate']:.0f}% ({r['wins']}W/{r['losses']}L/{r['total']})")
        print(f"     Avg PM Move: {avg_pm:+.2f}%")
        print(f"     Avg Trade: ${avg_val:,.0f}")
        print(f"     History:")
        for t in sorted(r['trades'], key=lambda x: x['earnings_date'], reverse=True):
            e = "✅" if t['is_win'] else "❌"
            print(f"       {e} {t['date']} → Earnings {t['earnings_date']} ({t['days_before']}d)")
            print(f"          PM: {t['premarket_pct']:+.2f}% | EPS Surp: {t['eps_surprise']:+.1f}% | ${t['price']:.2f} x {t['shares']:,}sh")

# Show others
others = [r for r in ranked if r['win_rate'] < 80]
if others:
    print(f"\n{'─'*80}")
    print(f"  OTHER INSIDERS (below 80%)")
    print(f"{'─'*80}")
    for r in others:
        print(f"  {r['insider']} ({', '.join(r['tickers'])}): {r['win_rate']:.0f}% ({r['wins']}W/{r['losses']}L/{r['total']})")

# Save
output = {
    'generated_at': datetime.now().isoformat(),
    'method': 'yfinance insider_transactions + OpenInsider',
    'data_coverage': f'{len(TICKERS)} tickers, {len(unique_buys)} buys, 2-3yr lookback',
    'summary': {'total_insiders': len(ranked), 'elite_90_100': len(elite), 'good_80_89': len(good)},
    'elite': [{'name':r['insider'],'tickers':r['tickers'],'rate':r['win_rate'],'trades':r['total']} for r in elite],
    'all': [{'name':r['insider'],'tickers':r['tickers'],'rate':r['win_rate'],'trades':r['total'],'wins':r['wins']} for r in ranked],
}

out_path = os.path.join(OUTPUT_DIR, 'final_insider_analysis.json')
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2, default=str)
print(f"\n📁 Saved: {out_path}")
