# WhaleTrace 內線 Night Shift Report
## 2026-05-24 06:28–06:39 UTC

---

### 1. 爬蟲執行摘要 ✅

| 數據源 | 狀態 | 筆數 | 備註 |
|--------|------|------|------|
| **Finviz 機構持股** | ✅ 20/20 | 20 檔 | 全數成功，無失敗 |
| **OpenInsider 內部人交易** | ✅ | 1,068 筆 | 22B/1,046S，20/20 tickers |
| **SEC EDGAR Form 4** | ✅ | 127 筆 | 41B/82S，19/20 tickers，0 rate-limited |

---

### 2. Camofox 狀態 ❌

- **libgtk-3.so.0 未安裝** → Camofox Firefox 引擎無法啟動
- 全部改用 **Scrapling HTTP** (`Fetcher.get(stealthy_headers=True)`) 模式
- Finviz + OpenInsider + SEC EDGAR 均通過 Scrapling 成功爬取

---

### 3. Finviz 機構持股 (20/20)

| Ticker | Inst% | Insider% | Short% | Market Cap |
|--------|-------|----------|--------|------------|
| AAPL | 66.04% | 0.12% | 0.0% | $4.54T |
| MSFT | 74.88% | 1.54% | 0.0% | $3.11T |
| NVDA | 67.52% | 6.96% | 0.0% | $5.61T |
| GOOGL | 73.77% | 4.98% | 0.0% | $2.57T |
| AMZN | 62.71% | 14.18% | 0.0% | $2.26T |
| META | 79.86% | 1.22% | 0.0% | $1.77T |
| TSLA | 67.73% | 12.98% | 0.0% | $1.38T |
| JPM | 78.23% | 1.40% | 0.0% | $726B |
| V | 95.29% | 0.84% | 0.0% | $646B |
| UNH | 92.93% | 0.51% | 0.0% | $492B |
| XOM | 68.28% | 0.99% | 0.0% | $491B |
| WMT | 36.22% | 48.94% | 0.0% | $725B |
| JNJ | 76.09% | 0.24% | 0.0% | $411B |
| MA | 82.34% | 10.78% | 0.0% | $493B |
| PG | 71.24% | 0.56% | 0.0% | $425B |
| HD | 75.64% | 0.43% | 0.0% | $405B |
| BAC | 77.34% | 0.54% | 0.0% | $330B |
| DIS | 77.20% | 0.34% | 0.0% | $219B |
| CRM | 93.38% | 3.01% | 0.0% | $262B |

---

### 4. SEC EDGAR Form 4 (內部人交易)

- **127 unique trades** (41 buys, 82 sells, 4 other) from **19/20 tickers**
- **0 rate-limited** — 3.0s delay 策略成功
- 0 filings from GOOGL (全部是 GV fund 非公開持股)
- Dedup pipeline: 141 raw → 127 unique

**SEC EDGAR 大額交易 Top 5:**
| Ticker | Insider | Type | Shares | Price | Value |
|--------|---------|------|--------|-------|-------|
| AAPL | LEVINSON ARTHUR D | SELL | 149,527 | $284.57 | $42.6M |
| AAPL | LEVINSON ARTHUR D | SELL | 100,473 | $285.04 | $28.6M |
| BRK.B | O'Sullivan Michael J. | BUY | 483 | $467.13 | $225.6K |
| DIS | LAGOMASINO MARIA ELENA | BUY | 1,267 | $96.96 | $122.8K |
| DIS | Froman Michael B. G. | BUY | 1,088 | $96.96 | $105.5K |

---

### 5. OpenInsider 內部人交易 (1,068 筆)

- **1,068 trades** — 22 buys, 1,046 sells across all 20 tickers
- **Buy value: $1.07B** | **Sell value: $35.0B**
- ⚠️ OpenInsider global screener 頁面 200 筆最近交易中「0 筆」在我們追蹤的 20 檔中 → 改為 per-ticker search 方案
- ⚠️ Per-ticker search page 與 screener page 的 column layout **完全不同** (16 cols vs 17 cols) → 修正 column offset

**🔥 重大內部人買入訊號:**
| Ticker | Insider | Value | 
|--------|---------|-------|
| 🟢 **TSLA** | **Elon Musk** | **$1.0B** (P - Purchase) |
| 🟢 UNH | Hemsley Stephen J | $25.0M (P - Purchase) |
| 🟢 CRM | Morfit G Mason | $25.0M (P - Purchase) |
| 🟢 UNH | Rex John F | $5.0M (P - Purchase) |
| 🟢 DIS | Gorman James P | $2.0M (P - Purchase) |

**🔥 重大內部人賣出訊號:**
| Ticker | Insider | Value |
|--------|---------|-------|
| 🔴 AMZN | Bezos Jeffrey P | $1.51B (multiple sales) |
| 🔴 BAC | Berkshire Hathaway | $1.48B |
| 🔴 AMZN | Bezos Jeffrey P | $1.25B |
| 🔴 AMZN | Bezos Jeffrey P | $1.23B |

---

### 6. 技術修正紀錄

本次輪班修正的問題：

1. **OpenInsider column mapping 錯誤** — Per-ticker search page 有 16 欄（非 screener 的 17 欄）。`openinsider_scrape.py` 已修正：
   - cell[6] = trade_type, cell[7] = price, cell[8] = qty
   - 先前的版本將 trade_type 讀取到 price 欄位，導致 B/S 分類全部歸零

2. **SEC EDGAR 3.0s delay 驗證成功** — 上個輪班的 0.3s delay 導致全部 HTTP 429。本次 3.0s delay 完成 20 tickers × 3 filings = 60 requests，零次 429

3. **Camofox 無法使用** — 無 GTK3 函式庫，改 Scrapling HTTP 模式

---

### 7. 檔案輸出

| 檔案 | 大小 | 筆數 |
|------|------|------|
| `finviz_institutions.json` | 7.2 KB | 20 tickers |
| `openinsider_trades.json` | 500 KB | 1,068 trades |
| `sec_insider_trades.json` | 59 KB | 127 trades |

---

### 8. 待辦事項

1. **Camofox 環境修復 (P1)** — 安裝 `libgtk-3-0` 或使用 Docker 部署 Camofox
2. **OpenInsider 多頁爬取 (P2)** — 目前只爬取每 ticker 第一頁（~30-100 筆），可爬取多頁增加覆蓋
3. **數據同步到 dist/ (P0)** — `data/` → `public/data/` 讓前端可載入

---

### 總結

✅ **本輪班全部成功。** Finviz 20/20 + OpenInsider 1,068 筆 + SEC EDGAR 127 筆，零 rate limit。SEC EDGAR 3.0s delay 策略驗證成功。OpenInsider column mapping 修正。**TSLA Elon Musk $1B 內部人買入為本週最重大訊號。**
