import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS } from '@/lib/mock-data';
import { formatCompactNumber, truncate } from '@/lib/utils';

const F = formatCompactNumber;
const S = truncate;
const ROW_H = 20;
const WATCHLIST_KEY = 'whaletrace_watchlist';

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

/* ---- Reusable terminal components (matches FeedPage style) ---- */
function R({
  w, c, b, onClick, children,
}: {
  w: number; c: string; b?: boolean; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-block',
        width: w,
        height: ROW_H,
        lineHeight: `${ROW_H}px`,
        color: c,
        fontWeight: b ? 600 : 400,
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        textAlign: 'right',
        padding: '0 3px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        verticalAlign: 'middle',
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: onClick ? 'underline' : 'none',
      }}
    >
      {children}
    </span>
  );
}

function Cell({
  w, color, onClick, children,
}: {
  w: number; color: string; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        width: w,
        color,
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: onClick ? 'underline' : 'none',
        display: 'inline-block',
        height: ROW_H,
        lineHeight: `${ROW_H}px`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        verticalAlign: 'middle',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        padding: '0 3px',
        fontWeight: 400,
      }}
    >
      {children}
    </span>
  );
}

function Row({ children, h }: { children: React.ReactNode; h?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_H,
        padding: 0,
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        background: h ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  );
}

/* ---- Per-ticker aggregate ---- */
interface WatchItem {
  ticker: string;
  company: string;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  netFlow: number;
  confidence: number;
  lastTradeDate: string;
  hasResonance: boolean;
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchSet, setWatchSet] = useState<Set<string>>(loadWatchlist);

  const watched = useMemo(() => [...watchSet].sort(), [watchSet]);

  const remove = useCallback((ticker: string) => {
    setWatchSet((prev) => {
      const next = new Set(prev);
      next.delete(ticker);
      saveWatchlist(next);
      return next;
    });
  }, []);

  /* Build per-ticker aggregates from mock data */
  const items = useMemo((): WatchItem[] => {
    if (watched.length === 0) return [];

    return watched.map((ticker) => {
      const trades = MOCK_TRADES
        .filter((t) => t.ticker === ticker)
        .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
      const buys = trades.filter((t) => t.transaction_type === 'BUY');
      const sells = trades.filter((t) => t.transaction_type === 'SELL');
      const buyCount = buys.length;
      const sellCount = sells.length;
      const totalTrades = buyCount + sellCount;
      const tB = buys.reduce((s, t) => s + t.total_value, 0);
      const tS = sells.reduce((s, t) => s + t.total_value, 0);
      const netFlow = tB - tS;
      const confidence = Math.min(
        Math.round(
          (buyCount / (totalTrades || 1)) * 50 +
            (tB / (tB + tS || 1)) * 50,
        ),
        100,
      );
      const lastTradeDate = trades[0]?.trade_date?.slice(5) || '--';
      const company = trades[0]?.company_name || ticker;
      const hasResonance = MOCK_RESONANCE_SIGNALS.some(
        (r) => r.ticker === ticker,
      );

      return {
        ticker,
        company,
        totalTrades,
        buyCount,
        sellCount,
        netFlow,
        confidence,
        lastTradeDate,
        hasResonance,
      };
    });
  }, [watched]);

  /* ---- Column widths ---- */
  const CW = { N: 22, T: 58, CO: 120, CF: 44, BU: 44, SE: 44, NF: 62, SC: 72, LT: 48, RM: 36 };

  /* ---- Confidence color ---- */
  const confColor = (v: number) =>
    v > 60 ? '#0c6' : v > 30 ? '#ff8c00' : '#f33';

  /* ============================================================
     EMPTY STATE
     ============================================================ */
  if (watched.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          background: '#000',
          color: '#e6e6e6',
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            background: '#0a0a0a',
            borderBottom: '1px solid #1f1f1f',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#ff8c00', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
            ⭐ WATCHLIST
          </span>
          <span style={{ color: '#555', fontSize: 10, marginLeft: 'auto' }}>
            0 ITEMS
          </span>
        </div>

        {/* Empty state body */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 36, opacity: 0.3 }}>☆</div>
          <div style={{ fontSize: 14, color: '#888', fontWeight: 600, letterSpacing: 1 }}>
            WATCHLIST EMPTY
          </div>
          <div style={{ fontSize: 10, color: '#555', maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
            Click ⭐ WATCH on any stock detail page to add tickers here.<br />
            Track insider confidence, net flow, and resonance signals at a glance.
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: '1px solid #ff8c00',
              color: '#ff8c00',
              cursor: 'pointer',
              padding: '6px 14px',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              borderRadius: 2,
            }}
          >
            ← BROWSE TERMINAL
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     WATCHLIST TABLE
     ============================================================ */
  return (
    <div
      style={{
        height: '100%',
        background: '#000',
        color: '#e6e6e6',
        fontFamily: 'JetBrains Mono, monospace',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          background: '#0a0a0a',
          borderBottom: '1px solid #1f1f1f',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          style={{ color: '#ff8c00', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}
        >
          ⭐ WATCHLIST
        </span>
        <span style={{ color: '#555', fontSize: 10, marginLeft: 'auto' }}>
          {watched.length} ITEMS
        </span>
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          background: '#0a0a0a',
          borderBottom: '1px solid #1f1f1f',
          gap: 16,
          fontSize: 10,
          flexShrink: 0,
        }}
      >
        {(() => {
          const totalBuys = items.reduce((s, i) => s + i.buyCount, 0);
          const totalSells = items.reduce((s, i) => s + i.sellCount, 0);
          const totalNet = items.reduce((s, i) => s + i.netFlow, 0);
          const resonanceCount = items.filter((i) => i.hasResonance).length;
          return (
            <>
              <span style={{ color: '#555' }}>
                TOTAL:{' '}
                <span style={{ color: '#ff8c00', fontWeight: 600 }}>
                  {items.length}
                </span>
              </span>
              <span style={{ color: '#555' }}>
                BUY:{' '}
                <span style={{ color: '#0c6', fontWeight: 600 }}>
                  {totalBuys}
                </span>
              </span>
              <span style={{ color: '#555' }}>
                SELL:{' '}
                <span style={{ color: '#f33', fontWeight: 600 }}>
                  {totalSells}
                </span>
              </span>
              <span style={{ color: '#555' }}>
                NET:{' '}
                <span
                  style={{
                    color: totalNet >= 0 ? '#0c6' : '#f33',
                    fontWeight: 600,
                  }}
                >
                  {F(totalNet)}
                </span>
              </span>
              <span style={{ color: '#555' }}>
                🐋 RESONANCE:{' '}
                <span style={{ color: '#ff8c00', fontWeight: 600 }}>
                  {resonanceCount}
                </span>
              </span>
            </>
          );
        })()}
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 20,
          padding: 0,
          background: '#0a0a0a',
          borderBottom: '1px solid #1f1f1f',
          fontSize: 10,
          fontWeight: 600,
          color: '#555',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'inline-block', width: CW.N, padding: '0 3px' }}>
          #
        </span>
        <span style={{ display: 'inline-block', width: CW.T, padding: '0 3px' }}>
          TICK
        </span>
        <span style={{ display: 'inline-block', width: CW.CO, padding: '0 3px' }}>
          COMPANY
        </span>
        <span style={{ display: 'inline-block', width: CW.CF, padding: '0 3px', textAlign: 'right' }}>
          CONF
        </span>
        <span style={{ display: 'inline-block', width: CW.BU, padding: '0 3px', textAlign: 'right' }}>
          BUY
        </span>
        <span style={{ display: 'inline-block', width: CW.SE, padding: '0 3px', textAlign: 'right' }}>
          SEL
        </span>
        <span style={{ display: 'inline-block', width: CW.NF, padding: '0 3px', textAlign: 'right' }}>
          NET
        </span>
        <span style={{ display: 'inline-block', width: CW.SC, padding: '0 3px' }}>
          SIGNAL
        </span>
        <span style={{ display: 'inline-block', width: CW.LT, padding: '0 3px', textAlign: 'right' }}>
          LAST
        </span>
        <span style={{ display: 'inline-block', width: CW.RM, padding: '0 3px', textAlign: 'center' }}>
          ✂
        </span>
      </div>

      {/* Data rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.map((item, idx) => {
          const rowBg = (item.netFlow > 0 || item.confidence > 50)
            ? 'rgba(0,204,102,0.015)'
            : item.netFlow < 0
            ? 'rgba(255,51,51,0.015)'
            : 'transparent';

          return (
            <div
              key={item.ticker}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: ROW_H,
                padding: 0,
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                background: idx % 2 === 0 ? rowBg : 'rgba(255,255,255,0.015)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {/* # */}
              <span
                style={{
                  display: 'inline-block',
                  width: CW.N,
                  color: '#555',
                  fontSize: 10,
                  padding: '0 3px',
                  height: ROW_H,
                  lineHeight: `${ROW_H}px`,
                  verticalAlign: 'middle',
                }}
              >
                {idx + 1}
              </span>

              {/* TICKER — clickable */}
              <Cell
                w={CW.T}
                color="#ff8c00"
                onClick={() => navigate(`/stocks/${item.ticker}`)}
              >
                {item.ticker}
              </Cell>

              {/* COMPANY */}
              <Cell w={CW.CO} color="#e6e6e6">
                {S(item.company, 17)}
              </Cell>

              {/* CONFIDENCE */}
              <R w={CW.CF} c={confColor(item.confidence)} b>
                {item.confidence}
              </R>

              {/* BUY */}
              <R w={CW.BU} c="#0c6" b>
                {item.buyCount}
              </R>

              {/* SELL */}
              <R w={CW.SE} c={item.sellCount > 0 ? '#f33' : '#555'}>
                {item.sellCount}
              </R>

              {/* NET FLOW */}
              <R
                w={CW.NF}
                c={item.netFlow >= 0 ? '#0c6' : '#f33'}
                b
              >
                {item.netFlow === 0 ? '—' : F(item.netFlow)}
              </R>

              {/* SIGNAL / RESONANCE indicator */}
              <span
                style={{
                  display: 'inline-block',
                  width: CW.SC,
                  color: item.hasResonance ? '#ff8c00' : '#555',
                  fontWeight: item.hasResonance ? 600 : 400,
                  fontSize: 10,
                  padding: '0 3px',
                  height: ROW_H,
                  lineHeight: `${ROW_H}px`,
                  fontFamily: 'JetBrains Mono, monospace',
                  verticalAlign: 'middle',
                }}
              >
                {item.hasResonance ? '🐋 RES' : '—'}
              </span>

              {/* LAST TRADE DATE */}
              <R w={CW.LT} c="#888">
                {item.lastTradeDate}
              </R>

              {/* REMOVE */}
              <span
                onClick={() => remove(item.ticker)}
                style={{
                  display: 'inline-block',
                  width: CW.RM,
                  color: '#555',
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'center',
                  height: ROW_H,
                  lineHeight: `${ROW_H}px`,
                  fontFamily: 'JetBrains Mono, monospace',
                  verticalAlign: 'middle',
                }}
                title={`Remove ${item.ticker} from watchlist`}
              >
                ✂
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: '#0a0a0a',
          borderTop: '1px solid #1f1f1f',
          fontSize: 9,
          color: '#555',
          fontFamily: 'JetBrains Mono, monospace',
          flexShrink: 0,
        }}
      >
        <span>
          WATCHLIST | {watched.length} TICKERS | LOCAL STORAGE
        </span>
        <span>CLICK TICKER → DETAIL | ✂ → REMOVE</span>
      </div>
    </div>
  );
}
