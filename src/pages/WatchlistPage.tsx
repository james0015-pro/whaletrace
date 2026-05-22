import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MOCK_TRADES } from '@/lib/mock-data';
import { formatCompactNumber, truncate } from '@/lib/utils';

const F = formatCompactNumber;
const S = truncate;
const WATCHLIST_KEY = 'whaletrace_watchlist';
const ROW_H = 22;

function loadWatchlist(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveWatchlist(set: Set<string>) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...set]));
}

/* ============================================================
   WatchlistPage — Bloomberg terminal-style
   ============================================================ */
export default function WatchlistPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [watchSet, setWatchSet] = useState<Set<string>>(loadWatchlist);
  const tickers = useMemo(() => [...watchSet], [watchSet]);

  // Build summary per ticker
  const summaries = useMemo(() => {
    return tickers.map((ticker) => {
      const trades = MOCK_TRADES
        .filter((t) => t.ticker === ticker)
        .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
      const buys = trades.filter((t) => t.transaction_type === 'BUY');
      const sells = trades.filter((t) => t.transaction_type === 'SELL');
      const tB = buys.reduce((s, t) => s + t.total_value, 0);
      const tS = sells.reduce((s, t) => s + t.total_value, 0);
      const latest = trades[0];
      const company = latest?.company_name ?? ticker;
      return { ticker, company, trades, buys, sells, tB, tS, latest, total: trades.length };
    }).sort((a, b) => (b.tB - b.tS) - (a.tB - a.tS)); // sort by net buy
  }, [tickers]);

  const remove = (ticker: string) => {
    setWatchSet((prev) => {
      const next = new Set(prev);
      next.delete(ticker);
      saveWatchlist(next);
      return next;
    });
  };

  if (tickers.length === 0) {
    return (
      <div style={{
        height: '100%', background: '#000', color: '#e6e6e6',
        fontFamily: 'JetBrains Mono, monospace', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 40,
      }}>
        <div style={{ fontSize: 48 }}>⭐</div>
        <div style={{ fontSize: 14, color: '#ff8c00', fontWeight: 700 }}>
          {t('watchlist.empty_title', 'NO TICKERS WATCHED')}
        </div>
        <div style={{ fontSize: 10, color: '#555', textAlign: 'center', lineHeight: 1.8 }}>
          <div>{t('watchlist.empty_desc', 'Click the ★ button on any stock detail page to add it here.')}</div>
          <div>{t('watchlist.empty_hint', 'Watchlist syncs via localStorage — data stays on your device.')}</div>
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent', border: '1px solid #ff8c00', color: '#ff8c00',
            cursor: 'pointer', padding: '6px 16px', fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace', marginTop: 8,
          }}>
          ← {t('watchlist.back_to_terminal', 'BACK TO TERMINAL')}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', background: '#000', color: '#e6e6e6',
      fontFamily: 'JetBrains Mono, monospace', overflow: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px',
        background: '#0a0a0a', borderBottom: '1px solid #1f1f1f',
        gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#ff8c00' }}>
          ⭐ {t('watchlist.title', 'WATCHLIST')}
        </span>
        <span style={{ fontSize: 9, color: '#555' }}>
          {tickers.length} {t('watchlist.tickers', 'tickers')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#555' }}>
          {t('watchlist.sorted_by_net', 'Sorted by net buy value')}
        </span>
      </div>

      {/* Ticker cards */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Column headers */}
          <div style={{
            display: 'flex', alignItems: 'center', height: ROW_H,
            fontSize: 9, color: '#555', padding: '0 4px',
            borderBottom: '1px solid #1f1f1f',
          }}>
            <span style={{ width: 55 }}>TICKER</span>
            <span style={{ width: 130 }}>COMPANY</span>
            <span style={{ width: 70, textAlign: 'right' }}>BUYS</span>
            <span style={{ width: 70, textAlign: 'right' }}>SELLS</span>
            <span style={{ width: 85, textAlign: 'right' }}>NET</span>
            <span style={{ width: 55, textAlign: 'right' }}>TRADES</span>
            <span style={{ width: 130 }}>LATEST</span>
            <span style={{ width: 50, textAlign: 'center' }}>DEL</span>
          </div>

          {summaries.map((s, i) => {
            const net = s.tB - s.tS;
            const netColor = net > 0 ? '#0c6' : net < 0 ? '#f33' : '#888';
            return (
              <div key={s.ticker} style={{
                display: 'flex', alignItems: 'center', height: ROW_H,
                fontSize: 10, padding: '0 4px',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
              }} onClick={() => navigate(`/stocks/${s.ticker}`)}
                 onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#111'; }}
                 onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'; }}
              >
                <span style={{ width: 55, color: '#ff8c00', fontWeight: 700, fontSize: 11 }}>
                  {s.ticker}
                </span>
                <span style={{ width: 130, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {S(s.company, 16)}
                </span>
                <span style={{ width: 70, textAlign: 'right', color: '#0c6' }}>
                  {F(s.tB)}
                </span>
                <span style={{ width: 70, textAlign: 'right', color: '#f33' }}>
                  {F(s.tS)}
                </span>
                <span style={{ width: 85, textAlign: 'right', color: netColor, fontWeight: 600 }}>
                  {net > 0 ? '+' : ''}{F(Math.abs(net))}
                </span>
                <span style={{ width: 55, textAlign: 'right', color: '#e6e6e6' }}>
                  {s.total}
                </span>
                <span style={{ width: 130, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>
                  {s.latest ? `${S(s.latest.insider_name, 12)} · ${s.latest.trade_date.slice(5)}` : '—'}
                </span>
                <span style={{ width: 50, textAlign: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(s.ticker); }}
                    style={{
                      background: 'transparent', border: '1px solid #333',
                      color: '#555', cursor: 'pointer', fontSize: 9,
                      fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px',
                    }}
                    title={t('watchlist.remove', 'Remove from watchlist')}>
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 12px', background: '#0a0a0a', borderTop: '1px solid #1f1f1f',
        fontSize: 9, color: '#555', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace',
      }}>
        <span>{tickers.length} {tickers.length === 1 ? 'ticker' : 'tickers'} watched</span>
        <span>{t('watchlist.click_for_detail', 'Click row → stock detail  |  ✕ to remove')}</span>
      </div>
    </div>
  );
}
