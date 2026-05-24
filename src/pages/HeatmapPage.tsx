import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ─── Deterministic seed ──────────────────────────────────
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Types ───────────────────────────────────────────────
type HeatmapMode = 'SIGNAL' | 'NET_FLOW' | 'VOLUME';

interface TickerHeatData {
  ticker: string;
  company: string;
  buyCount: number;
  sellCount: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  totalTrades: number;
  signal: number; // 0-100
}

const COLORS = {
  amber: '#ff8c00',
  green: '#0c6',
  red: '#f33',
  white: '#e6e6e6',
  gray: '#888',
  grayDim: '#555',
  grayDark: '#333',
  purple: '#8b5cf6',
};

const COMPANIES: Record<string, string> = {
  AAPL: '蘋果', MSFT: '微軟', NVDA: '輝達', GOOGL: '谷歌', META: 'Meta',
  AMZN: '亞馬遜', TSLA: '特斯拉', JPM: '摩根大通', V: 'Visa', UNH: '聯合健康',
  XOM: '埃克森美孚', WMT: '沃爾瑪', JNJ: '嬌生', MA: '萬事達卡',
  PG: '寶僑', HD: '家得寶', BAC: '美國銀行', 'BRK.B': '波克夏', DIS: '迪士尼', CRM: 'Salesforce',
};

const TICKERS = Object.keys(COMPANIES);

// ─── Heat Data Generation ────────────────────────────────
function computeHeatData(): TickerHeatData[] {
  return TICKERS.map(ticker => {
    const seed = seedFrom(ticker + '_heat');
    const rng = (n: number) => {
      const x = Math.sin(seed + n * 271.8 + 419.3) * 43758.5453;
      return x - Math.floor(x);
    };

    const buyCount = Math.floor(rng(0) * 40) + 5;
    const sellCount = Math.floor(rng(1) * 30) + 2;
    const avgPrice = 50 + rng(2) * 300;
    const buyValue = +(buyCount * avgPrice * (0.5 + rng(3))).toFixed(0);
    const sellValue = +(sellCount * avgPrice * (0.3 + rng(4))).toFixed(0);
    const netValue = +(buyValue - sellValue).toFixed(0);
    const buyRatio = (buyCount + sellCount) > 0 ? buyCount / (buyCount + sellCount) : 0;
    const volumeScore = Math.min(1, (buyValue + sellValue) / 5_000_000) * 20;
    const signal = Math.round(Math.min(100, buyRatio * 65 + volumeScore + (netValue > 0 ? 15 : 0)));

    return {
      ticker,
      company: COMPANIES[ticker],
      buyCount, sellCount,
      buyValue, sellValue, netValue,
      totalTrades: buyCount + sellCount,
      signal: Math.max(5, signal),
    };
  });
}

// ─── Color Functions ─────────────────────────────────────
function signalColor(score: number): string {
  if (score >= 70) return '#008844';
  if (score >= 55) return '#00aa44';
  if (score >= 40) return '#66cc88';
  if (score >= 25) return '#ffaa44';
  if (score >= 15) return '#ff7722';
  return '#e53935';
}

function signalBgColor(score: number): string {
  if (score >= 70) return '#003322';
  if (score >= 55) return '#002211';
  if (score >= 40) return '#112211';
  if (score >= 25) return '#221100';
  if (score >= 15) return '#221100';
  return '#220000';
}

function flowColor(netValue: number, maxAbs: number): string {
  if (maxAbs === 0) return COLORS.grayDark;
  const ratio = netValue / maxAbs;
  if (ratio > 0.7) return '#008844';
  if (ratio > 0.4) return '#00aa44';
  if (ratio > 0.1) return '#66cc88';
  if (ratio > -0.1) return '#666666';
  if (ratio > -0.4) return '#ff7722';
  if (ratio > -0.7) return '#cc3333';
  return '#e53935';
}

function volumeColor(count: number, max: number): string {
  if (max === 0) return COLORS.grayDark;
  const ratio = count / max;
  if (ratio > 0.85) return '#008844';
  if (ratio > 0.6) return '#00aa44';
  if (ratio > 0.4) return '#66cc88';
  if (ratio > 0.2) return '#ffaa44';
  return '#ff7722';
}

// ─── Format Helpers ──────────────────────────────────────
function formatCurrency(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

// ─── HeatTile Component ──────────────────────────────────
function HeatTile({
  data, mode, cellSize, maxAbsNet, maxVolume, onClick,
}: {
  data: TickerHeatData; mode: HeatmapMode; cellSize: number;
  maxAbsNet: number; maxVolume: number; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  let tileColor: string, textColor: string, subText: string;
  if (mode === 'SIGNAL') {
    tileColor = signalBgColor(data.signal);
    textColor = signalColor(data.signal);
    subText = `${data.signal}`;
  } else if (mode === 'NET_FLOW') {
    tileColor = '#0a0a0a';
    textColor = flowColor(data.netValue, maxAbsNet);
    subText = formatCurrency(data.netValue);
  } else {
    tileColor = '#0a0a0a';
    textColor = volumeColor(data.totalTrades, maxVolume);
    subText = `${data.totalTrades}`;
  }

  const borderColor = hovered
    ? COLORS.amber
    : mode === 'SIGNAL'
      ? signalColor(data.signal) + '44'
      : '#1f1f1f';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${data.ticker}: signal ${data.signal}, ${data.buyCount} buys, ${data.sellCount} sells`}
      onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
      style={{
        width: cellSize, height: cellSize,
        background: tileColor, border: `1px solid ${borderColor}`,
        borderRadius: 3, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        zIndex: hovered ? 2 : 1, position: 'relative',
        transition: 'transform 0.1s ease',
        outline: 'none',
      }}
    >
      {/* Left edge accent (signal mode) */}
      {mode === 'SIGNAL' && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: signalColor(data.signal),
        }} />
      )}
      {/* Ticker */}
      <span style={{
        fontWeight: 700,
        fontSize: cellSize >= 80 ? 13 : cellSize >= 60 ? 11 : 9,
        color: textColor,
      }}>{data.ticker}</span>
      {/* Sub-value */}
      {cellSize >= 60 && (
        <span style={{
          fontSize: cellSize >= 80 ? 10 : 8, color: textColor,
          opacity: 0.8, marginTop: 2,
        }}>{subText}</span>
      )}
      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: -2, left: 2, right: 2,
          background: 'rgba(0,0,0,0.92)', border: `1px solid ${COLORS.amber}`,
          borderRadius: 2, padding: '2px 6px', fontSize: 8,
          fontFamily: 'JetBrains Mono, monospace', color: COLORS.white,
          zIndex: 3, pointerEvents: 'none',
        }}>
          <span style={{ color: COLORS.green }}>{data.buyCount}B</span>
          /<span style={{ color: COLORS.red }}>{data.sellCount}S</span>
          {' '}{formatCurrency(data.netValue)}
        </div>
      )}
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────
export default function HeatmapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<HeatmapMode>('SIGNAL');
  const [cellSize, setCellSize] = useState(80);

  const heatData = useMemo(() => computeHeatData(), []);

  const maxAbsNet = useMemo(
    () => Math.max(...heatData.map(d => Math.abs(d.netValue)), 1),
    [heatData],
  );
  const maxVolume = useMemo(
    () => Math.max(...heatData.map(d => d.totalTrades), 1),
    [heatData],
  );

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#000',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* ── Header ── */}
      <div style={{
        height: 34, background: '#0a0a0a', borderBottom: '1px solid #1f1f1f',
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10,
        flexShrink: 0,
      }}>
        {/* Nav toggle: TERM button */}
        <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
          <button onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
            aria-label="Navigate to Terminal"
            tabIndex={0}
            style={{
              background: 'transparent', border: '1px solid #333', color: COLORS.gray,
              cursor: 'pointer', fontSize: 9, padding: '2px 10px',
              fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
            }}>TERM</button>
          <button
            style={{
              background: '#1a1a1a', border: `1px solid ${COLORS.amber}`, color: COLORS.amber,
              cursor: 'default', fontSize: 9, padding: '2px 10px',
              fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
            }}>OVR</button>
          <button onClick={() => { window.location.hash = '#/treemap'; window.location.reload(); }}
            aria-label="Navigate to Treemap"
            tabIndex={0}
            style={{
              background: 'transparent', border: '1px solid #333', color: COLORS.gray,
              cursor: 'pointer', fontSize: 9, padding: '2px 10px',
              fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
            }}>TREE</button>
          <button onClick={() => { window.location.hash = '#/watchlist'; window.location.reload(); }}
            aria-label="Navigate to Watchlist"
            tabIndex={0}
            style={{
              background: 'transparent', border: '1px solid #333', color: COLORS.gray,
              cursor: 'pointer', fontSize: 9, padding: '2px 10px',
              fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
            }}>⭐ WATCH</button>
        </div>

        {/* Mode selector */}
        <span style={{ fontSize: 9, color: COLORS.grayDim }}>MODE:</span>
        {(['SIGNAL', 'NET_FLOW', 'VOLUME'] as HeatmapMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            tabIndex={0}
            style={{
              background: mode === m ? '#1a1a1a' : 'transparent',
              border: `1px solid ${mode === m ? COLORS.amber : '#333'}`,
              color: mode === m ? COLORS.amber : COLORS.gray,
              cursor: 'pointer', fontSize: 9, padding: '2px 10px',
              fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
            }}>{m.replace('_', ' ')}</button>
        ))}

        {/* Size slider */}
        <span style={{ fontSize: 9, color: COLORS.grayDim, marginLeft: 12 }}>SZ:</span>
        <input
          type="range" min={44} max={120} step={4} value={cellSize}
          onChange={e => setCellSize(Number(e.target.value))}
          aria-label="Adjust tile size"
          style={{ width: 80, accentColor: COLORS.amber }}
        />
        <span style={{ fontSize: 9, color: COLORS.grayDim }}>{cellSize}px</span>

        {/* Color legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {mode === 'SIGNAL' && (
            <>
              <span style={{ fontSize: 9, color: COLORS.grayDim }}>LEGEND:</span>
              {[{ color: '#008844', label: 'BUY' },
                { color: '#66cc88', label: 'N+' },
                { color: '#ffaa44', label: 'CAUT' },
                { color: '#e53935', label: 'SELL' }].map((l, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 7, color: COLORS.grayDim }}>{l.label}</span>
                </span>
              ))}
            </>
          )}
          {mode === 'NET_FLOW' && (
            <>
              <span style={{ fontSize: 9, color: COLORS.grayDim }}>LEGEND:</span>
              {[{ color: '#008844', label: 'INFLOW' },
                { color: '#666666', label: 'NEUT' },
                { color: '#e53935', label: 'OUTFLOW' }].map((l, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 7, color: COLORS.grayDim }}>{l.label}</span>
                </span>
              ))}
            </>
          )}
          {mode === 'VOLUME' && (
            <>
              <span style={{ fontSize: 9, color: COLORS.grayDim }}>LEGEND:</span>
              {[{ color: '#008844', label: 'HIGH' },
                { color: '#66cc88', label: 'MED' },
                { color: '#ff7722', label: 'LOW' }].map((l, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 7, color: COLORS.grayDim }}>{l.label}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Tile Grid ── */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          justifyContent: 'center', alignContent: 'center',
        }}>
          {heatData.map(d => (
            <HeatTile
              key={d.ticker}
              data={d}
              mode={mode}
              cellSize={cellSize}
              maxAbsNet={maxAbsNet}
              maxVolume={maxVolume}
              onClick={() => navigate(`/stocks/${d.ticker}`)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '4px 10px', background: '#0a0a0a',
        borderTop: '1px solid #1f1f1f', fontSize: 9, color: COLORS.grayDim,
        flexShrink: 0, fontFamily: 'JetBrains Mono, monospace',
      }}>
        <span>🐋 WhaleTrace Heatmap | {heatData.length} tickers</span>
        <span>MODE: {mode.replace('_', ' ')} | SZ: {cellSize}px | Click → detail</span>
      </div>
    </div>
  );
}
