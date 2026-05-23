# WhaleTrace — 開發進度追蹤

> Harness Engineering 狀態檔。所有 agent session 從此檔恢復上下文。

## 最後更新

**2026-05-23** — Night Shift 7: Cron 自動化 + 市場情報擴充 — 建立 hermes cron job (每日 06/18 UTC 執行 refresh_and_deploy.sh) + market_intelligence.json 擴充至 17 張卡片（去重 Broadcom ASIC + 新增 NVDA $200B/Lenovo AI Surge/SpaceX IPO 信號）

## 專案狀態

| 子系統 | 狀態 | 說明 |
|--------|------|------|
| 前端 (React) | ✅ v3 就緒 | Bloomberg/Finviz 混合風格，四象限儀表板，code-split，市場情報卡片資料驅動 |
| 資料層 | ✅ 已接入 | n8n SEC EDGAR Proxy + WhaleTrace API + Mock fallback |
| 雙語 (i18n) | ✅ 就緒 | zh-TW + en，react-i18next |
| Telegram 推播 | ✅ 就緒 | n8n 定時共振警報推送 |
| 部署 | ✅ 就緒 | GitHub Pages (gh-pages branch) |
| 認證 | ⬜ 未實作 | Phase 4 需要 Supabase |
| 關注清單 (後端) | ⬜ 未實作 | 有 localStorage 前端版，無後端持久化 |
| 效能 | ✅ code-split | React.lazy 8 page chunks，initial load 326KB main + 20KB page |
| 數據刷新 | ✅ 自動化 | refresh_and_deploy.sh 一鍵爬取→複製→建置→部署 + hermes cron 排程 (每日 06/18 UTC) |

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
- [x] i18n 中英雙語切換
- [x] Telegram 共振警報推播 (n8n workflow)
- [x] 信心分數 12 月趨勢圖
- [x] 價格圖表 per-bar directional coloring
- [x] localStorage watchlist (StockDetailPage)
- [x] WatchlistPage — Bloomberg 終端機風格，10 欄位表格，與 StockDetailPage 同步 localStorage
- [x] feat-014 效能優化 — React.lazy code splitting, 主 bundle 326KB + 8 page chunks
- [x] 市場情報卡片外部化 — market_intelligence.json + MarketIntelligenceCard 元件
- [x] 數據刷新 Cron 排程 — hermes cron job 每日 06/18 UTC 自動執行 refresh_and_deploy.sh
- [x] 市場情報擴充 — 17 張卡片（去重 Broadcom ASIC + NVDA $200B/Lenovo AI Surge/SpaceX IPO）

## 下一步 (優先順序)

1. **Phase 4: 認證系統** — Supabase auth + 後端 watchlist 持久化 (需要 Supabase API keys)
2. **無障礙與測試** — WCAG 2.1 + Vitest + Playwright smoke tests
3. **市場情報內容更新** — 後續透過 script 自動更新 market_intelligence.json
4. **機構 13F 季度真實資料** — 等 SEC 13F 季度週期替換 mock 資料

## Session Log

| Date | Session | Changes |
|------|---------|---------|
| 2026-05-22 | Night Shift 1 | 建立 progress.md + feature_list.json |
| 2026-05-22 | Night Shift 2 | 實作 WatchlistPage：Bloomberg 終端機風格 10 欄位表格 (TICK/CONF/BUY/SEL/NET/SIGNAL/LAST/✂)，localStorage 與 StockDetailPage 同步，含摘要列、空狀態、共鳴信號指示器 |
| 2026-05-22 | Night Shift 3 | feat-014 效能優化：App.tsx 所有 page imports 改 React.lazy → 8 個獨立 page chunks，主 bundle 326KB (↓12% initial load)，首次載入只下載 FeedPage chunk (20KB)，後續導航按需載入 |
| 2026-05-22 | Night Shift 4 | 數據刷新自動化：執行 whaletrace_scraper.py quick mode (Finviz + yfinance) → 20 檔快照 + 200 筆機構持股；執行 SEC EDGAR 爬蟲 (零依賴 urllib+re) → 334 筆真實 Form 4 內部人交易 (BUY:108 / SELL:226)，日期範圍 2025-11-11 ~ 2026-05-21，涵蓋 25 檔美股。資料複製到 public/data/ → npm run build ✅ → GitHub Pages 部署驗證 ✅ (334 trades on live site) |
| 2026-05-23 | Night Shift 5 | 市場情報卡片外部化：從 DashboardPage.tsx 提取 10 張硬編碼卡片 → public/data/market_intelligence.json + MarketIntelligenceCard 元件 + MarketIntelligenceItem type。DashboardPage 從 226 行縮減至 118 行（-48%）。npm run build ✅，資料確認內嵌於 DashboardPage chunk。後續 script 可直接更新 JSON。 |
| 2026-05-23 | Night Shift 6 | 數據刷新自動化：重新執行 night_shift_scrape.py (Finviz 20/20 + SEC EDGAR 259 trades + yfinance 190 holdings) → 複製 data/ → public/data/ → npm run build ✅ → GitHub Pages 部署驗證 ✅ (所有 data JSON 200 OK)。建立 scripts/refresh_and_deploy.sh 一鍵管線腳本（爬取→複製→建置→部署→觸發 Pages rebuild）。 |
| 2026-05-23 | Night Shift 7 | Cron 自動化 + 市場情報擴充：建立 hermes cron job (job_id: 1ce55d9a7f42, 每日 06/18 UTC 自動執行 refresh_and_deploy.sh)。market_intelligence.json → 17 張卡片：去重 Broadcom ASIC (合併 #2 + #8) + 新增 3 張 (NVDA $200B Oppty, SpaceX/OpenAI IPO, Lenovo AI Surge) based on CNBC 即時頭條。npm run build ✅ → GitHub Pages 部署驗證 ✅ |
