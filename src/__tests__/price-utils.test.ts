import { describe, it, expect } from 'vitest';
import {
  generatePrices,
  generateConfidenceHistory,
  generatePostTradeReturns,
  type Timeframe,
} from '@/lib/price-utils';

// ─── generatePrices ─────────────────────────────────────────────
describe('generatePrices', () => {
  it('returns the right number of data points per timeframe', () => {
    const tfCounts: Record<string, number> = {
      '1D': 8, '5D': 5, '30D': 30, '6M': 26, '1Y': 12, 'ALL': 20,
    };

    for (const [tf, expectedCount] of Object.entries(tfCounts)) {
      const result = generatePrices('AAPL', tf as Timeframe);
      expect(result.prices).toHaveLength(expectedCount);
      expect(result.labels).toHaveLength(expectedCount);
    }
  });

  it('is deterministic', () => {
    const a = generatePrices('NVDA', '30D');
    const b = generatePrices('NVDA', '30D');
    expect(a.prices).toEqual(b.prices);
    expect(a.labels).toEqual(b.labels);
  });

  it('returns different data for different tickers', () => {
    const aapl = generatePrices('AAPL', '30D');
    const msft = generatePrices('MSFT', '30D');
    // First price should differ
    expect(aapl.prices[0]).not.toBe(msft.prices[0]);
  });

  it('all prices are positive', () => {
    const result = generatePrices('TSLA', '1Y');
    for (const p of result.prices) {
      expect(p).toBeGreaterThan(0);
    }
  });

  it('prices are positive numbers', () => {
    const result = generatePrices('GOOGL', 'ALL');
    for (const p of result.prices) {
      expect(p).toBeGreaterThan(0);
      expect(typeof p).toBe('number');
    }
  });
});

// ─── generateConfidenceHistory ─────────────────────────────────
describe('generateConfidenceHistory', () => {
  it('returns 12 months of data', () => {
    const history = generateConfidenceHistory('AAPL');
    expect(history).toHaveLength(12);
  });

  it('scores are in range [0, 100]', () => {
    const history = generateConfidenceHistory('NVDA');
    for (const h of history) {
      expect(h.score).toBeGreaterThanOrEqual(0);
      expect(h.score).toBeLessThanOrEqual(100);
    }
  });

  it('each entry has month and score', () => {
    const history = generateConfidenceHistory('MSFT');
    for (const h of history) {
      expect(h).toHaveProperty('month');
      expect(h).toHaveProperty('score');
      expect(h.month).toHaveLength(1);
    }
  });

  it('is deterministic', () => {
    expect(generateConfidenceHistory('AAPL')).toEqual(
      generateConfidenceHistory('AAPL'),
    );
  });
});

// ─── generatePostTradeReturns ──────────────────────────────────
describe('generatePostTradeReturns', () => {
  it('returns 5 returns + summary', () => {
    const result = generatePostTradeReturns('AAPL', '2026-05-15');
    expect(result.returns).toHaveLength(5);
    expect(typeof result.summary).toBe('number');
  });

  it('is deterministic', () => {
    const a = generatePostTradeReturns('NVDA', '2026-01-01');
    const b = generatePostTradeReturns('NVDA', '2026-01-01');
    expect(a).toEqual(b);
  });

  it('summary is the average of returns', () => {
    const result = generatePostTradeReturns('MSFT', '2026-03-01');
    const avg = +(result.returns.reduce((a, b) => a + b, 0) / 5).toFixed(1);
    expect(result.summary).toBe(avg);
  });
});
