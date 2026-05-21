import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_TRADES } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';

const WATCHLIST_KEY = 'whaletrace_finviz_watchlist';

function loadWatchlist(): Set<string> {
  try { const r = localStorage.getItem(WATCHLIST_KEY); return r ? new Set(JSON.parse(r)) : new Set(); }
  catch { return new Set(); }
}
function saveWatchlist(set: Set<string>) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...set]));
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchSet, setWatchSet] = useState<Set<string>>(loadWatchlist);

  useEffect(() => { saveWatchlist(watchSet); }, [watchSet]);

  const allTickers = [...new Set(MOCK_TRADES.map(t => t.ticker))].sort();
  const watched = [...watchSet];

  const toggle = useCallback((ticker: string) => {
    setWatchSet(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
      return next;
    });
  }, []);

  if (watched.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', textAlign: 'center' }}>
        <h2 style={{ color: '#1a1d23', fontWeight: 600 }}>Watchlist</h2>
        <p style={{ color: '#7a8088', fontSize: 14 }}>No tickers watched. Click a ticker on the Screener or Heatmap to add it.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 20 }}>
          {allTickers.map(t => (
            <span key={t} onClick={() => toggle(t)} style={{
              padding: '4px 12px', cursor: 'pointer', borderRadius: 3,
              background: '#fff', border: '1px solid #d0d5dd',
              fontSize: 12, color: '#1a73e8', fontFamily: 'JetBrains Mono, monospace',
            }}>+ {t}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#1a1d23', fontWeight: 600 }}>Watchlist ({watched.length})</h2>
        <button onClick={() => setWatchSet(new Set())} style={{
          padding: '5px 14px', fontSize: 11, cursor: 'pointer', background: '#fff',
          border: '1px solid #e53935', borderRadius: 3, color: '#e53935', fontFamily: 'Inter, sans-serif',
        }}>Clear All</button>
      </div>

      {watched.map(ticker => {
        const trades = MOCK_TRADES.filter(t => t.ticker === ticker);
        const buys = trades.filter(t => t.transaction_type === 'BUY');
        const sells = trades.filter(t => t.transaction_type === 'SELL');
        const net = buys.reduce((s, t) => s + t.total_value, 0) - sells.reduce((s, t) => s + t.total_value, 0);

        return (
          <div key={ticker} style={{
            background: '#fff', border: '1px solid #e0e3e8', borderRadius: 3,
            padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/stocks/${ticker}`)}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a73e8', fontFamily: 'JetBrains Mono, monospace' }}>{ticker}</span>
              <span style={{ fontSize: 13, color: '#4a5058', marginLeft: 10 }}>{trades[0]?.company_name}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: '#00aa44' }}>{buys.length} buys</span>
              <span style={{ color: '#e53935' }}>{sells.length} sells</span>
              <span style={{ color: net >= 0 ? '#00aa44' : '#e53935', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                {net >= 0 ? '+' : ''}{formatCurrency(net)}
              </span>
            </div>
            <button onClick={() => toggle(ticker)} style={{
              padding: '4px 10px', fontSize: 11, cursor: 'pointer', background: 'transparent',
              border: '1px solid #d0d5dd', borderRadius: 3, color: '#e53935', fontFamily: 'Inter, sans-serif',
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
