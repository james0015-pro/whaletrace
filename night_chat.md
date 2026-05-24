# WhaleTrace 內線 Night Shift Report
## 2026-05-23 23:27–23:33 UTC

---

### 1. 程式碼品質 ✅

| 項目 | 狀態 | 說明 |
|------|------|------|
| `npm run build` | ✅ PASS | tsc + vite build 2.63s，8 page chunks + main bundle (327KB) |
| `npm run lint` | ✅ PASS | ESLint 0 errors |
| `npm test` | ✅ 63/63 | 4 test files, 10.12s total |
| `git status` | ✅ Clean | 無未提交變更 |
| 最後 commit | `fd838cf8` | feat-019: Playwright E2E smoke tests |

---

### 2. GitHub Pages 部署 ✅

| 項目 | 狀態 |
|------|------|
| Source branch | `gh-pages` / `/` |
| 最新 build | `built` (2026-05-23 18:02 UTC, 20.6s) |
| Live site | `https://james0015-pro.github.io/whaletrace/` — HTTPS 200 ✅ |
| React root div | ✅ |
| JS bundle features | CONFIDENCE ✅ / WATCHLIST ✅ / Dashboard ✅ / Treemap ✅ |

---

### 3. 爬蟲數據新鮮度

| 檔案 | 筆數 | 時間 | 年齡 | 狀態 |
|------|------|------|------|------|
| `finviz_institutions.json` | 20/20 | 05-23 18:01 | 5.4h | ✅ |
| `institution_holdings.json` | 190 records | 05-23 18:02 | 5.4h | ✅ |
| `stock_snapshots.json` | 20 | 05-23 18:02 | 5.4h | ✅ |
| `market_intelligence.json` | 28 cards | 05-23 20:53 | 2.6h | ✅ |
| **`sec_insider_trades.json`** | **0** | 05-23 18:01 | 5.4h | ❌ |
| `openinsider_trades.json` | 5 | 05-22 17:11 | 30.3h | ⚠️ >24h |

---

### 4. SEC EDGAR 0 筆交易 — 根因診斷 ❌

| 項目 | 詳情 |
|------|------|
| 症狀 | `sec_insider_trades.json` count=0, buys=0, sells=0 |
| 前次 (05:28 UTC) | 259 trades |
| 本次 (18:01 UTC) | 0 trades |
| 根因 | **SEC.gov HTTP 429 Rate Limiting** |

**診斷過程：**
1. `data.sec.gov/submissions/CIK{CIK}.json` — HTTP 200 ✅（JSON 正常，含 Form 4 列表）
2. `www.sec.gov/Archives/edgar/data/{CIK}/{acc}/{acc}.txt` — **HTTP 429** ❌（Request Rate Threshold Exceeded）
3. 嘗試 30 秒等待後重試 → 仍 429
4. 嘗試不同 User-Agent → 仍 429（per-IP rate limit）

**結論：** `night_shift_scrape.py` 的 SEC EDGAR 部分對 20 tickers × 5 filings = ~100 filing requests + 20 submission requests，總共 ~120 requests。`time.sleep(0.3)` 間隔不足以避免累積式 rate limit。SEC.gov 在觸發 429 後會封鎖 IP 至少數分鐘。

**影響：** 網站上 `sec_insider_trades.json` 的 `trades` 陣列為空，前端的內部人交易面板無資料顯示。

---

### 5. 修復建議 (P0)

`scripts/night_shift_scrape.py` 第 177 行：
```python
time.sleep(0.3)  # ← 太短，觸發 SEC.gov rate limit
```

**建議方案：**
1. **增加延遲至 1.0–2.0 秒** per filing request（每次 filing 之間）
2. 每個 ticker 完成後增加 1.5 秒延遲
3. 總耗時約 20 × (2s × 5 + 1.5s) ≈ 230 秒 ≈ 4 分鐘，仍在可接受範圍
4. 加入 HTTP 429 重試邏輯（檢測 429 → sleep 60s → retry）
5. 或改用 SEC EDGAR bulk data（`https://www.sec.gov/Archives/edgar/daily-index/`）減少請求次數

---

### 6. 數據狀態總結

| 指標 | 結果 |
|------|------|
| 程式碼品質 | ✅ build + lint + tests 全過 |
| GitHub Pages | ✅ built + live + verified |
| Finviz 機構持股 | ✅ 20/20 成功 |
| yfinance 機構持有人 | ✅ 190 records |
| 市場情報卡片 | ✅ 28 張 (2.6h) |
| SEC 內部人交易 | ❌ 0 筆 (HTTP 429 rate limit) |
| OpenInsider | ⚠️ 30h 舊 (需 JS，已跳過) |

---

### 7. 待辦事項

1. **SEC EDGAR scraper rate limit 修復 (P0)** — 增加 request delay + 429 retry logic
2. **OpenInsider 替代方案** — 考慮 Scrapling browser mode 或 Playwright

---

### 總結

🟡 **程式碼與部署健康。Finviz + yfinance 數據新鮮。SEC EDGAR 因 rate limit (HTTP 429) 回歸到 0 筆交易，需增加 scraper 請求間隔並加入重試邏輯。**
