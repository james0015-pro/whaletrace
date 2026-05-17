// ============================================================
// WhaleTrace Data Layer — n8n SEC Proxy + Mock Fallback
// ============================================================
// 順序：試 n8n webhook → fallback mock data
// 提供與現有 hooks/components 相容的介面

import type { InsiderTrade, PaginatedResponse, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';
import {
  MOCK_TRADES,
  MOCK_RESONANCE_SIGNALS,
  MOCK_INSTITUTION_ORDERS,
  getPaginatedTrades,
  filterTrades,
} from '@/lib/mock-data';

// ============================================================
// n8n Webhook URLs
// ============================================================

const N8N_BASE = 'https://n8n-james0015.zeabur.app/webhook';

const ENDPOINTS = {
  insiderTrades: (ticker: string, limit = 10) =>
    `${N8N_BASE}/sec-insider-trades?ticker=${ticker}&limit=${limit}`,
} as const;

// ============================================================
// Types from n8n SEC response
// ============================================================

interface SECTransactionRaw {
  ticker: string;
  company_name: string;
  insider_name: string;
  role: string;
  filing_date: string;
  filing_url: string;
  transaction_date: string;
  security: string;
  type: string;
  code: string;
  shares: number | null;
  price: number | null;
  total_value: number | null;
  shares_owned_after: number | null;
  is_derivative: boolean;
}

interface SECResponse {
  success: boolean;
  count: number;
  query_ticker: string;
  data_timestamp: string;
  source: string;
  trades: SECTransactionRaw[];
}

// ============================================================
// n8n API Client
// ============================================================

async function fetchFromN8N<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Transform: n8n SEC → InsiderTrade
// ============================================================

let _realIdCounter = 1000000;

function transformToInsiderTrade(raw: SECTransactionRaw): InsiderTrade {
  const isBuy = raw.type === 'BUY' || raw.type === 'DERIVATIVE_BUY';
  const isSell = raw.type === 'SELL' || raw.type === 'DERIVATIVE_SELL';

  return {
    id: ++_realIdCounter,
    ticker: raw.ticker,
    company_name: raw.company_name,
    insider_name: raw.insider_name,
    title: raw.role,
    transaction_type: isBuy ? 'BUY' : isSell ? 'SELL' : 'BUY',
    shares: raw.shares ?? 0,
    price: raw.price ?? 0,
    total_value: raw.total_value ?? 0,
    filing_date: raw.filing_date,
    trade_date: raw.transaction_date,
    is_10b5_1: false, // SEC XML doesn't easily expose this
    sec_form_url: raw.filing_url,
    signal_category: isBuy ? 'BUY' : 'SELL',
    signal_strength: 50, // default, will be enhanced later
  };
}

// ============================================================
// Public API — 與現有 hooks 相容
// ============================================================

/** 用真實 SEC 資料升級 mock 中的同 ticker 項目 */
let _realTradesCache: InsiderTrade[] | null = null;
const TRACKED_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META',
  'TSLA', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'MA', 'UNH',
  'HD', 'BAC', 'DIS', 'ADBE', 'NFLX', 'CRM',
];

export async function fetchRealInsiderTrades(
  tickers: string[] = TRACKED_TICKERS,
  limitPerTicker = 5,
): Promise<InsiderTrade[]> {
  if (_realTradesCache) return _realTradesCache;

  const allTrades: InsiderTrade[] = [];

  for (const ticker of tickers) {
    try {
      const url = ENDPOINTS.insiderTrades(ticker, limitPerTicker);
      const data = await fetchFromN8N<SECResponse>(url, 10000);

      if (data?.trades?.length) {
        const transformed = data.trades.map(transformToInsiderTrade);
        allTrades.push(...transformed);
      }
    } catch {
      // n8n 無法連線 — 該 ticker 跳過，等下一個
    }
  }

  if (allTrades.length > 0) {
    _realTradesCache = allTrades;
  }

  return allTrades;
}

/**
 * 主要 fetcher：先試 n8n，失敗就用 mock
 */
export async function getInsiderTrades(
  filter: 'all' | 'buy' | 'sell' | 'cluster',
  page: number,
  pageSize: number,
): Promise<PaginatedResponse<InsiderTrade>> {
  // 嘗試拿真實資料
  if (!_realTradesCache) {
    await fetchRealInsiderTrades().catch(() => {});
  }

  if (_realTradesCache && _realTradesCache.length > 0) {
    // 用真實資料做分頁
    let filtered: InsiderTrade[];
    switch (filter) {
      case 'buy':
        filtered = _realTradesCache.filter(
          (t) => t.transaction_type === 'BUY' && t.signal_category !== 'CLUSTER',
        );
        break;
      case 'sell':
        filtered = _realTradesCache.filter(
          (t) => t.transaction_type === 'SELL',
        );
        break;
      case 'cluster':
        filtered = _realTradesCache.filter(
          (t) => t.signal_category === 'CLUSTER',
        );
        break;
      default:
        filtered = [..._realTradesCache];
    }

    filtered.sort((a, b) => b.filing_date.localeCompare(a.filing_date));

    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return {
      data,
      total: filtered.length,
      page,
      page_size: pageSize,
      has_more: start + data.length < filtered.length,
    };
  }

  // Fallback to mock
  return getPaginatedTrades(filter, page, pageSize);
}

/**
 * 共振訊號 — 目前仍是 mock（需等 n8n + 13F 資料串接）
 */
export async function getResonanceSignals(): Promise<ResonanceSignal[]> {
  return MOCK_RESONANCE_SIGNALS;
}

/**
 * 機構大單 — 目前仍是 mock（需等 13F 季報資料）
 */
export async function getInstitutionOrders(): Promise<InstitutionOrder[]> {
  return MOCK_INSTITUTION_ORDERS;
}
