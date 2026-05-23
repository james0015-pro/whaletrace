import { describe, it, expect } from 'vitest';
import { convertSecTrade, convertSecTrades } from '@/lib/sec-converter';

describe('convertSecTrade', () => {
  it('converts a BUY trade correctly', () => {
    const result = convertSecTrade({
      ticker: 'AAPL',
      company_name: 'Apple Inc.',
      insider_name: 'Tim Cook Chief Executive Officer',
      filing_date: '2026-05-10',
      filing_url: 'https://sec.gov/...',
      transaction_date: '2026-05-08',
      security: 'Common Stock',
      type: 'BUY',
      code: 'P',
      shares: 5000,
      price: 190.50,
      total_value: 952500,
      shares_owned_after: 50000,
      is_derivative: false,
    });

    expect(result.ticker).toBe('AAPL');
    expect(result.transaction_type).toBe('BUY');
    expect(result.signal_category).toBe('BUY');
    expect(result.shares).toBe(5000);
    expect(result.price).toBe(190.50);
    expect(result.total_value).toBe(952500);
    expect(result.is_10b5_1).toBe(false);
    expect(result.title).toBe('Chief Executive Officer');
    // $952k → strength should be 80+
    expect(result.signal_strength).toBeGreaterThanOrEqual(80);
  });

  it('converts a SELL trade correctly', () => {
    const result = convertSecTrade({
      ticker: 'NVDA',
      company_name: 'NVIDIA CORP',
      insider_name: 'Mark Stevens Director',
      filing_date: '2026-03-21',
      filing_url: 'https://sec.gov/...',
      transaction_date: '2026-03-20',
      security: 'Common Stock',
      type: 'SELL',
      code: 'S',
      shares: 1274,
      price: 290.00,
      total_value: 369460,
      shares_owned_after: 38713,
      is_derivative: false,
    });

    expect(result.ticker).toBe('NVDA');
    expect(result.transaction_type).toBe('SELL');
    expect(result.signal_category).toBe('SELL');
  });

  it('derives chairman title from name', () => {
    const result = convertSecTrade({
      ticker: 'BRK.B',
      company_name: 'Berkshire Hathaway',
      insider_name: 'Warren Buffett Chairman of the Board',
      filing_date: '2026-01-15',
      filing_url: 'https://sec.gov/...',
      transaction_date: '2026-01-10',
      security: 'Common Stock',
      type: 'BUY',
      code: 'P',
      shares: 100,
      price: 400,
      total_value: 40000,
      shares_owned_after: 1000,
      is_derivative: false,
    });

    expect(result.title).toBe('Chairman of the Board');
  });

  it('derives CFO title', () => {
    const result = convertSecTrade({
      ticker: 'MSFT',
      company_name: 'Microsoft',
      insider_name: 'CFO Jane Smith',
      filing_date: '2026-01-01',
      filing_url: 'https://sec.gov/...',
      transaction_date: '2026-01-01',
      security: 'Common Stock',
      type: 'BUY',
      code: 'P',
      shares: 10,
      price: 400,
      total_value: 4000,
      shares_owned_after: 100,
      is_derivative: false,
    });

    expect(result.title).toBe('Chief Financial Officer');
  });

  it('handles small trade strength', () => {
    const result = convertSecTrade({
      ticker: 'XYZ',
      company_name: 'XYZ Corp',
      insider_name: 'Jane Doe',
      filing_date: '2026-01-01',
      filing_url: 'https://sec.gov/...',
      transaction_date: '2026-01-01',
      security: 'Common Stock',
      type: 'BUY',
      code: 'P',
      shares: 50,
      price: 10,
      total_value: 500,
      shares_owned_after: 100,
      is_derivative: false,
    });

    expect(result.signal_strength).toBeLessThanOrEqual(25);
  });
});

describe('convertSecTrades', () => {
  it('converts an array of trades sorted by date descending', () => {
    const data = {
      timestamp: '2026-05-23',
      source: 'test',
      count: 2,
      tickers_scanned: ['AAPL'],
      trades: [
        {
          ticker: 'AAPL', company_name: 'Apple', insider_name: 'Early Insider',
          filing_date: '2026-01-10', filing_url: '', transaction_date: '2026-01-08',
          security: 'CS', type: 'BUY', code: 'P',
          shares: 100, price: 100, total_value: 10000,
          shares_owned_after: 200, is_derivative: false,
        },
        {
          ticker: 'AAPL', company_name: 'Apple', insider_name: 'Late Insider',
          filing_date: '2026-03-10', filing_url: '', transaction_date: '2026-03-08',
          security: 'CS', type: 'SELL', code: 'S',
          shares: 50, price: 150, total_value: 7500,
          shares_owned_after: 150, is_derivative: false,
        },
      ],
    };

    const result = convertSecTrades(data);
    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0].trade_date).toBe('2026-03-08');
    expect(result[1].trade_date).toBe('2026-01-08');
  });

  it('filters out trades that are not BUY or SELL', () => {
    const data = {
      timestamp: '', source: '', count: 2, tickers_scanned: [],
      trades: [
        {
          ticker: 'AAPL', company_name: 'Apple', insider_name: 'X',
          filing_date: '', filing_url: '', transaction_date: '2026-01-01',
          security: 'CS', type: 'OTHER', code: 'G',
          shares: 100, price: 100, total_value: 10000,
          shares_owned_after: 200, is_derivative: false,
        },
        {
          ticker: 'AAPL', company_name: 'Apple', insider_name: 'Y',
          filing_date: '', filing_url: '', transaction_date: '2026-01-02',
          security: 'CS', type: 'BUY', code: 'P',
          shares: 50, price: 100, total_value: 5000,
          shares_owned_after: 250, is_derivative: false,
        },
      ],
    };

    const result = convertSecTrades(data);
    expect(result).toHaveLength(1);
    expect(result[0].transaction_type).toBe('BUY');
  });
});
