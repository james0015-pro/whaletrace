// ============================================================
// WhaleTrace Data Layer — n8n SEC Proxy + WhaleTrace API + Mock Fallback
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
} from '@/lib/mock-data';

// ============================================================
// n8n Webhook URLs
// ============================================================

const N8N_BASE = 'https://n8n-james0015.zeabur.app/webhook';

const ENDPOINTS = {
  /** Stock Query v2 — 完整資料（365天內部人+機構） */
  insiderTrades: (ticker: string, limit = 10) =>
    `${N8N_BASE}/stock-query?ticker=${ticker}&limit=${limit}`,

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

interface StockQueryResponse {
  ticker: string;
  price: number | null;
  market_cap: number | null;
  inst_own_pct: string | null;
  insider_sentiment: string;
  insider_buys: number;
  insider_sells: number;
  insider_trades_365d: number;
  insiders: Array<{
    name: string;
    buys: number;
    sells: number;
    total_value: number;
    trades: Array<{
      date: string;
      buy_or_sell: string;
      shares: number;
      price: number;
      value: number;
    }>;
  }>;
  institutional_holders: Array<{
    holder: string;
    date: string;
    direction: string;
    shares_held: string;
    value: string;
    change_pct: string;
  }>;
}

function transformStockQueryToInsiderTrades(data: StockQueryResponse): InsiderTrade[] {
  const results: InsiderTrade[] = [];
  for (const insider of (data.insiders || [])) {
    for (const trade of (insider.trades || [])) {
      const isBuy = trade.buy_or_sell.includes('買');
      results.push({
        id: ++_realIdCounter,
        ticker: data.ticker,
        company_name: data.ticker,
        insider_name: insider.name,
        title: '',
        transaction_type: isBuy ? 'BUY' : 'SELL',
        shares: trade.shares,
        price: trade.price,
        total_value: trade.value,
        filing_date: trade.date,
        trade_date: trade.date,
        is_10b5_1: false,
        sec_form_url: '',
        signal_category: isBuy ? 'BUY' : 'SELL',
        signal_strength: 50,
      });
    }
  }
  return results;
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

function transformToInsiderTrade(raw: InsiderTrade): InsiderTrade {
  return raw;
}

// Old transform removed — now handled by transformStockQueryToInsiderTrades

// ============================================================
// Insider Trades (n8n SEC Proxy — 現有邏輯)
// ============================================================

let _realTradesCache: InsiderTrade[] | null = null;
const TRACKED_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META',
  'TSLA', 'BRK-B', 'JPM', 'V', 'UNH', 'XOM', 'WMT', 'JNJ', 'MA',
  'PG', 'HD', 'BAC', 'DIS', 'CRM', 'CRWV', 'PLTR', 'RDDT',
  'TSM', 'AMD', 'INTC', 'COIN', 'SMCI',
  'NFLX', 'ADBE', 'NVO', 'LLY', 'AVGO', 'ORCL', 'ABBV', 'PEP', 'KO'
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
      const data = await fetchFromN8N<StockQueryResponse>(url, 10000);

      if (data?.insiders?.length) {
        const transformed = transformStockQueryToInsiderTrades(data);
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
  _snapshotCache = null;
  _holdingsCache = new Map();
}
