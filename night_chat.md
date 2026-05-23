# 🌙 夜班報告 — 2026-05-23 01:24 UTC

## 執行摘要

夜班研究輪班已完成。三項資料來源全數更新。

## 資料更新狀態

| 資料來源 | 狀態 | 數量 | 備註 |
|----------|------|------|------|
| Finviz 機構持股 | ✅ 20/20 | 20 檔完整 | 使用 Scrapling stealthy_headers 繞過 Cloudflare |
| SEC EDGAR 內部人交易 | ✅ 259 筆 | 46 買/108 賣/105 其他 | 20 檔 × 5 筆 Form 4 申報 |
| yfinance 機構持股 | ✅ 19/20 | 190 筆 | BRK.B 無持股數據 |

## ⚠️ 重要數據品質提醒

**SEC EDGAR 的 259 筆交易中，部分為「交叉持股揭露」而非真正的內部人買賣。** 範例：

- `XOM` 提交的 `PUMP` 賣出 $277M → 這是 Exxon 賣出 ProPetro 持股，不是 Exxon 內部人交易
- `BRK.B` 提交的 `DVA` 賣出 $183M → 這是波克夏賣出 DaVita，不是波克夏自己股票
- `BAC` 提交的多筆小額買賣 → 是 BoA 投資組合調整

**建議前端 data-layer.ts 過濾條件**：只顯示 `trade.ticker === trade.ticker_from_issuer` 的交易（即交易標的與申報公司 ticker 一致）。已標記 `ticker` 欄位但申報公司可能持有其他公司股票。

## 值得注意的活動

### 近期真實內部人買入（推測）
- **BRK.B**: Michael Sullivan 買入 536 股 (@$467-$470)，總值 $250K（5/6）
- **AMZN**: 多位董事/高管選擇權行使（M code），5/15（Garman, Herrington, Ng, Nooyi）
- **META**: Dina Powell 選擇權行使 9,635 股，5/15

### 近期顯著內部人賣出
- **AAPL**: Arthur Levinson 賣出 250K 股，總值 $71.6M（5/6）
- **NVDA**: Mark Stevens 賣出 121K 股，總值 $21.2M（3/20）
- **V**: 多位高管賣出，總值 $14.4M
- **TSLA**: 32 筆賣出，總值 $20.6M（多為定額稅務賣出 F code）

## 技術筆記

### Camofox 無法使用
- 伺服器缺少 `libgtk-3.so.0`，Camofox（Firefox 引擎）無法啟動
- **解決方案**：Finviz 使用 Scrapling `Fetcher.get(stealthy_headers=True)` 成功繞過 Cloudflare（20/20 成功）
- OpenInsider 因需要 JS 渲染而跳過（`<tbody>` 為空）
- SEC EDGAR 使用 urllib 零依賴方案，遵守速率限制（0.25-0.3s 延遲）

### 檔案位置
```
data/
├── finviz_institutions.json     (6.2 KB, 20 tickers)
├── sec_insider_trades.json      (146 KB, 259 trades)
├── institution_holdings.json    (38.8 KB, 190 records)
└── data_summary.json            (779 B, metadata)
```

### 爬蟲腳本
`scripts/night_shift_scrape.py` — 可直接重複執行以更新數據

## 建議下一步

1. **前端過濾邏輯**：在 data-layer.ts 中過濾交叉持股揭露
2. **Camofox 環境修復**：考慮安裝 GTK3 或使用 Docker 版本
3. **自動排程**：此夜班可設為每 6-12 小時自動執行
4. **共振訊號檢測**：基於新數據執行 WhaleTrace 共振警報邏輯

---
*夜班工人簽退 @ 2026-05-23 01:24 UTC*
