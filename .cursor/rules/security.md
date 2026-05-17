---
description: 安全規則 — 涵蓋所有檔案
globs: ["src/**/*"]
alwaysApply: false
---

# 安全規則

## 絕對禁止
- 不要在程式碼中 hardcode API Key、Token、密碼
- 所有敏感設定使用環境變數（`import.meta.env.VITE_*`）
- 不要在前端儲存未加密的使用者密碼
- 不要使用 `dangerouslySetInnerHTML` 除非經 XSS 過濾

## 認證
- 使用 Supabase Auth 進行使用者認證（Phase 4）
- Token 儲存在 localStorage 的 `whaletrace-auth-token`
- API 請求自動附帶 Authorization header

## 依賴安全
- 定期執行 `npm audit`
- 不引入不必要的第三方依賴
