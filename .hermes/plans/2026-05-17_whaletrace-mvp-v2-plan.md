# WhaleTrace MVP v2 — 完整執行計畫

**建立時間:** 2026-05-17  
**範圍:** 選項 3 — 畫面 + 真實資料 + Telegram 推播  
**方法論:** Superpowers (Plan → Execute → Verify)

---

## 🎯 Goal

讓 WhaleTrace 成為一個可實際運行的 MVP：
- 首頁三段式儀表板（共振訊號 + 機構大單 + 內部人交易）
- 中英文雙語切換
- SEC EDGAR API 真實資料（非 mock）
- Telegram Bot 偵測到共振訊號時自動推播

---

## 📦 Phase A: 修復 Zeabur 部署（阻擋器）

**現狀:** GitHub master 有完整 v2+i18n 程式碼，但 Zeabur serve 的是舊版。  
**可能原因:** Zeabur build 失敗，自動回退到最後成功版本。  
**解法:** 本地 build 確認無誤後，直接重新部署。

| # | 任務 | 檔案 | 驗證 |
|---|---|---|---|
| A1 | `npm run build:prod` 本地確認無 error | — | exit code 0 |
| A2 | 檢查 build output 包含 ResonanceCard/CompactDataTable 字串 | dist/assets/*.js | `grep -l "ResonanceCard" dist/assets/*.js` |
| A3 | 推上 GitHub master | — | Zeabur 觸發 deploy |
| A4 | 等 Zeabur build 完成，檢查 `https://whaletrace.zeabur.app` HTML 資產 hash 是否更新 | — | 資產 hash ≠ `dvMryLKm` |
| A5 | 手動觸發 Redeploy（若 Zeabur 未自動偵測） | Zeabur Dashboard | — |

---

## 📦 Phase B: 完成 i18n 雙語整合

**現狀:** i18n 架構已建（config + en/zh-TW + LanguageSwitcher），App.tsx/TopNavBar/Sidebar 已整合。  
**剩餘:** 所有頁面元件尚未使用 `useTranslation()`。

| # | 任務 | 檔案 |
|---|---|---|
| B1 | FeedPage 改用 `useTranslation()` | `src/pages/FeedPage.tsx` |
| B2 | SignalsPage, InstitutionsPage, WatchlistPage, SettingsPage, StockDetailPage 改用 `useTranslation()` | `src/pages/*.tsx` |
| B3 | TradeCard 欄位標籤改用 `useTranslation()` | `src/components/features/TradeCard.tsx` |
| B4 | ResonanceCard, CompactDataTable 改用 `useTranslation()` | `src/components/features/ResonanceCard.tsx`, `CompactDataTable.tsx` |
| B5 | SignalBadge 標籤改用 `useTranslation()` | `src/components/shared/SignalBadge.tsx` |
| B6 | build → push → 確認語言切換在瀏覽器正常 | — |

---

## 📦 Phase C: SEC EDGAR API 真實資料

**現狀:** 全部用 mock data（`src/lib/mock-data.ts`）。  
**目標:** 前端 call SEC EDGAR API 或透過 n8n middleware 代理。

| # | 任務 | 說明 |
|---|---|---|
| C1 | 研究 SEC EDGAR API endpoint（Form 4 insider trades） | `https://efts.sec.gov/LATEST/search-index?q=...` |
| C2 | 在 n8n 建立「SEC EDGAR Proxy」workflow | 接收前端請求 → call SEC API → 回傳 JSON |
| C3 | 前端 `src/lib/api.ts` 新增 `fetchInsiderTrades()` | call n8n webhook → parse → return |
| C4 | 機構 13F 資料同理（或先用 mock，等季報週期） | — |
| C5 | 共振訊號目前繼續用 mock（等真實資料到位再換） | — |

---

## 📦 Phase D: n8n Telegram 共振訊號推播

**現狀:** 無推播。  
**目標:** n8n 定時檢查共振訊號 → 偵測到新訊號 → Telegram 推送。

| # | 任務 | 說明 |
|---|---|---|
| D1 | n8n 建立「WhaleTrace Resonance Alert」workflow | Cron 每 30 分鐘 → 查共振訊號 API → 過濾新訊號 → Telegram Send |
| D2 | 前端 `/api/resonance` endpoint（或 n8n webhook 直接計算） | 回傳當前共振訊號列表 |
| D3 | Telegram 訊息格式：`🐋 鯨魚共振：NVDA — $2.8B 機構買入 + 4 內部人跟買 [查看](https://whaletrace.zeabur.app/stocks/NVDA)` | — |
| D4 | 測試：手動觸發 workflow → 確認 Telegram 收到訊息 | — |

---

## 📦 Phase E: 整合部署 + 全端驗證

| # | 任務 |
|---|---|
| E1 | 全部 push → Zeabur 最終部署 |
| E2 | 瀏覽器測試：首頁三段正常、中英切換、stock detail 頁 |
| E3 | 瀏覽器測試：RWD（手機/平板/桌面） |
| E4 | n8n 測試：resonance alert 推送成功 |
| E5 | 記錄已知限制（哪些還是 mock、哪些 API 待接） |

---

## ⚠️ 風險

| 風險 | 緩解 |
|---|---|
| Zeabur build 持續失敗 | 改用靜態上傳（dist/ 直接 deploy） |
| SEC EDGAR API 限流/CORS | 全部透過 n8n 代理，前端不直接 call |
| n8n 雲端 quota 不夠 | Telegram 推播用最小頻率 |
| 繁體中文 i18n 覆蓋不全 | 先英文完整、中文補重點區塊 |

---

## 📁 檔案變更預覽

```
修改: src/pages/FeedPage.tsx          (~50行改翻譯)
修改: src/pages/SignalsPage.tsx       (~15行)
修改: src/pages/InstitutionsPage.tsx  (~10行)
修改: src/pages/WatchlistPage.tsx     (~10行)
修改: src/pages/SettingsPage.tsx      (~10行)
修改: src/pages/StockDetailPage.tsx   (~10行)
修改: src/components/features/TradeCard.tsx        (~5行)
修改: src/components/features/ResonanceCard.tsx    (~3行)
修改: src/components/features/CompactDataTable.tsx  (~5行)
修改: src/components/shared/SignalBadge.tsx         (~5行)
新增: src/lib/api.ts 擴充 (fetchInsiderTrades)
新增: n8n workflows/whaletrace-sec-proxy.json
新增: n8n workflows/whaletrace-resonance-alert.json
```

---

## 🚦 執行順序

```
A (修部署) → B (i18n) → build / push → 確認畫面 → C (真實資料) → D (推播) → E (全驗)
```

A 和 B 有依賴關係（需要先確認 build 能過才能繼續加 code）。  
C 和 D 可並行。
