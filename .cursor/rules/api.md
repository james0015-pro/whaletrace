---
description: API 與資料層規則 — 當編輯 src/lib/api.ts 或使用 endpoints 時觸發
globs: ["src/lib/api.ts", "src/lib/query.tsx"]
alwaysApply: false
---

# API 規則

## 請求規範
- 所有 API 請求使用 `src/lib/api.ts` 的 `endpoints` 物件
- 不要直接寫 `fetch()` — 使用封裝好的 `api.get()` / `api.post()`
- API Base URL 從環境變數 `VITE_API_URL` 讀取，預設 `http://localhost:8000/api/v1`

## TanStack Query 規範
- 使用 `useQuery` 獲取資料，`useMutation` 發送變更
- queryKey 使用描述性陣列，例如 `['insider-trades', { ticker }]`
- 在 mutation 成功後使用 `queryClient.invalidateQueries()` 刷新相關快取
- staleTime 預設 60 秒（內部人資料非秒級變動）

## 錯誤處理
- API 錯誤型別為 `ApiError`（定義在 `src/types/index.ts`）
- 使用 TanStack Query 的 `onError` 回呼處理全域錯誤（例如 401 → 登出）
- 元件層級使用 `error` 狀態顯示局部錯誤
