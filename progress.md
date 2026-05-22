# WhaleTrace — 開發進度追蹤

> Harness Engineering 狀態檔。所有 agent session 從此檔恢復上下文。

## 最後更新

**2026-05-22** — Night Shift 2: 實作 WatchlistPage（Bloomberg 終端機風格關注清單，localStorage 與 StockDetailPage 同步）

## 專案狀態

| 子系統 | 狀態 | 說明 |
|--------|------|------|
| 前端 (React) | ✅ v3 就緒 | Bloomberg/Finviz 混合風格，四象限儀表板 |
| 資料層 | ✅ 已接入 | n8n SEC EDGAR Proxy + WhaleTrace API + Mock fallback |
| 雙語 (i18n) | ✅ 就緒 | zh-TW + en，react-i18next |
| Telegram 推播 | ✅ 就緒 | n8n 定時共振警報推送 |
| 部署 | ✅ 就緒 | GitHub Pages (gh-pages branch) |
| 認證 | ⬜ 未實作 | Phase 4 需要 Supabase |
| 關注清單 (後端) | ⬜ 未實作 | 有 localStorage 前端版，無後端持久化 |

## 已完成功能

- [x] Phase 0: 專案腳手架 (React 19 + Vite + TS + Tailwind v3)
- [x] Phase 1: 交易卡片 + Virtuoso 虛擬滾動
- [x] Phase 2: 股票詳情頁 (Bloomberg 風格，含信心分數、價格圖表、機構持股)
- [x] Phase 3: 群組信號 + 機構頁面 + 全域搜尋
- [x] Bloomberg 四象限儀表板 (/ → FeedPage)
- [x] Dashboard 頁面 (/dashboard → 共振訊號 + 機構大單 + 市場情報)
- [x] Treemap 頁面 (/treemap → 市場熱力圖)
- [x] SEC EDGAR 真實資料接入 (n8n proxy)
- [x] Finviz 爬蟲真實資料接入
- [x] i18n 雙語切換
- [x] Telegram 共振警報推播 (n8n workflow)
- [x] 信心分數 12 月趨勢圖
- [x] 價格圖表 per-bar directional coloring
- [x] localStorage watchlist (StockDetailPage)
- [x] WatchlistPage — Bloomberg 終端機風格，10 欄位表格，與 StockDetailPage 同步 localStorage

## 下一步 (優先順序)

1. **完善 WatchlistPage** — 接入 localStorage 同步 + Bloomberg 終端機風格
2. **Phase 4: 認證系統** — Supabase auth + 後端 watchlist 持久化
3. **數據刷新自動化** — 定時 SEC/Finviz 爬蟲 + 自動部署
4. **效能優化** — code splitting, lazy loading pages

## Session Log

| Date | Session | Changes |
|------|---------|---------|
| 2026-05-22 | Night Shift 1 | 建立 progress.md + feature_list.json |
| 2026-05-22 | Night Shift 2 | 實作 WatchlistPage：Bloomberg 終端機風格 10 欄位表格 (TICK/CONF/BUY/SEL/NET/SIGNAL/LAST/✂)，localStorage 與 StockDetailPage 同步，含摘要列、空狀態、共鳴信號指示器 |
