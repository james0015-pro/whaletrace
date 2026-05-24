#!/usr/bin/env python3
"""
🦈 WhaleTrace — 美股籌碼面全數據爬蟲
======================================
從你的本機執行。支援 5 個免費數據源：

1. yfinance — 內部人交易 + 財報日曆 + 盤前價格
2. SEC EDGAR — 13F 機構持股季報（XML/HTML 解析）
3. Finviz — 內部人交易、機構持股快照
4. OpenInsider — 內部人交易篩選器（歷史資料）
5. Nasdaq — 機構持股頁面

安裝依賴：
  pip install yfinance pandas lxml html5lib beautifulsoup4

執行：
  python3 whale_scraper.py

輸出：
  insider_trades.json     — 所有內部人買入交易
  institution_13f.json    — 13F QoQ 增減持分析
  edge_results.json       — 完整回測結果（誰在財報前買入最準）
"""

import json, os, re, time, csv
from datetime import datetime, timedelta
from collections import defaultdict
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ============================================================
# CONFIG
# ============================================================
USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
REQUEST_DELAY = 0.3

# 54 檔核心美股
WATCHLIST = [
    "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA",
    "BRK-B","JPM","V","MA","BAC","GS","MS","BLK",
    "UNH","JNJ","PFE","MRK","ABBV","LLY","TMO",
    "WMT","COST","HD","PG","KO","PEP","MCD","NKE","SBUX",
    "XOM","CVX","CAT","DE","LMT","BA","GE","HON","UPS",
    "CRM","ADBE","ORCL","CSCO","INTC","AMD","QCOM","TXN","AVGO",
    "DIS","NFLX","UBER","PYPL","ABNB",
]

# 已知頂尖機構 CIK
KNOWN_CIKS = {
    "BAUPOST GROUP": "0001061768", "D.E. SHAW": "0001009207",
    "TWO SIGMA": "0001179392", "FARALLON CAPITAL": "0000909661",
    "VIKING GLOBAL": "0001103804", "GREENLIGHT CAPITAL": "0001079114",
    "TIGER GLOBAL": "0001167483", "BRIDGEWATER": "0001350694",
    "PERSHING SQUARE": "0001336528", "MILLENNIUM": "0001273087",
    "AQR CAPITAL": "0001167557", "CITADEL ADVISORS": "0001423053",
    "ADAGE CAPITAL": "0001165408", "POINT72": "0001603466",
    "BERKSHIRE HATHAWAY": "0001067983", "RENAISSANCE TECH": "0001037389",
    "BLACKROCK": "0001364742", "APPALOOSA": "0001048476",
    "SOROS FUND": "0001029159", "LONE PINE": "0001067873",
    "MAVERICK CAPITAL": "0001035020",
}

# CUSIP → Ticker (60+ stocks)
CUSIP_MAP = {
    "03783310":"AAPL","59491810":"MSFT","02079K10":"GOOGL","02079K30":"GOOGL","02079K20":"GOOG",
    "02313510":"AMZN","30303M10":"META","67066G10":"NVDA","88160R10":"TSLA",
    "08467070":"BRK-B","08467010":"BRK-A","46625H10":"JPM",
    "92826C83":"V","57636Q10":"MA","06050510":"BAC","38141G10":"GS","61744644":"MS","09247X10":"BLK",
    "91324P10":"UNH","47816010":"JNJ","71708110":"PFE","58933Y10":"MRK","00287Y10":"ABBV",
    "53245710":"LLY","88355610":"TMO",
    "93114210":"WMT","22160K10":"COST","43707610":"HD","74271810":"PG",
    "19121610":"KO","71344810":"PEP","58013510":"MCD","65410610":"NKE","85524410":"SBUX",
    "30231G10":"XOM","16676410":"CVX","14912310":"CAT","24419910":"DE",
    "53983010":"LMT","09702310":"BA","36960430":"GE","43851610":"HON","91131210":"UPS",
    "79466L30":"CRM","00724F10":"ADBE","68389X10":"ORCL","17275R10":"CSCO",
    "45814010":"INTC","00790310":"AMD","74752510":"QCOM","88250810":"TXN","11135F10":"AVGO",
    "25468710":"DIS","64110L10":"NFLX","90353T10":"UBER","70450Y10":"PYPL","00906610":"ABNB",
}


# ============================================================
# HTTP helper
# ============================================================
def http_get(url, timeout=20, raw=False):
    """HTTP GET with rate limiting and error handling."""
    time.sleep(REQUEST_DELAY)
    req = Request(url, headers={'User-Agent': USER_AGENT})
    try:
        resp = urlopen(req, timeout=timeout)
        return resp if raw else resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return None


# ============================================================
# SOURCE 1: yfinance — 內部人交易 + 財報
# ============================================================
def scrape_yfinance_insider():
    """從 yfinance 抓取內部人買入 + 財報盤前數據"""
    import yfinance as yf
    
    print("\n=== [1/4] yfinance 內部人交易 ===")
    
    # 抓內部人買入
    buys = []
    for ticker in WATCHLIST:
        try:
            stock = yf.Ticker(ticker)
            ins = stock.insider_transactions
            if ins is None or len(ins) == 0:
                continue
            
            for _, row in ins.iterrows():
                text = str(row.get('Text', '') or '')
                t = text.lower()
                
                # 判斷是否為買入
                not_buy = ['sale','sell','sold','gift','grant','award','exercise',
                          'option','exchange','conversion','redemption','tender',
                          'disposed','disposition','expire','withholding','tax']
                if any(kw in t for kw in not_buy):
                    continue
                if not any(kw in t for kw in ['purchase','buy','bought','acquired','acquisition']):
                    continue
                
                # 提取價格
                pm = re.search(r'at price \$?([\d,.]+)', text)
                price = float(pm.group(1).replace(',','')) if pm else 0
                
                buys.append({
                    'ticker': ticker,
                    'insider': str(row.get('Insider','?')),
                    'position': str(row.get('Position','')),
                    'shares': int(row.get('Shares',0)),
                    'price': price,
                    'value': float(row.get('Value',0) or 0),
                    'date': str(row.get('Start Date',''))[:10],
                    'description': text[:200],
                    'source': 'yfinance',
                })
        except:
            pass
    
    print(f"  內部人買入: {len(buys)} 筆 ({len(set(b['ticker'] for b in buys))} 檔股票)")
    
    # 抓財報 + 盤前價格
    print(f"  抓取財報數據...")
    earnings = {}
    for ticker in set(b['ticker'] for b in buys):
        try:
            stock = yf.Ticker(ticker)
            ed = stock.earnings_dates
            if ed is None or len(ed) == 0:
                continue
            
            ticker_data = {}
            for dt, row in ed.iterrows():
                if hasattr(dt, 'to_pydatetime'):
                    dt = dt.to_pydatetime()
                if dt.tzinfo:
                    dt = dt.replace(tzinfo=None)
                
                try:
                    prev = stock.history(start=dt-timedelta(days=5), end=dt, interval='1d')
                    day = stock.history(start=dt, end=dt+timedelta(days=1), interval='1d')
                    if len(prev)>=1 and len(day)>=1:
                        pc = float(prev['Close'].iloc[-1])
                        do = float(day['Open'].iloc[0])
                        dc = float(day['Close'].iloc[0])
                        ticker_data[dt.strftime('%Y-%m-%d')] = {
                            'prev_close': round(pc,2),
                            'day_open': round(do,2),
                            'day_close': round(dc,2),
                            'premarket_pct': round(((do-pc)/pc)*100, 2),
                            'fullday_pct': round(((dc-pc)/pc)*100, 2),
                            'eps_surprise': float(row.get('Surprise(%)',0) or 0),
                        }
                except:
                    pass
            
            if ticker_data:
                earnings[ticker] = ticker_data
        except:
            pass
    
    print(f"  財報數據: {len(earnings)} 檔股票")
    
    # 交叉比對
    print(f"  交叉比對買入 vs 財報...")
    results = []
    for buy in buys:
        ticker = buy['ticker']
        if ticker not in earnings:
            continue
        try:
            td = datetime.strptime(buy['date'], '%Y-%m-%d')
        except:
            continue
        
        best = None
        for ds, e in sorted(earnings[ticker].items()):
            try:
                ed = datetime.strptime(ds, '%Y-%m-%d')
            except:
                continue
            delta = (ed - td).days
            if 0 <= delta <= 60:
                if not best or delta < best['days_before']:
                    best = {
                        'earnings_date': ds,
                        'days_before': delta,
                        'premarket_pct': e['premarket_pct'],
                        'fullday_pct': e['fullday_pct'],
                        'eps_surprise': e['eps_surprise'],
                        'is_win': e['premarket_pct'] > 0,
                    }
        
        if best:
            results.append({**buy, **best})
    
    return buys, results


# ============================================================
# SOURCE 2: OpenInsider — 歷史內部人交易
# ============================================================
def scrape_openinsider():
    """從 OpenInsider 抓取近期內部人交易"""
    print("\n=== [2/4] OpenInsider 內部人交易 ===")
    
    all_trades = []
    
    for ticker in WATCHLIST[:10]:  # Top 10 for speed
        try:
            url = f"http://openinsider.com/screener?s={ticker}&o=&pl=&ph=&ll=&lh=&fd=-1&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=100&page=1"
            html = http_get(url, timeout=15)
            if not html or 'OpenInsider' not in html:
                continue
            
            # 解析 HTML table
            tables = re.findall(r'<table[^>]*class="tinytable"[^>]*>(.*?)</table>', html, re.DOTALL)
            for table in tables:
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL)
                for row in rows[1:]:  # skip header
                    tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                    if len(tds) < 12:
                        continue
                    
                    cols = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
                    
                    try:
                        trade_type = cols[6] if len(cols) > 6 else ''
                        is_buy = 'P - Purchase' in trade_type
                        
                        if is_buy:
                            all_trades.append({
                                'ticker': cols[3] if len(cols) > 3 else ticker,
                                'insider': cols[5] if len(cols) > 5 else '',
                                'position': cols[6] if len(cols) > 6 else '',
                                'date': cols[2] if len(cols) > 2 else '',
                                'price': float(cols[8].replace('$','').replace(',','')) if len(cols) > 8 else 0,
                                'shares': int(cols[9].replace(',','')) if len(cols) > 9 else 0,
                                'source': 'openinsider',
                            })
                    except:
                        pass
            
            if len(all_trades) > 0:
                print(f"  {ticker}: {len([t for t in all_trades if t['ticker']==ticker])} 筆")
        except Exception as e:
            continue
    
    print(f"  OpenInsider 買入: {len(all_trades)} 筆")
    return all_trades


# ============================================================
# SOURCE 3: SEC EDGAR — 13F 機構持股
# ============================================================
def scrape_sec_13f():
    """從 SEC EDGAR 下載 13F 季報並解析持倉"""
    print("\n=== [3/4] SEC EDGAR 13F 機構持股 ===")
    
    all_qoq = []
    
    for name, cik in KNOWN_CIKS.items():
        print(f"  {name}...", end=' ', flush=True)
        
        # 取得 13F 清單
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        data = http_get(url)
        if not data:
            print("API 失敗")
            continue
        
        try:
            filings = json.loads(data)
        except:
            print("JSON 失敗")
            continue
        
        recent = filings.get('filings', {}).get('recent', {})
        forms = recent.get('form', [])
        accs = recent.get('accessionNumber', [])
        dates = recent.get('filingDate', [])
        
        cik_num = int(cik)
        quarters = {}
        count = 0
        
        for i, form in enumerate(forms):
            if form != '13F-HR' or i >= len(accs) or count >= 20:
                continue
            
            acc = accs[i]
            acc_clean = acc.replace('-', '')
            
            # 取得目錄頁面
            idx_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_clean}/{acc}-index.htm"
            idx_html = http_get(idx_url)
            if not idx_html:
                continue
            
            # 找持倉 XML（排除 primary_doc.xml）
            links = re.findall(r'href="([^"]+)"', idx_html)
            info_url = None
            for l in links:
                if 'xslForm13F_X02' in l and 'primary_doc.xml' not in l and l.endswith('.xml'):
                    info_url = f"https://www.sec.gov{l}" if l.startswith('/Archives/') else l
                    break
            
            if not info_url:
                continue
            
            # 下載持倉 HTML
            html = http_get(info_url, timeout=30)
            if not html:
                continue
            
            # 解析 HTML table
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
            holdings = []
            in_data = False
            
            for row in rows:
                if '<th>' in row or 'COLUMN' in row:
                    continue
                tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                if len(tds) < 5:
                    continue
                
                cols = [re.sub(r'<[^>]+>', '', td).strip() for td in tds]
                
                if 'NAME OF ISSUER' in cols[0]:
                    in_data = True
                    continue
                if not in_data:
                    continue
                
                cusip = cols[2].replace(',','').strip().upper() if len(cols)>2 else ''
                if len(cusip) < 6:
                    continue
                
                ticker = CUSIP_MAP.get(cusip, '')
                if not ticker:
                    continue
                
                val_str = cols[4].replace(',','').strip() if len(cols)>4 else '0'
                sh_str = cols[5].replace(',','').strip() if len(cols)>5 else '0'
                
                try:
                    holdings.append({
                        'ticker': ticker,
                        'issuer': cols[0],
                        'value': int(val_str) * 1000 if val_str.isdigit() else 0,
                        'shares': int(sh_str) if sh_str.isdigit() else 0,
                    })
                except:
                    pass
            
            if holdings and dates[i] not in quarters:
                quarters[dates[i]] = holdings
                count += 1
        
        # QoQ 比較
        sorted_q = sorted(quarters.items())
        qoq_count = 0
        for i in range(1, len(sorted_q)):
            prev_map = {h['ticker']: h['value'] for h in sorted_q[i-1][1]}
            curr_map = {h['ticker']: h['value'] for h in sorted_q[i][1]}
            
            for ticker in set(list(prev_map.keys()) + list(curr_map.keys())):
                pv = prev_map.get(ticker, 0)
                cv = curr_map.get(ticker, 0)
                if pv == 0 and cv == 0:
                    continue
                
                pct = ((cv - pv) / pv * 100) if pv > 0 else 100
                direction = 'INCREASE' if pct > 0 else 'DECREASE'
                
                all_qoq.append({
                    'institution': name,
                    'ticker': ticker,
                    'report_date': sorted_q[i][0],
                    'prev_date': sorted_q[i-1][0],
                    'prev_value': pv,
                    'curr_value': cv,
                    'pct_change': round(pct, 1),
                    'direction': direction,
                })
                qoq_count += 1
        
        print(f"{len(quarters)}季, {qoq_count}筆QoQ")
    
    return all_qoq


# ============================================================
# SOURCE 4: Finviz — 內部人/機構快照
# ============================================================
def scrape_finviz():
    """從 Finviz 抓取內部人持股和機構持股快照"""
    print("\n=== [4/4] Finviz 持股快照 ===")
    
    snapshots = []
    for ticker in WATCHLIST[:20]:  # Top 20 for speed
        try:
            url = f"https://finviz.com/quote.ashx?t={ticker}"
            html = http_get(url)
            if not html:
                continue
            
            # 提取關鍵數據
            def extract(label):
                m = re.search(rf'{label}</(?:div|a)></td>\s*<td[^>]*>\s*<div[^>]*>\s*(?:<a[^>]*>)?\s*(?:<b>)?\s*(?:<span[^>]*>)?\s*([\d.\-]+[%BMK]?)', html)
                return m.group(1) if m else 'N/A'
            
            inst_own = extract('Inst Own')
            insider_own = extract('Insider Own')
            insider_trans = extract('Insider Trans')
            short_float = extract('Short Float')
            
            snapshots.append({
                'ticker': ticker,
                'inst_own': inst_own,
                'insider_own': insider_own,
                'insider_trans': insider_trans,
                'short_float': short_float,
            })
        except:
            pass
    
    print(f"  Finviz 快照: {len(snapshots)} 檔")
    return snapshots


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 70)
    print("🦈 WhaleTrace — 美股籌碼面全數據爬蟲")
    print(f"   數據源: yfinance + OpenInsider + SEC 13F + Finviz")
    print(f"   追蹤: {len(WATCHLIST)} 檔股票")
    print("=" * 70)
    
    all_results = {}
    
    # Step 1: yfinance
    yf_buys, yf_results = scrape_yfinance_insider()
    all_results['yfinance_buys'] = yf_buys
    all_results['yfinance_matches'] = yf_results
    
    # Step 2: OpenInsider
    oi_trades = scrape_openinsider()
    all_results['openinsider_buys'] = oi_trades
    
    # Step 3: SEC 13F
    qoq_changes = scrape_sec_13f()
    all_results['sec_13f_qoq'] = qoq_changes
    
    # Step 4: Finviz
    finviz_data = scrape_finviz()
    all_results['finviz_snapshots'] = finviz_data
    
    # ============================================================
    # 綜合分析
    # ============================================================
    print(f"\n{'='*70}")
    print(f"📊 綜合分析結果")
    print(f"{'='*70}")
    
    # 內部人勝率排名
    ins_stats = defaultdict(lambda: {'wins':0,'total':0,'tickers':set()})
    for r in yf_results:
        key = r['insider']
        ins_stats[key]['wins'] += 1 if r['is_win'] else 0
        ins_stats[key]['total'] += 1
        ins_stats[key]['tickers'].add(r['ticker'])
    
    ranked = []
    for name, s in ins_stats.items():
        if s['total'] >= 1:
            ranked.append({
                'name': name,
                'tickers': sorted(s['tickers']),
                'total': s['total'],
                'wins': s['wins'],
                'win_rate': round(s['wins']/s['total']*100, 1),
            })
    ranked.sort(key=lambda x: (-x['win_rate'], -x['total']))
    
    elite = [r for r in ranked if r['win_rate'] >= 90]
    good = [r for r in ranked if 80 <= r['win_rate'] < 90]
    
    print(f"\n🏆 內部人勝率 (財報盤前)")
    print(f"   90-100%: {len(elite)} 人 | 80-89%: {len(good)} 人")
    
    if elite:
        print(f"\n   ELITE (90%+):")
        for r in elite[:15]:
            print(f"   {r['name'][:40]} | {r['win_rate']}% ({r['wins']}W/{r['total']-r['wins']}L)")
    
    # 13F 摘要
    if qoq_changes:
        inst_counts = defaultdict(int)
        for q in qoq_changes:
            inst_counts[q['institution']] += 1
        print(f"\n📈 13F QoQ 變動: {len(qoq_changes)} 筆")
        print(f"   機構數: {len(inst_counts)}")
        for name, cnt in sorted(inst_counts.items(), key=lambda x: -x[1])[:10]:
            print(f"   {name}: {cnt} 筆")
    
    # Finviz 摘要
    if finviz_data:
        high_inst = [s for s in finviz_data if s['inst_own'] != 'N/A']
        if high_inst:
            high_inst.sort(key=lambda x: float(x['inst_own'].replace('%','')))
            print(f"\n📊 Finviz 機構持股最集中:")
            for s in high_inst[-5:]:
                print(f"   {s['ticker']}: 機構 {s['inst_own']} | 內部人 {s['insider_own']} | 放空 {s['short_float']}")
    
    # 儲存
    out = {
        'generated_at': datetime.now().isoformat(),
        'sources': ['yfinance', 'openinsider', 'sec_13f', 'finviz'],
        'data': all_results,
        'rankings': ranked,
    }
    
    with open('whaletrace_data.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n📁 完整數據: whaletrace_data.json")


if __name__ == '__main__':
    main()
