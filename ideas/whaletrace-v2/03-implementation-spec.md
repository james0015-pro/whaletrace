# WhaleTrace v2 — 實作規格

## 摘要

基於 01-design-doc.md 和 02-ui-design-brief.md，將現有 Phase 0-3 的 WhaleTrace 升級為「鯨魚共振訊號雷達」。新增 Phase 4（認證+關注+推播）和 Phase 5（共振歷史+股價圖）。

---

## 現有資產（Phase 0-3 已完成）

| 層 | 檔案/元件 |
|---|---|
| 框架 | React 19 + Vite + TypeScript + Tailwind CSS v3 |
| 路由 | React Router v7，6 條路由 |
| 資料 | TanStack Query，MOCK_TRADES 500 筆 |
| 元件 | TradeCard, SignalBadge, Skeleton, EmptyState, ConfidenceRing, InsiderTimeline, HoldingsTable |
| 頁面 | FeedPage, SignalsPage, InstitutionsPage, StockDetailPage, WatchlistPage, SettingsPage |
| 佈局 | TopNavBar（含全域搜尋）, Sidebar, MobileNav, AppShell |
| 工具 | cn(), formatCurrency(), formatDate(), formatNumber() 等 |

---

## Phase 4：認證 + 關注清單 + Telegram 推播

### 4-0 安裝依賴

```bash
npm install @supabase/supabase-js
```

### 4-1 Supabase Auth

**新建 `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**新建 `src/lib/auth.tsx`** — Auth Context + Provider + useAuth() hook
- `useAuth()` 提供：user, session, signIn, signUp, signOut, loading
- `onAuthStateChange` 監聽登入狀態變化
- `RequireAuth` 元件：未登入自動跳轉 /login

### 4-2 登入/註冊頁面

**新建 `src/pages/LoginPage.tsx`**
- Email + 密碼登入表單
- 註冊切換（同一頁 tab switch）
- 表單驗證：Email 格式、密碼 ≥ 8 字元
- 錯誤訊息顯示
- 登入成功 → 跳轉到上一頁或首頁

**修改 `src/App.tsx`** — 新增 /login 路由

### 4-3 關注清單功能

**新建 `src/hooks/useWatchlist.ts`**
- 使用 Supabase 資料表 `watchlist`（user_id, ticker, added_at）
- `useWatchlist()` → 回傳關注清單
- `addToWatchlist(ticker)` → 新增
- `removeFromWatchlist(ticker)` → 移除
- `isWatched(ticker)` → 檢查

**修改 `src/pages/WatchlistPage.tsx`**（覆蓋）
- 須登入才能使用（未登入顯示登入提示）
- 已登入：顯示關注股票清單
- 每筆：股票代號 + 公司名稱 + 最近內部人動態摘要 + 信心分數
- 取消關注按鈕
- 空狀態：引導搜尋並加入第一檔股票

**修改 `TradeCard.tsx` / `StockDetailPage.tsx`** — 加入關注按鈕（⭐）

### 4-4 Telegram 推播通知

**新建 `src/lib/notifications.ts`**
- Telegram Bot Token（環境變數）
- `sendNotification(chatId, message)` → HTTP POST to Telegram Bot API

**新建 n8n workflow（whaletrace-notify）**
- 定時每 15 分鐘觸發
- 從 Supabase 拉取所有使用者的關注清單 + Telegram chatId
- 比對最新內部人交易（MOCK_TRADES）
- 若關注股票有新建交易 → Telegram 推播
- 訊息格式：`🐋 AAPL · Tim Cook 買入 $2.1M · 12,000 股 · 2 小時前`

**修改 `src/pages/SettingsPage.tsx`**（覆蓋）
- Telegram 綁定區塊（連接狀態、綁定/解除按鈕）
- 通知偏好開關（機構買入 / 內部人買入 / 賣出 / 共振訊號）
- Email 顯示
- 密碼修改
- 登出按鈕

### Phase 4 驗證

```bash
npm run build   # 必須零錯誤
npm run dev     # 確認：登入流程 / 關注清單 CRUD / 設定頁 / Telegram 推播
```

---

## Phase 5：共振訊號 + 歷史 + 股價圖

### 5-1 共振訊號計算（n8n workflow）

**新建 n8n workflow（whaletrace-resonance）**
- 每日定時觸發（美股收盤後）
- 計算邏輯：
  1. 從 MOCK_TRADES 篩選機構買入（13F），按 ticker 加總金額
  2. 保留總金額 > $100M 的 ticker
  3. 交叉比對同一 ticker 30 天內是否有內部人買入
  4. 符合條件 → 產生 ResonanceSignal 記錄
- 存入 Supabase 資料表 `resonance_signals`
- 發送 Telegram 推播給所有訂閱「共振訊號通知」的使用者

### 5-2 共振訊號型別

**修改 `src/types/index.ts`** — 新增：

```ts
export interface ResonanceSignal {
  id: number;
  ticker: string;
  company_name: string;
  signal_date: string;
  total_institution_buy: number;    // 機構合計買入金額
  institutions: { name: string; amount: number }[];
  insider_count: number;            // 內部人買入人數
  insider_names: string[];
  signal_strength: number;          // 0-100
}
```

### 5-3 共振訊號卡片元件

**新建 `src/components/features/ResonanceCard.tsx`**
- Props: `signal: ResonanceSignal`
- 橫向卡片，彭博風格
- 左側：股票代號 + 公司名 + 訊號日期
- 中間：機構清單（最多顯示 3 家，+N 更多）+ 總金額
- 右側：內部人人數 + 信號強度條
- 紫色左邊框（`border-l-signal`），區別於一般的買入/賣出
- framer-motion 進場動畫

### 5-4 改寫首頁（FeedPage → HomePage）

**覆蓋 `src/pages/FeedPage.tsx`** → 升級為三段式儀表板：

```
區塊 1：鯨魚共振訊號（ResonanceCard × N，橫排 2-4 欄）
區塊 2：今日機構大單（緊湊 DataTable）
區塊 3：最新內部人交易（TradeCard × 5）
```

- 共振訊號區：讀取 Supabase `resonance_signals`，按 signal_strength 排序
- 機構大單區：從 MOCK_TRADES 篩選，用新的 DataTable 元件
- 內部人交易區：保留既有 Virtuoso 虛擬滾動

### 5-5 共振歷史 + 股價圖（股票詳情頁）

**修改 `src/pages/StockDetailPage.tsx`**
- 新增區塊：股價走勢圖（mock 資料，顯示 3/6/12 個月報酬）
- 新增區塊：共振歷史（該 ticker 過去的 ResonanceSignal 紀錄 + 報酬率）
- 圖表可用簡單的 CSS bar chart 或 SVG（不裝重型圖表庫）

### 5-6 資料表元件

**新建 `src/components/features/DataTable.tsx`**
- 緊湊表格，字小（text-xs / text-sm）
- 行距窄（py-1.5）
- 支援排序（點擊欄位標題）
- responsive：桌面表格 / 手機卡片

### Phase 5 驗證

```bash
npm run build   # 必須零錯誤
npm run dev     # 確認：首頁三段儀表板 / 共振卡片 / 共振歷史 / 股價圖
```

---

## Phase 6：上線準備（Post-MVP）

- 串接真實資料 API（Polygon.io / Financial Modeling Prep）
- 錯誤監控（Sentry）
- iOS / Android App（React Native 或 PWA）
- Line 推播整合
- 效能優化（code splitting）

---

## 風險與取捨

| 風險 | 緩解 |
|---|---|
| Supabase 免費額度不夠 | Phase 4 先用 localStorage mock，Phase 6 再遷移 |
| n8n workflow 定時計算複雜 | 先用手動觸發，穩定後再設排程 |
| 手機 App 開發量大 | PWA 優先，React Native 後補 |
| 真實 API 費用高 | 先用 Polygon.io 免費 tier（5 calls/min） |

---

## 接受條件

- [ ] Phase 4：使用者可註冊/登入/關注股票/收到 Telegram 推播
- [ ] Phase 5：首頁顯示共振訊號排行榜，點進股票可看共振歷史
- [ ] `npm run build` 每階段零錯誤
- [ ] 所有新增元件有對應的載入中/空狀態/錯誤狀態
