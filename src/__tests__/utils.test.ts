import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatNumber,
  formatShares,
  formatDate,
  formatMarketCap,
  isValidTicker,
  formatPercentChange,
  formatCompactNumber,
  truncate,
  seedFrom,
} from '@/lib/utils';

// ─── cn ─────────────────────────────────────────────────────────
describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    const hidden = false;
    const active = true;
    expect(cn('base', hidden && 'hidden', active && 'active')).toBe('base active');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});

// ─── formatCurrency ─────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats billions', () => {
    expect(formatCurrency(5_600_000_000)).toBe('$5.60B');
  });

  it('formats millions', () => {
    expect(formatCurrency(12_300_000)).toBe('$12.30M');
  });

  it('formats thousands', () => {
    expect(formatCurrency(4_500)).toBe('$4.5K');
  });

  it('formats small numbers', () => {
    expect(formatCurrency(42)).toBe('$42');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-1_500_000)).toBe('-$1.50M');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('handles exactly 1 billion', () => {
    expect(formatCurrency(1_000_000_000)).toBe('$1.00B');
  });
});

// ─── formatNumber ───────────────────────────────────────────────
describe('formatNumber', () => {
  it('adds commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ─── formatShares ───────────────────────────────────────────────
describe('formatShares', () => {
  it('formats millions of shares', () => {
    expect(formatShares(2_500_000)).toBe('2.5M shares');
  });

  it('formats thousands of shares', () => {
    expect(formatShares(5_000)).toBe('5.0K shares');
  });

  it('formats small share counts', () => {
    // Under 1000 → raw number
    expect(formatShares(500)).toBe('500 shares');
    expect(formatShares(999)).toBe('999 shares');
  });
});

// ─── formatDate ─────────────────────────────────────────────────
describe('formatDate', () => {
  it('returns elapsed hours for recent dates', () => {
    // 2 hours ago
    const d = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatDate(d);
    expect(result).toContain('小時前');
    expect(result).toBe('2 小時前');
  });

  it('returns elapsed days for older dates', () => {
    const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDate(d);
    expect(result).toContain('天前');
  });

  it('returns absolute date for old dates', () => {
    const result = formatDate('2020-01-15');
    expect(result).toContain('2020');
  });
});

// ─── formatMarketCap ────────────────────────────────────────────
describe('formatMarketCap', () => {
  it('formats trillions', () => {
    expect(formatMarketCap(3_500_000_000_000)).toBe('$3.5T');
  });

  it('formats billions', () => {
    expect(formatMarketCap(850_000_000_000)).toBe('$850.0B');
  });

  it('formats millions', () => {
    expect(formatMarketCap(500_000_000)).toBe('$500.0M');
  });
});

// ─── isValidTicker ──────────────────────────────────────────────
describe('isValidTicker', () => {
  it('accepts standard tickers', () => {
    expect(isValidTicker('AAPL')).toBe(true);
    expect(isValidTicker('NVDA')).toBe(true);
    expect(isValidTicker('X')).toBe(true);
    expect(isValidTicker('BRKB')).toBe(true);
  });

  it('rejects too-long tickers', () => {
    expect(isValidTicker('ABCDEF')).toBe(false);
  });

  it('rejects numbers', () => {
    expect(isValidTicker('A1234')).toBe(false);
  });

  it('rejects empty', () => {
    expect(isValidTicker('')).toBe(false);
  });
});

// ─── formatPercentChange ────────────────────────────────────────
describe('formatPercentChange', () => {
  it('adds + for positive', () => {
    expect(formatPercentChange(5.5)).toBe('+5.5%');
  });

  it('shows - for negative', () => {
    expect(formatPercentChange(-3.2)).toBe('-3.2%');
  });

  it('handles zero', () => {
    expect(formatPercentChange(0)).toBe('0.0%');
  });
});

// ─── formatCompactNumber ────────────────────────────────────────
describe('formatCompactNumber', () => {
  it('formats billions', () => {
    expect(formatCompactNumber(2_500_000_000)).toBe('2.50B');
  });

  it('formats millions', () => {
    expect(formatCompactNumber(3_400_000)).toBe('3.4M');
  });

  it('formats null as em dash', () => {
    expect(formatCompactNumber(null)).toBe('—');
  });

  it('formats undefined as em dash', () => {
    expect(formatCompactNumber(undefined)).toBe('—');
  });
});

// ─── truncate ───────────────────────────────────────────────────
describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello');
  });

  it('leaves short strings alone', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
});

// ─── seedFrom ───────────────────────────────────────────────────
describe('seedFrom', () => {
  it('returns a positive integer', () => {
    const s = seedFrom('AAPL');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s)).toBe(true);
  });

  it('is deterministic', () => {
    expect(seedFrom('NVDA')).toBe(seedFrom('NVDA'));
  });

  it('returns different results for different inputs', () => {
    expect(seedFrom('AAPL')).not.toBe(seedFrom('MSFT'));
  });
});
