import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';

/* ============================================================
   Helpers
   ============================================================ */
const F = (v: number | null | undefined): string => {
  if (v == null) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
};
const S = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

type Timeframe = '1D' | '5D' | '30D' | '6M' | '1Y' | 'ALL';

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

/* ============================================================
   Mock Confidence History Generator
   ============================================================ */
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function generateConfidenceHistory(ticker: string): { month: string; score: number }[] {
  const seed = seedFrom(ticker + '_conf');
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 271.8 + 419.3) * 43758.5453;
    return x - Math.floor(x);
  };
  const base = 30 + rng(0) * 50;
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
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

/* ============================================================
   Price Generator (deterministic-ish per ticker+timeframe)
   ============================================================ */
function generatePrices(
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

/* ============================================================
   StockDetailPage
   ============================================================ */
export default function StockDetailPage() {
  const { ticker: rawTicker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const ticker = rawTicker?.toUpperCase() || '';
  const [tf, setTf] = useState<Timeframe>('30D');
  const [insiderFilter, setInsiderFilter] = useState<'ALL' | 'BUY'>('ALL');

  // Watchlist with localStorage persistence
  const [watchSet, setWatchSet] = useState<Set<string>>(loadWatchlist);
  const watch = watchSet.has(ticker);
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const toggleWatch = useCallback(() => {
    setWatchSet((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      saveWatchlist(next);
      return next;
    });
  }, [ticker]);

  const trades = useMemo(
    () =>
      MOCK_TRADES
        .filter((t) => t.ticker === ticker)
        .sort((a, b) => b.trade_date.localeCompare(a.trade_date)),
    [ticker],
  );
  const buys = trades.filter((t) => t.transaction_type === 'BUY');
  const sells = trades.filter((t) => t.transaction_type === 'SELL');
  const tB = buys.reduce((s, t) => s + t.total_value, 0);
  const tS = sells.reduce((s, t) => s + t.total_value, 0);
  const buyCount = buys.length;
  const sellCount = sells.length;
  const totalTrades = buyCount + sellCount;

  const confidence = Math.min(
    Math.round(
      (buyCount / (totalTrades || 1)) * 50 + (tB / (tB + tS || 1)) * 50,
    ),
    100,
  );

  const confHistory = useMemo(() => generateConfidenceHistory(ticker), [ticker]);

  const resonance = MOCK_RESONANCE_SIGNALS.find((r) => r.ticker === ticker);
  const instOrders = MOCK_INSTITUTION_ORDERS.filter((o) => o.ticker === ticker);

  const company = trades[0]?.company_name || resonance?.company_name || ticker;

  const { prices, labels } = useMemo(
    () => generatePrices(ticker, tf),
    [ticker, tf],
  );
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;
  const pFirst = prices[0];
  const pLast = prices[prices.length - 1];
  const changePct = pFirst ? ((pLast - pFirst) / pFirst) * 100 : 0;
  const changeAbs = pLast - pFirst;

  const TIMEFRAMES: Timeframe[] = ['1D', '5D', '30D', '6M', '1Y', 'ALL'];

  /* ---- sub-scores ---- */
  const subScores = [
    { label: 'BUY SCALE',  value: Math.min(Math.round((tB / 5e8) * 100), 100) },
    { label: 'BUYER COUNT', value: Math.min(buyCount * 8, 100) },
    { label: 'BUY/SELL',    value: Math.min(Math.round((buyCount / (sellCount || 1)) * 15), 100) },
    { label: 'CLUSTER',     value: resonance ? resonance.signal_strength : Math.round((seedFrom(ticker + '_cluster') % 100) * 0.3) },
  ];

  // Insider trades with optional filter
  const displayTrades = insiderFilter === 'BUY'
    ? trades.filter(t => t.transaction_type === 'BUY')
    : trades;

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
      {/* ========== HEADER ========== */}
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
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#ff8c00',
            cursor: 'pointer',
            padding: '3px 10px',
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            borderRadius: 2,
          }}
        >
          ← BACK
        </button>
        <span style={{ color: '#ff8c00', fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>
          {ticker}
        </span>
        <span style={{ color: '#888', fontSize: 11 }}>{company}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#555' }}>
            {totalTrades} trades / 2YR
          </span>
          <button
            onClick={toggleWatch}
            style={{
              background: 'transparent',
              border: watch ? '1px solid #ff8c00' : '1px solid #333',
              color: watch ? '#ff8c00' : '#555',
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 2,
              fontFamily: 'JetBrains Mono, monospace',
              lineHeight: 1,
            }}
            title={watch ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {watch ? '★' : '☆'} WATCH
          </button>
        </span>
      </div>

      {/* ========== SCROLLABLE BODY ========== */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* ========== CONFIDENCE SCORE + HISTORY SPARKLINE ========== */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {/* Left: Score */}
          <div
            style={{
              padding: 10,
              background: '#0a0a0a',
              border: '1px solid #1f1f1f',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#555',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              CONFIDENCE SCORE
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, height: 10, background: '#1f1f1f' }}>
                <div
                  style={{
                    width: `${confidence}%`,
                    height: '100%',
                    background:
                      confidence > 60 ? '#0c6' : confidence > 30 ? '#ff8c00' : '#f33',
                    transition: 'width 0.6s',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color:
                    confidence > 60 ? '#0c6' : confidence > 30 ? '#ff8c00' : '#f33',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {confidence}
              </div>
              <div style={{ fontSize: 9, color: '#555' }}>/100</div>
            </div>
          </div>

          {/* Right: Confidence History Sparkline */}
          <div
            style={{
              padding: 10,
              background: '#0a0a0a',
              border: '1px solid #1f1f1f',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#555',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              CONFIDENCE TREND (12M)
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 50 }}>
              {confHistory.map((h, i) => {
                const barH = Math.max(8, (h.score / 100) * 100);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${barH}%`,
                      background: h.score > 60 ? '#0c6' : h.score > 30 ? '#ff8c00' : '#f33',
                      opacity: 0.8,
                      minWidth: 4,
                    }}
                    title={`${h.month}: ${h.score}`}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 8,
                color: '#555',
                marginTop: 2,
              }}
            >
              {confHistory.map((h, i) => (
                <span key={i} style={{ flex: 1, textAlign: 'center' }}>{h.month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {subScores.map((s) => (
            <div
              key={s.label}
              style={{
                padding: 8,
                background: '#0a0a0a',
                border: '1px solid #1f1f1f',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 8, color: '#555', marginBottom: 2 }}>
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color:
                    s.value > 60 ? '#0c6' : s.value > 30 ? '#ff8c00' : '#f33',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ========== PRICE CHART (green/red bars) ========== */}
        <div
          style={{
            padding: 10,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              PRICE CHART
            </div>
            {/* Change summary */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 10 }}>
              <span style={{ color: '#888' }}>
                {tf}{' '}
                <span style={{ color: changePct >= 0 ? '#0c6' : '#f33', fontWeight: 700 }}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              </span>
              <span style={{ color: changeAbs >= 0 ? '#0c6' : '#f33', fontWeight: 600 }}>
                {changeAbs >= 0 ? '+' : ''}${Math.abs(changeAbs).toFixed(2)}
              </span>
            </div>
            {/* Timeframe tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  style={{
                    background: tf === t ? '#1a1a1a' : 'transparent',
                    border: `1px solid ${tf === t ? '#ff8c00' : '#333'}`,
                    color: tf === t ? '#ff8c00' : '#888',
                    cursor: 'pointer',
                    fontSize: 9,
                    padding: '2px 7px',
                    fontFamily: 'JetBrains Mono, monospace',
                    borderRadius: 2,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Price bar chart — green/red per bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: prices.length > 20 ? 1 : 3,
              height: 80,
              marginBottom: 4,
            }}
          >
            {prices.map((p, i) => {
              const h = ((p - pMin) / pRange) * 100;
              const prevP = i > 0 ? prices[i - 1] : p;
              const isUp = p >= prevP;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(h, 3)}%`,
                    background: isUp ? '#0c6' : '#f33',
                    opacity: 0.75,
                    minWidth: 2,
                  }}
                  title={`${labels[i]}: $${p.toFixed(2)} ${isUp ? '▲' : '▼'}`}
                />
              );
            })}
          </div>

          {/* Price range + last */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 10, color: '#888' }}>
                L: <span style={{ color: '#f33' }}>${pMin.toFixed(2)}</span>
              </span>
              <span style={{ fontSize: 10, color: '#888' }}>
                H: <span style={{ color: '#0c6' }}>${pMax.toFixed(2)}</span>
              </span>
              <span style={{ fontSize: 10, color: '#888' }}>
                LAST:{' '}
                <span style={{ color: '#ff8c00', fontWeight: 700 }}>
                  ${pLast.toFixed(2)}
                </span>
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: changePct >= 0 ? '#0c6' : '#f33',
              }}
            >
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* ========== RESONANCE HISTORY ========== */}
        <div
          style={{
            padding: 10,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: '#555',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            RESONANCE HISTORY
          </div>
          {resonance ? (
            <div style={{ fontSize: 10, color: '#e6e6e6', lineHeight: 1.8 }}>
              <div>
                📅 Signal Date:{' '}
                <span style={{ color: '#ff8c00' }}>{resonance.signal_date}</span>
              </div>
              <div>
                🏦 Institutional Buy:{' '}
                <span style={{ color: '#0c6' }}>
                  {F(resonance.total_institutional_buy)}
                </span>{' '}
                from {resonance.institution_count} institutions
              </div>
              <div>
                👤 Insider Buyers:{' '}
                <span style={{ color: '#0c6' }}>
                  {resonance.insider_buy_count}
                </span>{' '}
                — {resonance.insider_names.join(', ')}
              </div>
              <div>
                📊 Signal Strength:{' '}
                <span
                  style={{
                    color:
                      resonance.signal_strength > 60
                        ? '#0c6'
                        : resonance.signal_strength > 30
                          ? '#ff8c00'
                          : '#f33',
                    fontWeight: 700,
                  }}
                >
                  {resonance.signal_strength}/100
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#888' }}>
                Overall: {buyCount + sellCount} trades in 2YR | 🟢 {buyCount} buys | 🔴{' '}
                {sellCount} sells | Net:{' '}
                <span style={{ color: tB > tS ? '#0c6' : '#f33', fontWeight: 600 }}>
                  {F(tB - tS)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: '#555' }}>
              No resonance signal detected for {ticker}
            </div>
          )}
        </div>

        {/* ========== INSTITUTION HOLDINGS ========== */}
        <div
          style={{
            padding: 10,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: '#555',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            INSTITUTION HOLDINGS
          </div>
          {instOrders.length > 0 ? (
            <>
              <div
                style={{
                  display: 'flex',
                  fontSize: 9,
                  color: '#555',
                  borderBottom: '1px solid #1f1f1f',
                  paddingBottom: 5,
                  marginBottom: 2,
                }}
              >
                <span style={{ width: '35%' }}>INSTITUTION</span>
                <span style={{ width: '22%', textAlign: 'right' }}>AMOUNT</span>
                <span style={{ width: '22%', textAlign: 'right' }}>COMPANY</span>
                <span style={{ width: '21%', textAlign: 'right' }}>CHANGE</span>
              </div>
              {instOrders.map((o, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    fontSize: 10,
                    padding: '3px 0',
                    borderBottom:
                      i < instOrders.length - 1
                        ? '1px solid #1a1a1a'
                        : 'none',
                    alignItems: 'center',
                    background:
                      i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: '35%',
                      color: '#e6e6e6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {S(o.institution, 18)}
                  </span>
                  <span style={{ width: '22%', textAlign: 'right', color: '#e6e6e6' }}>
                    {F(o.amount)}
                  </span>
                  <span style={{ width: '22%', textAlign: 'right', color: '#888' }}>
                    {S(o.company_name, 12)}
                  </span>
                  <span
                    style={{
                      width: '21%',
                      textAlign: 'right',
                      color:
                        o.direction === 'NEW'
                          ? '#8b5cf6'
                          : o.change_pct > 0
                            ? '#0c6'
                            : '#f33',
                      fontWeight: 600,
                    }}
                  >
                    {o.direction === 'NEW'
                      ? 'NEW'
                      : `${o.change_pct > 0 ? '+' : ''}${o.change_pct}%`}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#555' }}>
              No institution data for {ticker}
            </div>
          )}
        </div>

        {/* ========== INSIDER TRADES TIMELINE (with filter) ========== */}
        <div
          style={{
            padding: 10,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              INSIDER TRADES TIMELINE
            </div>
            {/* Filter toggle */}
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setInsiderFilter('ALL')}
                style={{
                  background: insiderFilter === 'ALL' ? '#1a1a1a' : 'transparent',
                  border: `1px solid ${insiderFilter === 'ALL' ? '#ff8c00' : '#333'}`,
                  color: insiderFilter === 'ALL' ? '#ff8c00' : '#888',
                  cursor: 'pointer',
                  fontSize: 9,
                  padding: '2px 8px',
                  fontFamily: 'JetBrains Mono, monospace',
                  borderRadius: 2,
                }}
              >
                ALL ({totalTrades})
              </button>
              <button
                onClick={() => setInsiderFilter('BUY')}
                style={{
                  background: insiderFilter === 'BUY' ? '#1a1a1a' : 'transparent',
                  border: `1px solid ${insiderFilter === 'BUY' ? '#0c6' : '#333'}`,
                  color: insiderFilter === 'BUY' ? '#0c6' : '#888',
                  cursor: 'pointer',
                  fontSize: 9,
                  padding: '2px 8px',
                  fontFamily: 'JetBrains Mono, monospace',
                  borderRadius: 2,
                }}
              >
                🟢 BUY ({buyCount})
              </button>
            </div>
          </div>

          {displayTrades.length > 0 ? (
            <>
              {/* Column headers */}
              <div
                style={{
                  display: 'flex',
                  fontSize: 9,
                  color: '#555',
                  borderBottom: '1px solid #1f1f1f',
                  paddingBottom: 4,
                  marginBottom: 2,
                  alignItems: 'center',
                }}
              >
                <span style={{ width: 55 }}>DATE</span>
                <span style={{ width: 105 }}>INSIDER</span>
                <span style={{ width: 95 }}>TITLE</span>
                <span style={{ width: 38, textAlign: 'right' }}>DIR</span>
                <span style={{ width: 55, textAlign: 'right' }}>SHARES</span>
                <span style={{ width: 55, textAlign: 'right' }}>PRICE</span>
                <span style={{ width: 65, textAlign: 'right' }}>VALUE</span>
              </div>
              {displayTrades.slice(0, 20).map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 10,
                    padding: '3px 0',
                    borderBottom:
                      i < Math.min(displayTrades.length, 20) - 1
                        ? '1px solid #1a1a1a'
                        : 'none',
                    background:
                      i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <span style={{ width: 55, color: '#888' }}>
                    {t.trade_date.slice(5)}
                  </span>
                  <span
                    style={{
                      width: 105,
                      color: '#e6e6e6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {S(t.insider_name, 15)}
                  </span>
                  <span
                    style={{
                      width: 95,
                      color: '#888',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {S(t.title, 14)}
                  </span>
                  <span
                    style={{
                      width: 38,
                      textAlign: 'right',
                      color: t.transaction_type === 'BUY' ? '#0c6' : '#f33',
                      fontWeight: 600,
                    }}
                  >
                    {t.transaction_type === 'BUY' ? 'BUY' : 'SEL'}
                  </span>
                  <span style={{ width: 55, textAlign: 'right', color: '#e6e6e6' }}>
                    {F(t.shares)}
                  </span>
                  <span style={{ width: 55, textAlign: 'right', color: '#e6e6e6' }}>
                    {(t.price ?? 0).toFixed(2)}
                  </span>
                  <span
                    style={{
                      width: 65,
                      textAlign: 'right',
                      color:
                        t.transaction_type === 'BUY' ? '#0c6' : '#f33',
                      fontWeight: 600,
                    }}
                  >
                    {F(t.total_value)}
                  </span>
                </div>
              ))}
              {displayTrades.length > 20 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '6px 0',
                    fontSize: 10,
                    color: '#555',
                  }}
                >
                  ... and {displayTrades.length - 20} more trades
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#555' }}>
              {insiderFilter === 'BUY'
                ? `No buy trades found for ${ticker}`
                : `No insider trades found for ${ticker}`}
            </div>
          )}
        </div>
      </div>

      {/* ========== FOOTER STATUS ========== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: '#0a0a0a',
          borderTop: '1px solid #1f1f1f',
          fontSize: 9,
          color: '#555',
          flexShrink: 0,
        }}
      >
        <span>
          STOCK/{ticker} | {company}
        </span>
        <span>
          {buyCount + sellCount} trades | CONF {confidence} | {new Date().toISOString().slice(0, 10)}
        </span>
      </div>
    </div>
  );
}
