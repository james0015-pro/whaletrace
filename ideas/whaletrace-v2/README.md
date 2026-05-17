# WhaleTrace v2 — Idea Package

> 從「內部人交易追蹤器」升級為「鯨魚共振訊號雷達」

## 文件索引

| 編號 | 文件 | 說明 |
|---|---|---|
| 01 | [design-doc](01-design-doc.md) | 產品設計：核心概念、使用者流程、功能清單、非目標 |
| 02 | [ui-design-brief](02-ui-design-brief.md) | 介面設計：每個畫面的 ASCII 佈局、元件清單、視覺方向 |
| 03 | [implementation-spec](03-implementation-spec.md) | 實作規格：Phase 4-6 任務拆解、檔案清單、驗收條件 |

## 狀態

| 階段 | 狀態 |
|---|---|
| Phase 0-3（框架+卡片+詳情+搜尋） | ✅ 已完成 |
| Phase 4（認證+關注+推播） | 🚧 待開發 |
| Phase 5（共振訊號+歷史+股價圖） | 📋 已規劃 |
| Phase 6（上線準備） | 📋 已規劃 |

## 核心產品決策

- **產品感受**：彭博終端機——冷靜、數據密度高、專業
- **核心功能**：機構 $1 億+買入 ＋ 內部高管跟買 ＝ 鯨魚共振訊號
- **絕不做**：交易下單、社群功能、AI 選股推薦
- **推播**：Telegram 優先，Line 後續
- **平台**：Web（MVP）→ iOS + Android（Post-MVP）
- **資料**：Mock 先行 → Polygon.io 真資料
