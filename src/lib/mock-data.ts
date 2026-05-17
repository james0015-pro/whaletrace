// ============================================================
// WhaleTrace Mock Data Generator
// 開發期使用，不需後端即可有 500 筆擬真內部人交易
// ============================================================

import type { InsiderTrade, TradeType, SignalCategory, PaginatedResponse } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

// ---- 真實美股代號對照表 (20 檔) ----
const STOCKS: { ticker: string; company: string }[] = [
  { ticker: 'AAPL', company: 'Apple Inc.' },
  { ticker: 'MSFT', company: 'Microsoft Corporation' },
  { ticker: 'GOOGL', company: 'Alphabet Inc.' },
  { ticker: 'AMZN', company: 'Amazon.com, Inc.' },
  { ticker: 'NVDA', company: 'NVIDIA Corporation' },
  { ticker: 'META', company: 'Meta Platforms, Inc.' },
  { ticker: 'TSLA', company: 'Tesla, Inc.' },
  { ticker: 'JPM', company: 'JPMorgan Chase & Co.' },
  { ticker: 'V', company: 'Visa Inc.' },
  { ticker: 'WMT', company: 'Walmart Inc.' },
  { ticker: 'JNJ', company: 'Johnson & Johnson' },
  { ticker: 'PG', company: 'The Procter & Gamble Company' },
  { ticker: 'MA', company: 'Mastercard Incorporated' },
  { ticker: 'UNH', company: 'UnitedHealth Group Incorporated' },
  { ticker: 'HD', company: 'The Home Depot, Inc.' },
  { ticker: 'BAC', company: 'Bank of America Corporation' },
  { ticker: 'DIS', company: 'The Walt Disney Company' },
  { ticker: 'ADBE', company: 'Adobe Inc.' },
  { ticker: 'NFLX', company: 'Netflix, Inc.' },
  { ticker: 'CRM', company: 'Salesforce, Inc.' },
];

// ---- 隨機姓名素材 ----
const FIRST_NAMES = ['Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Karen', 'John', 'Patricia', 'Thomas', 'Nancy'];
const LAST_NAMES = ['Burke', 'Chen-Lin', 'Fitzgerald', 'Nakamura', 'Okonkwo', 'Ivanova', 'Martinez', 'Kamau', 'Dubois', 'Park'];

// ---- 職位池 ----
const TITLES = [
  'Chief Executive Officer',
  'Chief Financial Officer',
  'Chief Technology Officer',
  'Independent Director',
  'President',
  'EVP, General Counsel',
  'SVP, Corporate Development',
  'Chairman of the Board',
];

// ---- 常數 ----
const NOW = Date.now();
const DAY_MS = 86400000;
const MAX_DAYS_BACK = 14;
const SEC_BASE_URL = 'https://www.sec.gov/Archives/edgar/data';

// ============================================================
// 抽取輔助函式
// ============================================================

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

function randDate(daysBack: number): Date {
  const offset = Math.random() * daysBack * DAY_MS;
  return new Date(NOW - offset);
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * 判定 signal_category:
 * - BUY  + 非 10b5-1 → `BUY`
 * - SELL + 非 10b5-1 → `SELL`
 * - 10b5-1 計劃 → `TENB5_1`
 * - 若該 ticker 同日 ≥3 人買入 → `CLUSTER`（後置處理）
 */
function deriveCategory(type: TradeType, is10b5: boolean): SignalCategory {
  if (is10b5) return 'TENB5_1';
  return type;
}

// ============================================================
// 主產生器
// ============================================================

let _idCounter = 0;

export function generateTrades(count: number): InsiderTrade[] {
  const trades: InsiderTrade[] = [];
  const buyMap = new Map<string, number>(); // key: ticker::date → 當日買入人數

  for (let i = 0; i < count; i++) {
    const stock = pick(STOCKS);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const transactionType: TradeType = Math.random() < 0.45 ? 'BUY' : 'SELL'; // 45% 買入
    const is10b5 = Math.random() < 0.15;
    const shares = randInt(100, 500_000);
    const price = randFloat(5, 5000);
    const tradeDate = randDate(MAX_DAYS_BACK);
    // filing_date 在 trade_date 之後 0-3 天
    const filingDate = new Date(tradeDate.getTime() + randInt(0, 3) * DAY_MS);

    let category = deriveCategory(transactionType, is10b5);

    // 累計同日同 ticker 買入筆數
    const buyKey = `${stock.ticker}::${toISODate(tradeDate)}`;
    if (transactionType === 'BUY') {
      const cnt = (buyMap.get(buyKey) ?? 0) + 1;
      buyMap.set(buyKey, cnt);
    }

    // 亂數產生 CIK（給 SEC URL）
    const cik = String(randInt(1000000, 1999999));
    const accession = toISODate(filingDate).replace(/-/g, '') + randInt(100000, 999999);

    const trade: InsiderTrade = {
      id: ++_idCounter,
      ticker: stock.ticker,
      company_name: stock.company,
      insider_name: `${firstName} ${lastName}`,
      title: pick(TITLES),
      transaction_type: transactionType,
      shares,
      price,
      total_value: +(shares * price).toFixed(2),
      filing_date: toISODate(filingDate),
      trade_date: toISODate(tradeDate),
      is_10b5_1: is10b5,
      sec_form_url: `${SEC_BASE_URL}/${cik}/${accession}/xslForm4_X01/primary_doc.xml`,
      signal_category: category,
      signal_strength: randInt(10, 95),
    };

    trades.push(trade);
  }

  // ---- 後置：標記 CLUSTER（同日同 ticker ≥3 筆買入非 10b5-1） ----
  const clusterMap = new Map<string, InsiderTrade[]>();
  for (const t of trades) {
    if (t.transaction_type === 'BUY' && !t.is_10b5_1) {
      const key = `${t.ticker}::${t.trade_date}`;
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(t);
    }
  }

  for (const group of clusterMap.values()) {
    if (group.length >= 3) {
      for (const t of group) {
        t.signal_category = 'CLUSTER';
        t.signal_strength = randInt(70, 98); // 群組信號強度偏高
      }
    }
  }

  // 按 filing_date 降冪排序（最新在前）
  trades.sort((a, b) => b.filing_date.localeCompare(a.filing_date));

  return trades;
}

// ============================================================
// 預產生 500 筆
// ============================================================

export const MOCK_TRADES: InsiderTrade[] = generateTrades(500);

// ============================================================
// 分頁過濾輔助
// ============================================================

export function filterTrades(
  filter: 'all' | 'buy' | 'sell' | 'cluster',
): InsiderTrade[] {
  switch (filter) {
    case 'buy':
      return MOCK_TRADES.filter(
        (t) => t.transaction_type === 'BUY' && !t.is_10b5_1 && t.signal_category !== 'CLUSTER',
      );
    case 'sell':
      return MOCK_TRADES.filter(
        (t) => t.transaction_type === 'SELL' && !t.is_10b5_1,
      );
    case 'cluster':
      return MOCK_TRADES.filter((t) => t.signal_category === 'CLUSTER');
    default:
      return MOCK_TRADES;
  }
}

export function getPaginatedTrades(
  filter: 'all' | 'buy' | 'sell' | 'cluster',
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginatedResponse<InsiderTrade> {
  const filtered = filterTrades(filter);
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

// ============================================================
// 鯨魚共振訊號 Mock Data
// ============================================================

import type { ResonanceSignal } from '@/types';

const INSTITUTIONS = [
  'Vanguard Group', 'BlackRock', 'State Street', 'Fidelity',
  'Capital Group', 'T. Rowe Price', 'Goldman Sachs', 'Morgan Stanley',
  'JPMorgan Chase', 'Citadel', 'Renaissance Technologies', 'Baillie Gifford',
];

export const MOCK_RESONANCE_SIGNALS: ResonanceSignal[] = [
  {
    ticker: 'NVDA', company_name: 'NVIDIA Corporation',
    signal_date: '2026-05-15',
    total_institutional_buy: 2_800_000_000,
    institution_count: 3,
    institutions: [
      { name: 'Vanguard Group', amount: 1_500_000_000 },
      { name: 'BlackRock', amount: 900_000_000 },
      { name: 'Fidelity', amount: 400_000_000 },
    ],
    insider_buy_count: 4,
    insider_names: ['Jensen Huang', 'Colette Kress', 'Mark Stevens', 'John Dabiri'],
    signal_strength: 82,
    sector: '半導體',
  },
  {
    ticker: 'AAPL', company_name: 'Apple Inc.',
    signal_date: '2026-05-14',
    total_institutional_buy: 1_200_000_000,
    institution_count: 2,
    institutions: [
      { name: 'Berkshire Hathaway', amount: 800_000_000 },
      { name: 'T. Rowe Price', amount: 400_000_000 },
    ],
    insider_buy_count: 2,
    insider_names: ['Tim Cook', 'Luca Maestri'],
    signal_strength: 65,
    sector: '科技',
  },
  {
    ticker: 'MSFT', company_name: 'Microsoft Corporation',
    signal_date: '2026-05-13',
    total_institutional_buy: 1_850_000_000,
    institution_count: 4,
    institutions: [
      { name: 'Capital Group', amount: 700_000_000 },
      { name: 'State Street', amount: 600_000_000 },
      { name: 'Goldman Sachs', amount: 350_000_000 },
      { name: 'Morgan Stanley', amount: 200_000_000 },
    ],
    insider_buy_count: 3,
    insider_names: ['Satya Nadella', 'Amy Hood', 'Brad Smith'],
    signal_strength: 74,
    sector: '科技',
  },
  {
    ticker: 'JPM', company_name: 'JPMorgan Chase & Co.',
    signal_date: '2026-05-16',
    total_institutional_buy: 980_000_000,
    institution_count: 3,
    institutions: [
      { name: 'Vanguard Group', amount: 500_000_000 },
      { name: 'BlackRock', amount: 300_000_000 },
      { name: 'Citadel', amount: 180_000_000 },
    ],
    insider_buy_count: 2,
    insider_names: ['Jamie Dimon', 'Daniel Pinto'],
    signal_strength: 58,
    sector: '金融',
  },
];

// ============================================================
// 機構大單 Mock Data
// ============================================================

export interface InstitutionOrder {
  institution: string;
  ticker: string;
  company_name: string;
  amount: number;
  change_pct: number;
  direction: 'NEW' | 'INCREASED' | 'DECREASED';
}

export const MOCK_INSTITUTION_ORDERS: InstitutionOrder[] = [
  { institution: 'Vanguard Group', ticker: 'MSFT', company_name: 'Microsoft', amount: 2_100_000_000, change_pct: 12, direction: 'INCREASED' },
  { institution: 'BlackRock', ticker: 'AMZN', company_name: 'Amazon', amount: 1_800_000_000, change_pct: 0, direction: 'NEW' },
  { institution: 'State Street', ticker: 'NVDA', company_name: 'NVIDIA', amount: 1_500_000_000, change_pct: 8, direction: 'INCREASED' },
  { institution: 'Fidelity', ticker: 'META', company_name: 'Meta', amount: 1_200_000_000, change_pct: 15, direction: 'INCREASED' },
  { institution: 'T. Rowe Price', ticker: 'GOOGL', company_name: 'Alphabet', amount: 950_000_000, change_pct: -3, direction: 'DECREASED' },
  { institution: 'Goldman Sachs', ticker: 'AAPL', company_name: 'Apple', amount: 880_000_000, change_pct: 22, direction: 'INCREASED' },
  { institution: 'Morgan Stanley', ticker: 'JPM', company_name: 'JPMorgan', amount: 750_000_000, change_pct: 5, direction: 'INCREASED' },
  { institution: 'Renaissance Tech', ticker: 'TSLA', company_name: 'Tesla', amount: 620_000_000, change_pct: 0, direction: 'NEW' },
];
