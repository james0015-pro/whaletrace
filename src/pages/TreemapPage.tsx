import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
/* MOCK_TRADES + F helper removed: unused (grid-based layout replaced squarify) */

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type FlowMode = 'inst' | 'insider' | 'short';

/* ============ Market-level Flow Data ============ */
interface FlowCell {
  ticker: string;
  company: string;
  marketCap: number;         // in billions
  instFlow: number;          // -100 to 100 (net institutional flow score)
  insiderFlow: number;       // -100 to 100 (net insider buy/sell score)
  shortRisk: number;         // 0-100 (higher = more shorted)
  changePct: number;         // daily price change %
}

function generateMarketFlow(): FlowCell[] {
  const TICKERS = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','JPM','BRK.B','V','UNH','XOM','WMT','JNJ','MA','PG','HD','BAC','DIS','CRM'];
  const COMPANIES: Record<string,string> = {
    AAPL:'蘋果',MSFT:'微軟',NVDA:'輝達',GOOGL:'谷歌',META:'Meta',AMZN:'亞馬遜',TSLA:'特斯拉',
    JPM:'摩根大通',V:'Visa',UNH:'聯合健康',XOM:'埃克森美孚',WMT:'沃爾瑪',JNJ:'嬌生',MA:'萬事達卡',
    PG:'寶僑',HD:'家得寶',BAC:'美國銀行','BRK.B':'波克夏',DIS:'迪士尼',CRM:'Salesforce',
  };

  const cells: FlowCell[] = [];
  const weights: Record<string, number> = {
    AAPL:2.85, MSFT:3.10, NVDA:3.65, GOOGL:2.20, META:1.55, AMZN:2.10, TSLA:0.85,
    JPM:0.66, 'BRK.B':0.98, V:0.58, UNH:0.52, XOM:0.48, WMT:0.55, JNJ:0.42, MA:0.45,
    PG:0.40, HD:0.38, BAC:0.32, DIS:0.22, CRM:0.30,
  };

  TICKERS.forEach(ticker => {
    const seed = seedFrom(ticker + '_flow');
    const rng = (n: number) => { const x = Math.sin(seed + n * 271) * 43758.5453; return x - Math.floor(x); };
    
    const marketCap = weights[ticker] || 0.3 + rng(0) * 2;
    const instFlow = +(rng(0) * 200 - 100).toFixed(0);
    const insiderFlow = +(rng(1) * 200 - 100).toFixed(0);
    const shortRisk = +(rng(2) * 100).toFixed(0);
    const changePct = +((rng(3) - 0.5) * 6).toFixed(2);

    cells.push({
      ticker, company: COMPANIES[ticker] || ticker,
      marketCap, instFlow, insiderFlow, shortRisk, changePct,
    });
  });

  return cells;
}

/* ============ Treemap Layout (simple squarified) ============ */
interface Rect { x: number; y: number; w: number; h: number; }
interface Tile extends Rect { cell: FlowCell; }

function treemapLayout(cells: FlowCell[], width: number, height: number): Tile[] {
  // Sort by market cap descending
  const sorted = [...cells].sort((a, b) => b.marketCap - a.marketCap);
  
  const tiles: Tile[] = [];
  
  // Grid-based proportional sizing (simpler than squarify)
  const cols = 5;
  const rows = Math.ceil(sorted.length / cols);
  const cellW = (width - 16) / cols;
  const cellH = (height - 16) / rows;
  
  sorted.forEach((cell, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    tiles.push({
      x: 8 + col * cellW, y: 8 + row * cellH,
      w: cellW - 4, h: cellH - 4,
      cell,
    });
  });

  return tiles;
}

/* ============ Color scale for flow ============ */
function flowColor(v: number): string {
  if (v > 50) return '#00cc66';
  if (v > 20) return '#22aa55';
  if (v > 0) return '#338844';
  if (v > -20) return '#883333';
  if (v > -50) return '#aa2222';
  return '#ff3333';
}

function shortColor(v: number): string {
  if (v < 10) return '#0c6';
  if (v < 25) return '#ff8c00';
  if (v < 50) return '#b36800';
  return '#f33';
}

/* ============ Page ============ */
export default function TreemapPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<FlowMode>('inst');
  const [hovered, setHovered] = useState<string | null>(null);

  const cells = useMemo(() => generateMarketFlow(), []);
  
  const WIDTH = 900;
  const HEIGHT = 520;
  const tiles = useMemo(() => treemapLayout(cells, WIDTH, HEIGHT), [cells]);

  const getValue = (c: FlowCell): number => {
    if (mode === 'inst') return c.instFlow;
    if (mode === 'insider') return c.insiderFlow;
    return c.shortRisk;
  };

  const getColor = (c: FlowCell): string => {
    if (mode === 'short') return shortColor(getValue(c));
    return flowColor(getValue(c));
  };

  const modeLabel = mode === 'inst' ? '機構淨流向' : mode === 'insider' ? '內部人淨買賣' : '放空風險';
  const MODES: { key: FlowMode; label: string }[] = [
    { key: 'inst', label: '機構流向' },
    { key: 'insider', label: '內部人' },
    { key: 'short', label: '放空風險' },
  ];

  return (
    <div style={{ height: '100%', background: '#000', color: '#e6e6e6', fontFamily: 'JetBrains Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f', gap: 12, flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid #333', color: '#ff8c00', cursor: 'pointer', padding: '3px 10px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', borderRadius: 2 }}>
          ← BACK
        </button>
        <span style={{ color: '#ff8c00', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>TREEMAP</span>
        <span style={{ color: '#888', fontSize: 10 }}>全市場流向樹狀圖</span>
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 9 }}>{modeLabel}</span>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 10px', background: '#0a0a0a', borderBottom: '1px solid #1f1f1f' }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} style={{
            background: mode === m.key ? '#1a1a1a' : 'transparent',
            border: `1px solid ${mode === m.key ? '#ff8c00' : '#333'}`,
            color: mode === m.key ? '#ff8c00' : '#888',
            cursor: 'pointer', fontSize: 10, padding: '4px 12px',
            fontFamily: 'JetBrains Mono, monospace', borderRadius: 2,
          }}>{m.label}</button>
        ))}
      </div>

      {/* Treemap SVG */}
      <div style={{ flex: 1, padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}>
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#0a0a0a" />
          {tiles.map((tile, i) => {
            const v = getValue(tile.cell);
            const c = getColor(tile.cell);
            const isHovered = hovered === tile.cell.ticker;
            return (
              <g key={i}>
                <rect
                  x={tile.x} y={tile.y} width={tile.w} height={tile.h}
                  fill={c} fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke={isHovered ? '#ff8c00' : '#1f1f1f'}
                  strokeWidth={isHovered ? 2 : 1}
                  rx={2} ry={2}
                  style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                  onMouseEnter={() => setHovered(tile.cell.ticker)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(`/stocks/${tile.cell.ticker}`)}
                />
                <text x={tile.x + tile.w / 2} y={tile.y + tile.h / 2 - 5}
                  textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none' }}
                >{tile.cell.ticker}</text>
                <text x={tile.x + tile.w / 2} y={tile.y + tile.h / 2 + 8}
                  textAnchor="middle" fill={isHovered ? '#fff' : '#aaa'} fontSize={7}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none' }}
                >{mode === 'short' ? `S ${tile.cell.shortRisk}` : v >= 0 ? `+${v}` : `${v}`}</text>
                {isHovered && (
                  <text x={tile.x + tile.w / 2} y={tile.y + tile.h / 2 + 18}
                    textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                    style={{ pointerEvents: 'none' }}
                  >{tile.cell.marketCap.toFixed(2)}T</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0', background: '#0a0a0a', borderTop: '1px solid #1f1f1f', fontSize: 9 }}>
        <span style={{ color: '#555' }}>方塊大小=</span><span style={{ color: '#888' }}>市值</span>
        <span style={{ color: '#555', marginLeft: 8 }}>顏色=</span><span style={{ color: '#888' }}>{modeLabel}</span>
        {mode !== 'short' ? (
          <>
            <span style={{ color: '#0c6' }}>🟢 買入</span>
            <span style={{ color: '#f33' }}>🔴 賣出</span>
          </>
        ) : (
          <>
            <span style={{ color: '#0c6' }}>🟢 低風險</span>
            <span style={{ color: '#f33' }}>🔴 高風險</span>
          </>
        )}
        <span style={{ color: '#555', marginLeft: 8 }}>點擊</span><span style={{ color: '#ff8c00' }}>→ 查看詳情</span>
      </div>
    </div>
  );
}
