# 🐳 WhaleTrace 內部人/機構回測工具

從你的本機執行，找出 10 年內勝率 90%+ 的內部人和機構。

---

## 安裝

```bash
pip install yfinance pandas
```

## 執行

### 1️⃣ 內部人分析（較快，~5 分鐘）

```bash
python3 run_insider_analysis.py
```

- 分析 54 檔美股的所有內部人**買入**交易
- 比對買入後 60 天內的財報盤前漲跌
- 輸出 `insider_edge_results.json`

### 2️⃣ 機構分析（較慢，~20-60 分鐘）

```bash
python3 run_institution_analysis.py
```

- 從 SEC EDGAR 下載 21 家頂尖機構的 13F 季報
- 逐季比對增減持，交叉比對財報盤前漲跌
- 雙向勝率：增持+漲=贏，減持+跌=贏
- 輸出 `institution_edge_results.json`

---

## 自訂參數

編輯腳本開頭的常數：

```python
LOOKBACK_DAYS = 60    # 買入後幾天內有財報
MIN_TRADES = 3        # 最少幾筆交易才列入排名
MAX_QUARTERS = 30     # 每機構最多抓幾季（約 7.5 年）
REQUEST_DELAY = 0.5   # SEC 請求延遲（秒）
```

---

## 輸出格式

`insider_edge_results.json` / `institution_edge_results.json`:

```json
{
  "rankings": [
    {
      "insider": "MUSK ELON REEVE",
      "tickers": ["TSLA"],
      "win_rate": 100.0,
      "total": 1,
      "wins": 1,
      "trades": [
        {
          "date": "2025-09-12",
          "earnings_date": "2025-10-22",
          "premarket_pct": 1.02,
          "is_win": true,
          "price": 371.90,
          "shares": 2568732,
          "value": 999959042
        }
      ]
    }
  ]
}
```

---

## ⚠️ 注意事項

1. **CUSIP 對照表**：腳本內建 ~60 檔美股 CUSIP。如果機構大量持有不在清單上的股票，會被略過。可自行擴充 `CUSIP_MAP`。
2. **SEC 速率限制**：腳本已設定 0.5 秒延遲。如遇到 429 錯誤，增加 `REQUEST_DELAY`。
3. **數據年份**：yfinance 內部人資料約 2-3 年，13F 季報可回溯 7-10 年（視 SEC 保存期限）。

---

## 擴充 CUSIP 對照表

在 `CUSIP_MAP` 字典中新增：

```python
CUSIP_MAP = {
    "03783310": "AAPL",   # Apple
    "59491810": "MSFT",   # Microsoft
    # ... 自行新增 ...
}
```

CUSIP 可從以下來源取得：
- https://www.quantconnect.com/docs/v2/writing-algorithms/securities/asset-classes/us-equity/cusip
- FINRA 的 CUSIP 查詢工具
