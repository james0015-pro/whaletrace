---
description: 測試規則 — 當編輯 *.test.ts 或 *.spec.ts 檔案時觸發
globs: ["src/**/*.test.*", "src/**/*.spec.*"]
alwaysApply: false
---

# 測試規則

## 測試框架
- Vitest + React Testing Library
- 測試檔案放在被測檔案旁邊，命名為 `*.test.tsx` 或 `*.test.ts`

## TDD 流程
1. 先寫失敗的測試
2. 執行測試確認失敗（紅燈）
3. 寫最少程式碼讓測試通過（綠燈）
4. 重構（不改變行為的前提改善程式碼）
5. Commit

## 測試類型
- **單元測試**：純函數、工具函數（`src/lib/utils.ts`）
- **元件測試**：使用 React Testing Library 測試元件行為
- **整合測試**：API 互動 + 狀態管理

## 必須測試
- 所有 `src/lib/` 下的工具函數
- 核心元件（SignalBadge、Skeleton、EmptyState、InsiderTradeCard）
- API client 的錯誤處理
