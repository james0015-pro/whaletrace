# WhaleTrace — 開發進度追蹤

> Harness Engineering 狀態檔。所有 agent session 從此檔恢復上下文。

## 最後更新

**2026-05-24** — Night Shift 12: Market Intelligence +3 Cards (NVDA $80B Buyback, Anthropic x MSFT Chips, Growth→Value Rotation)

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
| 測試 (Vitest) | ✅ 63 tests | utils + price-utils + sec-converter + SignalBadge |
| 測試 (E2E) | ✅ 15 tests | Playwright smoke tests — 8 routes, navigation, interactions |
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
- [x] feat-017 Vitest 單元測試 — 63 tests (utils 38 + price-utils 12 + sec-converter 7 + SignalBadge 6)
- [x] feat-018 WCAG 2.1 AA 無障礙審計 — 鍵盤導航 + ARIA 標籤/角色 + 載入指示器 + 跑馬燈 aria-hidden (WCAG_AUDIT.md)
- [x] feat-019 Playwright E2E Smoke Tests — 15 tests (8 routes + navigation + interactions), playwright.config.ts, scripts/run-e2e.sh, all 15/15 pass
- [x] feat-020 市場情報擴充 v3 — 33 張卡片：+3 (NVDA $80B Buyback, Anthropic x MSFT AI Chip Deal, Growth→Value Rotation Signal) based on 2026-05-24 Google News headlines

## 下一步 (優先順序)

1. **Phase 4: 認證系統 (feat-011)** — Supabase auth + 後端 watchlist 持久化 (需要 Supabase API keys，夜班無法自主處理)
2. **機構 13F 季度真實資料 (feat-013)** — 等 SEC 13F 季度週期替換 mock 資料
3. **市場情報內容更新** — 後續透過 script 自動更新 market_intelligence.json

## Session Log

| Date | Session | Changes |
|------|---------|---------|
| 2026-05-22 | Night Shift 1 | 建立 progress.md + feature_list.json |
| 2026-05-22 | Night Shift 2 | 實作 WatchlistPage：Bloomberg 終端機風格 10 欄位表格 (TICK/CONF/BUY/SEL/NET/SIGNAL/LAST/✂)，localStorage 與 StockDetailPage 同步，含摘要列、空狀態、共鳴信號指示器 |
| 2026-05-22 | Night Shift 3 | feat-014 效能優化：App.tsx 所有 page imports 改 React.lazy → 8 個獨立 page chunks，主 bundle 326KB (↓12% initial load)，首次載入只下載 FeedPage chunk (20KB)，後續導航按需載入 |
| 2026-05-22 | Night Shift 4 | 數據刷新自動化：執行 whaletrace_scraper.py quick mode (Finviz + yfinance) → 20 檔快照 + 200 筆機構持股；執行 SEC EDGAR 爬蟲 (零依賴 urllib+re) → 334 筆真實 Form 4 內部人交易 (BUY:108 / SELL:226)，日期範圍 2025-11-11 ~ 2026-05-21，涵蓋 25 檔美股。資料複製到 public/data/ → npm run build ✅ → GitHub Pages 部署驗證 ✅ (334 trades on live site) |
| 2026-05-23 | Night Shift 8 | 市場情報內容擴充 v2：npm install 安裝 vitest/testing-library 依賴，更新 Big Tech AI Capex (id 7) 為 2026-05-23 最新數據，新增 5 張卡片 (Fed Hawks/China Chip Flop/Tesla FSD/Gates Exits/TI Power Chips)，22→27 張，npm run build ✅，GitHub Pages 部署完成 |
| 2026-05-23 | Night Shift 5 | 市場情報卡片外部化：從 DashboardPage.tsx 提取 10 張硬編碼卡片 → public/data/market_intelligence.json + MarketIntelligenceCard 元件 + MarketIntelligenceItem type。DashboardPage 從 226 行縮減至 118 行（-48%）。npm run build ✅，資料確認內嵌於 DashboardPage chunk。後續 script 可直接更新 JSON。 |
| 2026-05-23 | Night Shift 6 | 數據刷新自動化：重新執行 night_shift_scrape.py (Finviz 20/20 + SEC EDGAR 259 trades + yfinance 190 holdings) → 複製 data/ → public/data/ → npm run build ✅ → GitHub Pages 部署驗證 ✅ (所有 data JSON 200 OK)。建立 scripts/refresh_and_deploy.sh 一鍵管線腳本（爬取→複製→建置→部署→觸發 Pages rebuild）。 |
| 2026-05-23 | Night Shift 7 | Cron 自動化 + 市場情報擴充：建立 hermes cron job (job_id: 1ce55d9a7f42, 每日 06/18 UTC 自動執行 refresh_and_deploy.sh)。market_intelligence.json → 17 張卡片：去重 Broadcom ASIC (合併 #2 + #8) + 新增 3 張 (NVDA $200B Oppty, SpaceX/OpenAI IPO, Lenovo AI Surge) based on CNBC 即時頭條。npm run build ✅ → GitHub Pages 部署驗證 ✅ |
| 2026-05-23 | Night Shift 8 | Vitest 單元測試：安裝 vitest + @testing-library/react + jsdom，建立 vitest.config.ts + test-setup.ts。4 個測試檔 (utils.test.ts 38 tests, price-utils.test.ts 12 tests, sec-converter.test.ts 7 tests, SignalBadge.test.tsx 6 tests)，共 63 tests 全數通過。npm run build ✅。原本的 feat-017 拆分為 feat-017(✅)/feat-018(WCAG)/feat-019(Playwright)。 |
| 2026-05-23 | Night Shift 10 | feat-019 Playwright E2E Smoke Tests: npm install -D @playwright/test, playwright.config.ts (chromium headless shell), e2e/smoke.spec.ts (15 tests: App Shell 2, FeedPage 1, Dashboard 2, StockDetail 3, Watchlist 1, Treemap 1, Navigation 3, Interactions 2), scripts/run-e2e.sh runner, vitest.config.ts exclude e2e/. All 15/15 pass + 63/63 unit tests. npm run build ✅. |
| 2026-05-23 | Night Shift 9 | WCAG 2.1 AA 審計：修復 13 處鍵盤導航 (Cell/R 元件 + DashboardPage 卡片 + FeedPage 遮罩)，8 處 ARIA 標籤/角色 (TopNavBar 6 按鈕 + LoadingFallback + Ticker tape aria-hidden)，1 處載入指示器 (role="status" + aria-live="polite")。npm run build ✅ (1.71s)，npm test ✅ (63/63)。建立 WCAG_AUDIT.md。feat-018 ✅。|
| 2026-05-24 | Night Shift 11 | **SEC 爬蟲修復 + 資料刷新**: 上次 cron 執行 night_shift_scrape.py 命中 SEC rate limit (0.3s delay)，sec_insider_trades.json = 0 trades。修復：(1) 建立 sec_incremental_scrape.py (逐檔存檔 + 3.0s delay + 429 自動 90s backoff retry)，(2) 降低 filings/ticker 5→3 避免超時。**成果**: 149 real SEC Form 4 trades (44 buys, 75 sells) from 20/20 tickers，日期範圍 2026-03-01 ~ 2026-05-21。yfinance 190 筆機構持股 (19/20 tickers, BRK.B = none)。npm run build ✅ (2.25s) → GitHub Pages 部署 + rebuild trigger 201。night_shift_scrape.py 也修復：sleep 0.3s→2.0s + 429 retry。|
| 2026-05-24 | Night Shift 12 | **市場情報擴充 v3**: 搜尋 Google News RSS 取得 2026-05-24 最新金融頭條。新增 3 張卡片：(1) NVDA $80B Buyback — Motley Fool/Yahoo Finance 報導 NVDA 董事會授權額外 $80B 回購，總額 ~$115B 科技史上最大，Yahoo 比擬 Apple 2013 年回購模式 (2) Anthropic x MSFT Chips — CNBC/Reuters 報導 Anthropic 洽談使用 Microsoft Athena 客製化 AI 晶片，對沖「MSFT 輸掉 AI 競賽」敘事 (3) Growth→Value Rotation — Morningstar/Goldman Sachs 同步發出戰術性成長→價值輪動訊號。market_intelligence.json 30→33 張卡片。npm run build ✅ (1.72s) + 63/63 tests ✅ → GitHub Pages 部署驗證 ✅ (DashboardPage-20WhfzB1.js 確認含 3 張新卡片)。|
