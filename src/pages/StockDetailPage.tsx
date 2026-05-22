import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import { formatCompactNumber, truncate, seedFrom } from '@/lib/utils';
import { generateConfidenceHistory, generatePrices, generatePostTradeReturns } from '@/lib/price-utils';
import type { Timeframe } from '@/lib/price-utils';

const F = formatCompactNumber;
const S = truncate;

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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- ticker captured in functional setState updater; React Compiler infers [setWatchSet] which is correct
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

  /* ---- ownership data (deterministic per ticker) ---- */
  const ownershipData = useMemo(() => {
    const instPct = 60 + (seedFrom(ticker + '_inst') % 16);
    const insiderPct = seedFrom(ticker + '_ins') % 16;
    const retailPct = 100 - instPct - insiderPct;
    return { instPct, insiderPct, retailPct };
  }, [ticker]);

  /* ---- short float (deterministic per ticker) ---- */
  const shortFloat = useMemo(() => seedFrom(ticker + '_short') % 10, [ticker]);

  /* ---- factor grades ---- */
  const buySellRatio = buyCount / (sellCount || 1);

  const gradeColors = ['#0c6', '#0c6', '#0c6', '#ff8c00', '#ff8c00', '#b36800', '#f33'];

  function letterGrade(
    value: number,
    ascending: boolean,
    thresholds: number[],
    labels: string[],
    descs: string[],
  ): { grade: string; color: string; desc: string } {
    for (let i = 0; i < thresholds.length; i++) {
      if (ascending ? value > thresholds[i] : value < thresholds[i]) {
        return { grade: labels[i], color: gradeColors[i], desc: descs[i] };
      }
    }
    const last = thresholds.length - 1;
    return { grade: labels[last], color: gradeColors[last], desc: descs[last] };
  }

  const factorGrades = useMemo(() => {
    // INSIDER FLOW: buy/sell ratio (ascending = true, higher is better)
    const insiderGrade = letterGrade(
      buySellRatio, true,
      [3, 2, 1.5, 1, 0.5, 0],
      ['A+', 'A', 'B+', 'B', 'C', 'D'],
      ['強勢買入', '明顯買入', '中小買入', '輕微買入', '賣壓浮現', '強勢賣出'],
    );

    // INSTITUTION CONSENSUS: from resonance signal_strength
    const consensusGrade = letterGrade(
      resonance ? resonance.signal_strength : 30, true,
      [75, 65, 50, 35, 20, 0],
      ['A', 'B+', 'B', 'C', 'D', 'D'],
      ['高度共識', '持續加倉', '溫和加倉', '方向未明', '缺乏共識', '缺乏共識'],
    );

    // SHORT RISK: inverse of short float (ascending = false, lower is better)
    const shortGrade = letterGrade(
      shortFloat, false,
      [0, 1, 3, 5, 8, 100],
      ['A+', 'A', 'B', 'C', 'D', 'D'],
      ['極低放空', '極低放空', '低放空', '中等放空', '高放空', '高放空'],
    );

    // WHALESCORE: same as confidence
    const whaleGrade = letterGrade(
      confidence, true,
      [80, 65, 50, 35, 20, 0],
      ['A+', 'A', 'B+', 'B', 'C', 'D'],
      ['極強信號', '強勢信號', '明顯信號', '溫和信號', '微弱信號', '無信號'],
    );

    return [
      { label: '內部人流動', ...insiderGrade },
      { label: '機構共識', ...consensusGrade },
      { label: '放空風險', ...shortGrade },
      { label: '鯨力綜合', ...whaleGrade },
    ];
  }, [buySellRatio, resonance, shortFloat, confidence]);

  /* ---- post-trade return cache ---- */
  const postTradeCache = useMemo(() => {
    const cache = new Map<number, { returns: number[]; summary: number }>();
    trades.forEach((t) => {
      cache.set(t.id, generatePostTradeReturns(ticker, t.trade_date));
    });
    return cache;
  }, [ticker, trades]);

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
          {/* Left: WhaleScore Semi-Circular Gauge */}
          <div
            style={{
              padding: 10,
              background: '#0a0a0a',
              border: '1px solid #1f1f1f',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#555',
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              WHALESCORE
            </div>
            <svg width="180" height="110" viewBox="0 0 180 110">
              {/* Background arc */}
              <path
                d="M 30 95 A 60 60 0 0 1 150 95"
                fill="none"
                stroke="#333"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Foreground arc */}
              {(() => {
                const scoreColor =
                  confidence > 60 ? '#0c6' : confidence > 30 ? '#ff8c00' : '#f33';
                const angle = Math.PI * (1 - confidence / 100);
                const endX = 90 + 60 * Math.cos(angle);
                const endY = 95 - 60 * Math.sin(angle);
                return (
                  <path
                    d={`M 30 95 A 60 60 0 0 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                );
              })()}
              {/* Center text: score */}
              <text
                x="90"
                y="82"
                textAnchor="middle"
                fill={
                  confidence > 60 ? '#0c6' : confidence > 30 ? '#ff8c00' : '#f33'
                }
                fontSize="28"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {confidence}
              </text>
              <text
                x="90"
                y="98"
                textAnchor="middle"
                fill="#555"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                /100
              </text>
              {/* Labels */}
              <text
                x="22"
                y="100"
                textAnchor="middle"
                fill="#555"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
              >
                0
              </text>
              <text
                x="90"
                y="16"
                textAnchor="middle"
                fill="#555"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
              >
                50
              </text>
              <text
                x="158"
                y="100"
                textAnchor="middle"
                fill="#555"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
              >
                100
              </text>
            </svg>
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

        {/* Factor Grade Cards (Seeking Alpha style) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {factorGrades.map((fg) => (
            <div
              key={fg.label}
              style={{
                padding: '8px 4px',
                background: '#0a0a0a',
                border: `1px solid ${fg.color}33`,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {fg.label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: fg.color,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1.1,
                }}
              >
                {fg.grade}
              </div>
              <div style={{ fontSize: 8, color: '#888' }}>
                {fg.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ========== OWNERSHIP DONUT CHART ========== */}
        <div
          style={{
            padding: 10,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Donut */}
          {(() => {
            const circ = 2 * Math.PI * 40; // ~251.33
            const instDash = (ownershipData.instPct / 100) * circ;
            const insiderDash = (ownershipData.insiderPct / 100) * circ;
            const instOffset = 0;
            const insiderOffset = -instDash;
            return (
              <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Background ring */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#1f1f1f"
                  strokeWidth="16"
                />
                {/* Institutional slice */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#0c6"
                  strokeWidth="16"
                  strokeDasharray={`${instDash.toFixed(1)} ${(circ - instDash).toFixed(1)}`}
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                />
                {/* Insider slice */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#ff8c00"
                  strokeWidth="16"
                  strokeDasharray={`${insiderDash.toFixed(1)} ${(circ - insiderDash).toFixed(1)}`}
                  strokeDashoffset={insiderOffset.toFixed(1)}
                  transform="rotate(-90 60 60)"
                />
                {/* Center text */}
                <text
                  x="60"
                  y="57"
                  textAnchor="middle"
                  fill="#ff8c00"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {ticker}
                </text>
                <text
                  x="60"
                  y="72"
                  textAnchor="middle"
                  fill="#888"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  OWNERSHIP
                </text>
              </svg>
            );
          })()}
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#0c6', display: 'inline-block' }} />
              <span style={{ color: '#e6e6e6' }}>機構</span>
              <span style={{ color: '#0c6', fontWeight: 600 }}>{ownershipData.instPct}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#ff8c00', display: 'inline-block' }} />
              <span style={{ color: '#e6e6e6' }}>內部人</span>
              <span style={{ color: '#ff8c00', fontWeight: 600 }}>{ownershipData.insiderPct}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#333', display: 'inline-block' }} />
              <span style={{ color: '#e6e6e6' }}>其他</span>
              <span style={{ color: '#888', fontWeight: 600 }}>{ownershipData.retailPct}%</span>
            </div>
          </div>
        </div>
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
                <span style={{ width: 80, textAlign: 'center' }}>POST-TRADE</span>
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
                  {/* Post-Trade Sparkline */}
                  {(() => {
                    const pt = postTradeCache.get(t.id);
                    if (!pt) return <span style={{ width: 80, textAlign: 'center', color: '#555', fontSize: 9 }}>—</span>;
                    const maxAbs = Math.max(...pt.returns.map(Math.abs), 1);
                    const summaryColor = pt.summary >= 0 ? '#0c6' : '#f33';
                    const summarySign = pt.summary >= 0 ? '+' : '';
                    return (
                      <span style={{ width: 80, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                        {pt.returns.map((r, ri) => {
                          const barH = Math.max(2, (Math.abs(r) / maxAbs) * 16);
                          const barColor = r >= 0 ? '#0c6' : '#f33';
                          return (
                            <span
                              key={ri}
                              style={{
                                display: 'inline-block',
                                width: 6,
                                height: barH,
                                background: barColor,
                                verticalAlign: 'middle',
                                borderRadius: 1,
                              }}
                              title={`${['1D','3D','5D','7D','14D'][ri]}: ${summarySign}${r}%`}
                            />
                          );
                        })}
                        <span style={{ fontSize: 8, color: summaryColor, fontWeight: 600, marginLeft: 2 }}>
                          {summarySign}{pt.summary}%
                        </span>
                      </span>
                    );
                  })()}
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
