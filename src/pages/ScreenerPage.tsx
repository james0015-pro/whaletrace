import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InsiderTrade, TradeType, SignalCategory } from '@/types';
import { MOCK_TRADES } from '@/lib/mock-data';
import { formatCurrency, formatNumber } from '@/lib/utils';

// ── Filter state ──

type SortField = 'filing_date' | 'total_value' | 'shares' | 'price' | 'signal_strength';
type SortDir = 'asc' | 'desc';

interface Filters {
  signal: SignalCategory | 'ALL';
  direction: TradeType | 'ALL';
  ticker: string;
  sort: SortField;
  dir: SortDir;
}

// ── Color helpers ──

const dirColor = (d: TradeType) => d === 'BUY' ? '#00aa44' : '#e53935';
const dirBg = (d: TradeType) => d === 'BUY' ? '#e8f5e9' : '#ffebee';
const sigBg = (s: SignalCategory) => {
  switch (s) {
    case 'BUY': return '#e8f5e9';
    case 'SELL': return '#ffebee';
    case 'CLUSTER': return '#e3f2fd';
    case 'TENB5_1': return '#fff3e0';
  }
};

// ── Ticker summary row ──

interface TickerSummary {
  ticker: string;
  company: string;
  totalBuys: number;
  totalSells: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  avgStrength: number;
  lastDate: string;
}

function aggregateTrades(trades: InsiderTrade[]): TickerSummary[] {
  const map = new Map<string, InsiderTrade[]>();
  for (const t of trades) {
    const arr = map.get(t.ticker) || [];
    arr.push(t);
    map.set(t.ticker, arr);
  }
  const summaries: TickerSummary[] = [];
  for (const [ticker, items] of map) {
    const buys = items.filter(t => t.transaction_type === 'BUY');
    const sells = items.filter(t => t.transaction_type === 'SELL');
    const buyV = buys.reduce((s, t) => s + t.total_value, 0);
    const sellV = sells.reduce((s, t) => s + t.total_value, 0);
    summaries.push({
      ticker,
      company: items[0].company_name,
      totalBuys: buys.length,
      totalSells: sells.length,
      buyValue: buyV,
      sellValue: sellV,
      netValue: buyV - sellV,
      avgStrength: Math.round(items.reduce((s, t) => s + t.signal_strength, 0) / items.length),
      lastDate: items.reduce((max, t) => t.filing_date > max ? t.filing_date : max, ''),
    });
  }
  return summaries;
}

// ── Fmt helpers ──

const F = (v: number) => {
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
};

// ── Component ──

export default function ScreenerPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    signal: 'ALL',
    direction: 'ALL',
    ticker: '',
    sort: 'lastDate',
    dir: 'desc',
  });
  const [view, setView] = useState<'summary' | 'trades'>('summary');

  const allTrades = MOCK_TRADES;
  const tickers = useMemo(() => [...new Set(allTrades.map(t => t.ticker))].sort(), [allTrades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    let trades = allTrades;
    if (filters.signal !== 'ALL') trades = trades.filter(t => t.signal_category === filters.signal);
    if (filters.direction !== 'ALL') trades = trades.filter(t => t.transaction_type === filters.direction);
    if (filters.ticker) trades = trades.filter(t => t.ticker === filters.ticker);
    return trades;
  }, [filters]);

  // Summary view
  const summaries = useMemo(() => {
    const s = aggregateTrades(filteredTrades);
    s.sort((a, b) => {
      const mul = filters.dir === 'asc' ? 1 : -1;
      switch (filters.sort) {
        case 'total_value': return (a.netValue - b.netValue) * mul;
        case 'signal_strength': return (a.avgStrength - b.avgStrength) * mul;
        case 'filing_date':
        case 'lastDate': return a.lastDate.localeCompare(b.lastDate) * mul;
        default: return 0;
      }
    });
    return s;
  }, [filteredTrades, filters.sort, filters.dir]);

  // Trades view (sorted)
  const sortedTrades = useMemo(() => {
    const t = [...filteredTrades];
    t.sort((a, b) => {
      const mul = filters.dir === 'asc' ? 1 : -1;
      switch (filters.sort) {
        case 'filing_date': return a.filing_date.localeCompare(b.filing_date) * mul;
        case 'total_value': return (a.total_value - b.total_value) * mul;
        case 'shares': return (a.shares - b.shares) * mul;
        case 'price': return (a.price - b.price) * mul;
        case 'signal_strength': return (a.signal_strength - b.signal_strength) * mul;
        default: return 0;
      }
    });
    return t;
  }, [filteredTrades, filters.sort, filters.dir]);

  const toggleSort = (field: SortField) => {
    setFilters(f => ({ ...f, sort: field, dir: f.sort === field && f.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const sortArrow = (field: SortField) => {
    if (filters.sort !== field) return '';
    return filters.dir === 'asc' ? ' ▴' : ' ▾';
  };

  // ── Styles ──

  const thStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: '#1e3a5f',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderRight: '1px solid rgba(255,255,255,0.15)',
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 12,
    borderBottom: '1px solid #edf0f3',
    whiteSpace: 'nowrap',
  };

  const filterBtn = (active: boolean, color: string) => ({
    padding: '4px 12px',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    fontFamily: 'Inter, system-ui, sans-serif',
    cursor: 'pointer',
    border: active ? `1px solid ${color}` : '1px solid #d0d5dd',
    borderRadius: 3,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#4a5058',
  } as React.CSSProperties);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 16px' }}>
      {/* ── Filter Bar ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e0e3e8',
        borderRadius: 3,
        padding: '10px 14px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', minWidth: 50 }}>Signal</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'BUY', 'SELL', 'CLUSTER', 'TENB5_1'] as const).map(s => (
            <button key={s} style={filterBtn(filters.signal === s,
              s === 'BUY' ? '#00aa44' : s === 'SELL' ? '#e53935' : s === 'CLUSTER' ? '#1a73e8' : s === 'TENB5_1' ? '#ff6d00' : '#7a8088'
            )} onClick={() => setFilters(f => ({ ...f, signal: s }))}>
              {s === 'ALL' ? 'All' : s === 'TENB5_1' ? '10b5-1' : s}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', minWidth: 50, marginLeft: 8 }}>Dir</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'BUY', 'SELL'] as const).map(d => (
            <button key={d} style={filterBtn(filters.direction === d, d === 'BUY' ? '#00aa44' : d === 'SELL' ? '#e53935' : '#7a8088')} onClick={() => setFilters(f => ({ ...f, direction: d }))}>
              {d === 'ALL' ? 'All' : d}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', minWidth: 40, marginLeft: 8 }}>Ticker</span>
        <select
          value={filters.ticker}
          onChange={e => setFilters(f => ({ ...f, ticker: e.target.value }))}
          style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #d0d5dd', borderRadius: 3, fontFamily: 'Inter, sans-serif' }}
        >
          <option value="">All ({tickers.length})</option>
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button style={filterBtn(view === 'summary', '#1a73e8')} onClick={() => setView('summary')}>Summary</button>
          <button style={filterBtn(view === 'trades', '#1a73e8')} onClick={() => setView('trades')}>Trades</button>
        </div>
      </div>

      {/* ── Data Table ── */}
      <div style={{ background: '#fff', border: '1px solid #e0e3e8', borderRadius: 3, overflow: 'auto' }}>
        {view === 'summary' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr>
                <th style={thStyle}>Ticker</th>
                <th style={thStyle}>Company</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>🟢 Buys</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>🔴 Sells</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Buy Value</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Sell Value</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('total_value')}>Net{sortArrow('total_value')}</th>
                <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => toggleSort('signal_strength')}>Signal{sortArrow('signal_strength')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('lastDate')}>Last{sortArrow('lastDate')}</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(r => (
                <tr key={r.ticker} style={{ background: r.netValue > 0 ? '#f8fdf8' : r.netValue < 0 ? '#fef8f8' : '#fff' }}>
                  <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => navigate(`/stocks/${r.ticker}`)}>
                    {r.ticker}
                  </td>
                  <td style={{ ...tdStyle, color: '#1a1d23' }}>{r.company}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#00aa44', fontWeight: 600 }}>{r.totalBuys}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#e53935', fontWeight: 600 }}>{r.totalSells}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#00aa44', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(r.buyValue)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#e53935', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(r.sellValue)}</td>
                  <td style={{
                    ...tdStyle, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                    color: r.netValue > 0 ? '#00aa44' : r.netValue < 0 ? '#e53935' : '#4a5058',
                    fontWeight: 600,
                  }}>{r.netValue > 0 ? '+' : ''}{formatCurrency(r.netValue)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                      background: r.avgStrength >= 60 ? '#e8f5e9' : r.avgStrength >= 30 ? '#fff3e0' : '#ffebee',
                      color: r.avgStrength >= 60 ? '#00aa44' : r.avgStrength >= 30 ? '#ff6d00' : '#e53935',
                    }}>{r.avgStrength}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#7a8088' }}>{r.lastDate.slice(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort('filing_date')}>Date{sortArrow('filing_date')}</th>
                <th style={thStyle}>Ticker</th>
                <th style={thStyle}>Insider</th>
                <th style={thStyle}>Title</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 50 }}>Dir</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('shares')}>Shares{sortArrow('shares')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('price')}>Price{sortArrow('price')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort('total_value')}>Value{sortArrow('total_value')}</th>
                <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => toggleSort('signal_strength')}>Signal{sortArrow('signal_strength')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.slice(0, 200).map(t => (
                <tr key={t.id}>
                  <td style={{ ...tdStyle, color: '#7a8088' }}>{t.filing_date.slice(5)}</td>
                  <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => navigate(`/stocks/${t.ticker}`)}>{t.ticker}</td>
                  <td style={{ ...tdStyle, color: '#1a1d23' }}>{t.insider_name}</td>
                  <td style={{ ...tdStyle, color: '#4a5058', fontSize: 11 }}>{t.title.slice(0, 25)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                      background: dirBg(t.transaction_type), color: dirColor(t.transaction_type),
                    }}>{t.transaction_type === 'BUY' ? 'B' : 'S'}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{F(t.shares)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>${F(t.price)}</td>
                  <td style={{
                    ...tdStyle, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                    color: t.transaction_type === 'BUY' ? '#00aa44' : '#e53935',
                  }}>{formatCurrency(t.total_value)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                      background: t.signal_strength >= 60 ? '#e8f5e9' : t.signal_strength >= 30 ? '#fff3e0' : '#ffebee',
                      color: t.signal_strength >= 60 ? '#00aa44' : t.signal_strength >= 30 ? '#ff6d00' : '#e53935',
                    }}>{t.signal_strength}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        marginTop: 8, padding: '6px 12px', fontSize: 11, color: '#7a8088',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{view === 'summary' ? summaries.length : sortedTrades.length} results ({filteredTrades.length} trades)</span>
        <span>WhaleTrace Finviz-style v1 • Mock Data</span>
      </div>
    </div>
  );
}
