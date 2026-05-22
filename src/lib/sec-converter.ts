// ============================================================
// SEC EDGAR → InsiderTrade Converter
// Maps real SEC Form 4 filing data to the app's InsiderTrade type.
// Data source: scripts/output/sec_insider_trades.json
// ============================================================

import type { InsiderTrade, TradeType, SignalCategory } from '@/types';

/** Raw SEC trade record from sec_insider_trades.json */
interface SecTradeRecord {
  ticker: string;
  company_name: string;
  insider_name: string;
  filing_date: string;
  filing_url: string;
  transaction_date: string;
  security: string;
  type: string;          // "BUY" | "SELL" | "OTHER"
  code: string;           // SEC transaction code (P, S, A, D...)
  shares: number;
  price: number;
  total_value: number;
  shares_owned_after: number;
  is_derivative: boolean;
}

/** SEC data wrapper (structure of sec_insider_trades.json) */
interface SecDataWrapper {
  timestamp: string;
  source: string;
  count: number;
  tickers_scanned: string[];
  trades: SecTradeRecord[];
}

// ---- Signal category derivation ----

function deriveCategory(type: string): SignalCategory {
  const upper = type.toUpperCase();
  if (upper === 'BUY') return 'BUY';
  if (upper === 'SELL') return 'SELL';
  return 'SELL'; // OTHER/NON-DERIVATIVE treated as SELL for safety
}

function deriveStrength(shares: number, totalValue: number): number {
  // Normalize to 0-100 based on trade magnitude
  // $100k+ trades → 80+, $10k-100k → 50-80, <$10k → 20-50
  if (totalValue > 1_000_000) return 85 + Math.min(15, Math.floor(totalValue / 5_000_000));
  if (totalValue > 100_000) return 60 + Math.floor((totalValue - 100_000) / 36_000);
  if (totalValue > 10_000) return 40 + Math.floor((totalValue - 10_000) / 4_500);
  return 20 + Math.floor(totalValue / 500);
}

/** Known insider titles from company filings — fallback to "Insider" */
function deriveTitle(insiderName: string): string {
  const lower = insiderName.toLowerCase();
  if (lower.includes('chief') || lower.includes('ceo')) return 'Chief Executive Officer';
  if (lower.includes('cfo') || lower.includes('chief financial')) return 'Chief Financial Officer';
  if (lower.includes('cto') || lower.includes('chief technolog')) return 'Chief Technology Officer';
  if (lower.includes('president')) return 'President';
  if (lower.includes('chairman') || lower.includes('chair')) return 'Chairman of the Board';
  if (lower.includes('director') || lower.includes('board')) return 'Director';
  if (lower.includes('vp ') || lower.includes('vice president')) return 'Vice President';
  if (lower.includes('general counsel') || lower.includes('gc ')) return 'General Counsel';
  return 'Insider';
}

// ---- Main converter ----

let _idCounter = 0;

export function convertSecTrade(record: SecTradeRecord): InsiderTrade {
  const transactionType: TradeType =
    record.type.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';

  return {
    id: ++_idCounter,
    ticker: record.ticker,
    company_name: record.company_name,
    insider_name: record.insider_name,
    title: deriveTitle(record.insider_name),
    transaction_type: transactionType,
    shares: record.shares,
    price: record.price,
    total_value: record.total_value,
    filing_date: record.filing_date,
    trade_date: record.transaction_date,
    is_10b5_1: false, // SEC data doesn't flag 10b5-1 plans
    sec_form_url: record.filing_url,
    signal_category: deriveCategory(record.type),
    signal_strength: deriveStrength(record.shares, record.total_value),
  };
}

export function convertSecTrades(data: SecDataWrapper): InsiderTrade[] {
  _idCounter = 0; // reset for deterministic IDs
  return data.trades
    .filter((t) => t.type === 'BUY' || t.type === 'SELL')
    .map(convertSecTrade)
    .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
}

// ---- Lazy loader (runtime fetch from public/data/) ----

let _secTradesCache: InsiderTrade[] | null = null;
let _loadPromise: Promise<InsiderTrade[]> | null = null;

export async function loadSecTrades(): Promise<InsiderTrade[]> {
  if (_secTradesCache) return _secTradesCache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = fetch('/data/sec_insider_trades.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((wrapper: SecDataWrapper) => {
      _secTradesCache = convertSecTrades(wrapper);
      return _secTradesCache;
    })
    .catch((err) => {
      console.warn('[WhaleTrace] SEC trades unavailable, falling back to mock data:', err.message);
      _secTradesCache = [];
      return _secTradesCache;
    });

  return _loadPromise;
}

/** Synchronous accessor — returns cached data or empty array */
export function getSecTrades(): InsiderTrade[] {
  return _secTradesCache ?? [];
}
