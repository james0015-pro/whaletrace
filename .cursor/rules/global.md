---
description: WhaleTrace 全專案通用規則 — 技術棧、程式碼風格、命名慣例
globs: ["**/*"]
alwaysApply: true
---

# WhaleTrace 專案規則

## 技術棧
- React 19 + TypeScript (strict mode) + Vite
- Tailwind CSS v3 + CSS 自訂屬性（暗黑主題優先）
- 狀態管理：TanStack Query v5（伺服器狀態）+ React Context（UI 狀態）
- 路由：React Router v7
- 動畫：framer-motion
- 圖表：Recharts + D3.js（僅桑基圖）
- 圖標：lucide-react
- 部署：Vercel（前端）+ Railway（後端 FastAPI）+ Supabase（資料庫）

## 程式碼風格
- 函數元件 + Hooks，不用 Class 元件
- Props 用 `interface` 定義
- 檔案命名：kebab-case（例如 `signal-badge.tsx`）
- 元件命名：PascalCase（例如 `SignalBadge`）
- 一個檔案只放一個元件（小輔助元件除外）
- 使用 `@/` 路徑別名引入 src/ 下的檔案

## 型別規範
- 禁止使用 `any`，必要時用 `unknown`
- API 回應型別定義在 `src/types/index.ts`
- 元件 Props 型別定義在元件檔案內

## 樣式規範
- 使用 Tailwind utility classes 為主
- 使用 `cn()`（來自 `@/lib/utils`）合併動態 class
- CSS 自訂屬性定義在 `src/index.css` 的 `:root` 中
- 顏色使用 Tailwind 自訂 token（例如 `text-green-primary`、`bg-canvas`）

## 禁止事項
- 不要用 `useEffect` 做資料獲取，使用 TanStack Query（`useQuery` / `useMutation`）
- 不要直接操作 DOM，使用 React ref
- 不要在元件內寫 inline API fetch，統一使用 `@/lib/api` 的 `endpoints` 物件
- 不要跳過型別定義
