#!/usr/bin/env python3
"""
INSTITUTIONAL 13F → EARNINGS PRE-MARKET EDGE (10-Year Backtest)
================================================================
從你的本機執行此腳本。需要 Python 3.8+。

安裝依賴：
  pip install yfinance pandas

執行：
  python3 run_institution_analysis.py

工作原理：
  1. 從 SEC EDGAR API 取得 21 家頂尖機構的 13F 季報清單
  2. 下載每季 13F HTML 持倉頁面 → 解析 HTML table 取得 CUSIP/市值/股數
  3. CUSIP 對照到 ticker（AAPL, MSFT...）
  4. 逐季比對增減持 → 找出每次變化後下次財報的盤前漲跌
  5. 勝率 = (增持+漲 or 減持+跌) / 總交易數
  6. 輸出 100%-90% 勝率機構名單 + 完整回測數據

預計執行時間：20-60 分鐘（視 SEC 速率限制）
"""

import json, os, time, re
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error
import yfinance as yf

# ============================================================
# CONFIG
# ============================================================
USER_AGENT = 'ResearchBot/3.0 (contact@example.com)'
REQUEST_DELAY = 0.5  # 秒，SEC 限制 10 req/s，用 2 req/s 比較安全
MAX_QUARTERS = 30    # 每機構最多抓幾季（約 7.5 年）
MIN_TRADES = 3       # 最少幾筆 QoQ 變動才列入排名

# 已知的頂尖機構 CIK（手動驗證過）
VERIFIED_CIKS = {
    "BAUPOST GROUP": "0001061768",
    "D.E. SHAW": "0001009207",
    "TWO SIGMA INVESTMENTS": "0001179392",
    "FARALLON CAPITAL": "0000909661",
    "VIKING GLOBAL": "0001103804",
    "GREENLIGHT CAPITAL": "0001079114",
    "TIGER GLOBAL": "0001167483",
    "BRIDGEWATER ASSOCIATES": "0001350694",
    "PERSHING SQUARE": "0001336528",
    "MILLENNIUM MANAGEMENT": "0001273087",
    "AQR CAPITAL": "0001167557",
    "CITADEL ADVISORS": "0001423053",
    "ADAGE CAPITAL": "0001165408",
    "POINT72 ASSET MANAGEMENT": "0001603466",
    "BERKSHIRE HATHAWAY": "0001067983",
    "RENAISSANCE TECHNOLOGIES": "0001037389",
    "BLACKROCK": "0001364742",
    "APPALOOSA": "0001048476",
    "SOROS FUND MANAGEMENT": "0001029159",
    "LONE PINE CAPITAL": "0001067873",
    "MAVERICK CAPITAL": "0001035020",
}

# CUSIP → Ticker 對照表（可自行擴充）
CUSIP_MAP = {
    # 科技七巨頭
    "03783310": "AAPL", "59491810": "MSFT", "02079K10": "GOOGL",
    "02079K30": "GOOGL", "02079K20": "GOOG",
    "02313510": "AMZN", "30303M10": "META", "67066G10": "NVDA",
    "88160R10": "TSLA",
    # 金融
    "08467070": "BRK-B", "08467010": "BRK-A", "46625H10": "JPM",
    "92826C83": "V", "57636Q10": "MA", "06050510": "BAC",
    "38141G10": "GS", "61744644": "MS", "09247X10": "BLK",
    # 醫療
    "91324P10": "UNH", "47816010": "JNJ", "71708110": "PFE",
    "58933Y10": "MRK", "00287Y10": "ABBV", "53245710": "LLY",
    "88355610": "TMO",
    # 消費
    "93114210": "WMT", "22160K10": "COST", "43707610": "HD",
    "74271810": "PG", "19121610": "KO", "71344810": "PEP",
    "58013510": "MCD", "65410610": "NKE", "85524410": "SBUX",
    # 工業/能源
    "30231G10": "XOM", "16676410": "CVX", "14912310": "CAT",
    "24419910": "DE", "53983010": "LMT", "09702310": "BA",
    "36960430": "GE", "43851610": "HON", "91131210": "UPS",
    # 科技
    "79466L30": "CRM", "00724F10": "ADBE", "68389X10": "ORCL",
    "17275R10": "CSCO", "45814010": "INTC", "00790310": "AMD",
    "74752510": "QCOM", "88250810": "TXN", "11135F10": "AVGO",
    # 其他
    "25468710": "DIS", "64110L10": "NFLX", "90353T10": "UBER",
    "70450Y10": "PYPL", "00906610": "ABNB",
}

# ============================================================
# HTTP 請求（含延遲）
# ============================================================
def sec_get(url, timeout=30):
    """發送 HTTP GET 請求到 SEC EDGAR"""
    time.sleep(REQUEST_DELAY)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return None

# ============================================================
# PHASE 1: 取得 13F 季報 URL
# ============================================================
def get_13f_filing_list(cik):
    """從 SEC submissions API 取得 13F-HR 季報清單"""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    text = sec_get(url)
    if not text:
        return []
    
    try:
        data = json.loads(text)
    except:
        return []
    
    recent = data.get('filings', {}).get('recent', {})
    forms = recent.get('form', [])
    acc_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    
    cik_num = int(cik)
    filings = []
    
    for i, form in enumerate(forms):
        if form == '13F-HR' and i < len(acc_numbers):
            acc = acc_numbers[i]
            acc_clean = acc.replace('-', '')
            date = filing_dates[i] if i < len(filing_dates) else ''
            
            # 13F 季報目錄頁面
            index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{acc}-index.htm"
            
            filings.append({
                'date': date,
                'index_url': index_url,
            })
    
    return filings

# ============================================================
# PHASE 2: 下載並解析 13F 持倉 HTML
# ============================================================
def find_info_table_url(index_url):
    """從 13F 季報目錄頁面找持倉 HTML 的 URL"""
    html = sec_get(index_url)
    if not html:
        return None
    
    # 找 xslForm13F_X02 目錄下的 XML 檔，但排除 primary_doc.xml（封面頁）
    links = re.findall(r'href="([^"]+)"', html)
    
    for link in links:
        if 'xslForm13F_X02' in link and 'primary_doc.xml' not in link and link.endswith('.xml'):
            if link.startswith('/Archives/'):
                return f"https://www.sec.gov{link}"
            return link
    
    return None


def parse_13f_holdings(html_text):
    """解析 13F 持倉 HTML table → 提取 CUSIP、市值、股數"""
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html_text, re.DOTALL)
    
    holdings = []
    in_data = False
    
    for row_html in rows:
        # 跳過表頭
        if '<th>' in row_html or 'COLUMN' in row_html:
            continue
        
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
        if len(tds) < 5:
            continue
        
        # 清理 HTML tags
        cols = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
        
        # 找到真正的標題列
        if 'NAME OF ISSUER' in cols[0]:
            in_data = True
            continue
        
        if not in_data:
            continue
        
        # 13F HTML 欄位配置：[0]=發行人 [1]=證券類別 [2]=CUSIP [3]=FIGI [4]=市值(千元) [5]=股數
        cusip_raw = cols[2] if len(cols) > 2 else ''
        if not cusip_raw or len(cusip_raw) < 6:
            continue
        
        cusip = cusip_raw.strip().replace(',', '').upper()
        issuer = cols[0] if len(cols) > 0 else ''
        
        value_str = cols[4].replace(',', '').strip() if len(cols) > 4 else '0'
        shares_str = cols[5].replace(',', '').strip() if len(cols) > 5 else '0'
        
        try:
            value = int(value_str) * 1000 if value_str.isdigit() else 0
            shares = int(shares_str) if shares_str.isdigit() else 0
        except:
            continue
        
        ticker = CUSIP_MAP.get(cusip, '')
        
        # 只保留有對照到 ticker 的持倉
        if ticker:
            holdings.append({
                'issuer': issuer,
                'cusip': cusip,
                'ticker': ticker,
                'value': value,
                'shares': shares,
            })
    
    return holdings


def process_institution(name, cik, max_quarters=MAX_QUARTERS):
    """處理一間機構的所有 13F 季報"""
    filings = get_13f_filing_list(cik)
    if not filings:
        return []
    
    quarterly_holdings = {}  # date → holdings list
    count = 0
    
    for filing in filings[:max_quarters]:
        info_url = find_info_table_url(filing['index_url'])
        if not info_url:
            continue
        
        html = sec_get(info_url, timeout=30)
        if not html:
            continue
        
        holdings = parse_13f_holdings(html)
        if holdings and filing['date'] not in quarterly_holdings:
            quarterly_holdings[filing['date']] = holdings
            count += 1
    
    if not quarterly_holdings:
        return []
    
    # 依日期排序
    sorted_quarters = sorted(quarterly_holdings.items())
    
    # 計算 QoQ 變化
    qoq_changes = []
    for i in range(1, len(sorted_quarters)):
        prev_date, prev_holdings = sorted_quarters[i - 1]
        curr_date, curr_holdings = sorted_quarters[i]
        
        prev_map = {h['ticker']: h['value'] for h in prev_holdings}
        curr_map = {h['ticker']: h['value'] for h in curr_holdings}
        
        all_tickers = set(list(prev_map.keys()) + list(curr_map.keys()))
        
        for ticker in all_tickers:
            pv = prev_map.get(ticker, 0)
            cv = curr_map.get(ticker, 0)
            
            if pv == 0 and cv == 0:
                continue
            
            if pv == 0:
                direction = 'NEW'
                pct = 100.0
            elif cv == 0:
                direction = 'EXIT'
                pct = -100.0
            else:
                pct = ((cv - pv) / pv) * 100
                direction = 'INCREASE' if pct > 0 else 'DECREASE'
            
            qoq_changes.append({
                'institution': name,
                'ticker': ticker,
                'report_date': curr_date,
                'prev_date': prev_date,
                'prev_value': pv,
                'curr_value': cv,
                'pct_change': round(pct, 1),
                'direction': direction,
            })
    
    return qoq_changes

# ============================================================
# PHASE 3: 交叉比對財報盤前漲跌
# ============================================================
def cross_reference_earnings(all_qoq):
    """每筆 QoQ 變化 → 找下一季財報 → 判斷盤前漲跌"""
    # 快取財報資料
    tickers_needed = set(q['ticker'] for q in all_qoq)
    earnings_cache = {}
    
    print(f"  抓取 {len(tickers_needed)} 檔股票的財報資料...")
    for ticker in sorted(tickers_needed):
        try:
            stock = yf.Ticker(ticker)
            earnings = stock.earnings_dates
            if earnings is not None and len(earnings) > 0:
                earnings_cache[ticker] = (stock, earnings)
        except:
            pass
        time.sleep(0.1)
    
    print(f"  成功取得 {len(earnings_cache)} 檔")
    
    results = []
    for q in all_qoq:
        ticker = q['ticker']
        if ticker not in earnings_cache:
            continue
        
        try:
            report_date = datetime.strptime(q['report_date'], '%Y-%m-%d')
        except:
            continue
        
        stock, earnings = earnings_cache[ticker]
        
        # 找 13F 報告日後下一次財報
        best_match = None
        for dt, row in earnings.iterrows():
            if hasattr(dt, 'to_pydatetime'):
                dt = dt.to_pydatetime()
            if dt.tzinfo:
                dt = dt.replace(tzinfo=None)
            
            delta = (dt - report_date).days
            if 0 < delta <= 120:  # 4 個月內
                try:
                    prev = stock.history(start=dt - timedelta(days=5), end=dt, interval='1d')
                    day = stock.history(start=dt, end=dt + timedelta(days=1), interval='1d')
                    if len(prev) >= 1 and len(day) >= 1:
                        pc = float(prev['Close'].iloc[-1])
                        do = float(day['Open'].iloc[0])
                        pm = ((do - pc) / pc) * 100
                        best_match = {
                            'earnings_date': dt.strftime('%Y-%m-%d'),
                            'days_after_report': delta,
                            'premarket_pct': round(pm, 2),
                            'eps_surprise': float(row.get('Surprise(%)', 0) or 0),
                        }
                except:
                    pass
                break
        
        if best_match:
            pm_up = best_match['premarket_pct'] > 0
            
            # 勝負判定：增持+漲=贏，減持+跌=贏
            if q['direction'] in ('INCREASE', 'NEW'):
                is_win = pm_up
            else:
                is_win = not pm_up
            
            results.append({**q, **best_match, 'is_win': is_win, 'pm_up': pm_up})
    
    return results

# ============================================================
# PHASE 4: 排名輸出
# ============================================================
def rank_institutions(results, min_trades=MIN_TRADES):
    """計算每間機構的預測勝率"""
    stats = defaultdict(lambda: {
        'total': 0, 'wins': 0, 'inc_total': 0, 'inc_wins': 0,
        'dec_total': 0, 'dec_wins': 0, 'tickers': set()
    })
    
    for r in results:
        name = r['institution']
        stats[name]['total'] += 1
        stats[name]['tickers'].add(r['ticker'])
        
        if r['is_win']:
            stats[name]['wins'] += 1
        
        if r['direction'] in ('INCREASE', 'NEW'):
            stats[name]['inc_total'] += 1
            if r['is_win']:
                stats[name]['inc_wins'] += 1
        else:
            stats[name]['dec_total'] += 1
            if r['is_win']:
                stats[name]['dec_wins'] += 1
    
    ranked = []
    for name, s in stats.items():
        if s['total'] >= min_trades:
            ranked.append({
                'institution': name,
                'total': s['total'],
                'wins': s['wins'],
                'losses': s['total'] - s['wins'],
                'win_rate': round(s['wins'] / s['total'] * 100, 1),
                'inc_win_rate': round(s['inc_wins'] / s['inc_total'] * 100, 1) if s['inc_total'] > 0 else 0,
                'dec_win_rate': round(s['dec_wins'] / s['dec_total'] * 100, 1) if s['dec_total'] > 0 else 0,
                'inc_total': s['inc_total'],
                'dec_total': s['dec_total'],
                'tickers': sorted(s['tickers']),
            })
    
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total']))
    return ranked

# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 80)
    print("INSTITUTIONAL 13F → EARNINGS PRE-MARKET EDGE (10-YEAR)")
    print(f"分析 {len(VERIFIED_CIKS)} 家機構，每機構最多 {MAX_QUARTERS} 季，最少 {MIN_TRADES} 筆")
    print("=" * 80)
    
    # Phase 1+2: 處理所有機構
    print("\n[1/3] 下載並解析 13F 季報...")
    all_qoq = []
    
    for i, (name, cik) in enumerate(VERIFIED_CIKS.items(), 1):
        print(f"  [{i}/{len(VERIFIED_CIKS)}] {name}...", end=' ', flush=True)
        qoq = process_institution(name, cik)
        all_qoq.extend(qoq)
        
        if qoq:
            tickers_found = set(q['ticker'] for q in qoq)
            print(f"{len(qoq)} 筆 QoQ 變動 ({len(tickers_found)} 檔股票)")
        else:
            print("無資料（可能 13F 格式不同或無對照 ticker）")
    
    print(f"\n  總 QoQ 變動: {len(all_qoq)} 筆")
    
    if len(all_qoq) == 0:
        print("\n❌ 沒有找到任何 QoQ 變動。")
        print("   可能原因：")
        print("   1. CUSIP_MAP 中沒有對照到這些機構持有的股票")
        print("   2. SEC 封鎖了請求（嘗試增加 REQUEST_DELAY）")
        print("   3. 13F HTML 格式與預期不同")
        print("\n   請先執行 run_insider_analysis.py（內部人分析不需要 SEC）")
        return
    
    # Phase 3: 財報比對
    print(f"\n[2/3] 交叉比對財報盤前漲跌...")
    results = cross_reference_earnings(all_qoq)
    print(f"  匹配到財報: {len(results)} 筆")
    
    # Phase 4: 排名
    print(f"\n[3/3] 計算機構預測勝率...")
    ranked = rank_institutions(results)
    
    # 輸出
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    decent = [r for r in ranked if 70 <= r['win_rate'] < 80]
    
    print(f"\n{'=' * 80}")
    print(f"🏆 最終排名")
    print(f"   符合條件 (>={MIN_TRADES}筆): {len(ranked)} 家")
    print(f"   90-100%: {len(elite)} | 80-89%: {len(good)} | 70-79%: {len(decent)}")
    print(f"{'=' * 80}")
    
    for cat_name, cat_list in [
        ("🏆 90-100% 預測勝率 — ELITE", elite),
        ("📈 80-89%", good),
        ("📊 70-79%", decent),
    ]:
        if not cat_list:
            continue
        print(f"\n{'─' * 80}")
        print(f"  {cat_name}")
        print(f"{'─' * 80}")
        for r in cat_list:
            print(f"\n  {r['institution']}")
            print(f"    總預測: {r['total']} | 勝率: {r['win_rate']}% ({r['wins']}W/{r['losses']}L)")
            print(f"    增持準確率: {r['inc_win_rate']}% ({r['inc_total']}筆)")
            print(f"    減持準確率: {r['dec_win_rate']}% ({r['dec_total']}筆)")
            print(f"    追蹤股票: {', '.join(r['tickers'][:12])}")
    
    # 低於 70% 的也列出
    others = [r for r in ranked if r['win_rate'] < 70]
    if others:
        print(f"\n{'─' * 80}")
        print(f"  其他機構 (<70%)")
        print(f"{'─' * 80}")
        for r in others:
            print(f"  {r['institution']}: {r['win_rate']}% ({r['wins']}W/{r['losses']}L/{r['total']})")
    
    # 儲存完整結果
    output = {
        'generated_at': datetime.now().isoformat(),
        'config': {
            'institutions': len(VERIFIED_CIKS),
            'max_quarters': MAX_QUARTERS,
            'min_trades': MIN_TRADES,
        },
        'summary': {
            'total_qoq_changes': len(all_qoq),
            'matched_with_earnings': len(results),
            'institutions_ranked': len(ranked),
            'elite_90_100': len(elite),
            'good_80_89': len(good),
        },
        'rankings': ranked,
        # 包含原始回測數據
        'all_results': [{
            'institution': r['institution'],
            'ticker': r['ticker'],
            'direction': r['direction'],
            'pct_change': r['pct_change'],
            'report_date': r['report_date'],
            'earnings_date': r.get('earnings_date', ''),
            'premarket_pct': r.get('premarket_pct', 0),
            'is_win': r.get('is_win', False),
        } for r in results],
    }
    
    out_path = 'institution_edge_results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📁 完整結果已儲存: {out_path}")
    print(f"   包含所有 QoQ 變動的原始回測資料")

if __name__ == '__main__':
    main()
