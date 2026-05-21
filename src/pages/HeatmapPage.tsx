import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InsiderTrade } from '@/types';
import { MOCK_TRADES } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';

type ViewMode = 'signal' | 'netValue' | 'volume';

interface HeatmapCell {
  ticker: string;
  company: string;
  netValue: number;
  buyCount: number;
  sellCount: number;
  avgSignal: number;
  totalValue: number;
}

function buildCells(trades: InsiderTrade[]): HeatmapCell[] {
  const map = new Map<string, InsiderTrade[]>();
  for (const t of trades) {
    const a = map.get(t.ticker) || [];
    a.push(t);
    map.set(t.ticker, a);
  }
  const cells: HeatmapCell[] = [];
  for (const [ticker, items] of map) {
    const buys = items.filter(t => t.transaction_type === 'BUY');
    const sells = items.filter(t => t.transaction_type === 'SELL');
    const buyV = buys.reduce((s, t) => s + t.total_value, 0);
    const sellV = sells.reduce((s, t) => s + t.total_value, 0);
    cells.push({
      ticker,
      company: items[0].company_name,
      netValue: buyV - sellV,
      buyCount: buys.length,
      sellCount: sells.length,
      avgSignal: Math.round(items.reduce((s, t) => s + t.signal_strength, 0) / items.length),
      totalValue: buyV + sellV,
    });
  }
  return cells;
}

function getColor(cell: HeatmapCell, mode: ViewMode): string {
  if (mode === 'signal') {
    const s = cell.avgSignal;
    if (s >= 70) return '#008844';
    if (s >= 55) return '#00aa44';
    if (s >= 40) return '#66cc88';
    if (s >= 25) return '#ffaa44';
    if (s >= 15) return '#ff7722';
    return '#e53935';
  }
  if (mode === 'netValue') {
    const v = cell.netValue;
    if (v > 100_000_000) return '#008844';
    if (v > 10_000_000) return '#00aa44';
    if (v > 1_000_000) return '#66cc88';
    if (v > -1_000_000) return '#ffaa44';
    if (v > -50_000_000) return '#ff7722';
    return '#e53935';
  }
  // volume
  const v = cell.totalValue;
  if (v > 1_000_000_000) return '#1a3a5f';
  if (v > 500_000_000) return '#1a73e8';
  if (v > 100_000_000) return '#4488ee';
  if (v > 10_000_000) return '#88bbff';
  return '#bbddff';
}

export default function HeatmapPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ViewMode>('signal');
  const [size, setSize] = useState(80);

  const cells = useMemo(() => buildCells(MOCK_TRADES), []);
  const maxVal = useMemo(() => {
    if (mode === 'signal') return 100;
    if (mode === 'netValue') return Math.max(...cells.map(c => Math.abs(c.netValue)), 1);
    return Math.max(...cells.map(c => c.totalValue), 1);
  }, [cells, mode]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 14px',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    fontFamily: 'Inter, system-ui, sans-serif',
    cursor: 'pointer',
    border: active ? '1px solid #1a73e8' : '1px solid #d0d5dd',
    borderRadius: 3,
    background: active ? '#1a73e8' : '#fff',
    color: active ? '#fff' : '#4a5058',
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1d23' }}>
          WhaleTrace Heatmap
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle(mode === 'signal')} onClick={() => setMode('signal')}>Signal</button>
          <button style={btnStyle(mode === 'netValue')} onClick={() => setMode('netValue')}>Net Flow</button>
          <button style={btnStyle(mode === 'volume')} onClick={() => setMode('volume')}>Volume</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#7a8088' }}>Size</span>
          <input type="range" min={40} max={120} value={size} onChange={e => setSize(+e.target.value)}
            style={{ width: 100 }} />
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
        fontSize: 10, color: '#7a8088', flexWrap: 'wrap',
      }}>
        <span>Legend:</span>
        {mode === 'signal' && (
          <>
            <span style={{ padding: '2px 8px', background: '#008844', color: '#fff', borderRadius: 2 }}>Strong Buy ≥70</span>
            <span style={{ padding: '2px 8px', background: '#00aa44', color: '#fff', borderRadius: 2 }}>Buy ≥55</span>
            <span style={{ padding: '2px 8px', background: '#66cc88', color: '#1a1d23', borderRadius: 2 }}>Neutral ≥40</span>
            <span style={{ padding: '2px 8px', background: '#ffaa44', color: '#1a1d23', borderRadius: 2 }}>Caution ≥25</span>
            <span style={{ padding: '2px 8px', background: '#e53935', color: '#fff', borderRadius: 2 }}>Sell &lt;25</span>
          </>
        )}
        {mode === 'netValue' && (
          <>
            <span style={{ padding: '2px 8px', background: '#008844', color: '#fff', borderRadius: 2 }}>+$100M+</span>
            <span style={{ padding: '2px 8px', background: '#00aa44', color: '#fff', borderRadius: 2 }}>+$10M+</span>
            <span style={{ padding: '2px 8px', background: '#66cc88', color: '#1a1d23', borderRadius: 2 }}>+$1M+</span>
            <span style={{ padding: '2px 8px', background: '#ffaa44', color: '#1a1d23', borderRadius: 2 }}>-$1M+</span>
            <span style={{ padding: '2px 8px', background: '#e53935', color: '#fff', borderRadius: 2 }}>-$50M+</span>
          </>
        )}
      </div>

      {/* Heatmap Grid */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
        background: '#fff', border: '1px solid #e0e3e8', borderRadius: 3,
        padding: 16,
      }}>
        {cells.map(c => {
          const color = getColor(c, mode);
          const val = mode === 'signal' ? c.avgSignal :
                      mode === 'netValue' ? formatCurrency(c.netValue) :
                      formatCurrency(c.totalValue);
          return (
            <div
              key={c.ticker}
              onClick={() => navigate(`/stocks/${c.ticker}`)}
              title={`${c.ticker} — ${c.company}\nSignal: ${c.avgSignal}\nNet: ${formatCurrency(c.netValue)}\n${c.buyCount}B / ${c.sellCount}S`}
              style={{
                width: size, height: size,
                background: color,
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: (mode === 'signal' && c.avgSignal >= 55) || (mode === 'netValue' && c.netValue > 10_000_000) || mode === 'volume' ? '#fff' : '#1a1d23',
                transition: 'transform 0.1s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                fontFamily: 'Inter, sans-serif',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.zIndex = '5'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; }}
            >
              <span style={{ fontSize: size > 70 ? 14 : 11, fontWeight: 700, letterSpacing: -0.5 }}>{c.ticker}</span>
              {size > 70 && <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{val}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#7a8088', textAlign: 'center' }}>
        {cells.length} tickers • Click to see detail • Hover to highlight
      </div>
    </div>
  );
}
