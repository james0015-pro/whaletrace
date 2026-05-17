// ============================================================
// WhaleTrace Type Definitions
// ============================================================

/** Trade direction */
export type TradeType = 'BUY' | 'SELL';

/** Signal category for visual treatment */
export type SignalCategory = 'BUY' | 'SELL' | 'TENB5_1' | 'CLUSTER';

/** Insider trade record */
export interface InsiderTrade {
  id: number;
  ticker: string;
  company_name: string;
  insider_name: string;
  title: string;               // CEO, CFO, Director...
  transaction_type: TradeType;
  shares: number;
  price: number;
  total_value: number;
  filing_date: string;         // ISO date
  trade_date: string;
  is_10b5_1: boolean;
  sec_form_url: string;
  signal_category: SignalCategory;
  signal_strength: number;     // 0-100
}

/** Cluster buy signal */
export interface ClusterSignal {
  id: number;
  ticker: string;
  company_name: string;
  signal_date: string;
  insider_count: number;
  total_buy_value: number;
  insider_names: string[];
  price_on_signal: number;
  price_3m?: number;
  price_6m?: number;
  price_12m?: number;
}

/** Institutional holding record */
export interface InstitutionalHolding {
  id: number;
  institution_name: string;
  ticker: string;
  quarter: string;             // "2026Q1"
  shares: number;
  market_value: number;
  change_direction: 'NEW' | 'INCREASED' | 'DECREASED' | 'SOLD_OUT';
  change_shares: number;
  is_super_investor: boolean;
}

/** Super investor profile */
export interface SuperInvestor {
  name: string;
  firm: string;
  slug: string;
  avatar_url?: string;
  description: string;
}

/** Confidence score breakdown */
export interface ConfidenceScore {
  ticker: string;
  score_date: string;
  score: number;               // 0-100
  buy_count_12m: number;
  sell_count_12m: number;
  net_buy_value_12m: number;
  has_cluster_signal: boolean;
  sub_scores: {
    buy_scale: number;         // 0-100
    buyer_count: number;       // 0-100
    buy_sell_ratio: number;    // 0-100
    cluster_presence: number;  // 0-100
  };
}

/** Stock detail aggregate */
export interface StockDetail {
  ticker: string;
  company_name: string;
  market_cap?: number;
  sector?: string;
  employees?: number;
  confidence: ConfidenceScore;
  recent_trades: InsiderTrade[];
  institutional_holdings: InstitutionalHolding[];
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** API error */
export interface ApiError {
  message: string;
  code: string;
  status: number;
}
