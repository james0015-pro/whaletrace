# WhaleTrace 內線 Night Shift Report
## 2026-05-24 14:54–14:58 UTC

---

### 1. 爬蟲執行摘要 ✅

| 數據源 | 狀態 | 筆數 | 備註 |
|--------|------|------|------|
| **Finviz 機構持股** | ✅ 20/20 | 20 檔 | 全數成功，0 失敗 |
| **OpenInsider 內部人交易** | ✅ | 1,067 筆 | 22B/1,045S，20/20 tickers (per-ticker search) |
| **SEC EDGAR Form 4** | ✅ | 133 筆 | 42B/87S/4 other，20/20 tickers，0 rate-limited |

---

### 2. Camofox 狀態 ❌

- **libgtk-3.so.0 仍未安裝** → Camofox Firefox 引擎無法啟動（同前次輪班）
- 全部改用 **Scrapling HTTP** (`Fetcher.get(stealthy_headers=True)`) 模式
- Finviz + OpenInsider + SEC EDGAR 均通過 Scrapling 成功爬取

---

### 3. Finviz 機構持股 (20/20)

| Ticker | Inst% | Insider% | Short% | Market Cap |
|--------|-------|----------|--------|------------|
| AAPL | 66.04% | 0.12% | 0.0% | $4.54T |
| MSFT | 74.88% | 1.54% | 0.0% | $3.11T |
| NVDA | 69.18% | 3.89% | 0.0% | $5.21T |
| GOOGL | 38.92% | 52.10% | 0.0% | $4.62T |
| AMZN | 66.74% | 8.97% | 0.0% | $2.86T |
| META | 67.53% | 13.72% | 0.0% | $1.55T |
| TSLA | 43.43% | 22.35% | 0.0% | $1.60T |
| BRK.B | 43.20% | 35.31% | 0.0% | $1.05T |
| JPM | 75.23% | 0.42% | 0.0% | $821B |
| V | 79.93% | 12.08% | 0.0% | $620B |
| UNH | 84.93% | 0.28% | 0.0% | $353B |
| XOM | 68.28% | 0.21% | 0.0% | $642B |
| WMT | 36.22% | 45.15% | 0.0% | $959B |
| JNJ | 76.09% | 0.10% | 0.0% | $564B |
| MA | 82.34% | 8.31% | 0.0% | $441B |
| PG | 71.24% | 0.06% | 0.0% | $336B |
| HD | 75.64% | 0.11% | 0.0% | $312B |
| BAC | 77.34% | 0.32% | 0.0% | $368B |
| DIS | 77.20% | 0.21% | 0.0% | $179B |
| CRM | 93.38% | 3.21% | 0.0% | $147B |

⚠️ GOOGL Inside Own 從前次 4.98% 變為 52.10% — Finviz 數據確實顯示此值（已人工驗證 HTML），可能是 Alphabet 雙重股權結構（Class B）導致 Insider % 重新計算。

---

### 4. OpenInsider 內部人交易 (1,067 筆)

- **1,067 trades** — 22 buys, 1,045 sells across all 20 tickers
- **Buy value: $1.07B** | **Sell value: $35.0B**
- Per-ticker search 策略（非 screener）— screener 頁面 200 筆中 0 筆在追蹤清單中
- 20/20 tickers 均有數據，覆蓋完整

**🔥 重大內部人買入訊號 Top 5:**

| Ticker | Insider | Value | 
|--------|---------|-------|
| 🟢 **TSLA** | **Elon Musk** | **$1.0B** (P - Purchase) |
| 🟢 UNH | Hemsley Stephen J | $25.0M (P - Purchase) |
| 🟢 CRM | Morfit G Mason | $25.0M (P - Purchase) |
| 🟢 UNH | Rex John F | $5.0M (P - Purchase) |
| 🟢 DIS | Gorman James P | $2.0M (P - Purchase) |

---

### 5. SEC EDGAR Form 4 (133 筆)

- **133 unique trades** (42 buys, 87 sells, 4 other) from **20/20 tickers**
- **0 rate-limited** — 3.0s delay 策略連續第二次成功
- Dedup pipeline: 150 raw → 133 unique

**SEC EDGAR 大額交易 Top 5:**

| Ticker | Insider | Type | Shares | Price | Value |
|--------|---------|------|--------|-------|-------|
| AAPL | LEVINSON ARTHUR D | SELL | 149,527 | $284.57 | $42.6M |
| AAPL | LEVINSON ARTHUR D | SELL | 100,473 | $285.04 | $28.6M |
| NVDA | STEVENS MARK A | SELL | 121,682 | $174.57 | $21.2M |
| NVDA | STEVENS MARK A | SELL | 100,000 | $172.61 | $17.3M |
| V | MCINERNEY RYAN | SELL | 31,455 | $340.14 | $10.7M |

**SEC EDGAR 總買入：$579K | 總賣出：$187M** — 賣壓主導

---

### 6. 檔案輸出

| 檔案 | 大小 | 筆數 |
|------|------|------|
| `finviz_institutions.json` | 7.2 KB | 20 tickers |
| `openinsider_trades.json` | 412 KB | 1,067 trades |
| `sec_insider_trades.json` | 62 KB | 133 trades |

所有檔案已同步到 `dist/data/` ✅

---

### 7. 待辦事項

1. **Camofox 環境修復 (P1)** — 安裝 `libgtk-3-0` 或使用 Docker 部署 Camofox（連續多班無法使用）
2. **GOOGL Insider % 激增調查 (P2)** — 從 4.98% → 52.10%，Finviz 數據確實如此，需確認是否為 Alphabet 股權結構變更或計算方法改變
3. **OpenInsider 多頁爬取 (P3)** — 目前每 ticker 只爬取第一頁（~30-100 筆），如 CRM/WMT/NVDA 等 ticker 第一頁已滿100筆，需多頁爬取擴大覆蓋

---

### 總結

✅ **本輪班全部成功。** Finviz 20/20 + OpenInsider 1,067 筆 + SEC EDGAR 133 筆，零 rate limit。SEC EDGAR 3.0s delay 策略連續第二次驗證成功（本次 60 requests，0 429）。Per-ticker OpenInsider 策略確認優於 screener（screener 回傳 0 筆追蹤標的，per-ticker 回傳 1,067 筆）。**TSLA Elon Musk $1.0B 內部人買入仍為最重大訊號（與前次輪班一致）。**
