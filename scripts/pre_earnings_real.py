#!/usr/bin/env python3
"""
🕵️ WhaleTrace 財報前內部人買入勝率分析 (真實數據版)
═══════════════════════════════════════════════════════════
數據來源：OpenInsider (1,068筆) + SEC EDGAR (302筆)
分析邏輯：找出在財報發布前買入、財報當天 pre-market 上漲的內部人
"""

import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import yfinance as yf
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

# ═══════════════════════════════════════════
# 1. 載入真實數據
# ═══════════════════════════════════════════
print("📂 載入真實內部人交易數據...")

# OpenInsider
with open('/opt/data/home/whaletrace/data/openinsider_trades.json') as f:
    oi_data = json.load(f)['trades']

# SEC EDGAR
with open('/opt/data/home/whaletrace/scripts/output/sec_insider_trades.json') as f:
    sec_raw = json.load(f)
    sec_data = sec_raw['trades']

# 標準化格式
def normalize_oi(t):
    return {
        'insider_name': t.get('insider_name', ''),
        'ticker': t.get('ticker', ''),
        'title': t.get('title', ''),
        'trade_date': str(t.get('trade_date', ''))[:10],
        'filing_date': str(t.get('filing_date', ''))[:10],
        'transaction_type': 'BUY' if t.get('is_buy') else 'SELL',
        'shares': abs(t.get('qty_signed', 0) or 0),
        'value': abs(t.get('value', 0) or 0),
        'source': 'OpenInsider',
    }

def normalize_sec(t):
    return {
        'insider_name': t.get('insider_name', ''),
        'ticker': t.get('ticker', ''),
        'title': '',
        'trade_date': str(t.get('transaction_date', ''))[:10],
        'filing_date': str(t.get('filing_date', ''))[:10],
        'transaction_type': t.get('type', '').upper() if t.get('type') else 'UNKNOWN',
        'shares': abs(t.get('shares', 0) or 0),
        'value': abs(t.get('total_value', 0) or 0),
        'source': 'SEC EDGAR',
    }

all_trades = [normalize_oi(t) for t in oi_data] + [normalize_sec(t) for t in sec_data]
df_all = pd.DataFrame(all_trades)
df_all['trade_date'] = pd.to_datetime(df_all['trade_date'], errors='coerce')
df_all = df_all.dropna(subset=['trade_date'])

# 只保留買入
df_buys = df_all[df_all['transaction_type'] == 'BUY'].copy()
# 過濾掉機構名稱（BANK OF AMERICA CORP 等不是個人內部人）
df_buys = df_buys[~df_buys['insider_name'].str.contains('CORP|INC|LTD|LLC|BANK|ASSOCIATES|GROUP|MANAGEMENT|HOLDINGS|CAPITAL|PARTNERS', case=False, na=False)]
df_buys = df_buys[df_buys['value'] > 10000]  # 過濾小額交易

print(f"  OpenInsider: {len(oi_data)} 筆")
print(f"  SEC EDGAR: {len(sec_data)} 筆")
print(f"  合併後總交易: {len(df_all)} 筆")
print(f"  買入交易: {len(df_buys)} 筆")
print(f"  涉及內部人: {df_buys['insider_name'].nunique()} 位")
print(f"  涉及股票: {df_buys['ticker'].nunique()} 檔")
print(f"  日期範圍: {df_buys['trade_date'].min().date()} → {df_buys['trade_date'].max().date()}")

# ═══════════════════════════════════════════
# 2. 下載財報日期 + 價格數據
# ═══════════════════════════════════════════
TICKERS = sorted(df_buys['ticker'].unique())
print(f"\n🕷️ 下載 {len(TICKERS)} 檔股票的財報日期...")

all_earnings = {}
price_data = {}

for sym in TICKERS:
    try:
        tk = yf.Ticker(sym)
        earnings = tk.earnings_dates
        if earnings is not None and len(earnings) > 0:
            earnings = earnings.sort_index()
            all_earnings[sym] = earnings
        hist = tk.history(period='10y')
        if not hist.empty:
            price_data[sym] = hist
            print(f"  ✅ {sym}: {len(earnings) if earnings is not None else 0} 次財報, {len(hist)} 天價格")
    except Exception as e:
        print(f"  ⚠️ {sym}: {e}")

# ═══════════════════════════════════════════
# 3. 比對買入日期 vs 財報日期
# ═══════════════════════════════════════════
print("\n🔍 比對內部人買入 vs 財報日期...")

def find_nearest_earnings(ticker, trade_date, max_days=45):
    """找出交易日期之後最近的財報日期（在 max_days 天內）"""
    if ticker not in all_earnings:
        return None, None
    earnings = all_earnings[ticker].copy()
    # Normalize timezone
    if hasattr(earnings.index, 'tz') and earnings.index.tz is not None:
        earnings.index = earnings.index.tz_localize(None)
    td = pd.Timestamp(trade_date)
    future_earnings = earnings[earnings.index >= td]
    future_earnings = earnings[earnings.index >= td]
    if len(future_earnings) == 0:
        return None, None
    next_ed = future_earnings.index[0]
    days_diff = (next_ed - td).days
    if 1 <= days_diff <= max_days:
        return next_ed, days_diff
    return None, None

def get_premarket_return(sym, earnings_date):
    """財報當天 (Open - Prev Close) / Prev Close"""
    if sym not in price_data:
        return None
    prices = price_data[sym].copy()
    if hasattr(prices.index, 'tz') and prices.index.tz is not None:
        prices.index = prices.index.tz_localize(None)

    ed_ts = pd.Timestamp(earnings_date).date() if hasattr(earnings_date, 'date') else pd.Timestamp(earnings_date)
    ed_ts = pd.Timestamp(ed_ts)

    if ed_ts in prices.index:
        idx = prices.index.get_loc(ed_ts)
    else:
        later = prices.index[prices.index >= ed_ts]
        if len(later) == 0:
            return None
        idx = prices.index.get_loc(later[0])

    if idx > 0:
        prev_close = prices.iloc[idx - 1]['Close']
        today_open = prices.iloc[idx]['Open']
        if prev_close > 0:
            return (today_open - prev_close) / prev_close
    return None

# 建立分析結果
results = []
for _, trade in df_buys.iterrows():
    next_ed, days_diff = find_nearest_earnings(trade['ticker'], trade['trade_date'])
    if next_ed is not None:
        premarket_ret = get_premarket_return(trade['ticker'], next_ed)
        if premarket_ret is not None:
            results.append({
                'insider_name': trade['insider_name'],
                'ticker': trade['ticker'],
                'trade_date': trade['trade_date'],
                'earnings_date': next_ed,
                'days_before': days_diff,
                'premarket_return': premarket_ret,
                'premarket_up': premarket_ret > 0,
                'value': trade['value'],
                'source': trade['source'],
            })

df_results = pd.DataFrame(results)
print(f"  有效配對: {len(df_results)} 筆（買入後 45 天內有財報）")

if len(df_results) == 0:
    print("\n⚠️ 買入日期與財報日期沒有重疊，可能原因：")
    print("  1. 買入發生在財報之後（內部人通常在財報後才能交易）")
    print("  2. 數據時間範圍不夠長")
    print("\n🔄 改用反向邏輯：找出財報前 N 天內的交易...")
    # 備案：改為在財報前後比對（有些內部人在財報後買入也是信號）
    # 這裡我們改用「交易日期前後 30 天內是否有財報」的寬鬆邏輯
    results2 = []
    for _, trade in df_buys.iterrows():
        ticker = trade['ticker']
        if ticker not in all_earnings:
            continue
        earnings = all_earnings[ticker]
        td = pd.Timestamp(trade['trade_date'])
        # 找前後 60 天內的財報
        nearby = earnings[(earnings.index >= td - timedelta(days=60)) & 
                         (earnings.index <= td + timedelta(days=60))]
        for ed in nearby.index:
            days = (ed - td).days
            premarket_ret = get_premarket_return(ticker, ed)
            if premarket_ret is not None:
                results2.append({
                    'insider_name': trade['insider_name'],
                    'ticker': ticker,
                    'trade_date': td,
                    'earnings_date': ed,
                    'days_before': days,
                    'premarket_return': premarket_ret,
                    'premarket_up': premarket_ret > 0,
                    'value': trade['value'],
                })
    df_results = pd.DataFrame(results2)
    print(f"  有效配對: {len(df_results)} 筆")

# ═══════════════════════════════════════════
# 4. 勝率分析
# ═══════════════════════════════════════════
if len(df_results) > 0:
    print(f"\n🎯 勝率分析 ({len(df_results)} 筆配對)...")

    winrate = []
    for name, group in df_results.groupby('insider_name'):
        n = len(group)
        n_up = group['premarket_up'].sum()
        wr = n_up / n
        avg_ret = group['premarket_return'].mean()
        if n >= 2:  # 至少 2 筆
            winrate.append({
                'insider_name': name,
                'n_trades': n,
                'n_up': n_up,
                'win_rate': wr,
                'avg_premarket_return': avg_ret,
            })

    df_wr = pd.DataFrame(winrate).sort_values('win_rate', ascending=False)

    # 顯示結果
    print(f"\n{'='*70}")
    print(f"🏆 財報前買入勝率排名 (真實 SEC/OpenInsider 數據)")
    print(f"{'='*70}")

    elite = df_wr[df_wr['win_rate'] >= 0.9]
    if len(elite) > 0:
        print(f"\n🥇 勝率 ≥ 90% ({len(elite)} 位):")
        for _, row in elite.iterrows():
            bar = '█' * int(row['win_rate'] * 20)
            print(f"  {row['insider_name']:<30s} {row['n_trades']:2d}筆  {row['win_rate']:.0%} {bar}  avg +{row['avg_premarket_return']:.2%}")
    else:
        print("\n  ⚠️ 目前沒有 ≥ 90% 的內部人（數據量不足）")
        print("  需要更多歷史買入數據（目前只有 2 年 OpenInsider 數據）")

    print(f"\n📊 Top 15（依勝率）:")
    for _, row in df_wr.head(15).iterrows():
        bar = '█' * int(row['win_rate'] * 20)
        star = '⭐' if row['win_rate'] >= 0.9 else ('✅' if row['win_rate'] >= 0.7 else '  ')
        print(f"  {star} {row['insider_name']:<30s} {row['n_trades']:2d}筆  {row['win_rate']:.0%} {bar}")

    # 圖表
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    fig.suptitle('WhaleTrace: Real Insider Pre-Earnings Win Rate Analysis', fontsize=14, fontweight='bold')

    ax = axes[0]
    if len(df_wr) > 0:
        ax.hist(df_wr['win_rate'] * 100, bins=15, color='#ff8c00', edgecolor='#333', alpha=0.8)
        ax.axvline(90, color='#0c6', linestyle='--', linewidth=2, label='90% Target')
        ax.set_title(f'Win Rate Distribution ({len(df_wr)} insiders)')
        ax.set_xlabel('Win Rate (%)')
        ax.legend()

    ax = axes[1]
    top = df_wr.head(10)
    if len(top) > 0:
        colors = ['#0c6' if w >= 0.9 else '#ff8c00' if w >= 0.7 else '#f59e0b' for w in top['win_rate']]
        ax.barh(range(len(top)), top['win_rate'] * 100, color=colors, edgecolor='#333')
        ax.set_yticks(range(len(top)))
        ax.set_yticklabels([f"{n} ({c}筆)" for n, c in zip(top['insider_name'], top['n_trades'])], fontsize=9)
        ax.set_title('Top 10 Insiders')
        ax.axvline(90, color='#0c6', linestyle='--')
        ax.invert_yaxis()

    plt.tight_layout()
    output_path = '/opt/data/home/whaletrace/scripts/output/pre_earnings_real.png'
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#111', edgecolor='none')
    print(f"\n📊 圖表: {output_path}")

    # 100% 驗證
    perfect = df_wr[df_wr['win_rate'] == 1.0]
    if len(perfect) > 0:
        print(f"\n{'='*70}")
        print(f"🔬 100% 勝率深度驗證")
        print(f"{'='*70}")
        for _, row in perfect.iterrows():
            print(f"\n  🏅 {row['insider_name']} ({row['n_trades']} 筆, 100% 勝率)")
            trades = df_results[df_results['insider_name'] == row['insider_name']]
            for _, t in trades.iterrows():
                print(f"    {t['ticker']:<6s} 買入 {str(t['trade_date'])[:10]}  "
                      f"財報 {str(t['earnings_date'])[:10]}  "
                      f"pre-market {t['premarket_return']:+.2%}")
else:
    print("\n❌ 沒有足夠的配對數據")

print(f"\n{'='*70}")
print(f"✅ 分析完成")
print(f"{'='*70}")
print(f"\n💡 要獲得 90-100% 勝率名單，需要：")
print(f"  1. 更長時間的 OpenInsider 數據（目前僅 2 年）")
print(f"  2. 針對單一股票爬取 10 年歷史")
print(f"  3. 或使用專業數據源（Bloomberg Terminal / Capital IQ）")
