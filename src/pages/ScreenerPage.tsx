import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore
import SNAPSHOTS from '../../public/data/stock_snapshots.json';
// @ts-ignore
import SEC_TRADES_RAW from '../../public/data/sec_insider_trades.json';

// ─── Types ───────────────────────────────────────────────
interface StockSnapshot {
  ticker: string;
  company_name: string;
  market_cap: number;
  price: number;
  pe_trailing: number;
  pe_forward: number;
  peg: number;
  inst_own_pct: number;
  insider_own_pct: number;
  insider_trans_pct: number;
  short_float_pct: number;
  short_ratio: number;
  roe: number;
  beta: number;
  rsi14: number;
  debt_equity: number;
  profit_margin: number;
  data_date: string;
  revenue_growth: number;
  analyst_target: number;
  recommendation: string;
  sma50: number;
  sma200: number;
}

interface SECRaw {
  count: number;
  trades: Array<{
    ticker: string;
    type: string;
    code: string;
    total_value: number;
    shares: number;
  }>;
}

interface ScreenerRow {
  ticker: string;
  company: string;
  price: number;
  marketCap: number;
  pe: number;
  rsi: number;
  instOwn: number;
  insiderOwn: number;
  signal: number;
  buys: number;
  sells: number;
  buyVal: number;
  sellVal: number;
  netVal: number;
  recommendation: string;
  sma50: number;
  sma200: number;
  beta: number;
  peg: number;
}

type SortField = 'ticker' | 'price' | 'marketCap' | 'pe' | 'rsi' | 'instOwn' | 'insiderOwn' | 'signal' | 'buys' | 'sells' | 'netVal' | 'recommendation';

// ─── Constants ────────────────────────────────────────────
const ROW_H = 22;
const HDR_H = 25;

const COMPANIES: Record<string, string> = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft', NVDA: 'NVIDIA', GOOGL: 'Alphabet',
  META: 'Meta', AMZN: 'Amazon', TSLA: 'Tesla', JPM: 'JPMorgan',
  V: 'Visa', UNH: 'UnitedHealth', XOM: 'ExxonMobil', WMT: 'Walmart',
  JNJ: 'Johnson & Johnson', MA: 'Mastercard', PG: 'Procter & Gamble',
  HD: 'Home Depot', BAC: 'Bank of America', 'BRK.B': 'Berkshire',
  DIS: 'Disney', CRM: 'Salesforce', ADBE: 'Adobe', NFLX: 'Netflix',
};

// ─── Colors ───────────────────────────────────────────────
const C = {
  bg: '#000',
  surface: '#0a0a0a',
  border: '#1f1f1f',
  amber: '#ff8c00',
  amberDim: '#b36800',
  green: '#0c6',
  greenDim: '#084',
  red: '#f33',
  redDim: '#a22',
  white: '#e6e6e6',
  gray: '#888',
  grayDim: '#555',
  grayDark: '#333',
  headerBg: '#0d0d0d',
  purple: '#8b5cf6',
  blue: '#3b82f6',
};

// ─── Formatters ───────────────────────────────────────────
function F(v: number): string {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(1);
}

function FP(v: number): string {
  if (v == null || isNaN(v)) return '—';
  return '$' + v.toFixed(2);
}

function FPct(v: number): string {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(1) + '%';
}

function sigColor(s: number): string {
  if (s >= 70) return C.green;
  if (s >= 50) return '#6a6';
  if (s >= 30) return C.amber;
  if (s >= 15) return C.amberDim;
  return C.red;
}

// ─── Primitive Components ─────────────────────────────────
function R({ w, c, b, a, onClick, children }: {
  w: number; c: string; b?: boolean; a?: 'left' | 'right' | 'center';
  onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-block', width: w, height: ROW_H, lineHeight: `${ROW_H}px`,
      color: c, fontWeight: b ? 700 : 400, fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
      textAlign: a || 'left', padding: '0 4px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      verticalAlign: 'middle',
      cursor: onClick ? 'pointer' : 'default',
    }}>{children}</span>
  );
}

function HCol({ w, c, a, field, sortField, sortDir, onClick, children }: {
  w: number; c: string; a?: 'left' | 'right' | 'center';
  field: SortField; sortField: SortField; sortDir: 'asc' | 'desc';
  onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  const active = sortField === field;
  return (
    <span onClick={() => onClick(field)} style={{
      display: 'inline-block', width: w, height: HDR_H, lineHeight: `${HDR_H}px`,
      color: active ? C.amber : c, fontWeight: 600, fontSize: 10,
      fontFamily: 'JetBrains Mono, monospace',
      textAlign: a || 'left', padding: '0 4px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      verticalAlign: 'middle', cursor: 'pointer',
      background: active ? 'rgba(255,140,0,0.06)' : 'transparent',
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {children}{active ? (sortDir === 'asc' ? ' ▴' : ' ▾') : ''}
    </span>
  );
}

// ─── Data Processing ──────────────────────────────────────
function computeScreenerData(): ScreenerRow[] {
  const snapshots = SNAPSHOTS as StockSnapshot[];
  const secRaw = SEC_TRADES_RAW as SECRaw;

  // Build per-ticker trade stats from SEC data
  const tradeStats: Record<string, { buys: number; sells: number; buyVal: number; sellVal: number }> = {};
  for (const t of secRaw.trades) {
    const tk = t.ticker;
    if (!tradeStats[tk]) tradeStats[tk] = { buys: 0, sells: 0, buyVal: 0, sellVal: 0 };
    if (t.type === 'BUY' || t.code === 'P') {
      tradeStats[tk].buys++;
      tradeStats[tk].buyVal += t.total_value || 0;
    } else {
      tradeStats[tk].sells++;
      tradeStats[tk].sellVal += t.total_value || 0;
    }
  }

  const rows: ScreenerRow[] = [];

  for (const s of snapshots) {
    const ts = tradeStats[s.ticker] || { buys: 0, sells: 0, buyVal: 0, sellVal: 0 };
    const netVal = ts.buyVal - ts.sellVal;

    // Compute signal score (0-100)
    // Formula: buy ratio * 50 + institution ownership score + RSI adjustment + value bonus
    const total = ts.buys + ts.sells;
    const buyRatio = total > 0 ? ts.buys / total : 0;
    const valueBonus = Math.min(25, (ts.buyVal / 1_000_000) * 2);
    const instScore = Math.min(20, (s.inst_own_pct || 0) * 0.25);
    const rsiBonus = s.rsi14 > 50 ? Math.min(10, (s.rsi14 - 50) * 0.2) : 0;
    const signal = Math.round(Math.min(100, buyRatio * 50 + valueBonus + instScore + rsiBonus));

    rows.push({
      ticker: s.ticker,
      company: COMPANIES[s.ticker] || s.company_name,
      price: s.price,
      marketCap: s.market_cap,
      pe: s.pe_trailing,
      rsi: s.rsi14,
      instOwn: s.inst_own_pct,
      insiderOwn: s.insider_trans_pct || s.insider_own_pct,
      signal,
      buys: ts.buys,
      sells: ts.sells,
      buyVal: ts.buyVal,
      sellVal: ts.sellVal,
      netVal,
      recommendation: s.recommendation,
      sma50: s.sma50,
      sma200: s.sma200,
      beta: s.beta,
      peg: s.peg,
    });
  }

  return rows;
}

export default function ScreenerPage() {
  const navigate = useNavigate();
  const allRows = useMemo(() => computeScreenerData(), []);
  const [sortField, setSortField] = useState<SortField>('signal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'SIG70' | 'SIG50'>('ALL');
  const [hovered, setHovered] = useState<string | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ─── Filter + Search + Sort ─────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = [...allRows];

    // Text search
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      rows = rows.filter(r =>
        r.ticker.includes(q) || r.company.toUpperCase().includes(q)
      );
    }

    // Filter by type
    if (filter === 'BUY') rows = rows.filter(r => r.buys > 0);
    else if (filter === 'SELL') rows = rows.filter(r => r.sells > 0);
    else if (filter === 'SIG70') rows = rows.filter(r => r.signal >= 70);
    else if (filter === 'SIG50') rows = rows.filter(r => r.signal >= 50);

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      const f = sortField;
      if (f === 'ticker') cmp = a.ticker.localeCompare(b.ticker);
      else if (f === 'recommendation') cmp = a.recommendation.localeCompare(b.recommendation);
      else cmp = (a[f] as number) - (b[f] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [allRows, search, filter, sortField, sortDir]);

  // ─── Counts ─────────────────────────────────────────────
  const buyCount = allRows.filter(r => r.buys > 0).length;
  const sellCount = allRows.filter(r => r.sells > 0).length;
  const sig70 = allRows.filter(r => r.signal >= 70).length;
  const sig50 = allRows.filter(r => r.signal >= 50).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.white, fontFamily: 'JetBrains Mono, monospace' }}>
      {/* ─── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: C.surface, borderBottom: `1px solid ${C.border}`, gap: 8, flexShrink: 0 }}>
        {/* Nav buttons */}
        <button onClick={() => navigate('/')}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gray, cursor: 'pointer', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2 }}>
          TERM
        </button>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gray, cursor: 'pointer', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2 }}>
          DASH
        </button>
        <button style={{
          background: '#1a1a1a', border: `1px solid ${C.amber}`, color: C.amber,
          cursor: 'default', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2,
        }}>
          SCRN
        </button>
        <button onClick={() => navigate('/heatmap')}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gray, cursor: 'pointer', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2 }}>
          HEAT
        </button>
        <button onClick={() => navigate('/treemap')}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gray, cursor: 'pointer', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2 }}>
          TREE
        </button>
        <button onClick={() => navigate('/watchlist')}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.gray, cursor: 'pointer', padding: '2px 8px', fontSize: 9, fontFamily: 'JetBrains Mono,monospace', borderRadius: 2 }}>
          ⭐ WATCH
        </button>

        {/* Filter buttons */}
        <span style={{ color: C.grayDim, fontSize: 9, marginLeft: 16 }}>FILTER:</span>
        {(['ALL', 'BUY', 'SELL', 'SIG50', 'SIG70'] as const).map(fb => {
          const active = filter === fb;
          const label = fb === 'ALL' ? `ALL(${allRows.length})` :
            fb === 'BUY' ? `🟢 BUY(${buyCount})` :
            fb === 'SELL' ? `🔴 SELL(${sellCount})` :
            fb === 'SIG50' ? `S≥50(${sig50})` : `S≥70(${sig70})`;
          const borderColor = active ? (fb === 'BUY' ? C.green : fb === 'SELL' ? C.red : fb === 'SIG70' ? C.green : C.amber) : C.border;
          const textColor = active ? borderColor : C.gray;
          return (
            <button key={fb} onClick={() => setFilter(fb)} style={{
              background: active ? '#1a1a1a' : 'transparent',
              border: `1px solid ${borderColor}`,
              color: textColor, cursor: 'pointer', fontSize: 9,
              padding: '2px 8px', fontFamily: 'JetBrains Mono,monospace', borderRadius: 2,
            }}>{label}</button>
          );
        })}

        {/* Search */}
        <input
          type="text"
          placeholder="TICKER..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
          style={{
            marginLeft: 'auto', width: 100, background: C.bg, border: `1px solid ${C.border}`,
            color: C.amber, padding: '2px 6px', fontSize: 10, fontFamily: 'JetBrains Mono,monospace',
            outline: 'none', borderRadius: 2,
          }}
        />
        <span style={{ color: C.grayDim, fontSize: 9, marginRight: 8 }}>{filteredRows.length}/{allRows.length}</span>
      </div>

      {/* ─── Column Headers ───────────────────────────────── */}
      <div style={{ display: 'flex', padding: '0 8px', background: C.headerBg, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <HCol w={55} c={C.grayDim} a="left" field="ticker" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>TICKER</HCol>
        <HCol w={130} c={C.grayDim} a="left" field="ticker" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>COMPANY</HCol>
        <HCol w={70} c={C.grayDim} a="right" field="price" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>PRICE</HCol>
        <HCol w={85} c={C.grayDim} a="right" field="marketCap" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>MKT CAP</HCol>
        <HCol w={60} c={C.grayDim} a="right" field="pe" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>P/E</HCol>
        <HCol w={55} c={C.grayDim} a="right" field="rsi" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>RS(14)</HCol>
        <HCol w={60} c={C.grayDim} a="right" field="instOwn" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>INST%</HCol>
        <HCol w={55} c={C.grayDim} a="right" field="insiderOwn" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>INS%</HCol>
        <HCol w={60} c={C.grayDim} a="right" field="signal" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>SIGNAL</HCol>
        <HCol w={50} c={C.grayDim} a="right" field="buys" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>B</HCol>
        <HCol w={50} c={C.grayDim} a="right" field="sells" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>S</HCol>
        <HCol w={75} c={C.grayDim} a="right" field="netVal" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>NET</HCol>
      </div>

      {/* ─── Data Rows ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredRows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.grayDim, fontSize: 12 }}>
            {search ? `NO RESULTS FOR "${search}"` : 'NO DATA'}
          </div>
        ) : (
          filteredRows.map((r, i) => {
            const isHover = hovered === r.ticker;
            const bg = isHover ? '#1a1a1a' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
            return (
              <div key={r.ticker}
                onMouseEnter={() => setHovered(r.ticker)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/stocks/${r.ticker}`)}
                style={{
                  display: 'flex', padding: '0 8px', height: ROW_H,
                  background: bg, borderBottom: `1px solid rgba(255,255,255,0.03)`,
                  cursor: 'pointer', margin: 0, lineHeight: `${ROW_H}px`,
                }}
              >
                <R w={55} c={C.amber} b a="left">{r.ticker}</R>
                <R w={130} c={C.white} a="left">{r.company}</R>
                <R w={70} c={C.white} a="right">{FP(r.price)}</R>
                <R w={85} c={C.gray} a="right">{F(r.marketCap)}</R>
                <R w={60} c={r.pe > 0 && r.pe < 50 ? C.white : C.grayDim} a="right">{r.pe > 0 ? r.pe.toFixed(1) : '—'}</R>
                <R w={55} c={r.rsi > 70 ? C.red : r.rsi > 50 ? C.green : r.rsi > 30 ? C.amber : C.redDim} a="right">{r.rsi > 0 ? r.rsi.toFixed(0) : '—'}</R>
                <R w={60} c={r.instOwn > 70 ? C.green : r.instOwn > 40 ? C.white : C.grayDim} a="right">{FPct(r.instOwn)}</R>
                <R w={55} c={r.insiderOwn > 0.5 ? C.amber : C.grayDim} a="right">{FPct(r.insiderOwn)}</R>
                <R w={60} c={sigColor(r.signal)} b a="right">{r.signal}</R>
                <R w={50} c={r.buys > 0 ? C.green : C.grayDim} a="right">{r.buys > 0 ? r.buys : '·'}</R>
                <R w={50} c={r.sells > 0 ? C.red : C.grayDim} a="right">{r.sells > 0 ? r.sells : '·'}</R>
                <R w={75} c={r.netVal > 0 ? C.green : r.netVal < 0 ? C.red : C.grayDim} b a="right">{r.netVal !== 0 ? F(r.netVal) : '·'}</R>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 10px', background: C.surface, borderTop: `1px solid ${C.border}`, fontSize: 9, color: C.grayDim, flexShrink: 0 }}>
        <span>🐋 WHALETRACE SCREENER | {allRows.length} TICKERS</span>
        <span>
          {filteredRows.length} SHOWN | SORT: {sortField.toUpperCase()} {sortDir === 'asc' ? '▲' : '▼'}
          {' | '}🟢{buyCount} 🔴{sellCount} ⚡{sig50}
        </span>
      </div>
    </div>
  );
}
