import { seedFrom } from './utils';

export type Timeframe = '1D' | '5D' | '30D' | '6M' | '1Y' | 'ALL';

/** Generate mock confidence score history (12 months) for a ticker */
export function generateConfidenceHistory(ticker: string): { month: string; score: number }[] {
  const seed = seedFrom(ticker + '_conf');
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 271.8 + 419.3) * 43758.5453;
    return x - Math.floor(x);
  };
  const base = 30 + rng(0) * 50;
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const now = new Date();
  const history: { month: string; score: number }[] = [];
  let score = base;
  for (let i = 11; i >= 0; i--) {
    score = Math.min(100, Math.max(0, +(score + (rng(i) - 0.45) * 15).toFixed(0)));
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    history.push({ month: months[d.getMonth()], score });
  }
  return history;
}

/** Generate mock price data for a ticker + timeframe */
export function generatePrices(
  ticker: string,
  tf: Timeframe,
): { prices: number[]; labels: string[] } {
  const seed = seedFrom(ticker + tf);
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const basePrice = 80 + rng(0) * 220;
  let count: number;
  const labels: string[] = [];
  switch (tf) {
    case '1D':  count = 8;   for (let i = count; i > 0; i--) labels.push(`${10 + i}:00`); break;
    case '5D':  count = 5;   for (let i = count; i > 0; i--) labels.push(`D-${i}`); break;
    case '30D': count = 30;  for (let i = count; i > 0; i--) labels.push(`D-${i}`); break;
    case '6M':  count = 26;  for (let i = count; i > 0; i--) labels.push(`W-${i}`); break;
    case '1Y':  count = 12;  for (let i = count; i > 0; i--) labels.push(`${['J','F','M','A','M','J','J','A','S','O','N','D'][(12-i)%12]}`); break;
    case 'ALL': count = 20;  for (let i = count; i > 0; i--) labels.push(`Q${((count-i)%4)+1}-${26-count+i}`); break;
    default: count = 30;
  }

  const drift = rng(1) > 0.5 ? 1.003 : 0.997;
  const prices: number[] = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    p = +(p * drift * (0.97 + rng(i * 3) * 0.06)).toFixed(2);
    prices.push(p);
  }
  return { prices, labels };
}

/** Generate mock post-trade returns (5 periods) for insider trade tracking */
export function generatePostTradeReturns(
  ticker: string,
  tradeDate: string,
): { returns: number[]; summary: number } {
  const seed = seedFrom(ticker + tradeDate + '_post');
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 317.5 + 219.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const returns: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = +((rng(i) - 0.48) * 8).toFixed(1);
    returns.push(r);
  }
  const summary = +((returns.reduce((a, b) => a + b, 0) / 5)).toFixed(1);
  return { returns, summary };
}
