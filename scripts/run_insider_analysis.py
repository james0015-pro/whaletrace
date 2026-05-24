#!/usr/bin/env python3
"""
INSIDER BUY → EARNINGS PRE-MARKET EDGE (10-Year Backtest)
=========================================================
從你的本機執行此腳本。需要 Python 3.8+。

安裝依賴：
  pip install yfinance pandas

執行：
  python3 run_insider_analysis.py

輸出：
  insider_edge_results.json — 內部人勝率排名 + 完整交易紀錄

數據來源：
  - yfinance insider_transactions（2-3年內部人交易）
  - yfinance earnings_dates（財報日期 + 盤前價格）
  - OpenInsider 買入資料（如果有 openinsider_trades.json）
"""

import json, os, time, re
from datetime import datetime, timedelta
from collections import defaultdict
import yfinance as yf

# ============================================================
# CONFIG — 可自行擴充股票清單
# ============================================================
TICKERS = [
    # 科技
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    "CRM", "ADBE", "ORCL", "CSCO", "INTC", "AMD", "QCOM", "TXN", "AVGO",
    # 金融
    "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "BLK",
    # 醫療
    "UNH", "JNJ", "PFE", "MRK", "ABBV", "LLY", "TMO",
    # 消費
    "WMT", "COST", "HD", "PG", "KO", "PEP", "MCD", "NKE", "SBUX",
    # 工業/能源
    "XOM", "CVX", "CAT", "DE", "LMT", "BA", "GE", "HON", "UPS",
    # 其他
    "DIS", "NFLX", "UBER", "PYPL", "ABNB",
]

LOOKBACK_DAYS = 60       # 買入後幾天內有財報才算
MIN_TRADES = 1           # 最少幾筆交易才列入（設1看全部，設3看顯著）

# ============================================================
# STEP 1: 抓取內部人買入交易
# ============================================================
def is_buy(text):
    """從 yfinance 的 Text 欄位判斷是否為買入"""
    if not text or not isinstance(text, str):
        return False
    t = text.lower()
    # 先排除非買入
    not_buy = ['sale','sell','sold','gift','grant','award','exercise','option',
               'exchange','conversion','redemption','tender','disposed','disposition',
               'expire','withholding','tax']
    for kw in not_buy:
        if kw in t:
            return False
    # 再確認買入
    for kw in ['purchase','buy','bought','acquired','acquisition']:
        if kw in t:
            return True
    return False

def fetch_yfinance_buys(tickers):
    """從 yfinance 抓取所有內部人買入"""
    buys = []
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            ins = stock.insider_transactions
            if ins is None:
                continue
            for _, row in ins.iterrows():
                text = str(row.get('Text', '') or '')
                if is_buy(text):
                    pm = re.search(r'at price \$?([\d,.]+)', text)
                    price = float(pm.group(1).replace(',', '')) if pm else 0
                    buys.append({
                        'ticker': ticker,
                        'insider': str(row.get('Insider', '?')),
                        'position': str(row.get('Position', '')),
                        'shares': int(row.get('Shares', 0)),
                        'price': price,
                        'value': float(row.get('Value', 0) or 0),
                        'date': str(row.get('Start Date', ''))[:10],
                        'source': 'yfinance',
                    })
        except Exception as e:
            pass
        time.sleep(0.1)
    return buys

# ============================================================
# STEP 2: 抓取財報日期 + 盤前價格
# ============================================================
def fetch_earnings_data(buy_tickers, lookback_years=10):
    """抓取財報日期和盤前價格變動"""
    earnings_cache = {}
    for ticker in buy_tickers:
        try:
            stock = yf.Ticker(ticker)
            earnings = stock.earnings_dates
            if earnings is None or len(earnings) == 0:
                continue
            
            cutoff = datetime.now() - timedelta(days=lookback_years * 365)
            ticker_data = {}
            
            for dt, row in earnings.iterrows():
                if hasattr(dt, 'to_pydatetime'):
                    dt = dt.to_pydatetime()
                if dt.tzinfo:
                    dt = dt.replace(tzinfo=None)
                if dt < cutoff:
                    continue
                
                date_str = dt.strftime('%Y-%m-%d')
                try:
                    prev = stock.history(start=dt - timedelta(days=5), end=dt, interval='1d')
                    day = stock.history(start=dt, end=dt + timedelta(days=1), interval='1d')
                    if len(prev) >= 1 and len(day) >= 1:
                        pc = float(prev['Close'].iloc[-1])
                        do = float(day['Open'].iloc[0])
                        dc = float(day['Close'].iloc[0])
                        ticker_data[date_str] = {
                            'prev_close': round(pc, 2),
                            'day_open': round(do, 2),
                            'day_close': round(dc, 2),
                            'premarket_pct': round(((do - pc) / pc) * 100, 2),
                            'fullday_pct': round(((dc - pc) / pc) * 100, 2),
                            'eps_surprise': float(row.get('Surprise(%)', 0) or 0),
                        }
                except:
                    pass
            
            if ticker_data:
                earnings_cache[ticker] = (stock, ticker_data)
        except:
            pass
        time.sleep(0.1)
    
    return earnings_cache

# ============================================================
# STEP 3: 交叉比對
# ============================================================
def cross_reference(buys, earnings_cache, lookback_days=60):
    """比對每筆買入與最近財報的盤前漲跌"""
    results = []
    
    for buy in buys:
        ticker = buy['ticker']
        if ticker not in earnings_cache:
            continue
        
        try:
            trade_date = datetime.strptime(buy['date'], '%Y-%m-%d')
        except:
            continue
        
        stock, ticker_data = earnings_cache[ticker]
        
        # 找買入後最近的財報
        best_match = None
        for date_str, e in sorted(ticker_data.items()):
            try:
                e_date = datetime.strptime(date_str, '%Y-%m-%d')
            except:
                continue
            delta = (e_date - trade_date).days
            if 0 <= delta <= lookback_days:
                if not best_match or delta < best_match['days_before']:
                    best_match = {
                        'earnings_date': date_str,
                        'days_before': delta,
                        'premarket_pct': e['premarket_pct'],
                        'fullday_pct': e['fullday_pct'],
                        'eps_surprise': e['eps_surprise'],
                        'is_win': e['premarket_pct'] > 0,
                    }
        
        if best_match:
            results.append({**buy, **best_match})
    
    return results

# ============================================================
# STEP 4: 計算勝率排名
# ============================================================
def rank_insiders(results, min_trades=1):
    """依勝率排名內部人"""
    stats = defaultdict(lambda: {
        'wins': 0, 'total': 0, 'trades': [], 'tickers': set(), 'positions': set()
    })
    
    for r in results:
        key = f"{r['insider']}|{r['ticker']}"
        stats[key]['insider'] = r['insider']
        stats[key]['tickers'].add(r['ticker'])
        stats[key]['positions'].add(r['position'])
        stats[key]['total'] += 1
        if r['is_win']:
            stats[key]['wins'] += 1
        stats[key]['trades'].append(r)
    
    ranked = []
    for key, s in stats.items():
        if s['total'] >= min_trades:
            wr = s['wins'] / s['total'] * 100
            avg_pm = sum(t['premarket_pct'] for t in s['trades']) / len(s['trades'])
            ranked.append({
                'insider': s['insider'],
                'tickers': sorted(s['tickers']),
                'positions': sorted(s['positions']),
                'total': s['total'],
                'wins': s['wins'],
                'losses': s['total'] - s['wins'],
                'win_rate': round(wr, 1),
                'avg_premarket_pct': round(avg_pm, 2),
                'trades': s['trades'],
            })
    
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total']))
    return ranked

# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 80)
    print("INSIDER BUY → EARNINGS PRE-MARKET EDGE ANALYSIS")
    print(f"Analyzing {len(TICKERS)} tickers, {LOOKBACK_DAYS}d lookback, min {MIN_TRADES} trades")
    print("=" * 80)
    
    # Step 1
    print("\n[1/3] Fetching insider BUY transactions from yfinance...")
    buys = fetch_yfinance_buys(TICKERS)
    print(f"  Found {len(buys)} insider buys across {len(set(b['ticker'] for b in buys))} tickers")
    
    # Show top buys
    big = sorted([b for b in buys if b['value'] > 500000], key=lambda x: -x['value'])
    for b in big[:10]:
        print(f"  💰 {b['ticker']}: {b['insider']} bought ${b['value']:,.0f} on {b['date']}")
    
    # Step 2
    print("\n[2/3] Fetching earnings data + pre-market prices...")
    buy_tickers = list(set(b['ticker'] for b in buys))
    earnings_cache = fetch_earnings_data(buy_tickers)
    print(f"  Earnings data for {len(earnings_cache)} tickers")
    
    # Step 3
    print(f"\n[3/3] Cross-referencing buys with earnings ({LOOKBACK_DAYS}d window)...")
    results = cross_reference(buys, earnings_cache, LOOKBACK_DAYS)
    print(f"  Matched {len(results)} trades")
    
    # Rank
    ranked = rank_insiders(results, MIN_TRADES)
    
    # Display
    print(f"\n{'=' * 80}")
    print(f"RESULTS: {len(ranked)} insiders with >={MIN_TRADES} matched trades")
    print(f"{'=' * 80}")
    
    categories = [
        ("🏆 100%-90% WIN RATE", [r for r in ranked if r['win_rate'] >= 90]),
        ("📈 80%-89%", [r for r in ranked if 80 <= r['win_rate'] < 90]),
        ("📊 70%-79%", [r for r in ranked if 70 <= r['win_rate'] < 80]),
        ("📉 ALL OTHERS", [r for r in ranked if r['win_rate'] < 70]),
    ]
    
    for cat_name, cat_list in categories:
        if not cat_list:
            continue
        print(f"\n{'─' * 80}")
        print(f"  {cat_name} ({len(cat_list)} insiders)")
        print(f"{'─' * 80}")
        
        for i, r in enumerate(cat_list, 1):
            print(f"\n  #{i} {r['insider']}")
            print(f"     Stocks: {', '.join(r['tickers'])}")
            print(f"     Role: {', '.join(r['positions'][:3])}")
            print(f"     Record: {r['win_rate']}% ({r['wins']}W/{r['losses']}L/{r['total']})")
            print(f"     Avg PM Move: {r['avg_premarket_pct']:+.2f}%")
            print(f"     History:")
            for t in sorted(r['trades'], key=lambda x: x['earnings_date'], reverse=True):
                e = "✅" if t['is_win'] else "❌"
                print(f"       {e} {t['date']} → Earnings {t['earnings_date']} ({t['days_before']}d)")
                print(f"          PM: {t['premarket_pct']:+.2f}% | EPS: {t['eps_surprise']:+.1f}% | ${t['price']:.2f} × {t['shares']:,}sh = ${t['value']:,.0f}")
    
    # Save
    output = {
        'generated_at': datetime.now().isoformat(),
        'config': {'tickers': len(TICKERS), 'lookback_days': LOOKBACK_DAYS, 'min_trades': MIN_TRADES},
        'summary': {
            'total_buys': len(buys),
            'matched_trades': len(results),
            'insiders_ranked': len(ranked),
        },
        'rankings': [{
            'insider': r['insider'], 'tickers': r['tickers'], 'positions': r['positions'],
            'win_rate': r['win_rate'], 'total': r['total'], 'wins': r['wins'],
            'avg_premarket_pct': r['avg_premarket_pct'],
            'trades': [{
                'date': t['date'], 'earnings_date': t['earnings_date'],
                'days_before': t['days_before'], 'premarket_pct': t['premarket_pct'],
                'is_win': t['is_win'], 'price': t['price'], 'shares': t['shares'],
                'value': t['value'],
            } for t in r['trades']],
        } for r in ranked],
    }
    
    out_path = 'insider_edge_results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📁 完整結果已儲存: {out_path}")

if __name__ == '__main__':
    main()
