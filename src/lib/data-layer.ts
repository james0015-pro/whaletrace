// ============================================================
// WhaleTrace Data Layer — n8n SEC Proxy + WhaleTrace API + Mock Fallback
// ============================================================
// 順序：試 n8n webhook → fallback mock data
// 提供與現有 hooks/components 相容的介面

import type { InsiderTrade, PaginatedResponse, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';
import {
  MOCK_RESONANCE_SIGNALS,
  MOCK_INSTITUTION_ORDERS,
  getPaginatedTrades,
} from '@/lib/mock-data';
import { loadSecTrades } from '@/lib/sec-converter';

// ============================================================
// n8n Webhook URLs
// ============================================================

const N8N_BASE = 'https://n8n-james0015.zeabur.app/webhook';

const ENDPOINTS = {
  /** SEC Form 4 內部人交易（現有） */
  insiderTrades: (ticker: string, limit = 10) =>
    `${N8N_BASE}/sec-insider-trades?ticker=${ticker}&limit=${limit}`,

  /** WhaleTrace 籌碼快照（機構持股%、放空%、估值） */
  stockSnapshot: (ticker?: string) =>
    ticker
      ? `${N8N_BASE}/whaletrace-snapshot?ticker=${ticker}`
      : `${N8N_BASE}/whaletrace-snapshot`,

  /** WhaleTrace 機構持股明細（分頁） */
  institutionalHoldings: (ticker: string, page = 1, pageSize = 20) =>
    `${N8N_BASE}/whaletrace-institutional?ticker=${ticker}&page=${page}&page_size=${pageSize}`,
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
// Types from WhaleTrace API response
// ============================================================

interface StockSnapshotRaw {
  ticker: string;
  company_name: string;
  market_cap: number;
  sector: string;
  industry: string;
  price: number;
  pe_trailing: number;
  pe_forward: number;
  peg: number;
  inst_own_pct: number;
  insider_own_pct: number;
  insider_trans_pct: number;
  short_float_pct: number;
  short_ratio: number;
  roe: number;
  beta: number;
  rsi14: number;
  debt_equity: number;
  revenue_growth: number;
  profit_margin: number;
  analyst_target: number;
  recommendation: string;
  sma50: number;
  sma200: number;
  data_date: string;
}

interface SnapshotResponse {
  data: StockSnapshotRaw[];
  total: number;
  generated_at: string;
}

interface InstitutionalHoldingRaw {
  ticker: string;
  institution_name: string;
  quarter: string;
  shares: number;
  market_value: number;
  change_direction: string;
  change_shares: number;
  pct_of_portfolio: number;
  is_super_investor: boolean;
}

interface InstitutionalResponse {
  data: InstitutionalHoldingRaw[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
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
    is_10b5_1: false,
    sec_form_url: raw.filing_url,
    signal_category: isBuy ? 'BUY' : 'SELL',
    signal_strength: 50,
  };
}

// ============================================================
// Insider Trades (n8n SEC Proxy — 現有邏輯)
// ============================================================

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
      // n8n 無法連線 — 該 ticker 跳過
    }
  }

  if (allTrades.length > 0) {
    _realTradesCache = allTrades;
  }

  return allTrades;
}

// Local SEC EDGAR fallback (302 real trades from sec_insider_trades.json)
let _secFallbackCache: InsiderTrade[] | null = null;

export async function getInsiderTrades(
  filter: 'all' | 'buy' | 'sell' | 'cluster',
  page: number,
  pageSize: number,
): Promise<PaginatedResponse<InsiderTrade>> {
  if (!_realTradesCache) {
    await fetchRealInsiderTrades().catch(() => {});
  }

  if (_realTradesCache && _realTradesCache.length > 0) {
    let filtered: InsiderTrade[];
    switch (filter) {
      case 'buy':
        filtered = _realTradesCache.filter(
          (t) => t.transaction_type === 'BUY' && t.signal_category !== 'CLUSTER',
        );
        break;
      case 'sell':
        filtered = _realTradesCache.filter((t) => t.transaction_type === 'SELL');
        break;
      case 'cluster':
        filtered = _realTradesCache.filter((t) => t.signal_category === 'CLUSTER');
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

  // Fallback 2: local SEC EDGAR data (302 real Form 4 trades)
  if (!_secFallbackCache) {
    try {
      _secFallbackCache = await loadSecTrades();
    } catch {
      // SEC file unavailable — fall through to mock
    }
  }

  if (_secFallbackCache && _secFallbackCache.length > 0) {
    let filtered: InsiderTrade[];
    switch (filter) {
      case 'buy':
        filtered = _secFallbackCache.filter((t) => t.transaction_type === 'BUY' && t.signal_category !== 'CLUSTER');
        break;
      case 'sell':
        filtered = _secFallbackCache.filter((t) => t.transaction_type === 'SELL');
        break;
      case 'cluster':
        filtered = _secFallbackCache.filter((t) => t.signal_category === 'CLUSTER');
        break;
      default:
        filtered = [..._secFallbackCache];
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

  return getPaginatedTrades(filter, page, pageSize);
}

// ============================================================
// Stock Snapshots (NEW — WhaleTrace API)
// ============================================================

let _snapshotCache: StockSnapshotRaw[] | null = null;

export async function fetchStockSnapshots(): Promise<StockSnapshotRaw[]> {
  if (_snapshotCache) return _snapshotCache;

  try {
    const data = await fetchFromN8N<SnapshotResponse>(ENDPOINTS.stockSnapshot(), 10000);
    if (data?.data?.length) {
      _snapshotCache = data.data;
      return data.data;
    }
  } catch {
    // WhaleTrace API 不可用 — 沿用空陣列
  }

  return [];
}

export async function getStockSnapshot(
  ticker: string,
): Promise<StockSnapshotRaw | null> {
  // 先試快取
  if (_snapshotCache) {
    const found = _snapshotCache.find(
      (s) => s.ticker.toUpperCase() === ticker.toUpperCase(),
    );
    if (found) return found;
  }

  // 直接查 API
  try {
    const data = await fetchFromN8N<StockSnapshotRaw>(
      ENDPOINTS.stockSnapshot(ticker),
      10000,
    );
    return data && data.ticker ? data : null;
  } catch {
    return null;
  }
}

// ============================================================
// Institutional Holdings (NEW — WhaleTrace API)
// ============================================================

let _holdingsCache: Map<string, InstitutionalHoldingRaw[]> = new Map();

export async function fetchInstitutionalHoldings(
  ticker: string,
): Promise<InstitutionalHoldingRaw[]> {
  if (_holdingsCache.has(ticker)) {
    return _holdingsCache.get(ticker)!;
  }

  try {
    const data = await fetchFromN8N<InstitutionalResponse>(
      ENDPOINTS.institutionalHoldings(ticker, 1, 30),
      10000,
    );

    if (data?.data?.length) {
      _holdingsCache.set(ticker, data.data);
      return data.data;
    }
  } catch {
    // API 不可用
  }

  return [];
}

/** 機構大單 — 從 WhaleTrace API 取真實資料，fallback mock */
export async function getInstitutionOrders(): Promise<InstitutionOrder[]> {
  const allOrders: InstitutionOrder[] = [];

  // 試取前 5 檔追蹤股票的機構持股
  for (const ticker of TRACKED_TICKERS.slice(0, 5)) {
    try {
      const holdings = await fetchInstitutionalHoldings(ticker);
      for (const h of holdings) {
        // InstitutionOrder uses: institution, ticker, company_name, amount, change_pct, direction
        allOrders.push({
          institution: h.institution_name,
          ticker: h.ticker,
          company_name: h.ticker,  // will be enriched from snapshot if available
          amount: h.market_value,
          change_pct: 0,
          direction: h.change_direction === 'INCREASED' ? 'INCREASED' as const
            : h.change_direction === 'DECREASED' ? 'DECREASED' as const
            : 'NEW' as const,
        });
      }
    } catch {
      // skip
    }
  }

  if (allOrders.length > 0) return allOrders;
  return MOCK_INSTITUTION_ORDERS;
}

// ============================================================
// Resonance Signals (still mock — awaiting 13F quarterly data)
// ============================================================

export async function getResonanceSignals(): Promise<ResonanceSignal[]> {
  // TODO: 等 WhaleTrace API 擴充共振訊號計算
  return MOCK_RESONANCE_SIGNALS;
}

// ============================================================
// Clear cache (for manual refresh)
// ============================================================

export function clearDataCache(): void {
  _realTradesCache = null;
  _secFallbackCache = null;
  _snapshotCache = null;
  _holdingsCache = new Map();
}
