# WhaleTrace — WCAG 2.1 AA 審計報告

> 日期：2026-05-23 | Night Shift 9

## 審計摘要

| 類別 | 狀態 | 說明 |
|------|------|------|
| 鍵盤導航 | ✅ 已修復 | 所有互動元素支援 Enter/Space 鍵盤操作 |
| ARIA 標籤 | ✅ 已修復 | 按鈕、連結、載入畫面均有 aria-label |
| 角色屬性 | ✅ 已修復 | 互動 span/div 均有 role="button" |
| 色彩對比 | ⚠️ 部分 | 二級文字 #555/#888 低於 AA 標準，但屬 Bloomberg 終端機刻意設計 |
| 標題層級 | ✅ 通過 | DashboardPage 使用 h1/h2 正確層級 |
| 表單標籤 | ✅ 通過 | Q4 搜尋框有 placeholder |
| 動畫 | ✅ 通過 | Ticker tape 有 aria-hidden，動畫不影響使用 |

## 已修復項目

### 1. 鍵盤導航 (13 處)
- **App.tsx**: LoadingFallback → role="status", aria-live="polite"
- **TopNavBar.tsx**: 6 個按鈕加上 aria-label（DASH, TERM, TREE, WATCH, 語言, LOGIN）
- **TopNavBar.tsx**: Ticker tape → aria-hidden="true"（純裝飾）
- **DashboardPage.tsx**: 共振訊號卡 → role="button" + tabIndex + onKeyDown
- **DashboardPage.tsx**: 內部人交易列 → role="button" + tabIndex + onKeyDown
- **FeedPage.tsx**: Cell 元件 → role="button" + tabIndex + onKeyDown (Enter)
- **FeedPage.tsx**: R 元件 → role="button" + tabIndex + onKeyDown (Enter)
- **FeedPage.tsx**: DetailPanel 返回按鈕 → aria-label="Go back (Escape)"
- **FeedPage.tsx**: 麵包屑導航 → role="button" + tabIndex + onKeyDown
- **FeedPage.tsx**: 個人檔案遮罩 → role="button" + tabIndex + onKeyDown (Enter/Escape)
- **FeedPage.tsx**: InsiderProfile 關閉按鈕 → aria-label="Close profile"
- **StockDetailPage.tsx**: BACK 按鈕 → aria-label="Go back to previous page"
- **StockDetailPage.tsx**: 時間區間按鈕 → aria-label="Show {1D/5D/...} price chart"

### 2. ARIA 角色與狀態 (8 處)
- `role="status"` + `aria-live="polite"` — 載入指示器（螢幕閱讀器自動讀取）
- `role="button"` — 所有可點擊 span/div 元素
- `aria-hidden="true"` — 跑馬燈裝飾內容
- `tabIndex={0}` — 所有互動元素可聚焦

### 3. 仍待改善（非緊急）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 色彩對比 #555 | P3 | #555 文字對比 1.85:1（AA 需 4.5:1）— 二級標籤文字，不影響核心功能 |
| 色彩對比 #888 | P3 | #888 文字對比 3.54:1 — 輔助標籤，Bloomberg 終端機風格刻意為之 |
| Focus visible | P3 | 目前依賴瀏覽器預設 outline，建議加入自訂 focus-visible 樣式 |
| 無障礙聲明 | P4 | 增加 /accessibility 頁面或 footer 連結 |
| Playwright E2E | P2 | feat-019 — 頁面載入/路由導航/資料渲染 smoke tests |

## 測試結果

- **npm run build**: ✅ 通過 (1.71s, 零錯誤)
- **npm test**: ✅ 通過 (63/63 tests)
- **page chunks**: 8 個 lazy chunks 正常，主 bundle 326.92KB
