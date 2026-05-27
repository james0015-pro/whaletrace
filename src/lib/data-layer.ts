// ============================================================
// WhaleTrace Data Layer — Supabase 為主，n8n + Mock 為備援
// v3: 使用 /stock-query (365天內部人+機構)
// ============================================================

import type { InsiderTrade, PaginatedResponse, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';
import {
  MOCK_RESONANCE_SIGNALS,
  MOCK_INSTITUTION_ORDERS,
  getPaginatedTrades,
} from '@/lib/mock-data';
import { loadSecTrades } from '@/lib/sec-converter';
import { supabase } from '@/lib/supabase';

// ============================================================
// Stock Query v3 — 完整 365 天資料
// ============================================================

const N8N_BASE = 'https://n8n-james0015.zeabur.app/webhook';

async function fetchStockQuery(ticker: string) {
  try {
    const resp = await fetch(`${N8N_BASE}/stock-query?ticker=${ticker}`);
    if (!resp.ok) return null;
    return resp.json();
  } catch { return null; }
}

// ============================================================
// Supabase 資料轉換
// ============================================================

interface InsiderTradeRow {
  id: number;
  ticker: string;
  company_name: string | null;
  insider_name: string;
  role: string | null;
  transaction_date: string;
  filing_date: string;
  security: string | null;
  transaction_type: string | null;
  shares: number | null;
  price: number | null;
  value: number | null;
  shares_held: number | null;
  filing_url: string | null;
}

interface InstitutionalRow {
  id: number;
  ticker: string;
  institution_name: string;
  shares: number | null;
  market_value: number | null;
  change_shares: number | null;
  change_pct: number | null;
  portfolio_pct: number | null;
  filing_date: string | null;
}

interface StockSnapshotRow {
  id: number;
  ticker: string;
  snapshot_date: string;
  inst_ownership_pct: number | null;
  insider_ownership_pct: number | null;
  short_float_pct: number | null;
  short_ratio: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  analyst_recommendation: string | null;
}

function toInsiderTrade(row: InsiderTradeRow): InsiderTrade {
  const isBuy = row.transaction_type === 'Buy' || row.transaction_type === 'BUY';
  return {
    id: row.id,
    ticker: row.ticker,
    company_name: row.company_name || row.ticker,
    insider_name: row.insider_name,
    title: row.role || 'Insider',
    transaction_type: isBuy ? 'BUY' : 'SELL',
    shares: row.shares ?? 0,
    price: row.price ?? 0,
    total_value: row.value ?? 0,
    filing_date: row.filing_date,
    trade_date: row.transaction_date,
    is_10b5_1: false,
    sec_form_url: row.filing_url || '',
    signal_category: isBuy ? 'BUY' : 'SELL',
    signal_strength: 50,
  };
}

// ============================================================
// Insider Trades（Supabase → /stock-query fallback）
// ============================================================

let _supabaseTradesCache: InsiderTrade[] | null = null;

export async function fetchRealInsiderTrades(): Promise<InsiderTrade[]> {
  if (_supabaseTradesCache) return _supabaseTradesCache;

  try {
    const { data, error } = await supabase
      .from('insider_trades')
      .select('*')
      .order('filing_date', { ascending: false })
      .limit(100);

    if (error) throw error;
    if (data && data.length > 0) {
      _supabaseTradesCache = data.map(toInsiderTrade);
      return _supabaseTradesCache;
    }
  } catch {
    // Supabase 不可用 → fall through
  }

  return [];
}

let _secFallbackCache: InsiderTrade[] | null = null;

export async function getInsiderTrades(
  filter: 'all' | 'buy' | 'sell' | 'cluster',
  page: number,
  pageSize: number,
): Promise<PaginatedResponse<InsiderTrade>> {
  // 1. Try Supabase
  if (!_supabaseTradesCache) {
    await fetchRealInsiderTrades().catch(() => {});
  }

  if (_supabaseTradesCache && _supabaseTradesCache.length > 0) {
    let filtered: InsiderTrade[];
    switch (filter) {
      case 'buy':
        filtered = _supabaseTradesCache.filter(t => t.transaction_type === 'BUY');
        break;
      case 'sell':
        filtered = _supabaseTradesCache.filter(t => t.transaction_type === 'SELL');
        break;
      case 'cluster':
        filtered = _supabaseTradesCache.filter(t => t.signal_category === 'CLUSTER');
        break;
      default:
        filtered = [..._supabaseTradesCache];
    }
    filtered.sort((a, b) => b.filing_date.localeCompare(a.filing_date));
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);
    return { data, total: filtered.length, page, page_size: pageSize, has_more: start + data.length < filtered.length };
  }

  // 2. Fallback: SEC local data
  if (!_secFallbackCache) {
    try { _secFallbackCache = await loadSecTrades(); } catch { /* fallback */ }
  }
  if (_secFallbackCache && _secFallbackCache.length > 0) {
    let filtered = _secFallbackCache;
    if (filter === 'buy') filtered = _secFallbackCache.filter(t => t.transaction_type === 'BUY');
    else if (filter === 'sell') filtered = _secFallbackCache.filter(t => t.transaction_type === 'SELL');
    filtered.sort((a, b) => b.filing_date.localeCompare(a.filing_date));
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);
    return { data, total: filtered.length, page, page_size: pageSize, has_more: start + data.length < filtered.length };
  }

  // 3. Fallback: mock data
  return getPaginatedTrades(filter, page, pageSize);
}

// ============================================================
// Stock Snapshots（Supabase + /stock-query fallback）
// ============================================================

let _snapshotCache: StockSnapshotRow[] | null = null;

interface StockSnapshotLegacy {
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

export async function fetchStockSnapshots(): Promise<StockSnapshotLegacy[]> {
  if (_snapshotCache) {
    return _snapshotCache.map(toLegacySnapshot);
  }

  try {
    const { data, error } = await supabase
      .from('stock_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (data && data.length > 0) {
      _snapshotCache = data;
      return data.map(toLegacySnapshot);
    }
  } catch { /* fallback */ }

  return [];
}

function toLegacySnapshot(row: StockSnapshotRow): StockSnapshotLegacy {
  return {
    ticker: row.ticker,
    company_name: row.ticker,
    market_cap: row.market_cap ?? 0,
    sector: '',
    industry: '',
    price: 0,
    pe_trailing: row.pe_ratio ?? 0,
    pe_forward: 0,
    peg: 0,
    inst_own_pct: row.inst_ownership_pct ?? 0,
    insider_own_pct: row.insider_ownership_pct ?? 0,
    insider_trans_pct: 0,
    short_float_pct: row.short_float_pct ?? 0,
    short_ratio: row.short_ratio ?? 0,
    roe: 0,
    beta: 0,
    rsi14: 0,
    debt_equity: 0,
    revenue_growth: 0,
    profit_margin: 0,
    analyst_target: 0,
    recommendation: row.analyst_recommendation || 'N/A',
    sma50: 0,
    sma200: 0,
    data_date: row.snapshot_date,
  };
}

export async function getStockSnapshot(ticker: string): Promise<StockSnapshotLegacy | null> {
  // Try Supabase
  try {
    const { data, error } = await supabase
      .from('stock_snapshots')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (data) return toLegacySnapshot(data);
  } catch { /* fallback */ }

  // Fallback: /stock-query
  try {
    const sq = await fetchStockQuery(ticker);
    if (sq && sq.price) {
      return {
        ticker, company_name: ticker,
        market_cap: sq.market_cap ?? 0,
        sector: '', industry: '',
        price: sq.price ?? 0,
        pe_trailing: 0, pe_forward: 0, peg: 0,
        inst_own_pct: parseFloat(sq.inst_own_pct) || 0,
        insider_own_pct: 0, insider_trans_pct: 0,
        short_float_pct: 0, short_ratio: 0,
        roe: 0, beta: 0, rsi14: 0,
        debt_equity: 0, revenue_growth: 0, profit_margin: 0,
        analyst_target: 0, recommendation: 'N/A',
        sma50: 0, sma200: 0, data_date: '',
      };
    }
  } catch { /* fail */ }

  return null;
}

// ============================================================
// Institutional Holdings（Supabase + /stock-query fallback）
// ============================================================

interface InstitutionalHoldingLegacy {
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

export async function fetchInstitutionalHoldings(ticker: string): Promise<InstitutionalHoldingLegacy[]> {
  try {
    const { data, error } = await supabase
      .from('institutional_holdings')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .order('market_value', { ascending: false })
      .limit(30);

    if (error) throw error;
    if (data) {
      return data.map((row: InstitutionalRow) => ({
        ticker: row.ticker,
        institution_name: row.institution_name,
        quarter: row.filing_date || '',
        shares: row.shares ?? 0,
        market_value: row.market_value ?? 0,
        change_direction: (row.change_shares ?? 0) >= 0 ? 'INCREASED' : 'DECREASED',
        change_shares: row.change_shares ?? 0,
        pct_of_portfolio: row.portfolio_pct ?? 0,
        is_super_investor: false,
      }));
    }
  } catch { /* fallback */ }

  // Fallback: /stock-query
  try {
    const sq = await fetchStockQuery(ticker);
    if (sq && sq.institutional_holders) {
      return sq.institutional_holders.map((h: any) => ({
        ticker,
        institution_name: h.holder,
        quarter: h.date || '',
        shares: parseInt(h.shares_held) || 0,
        market_value: parseInt(h.value) || 0,
        change_direction: h.direction?.includes('增') ? 'INCREASED' : h.direction?.includes('減') ? 'DECREASED' : 'UNCHANGED',
        change_shares: 0,
        pct_of_portfolio: 0,
        is_super_investor: false,
      }));
    }
  } catch { /* fail */ }

  return [];
}

/** 機構大單 — Supabase → /stock-query → mock */
export async function getInstitutionOrders(): Promise<InstitutionOrder[]> {
  const allOrders: InstitutionOrder[] = [];
  const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL'];

  for (const ticker of TICKERS) {
    try {
      const holdings = await fetchInstitutionalHoldings(ticker);
      for (const h of holdings) {
        allOrders.push({
          institution: h.institution_name,
          ticker: h.ticker,
          company_name: h.ticker,
          amount: h.market_value,
          change_pct: 0,
          direction: h.change_direction === 'INCREASED' ? 'INCREASED' as const : 'DECREASED' as const,
        });
      }
    } catch { /* skip */ }
  }

  if (allOrders.length > 0) return allOrders;
  return MOCK_INSTITUTION_ORDERS;
}

// ============================================================
// Resonance Signals
// ============================================================

export async function getResonanceSignals(): Promise<ResonanceSignal[]> {
  return MOCK_RESONANCE_SIGNALS;
}

// ============================================================
// Clear cache
// ============================================================

export function clearDataCache(): void {
  _supabaseTradesCache = null;
  _secFallbackCache = null;
  _snapshotCache = null;
}
