# WhaleTrace 內線 Night Shift Report
## 2026-05-23 09:33–09:42 UTC

---

### 1. Camofox 瀏覽器 ❌

| 項目 | 狀態 |
|------|------|
| Server 啟動 | ❌ FAIL |
| 錯誤 | `libgtk-3.so.0: cannot open shared object file` |
| 原因 | Camoufox (Firefox fork) 需要 GTK3 運行時，伺服器無 GUI 庫 |
| 已知問題 | 前次輪班（05:28 UTC）已記錄相同問題 |

**無解。需安裝 `libgtk-3` 或改用有 GUI 的伺服器。**

---

### 2. Finviz 機構持股 ✅

| 項目 | 狀態 |
|------|------|
| 方法 | Scrapling Fetcher.get(stealthy_headers=True) |
| 覆蓋 | 20/20 全成功 |
| 新鮮度 | 2026-05-23 09:35 UTC（剛剛更新） |
| 儲存 | `data/finviz_institutions.json` + `dist/data/` |

**Top 5 機構持股：** CRM (93.38%), UNH (84.94%), MA (82.34%), V (79.91%), BAC (77.34%)

**BRK.B 修正：** Finviz 使用 `BRK-B` URL 格式（非 `BRK.B`），已修正。數據：Inst 43.24%, MktCap $1.05T

---

### 3. OpenInsider 內部人交易 ⚠️

| 項目 | 狀態 |
|------|------|
| 方法 | Scrapling Fetcher.get — per-ticker search pages |
| 原始擷取 | 1,067 trades（20 tickers） |
| 有效使用 | 99 trades（前次 2026-05-22 screener 數據） |
| 問題 | Search page (`/search?q=TICKER`) 無 ticker 欄位，column mapping 偏移 |
| Screener page | 100 rows/tbody，正確欄位映射（ticker 在 TD[3]） |
| 建議 | 使用 screener page 多頁擷取，而非 per-ticker search |

**已知 Bug：** `/search?q=AAPL` 頁面比 screener 少一個 ticker 欄，所有欄位左移 1。前次數據（99 trades, 5/22）來自 screener，欄位正確。

---

### 4. SEC EDGAR 內部人交易 ✅

| 項目 | 狀態 |
|------|------|
| 數據 | 259 trades（20 tickers） |
| 更新時間 | 2026-05-23 05:28 UTC（4 小時前） |
| 新鮮度 | ✅ 仍在新鮮期內 |
| 來源 | SEC Form 4 XML 解析（re.IGNORECASE 修正後正確） |

---

### 5. 數據狀態總結

| 檔案 | 筆數 | 時間 | 新鮮度 |
|------|------|------|--------|
| `finviz_institutions.json` | 20 | 09:35 | ✅ 剛更新 |
| `sec_insider_trades.json` | 259 | 05:28 | ✅ 4h |
| `openinsider_trades.json` | 99 | 5/22 17:11 | ⚠️ 16h |
| `institution_holdings.json` | 190 | 05:28 | ✅ 4h |
| `data_summary.json` | — | 09:35 | ✅ 剛更新 |

---

### 6. 待辦事項（給開發班）

1. **OpenInsider search page parser 修正** — search page 無 ticker 欄，欄位映射需調整。Screener page 正常（有 ticker 欄在 TD[3]）。建議改用 screener multi-page fetch。
2. **Camofox 替代方案** — 目前 `libgtk-3.so.0` 無法安裝。考慮：Docker 容器（`make up`），或切換到有 GUI 的伺服器。
3. **BRK.B → BRK-B** — Finviz URL 中的 ticker 格式需轉換。

---

### 總結

| 指標 | 結果 |
|------|------|
| Finviz 機構持股 | ✅ 20/20 成功 |
| SEC 內部人交易 | ✅ 259 筆有效 |
| OpenInsider | ⚠️ 99 筆（16h 舊）+ parser bug |
| Camofox | ❌ GTK3 缺失 |
| 耗時 | ~9 分鐘 |

🟡 **數據大部分新鮮。OpenInsider parser 需修正，Camofox 需基礎設施修復。**
