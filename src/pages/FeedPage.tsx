import { useState, useEffect, useRef } from 'react';
import { getInsiderTrades } from '@/lib/data-layer';
import { MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

/* ============================================================
   BLOOMBERG 4-QUADRANT SCREEN
   ============================================================ */

const ROW_H = 20;

function Row({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: ROW_H,
      padding: '0 6px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
      background: highlight ? 'var(--bl-bg-hover)' : 'transparent',
      borderBottom: '1px solid var(--bl-bg-row)',
    }}>
      {children}
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 22, padding: '0 8px',
      background: 'var(--bl-bg-panel)', borderBottom: '1px solid var(--bl-border)',
      fontSize: '10px', fontWeight: 700, color: 'var(--bl-amber)',
      letterSpacing: 1, textTransform: 'uppercase',
    }}>
      <span>{title}</span>
      {detail && <span style={{ color: 'var(--bl-gray-dim)', fontWeight: 400, fontSize: 9 }}>{detail}</span>}
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'.padStart(6);
  if (v >= 1e9) return `${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
  return `${v}`;
}

function s(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) : str.padEnd(n);
}

type FilterMode = 'all' | 'buy' | 'sell' | 'cluster';

export default function FeedPage() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [signals] = useState<ResonanceSignal[]>(MOCK_RESONANCE_SIGNALS);
  const [instOrders] = useState<InstitutionOrder[]>(MOCK_INSTITUTION_ORDERS);
  const [cmd, setCmd] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load trades
  useEffect(() => {
    setLoading(true);
    getInsiderTrades(filter, 1, 50)
      .then((res) => setTrades(res.data))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }, [filter]);

  // Keyboard: 1-4 filter, / focus cmd
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Don't intercept when typing in input
      if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;

      if (e.key === '1') setFilter('all');
      if (e.key === '2') setFilter('buy');
      if (e.key === '3') setFilter('sell');
      if (e.key === '4') setFilter('cluster');
      if (e.key === '/' || e.key === '`') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setCmd('');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Handle command input
  const handleCmdKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = cmd.trim().toUpperCase();
      if (v === '1' || v === 'ALL') setFilter('all');
      else if (v === '2' || v === 'BUY') setFilter('buy');
      else if (v === '3' || v === 'SELL') setFilter('sell');
      else if (v === '4' || v === 'CLUSTER') setFilter('cluster');
      else if (v.startsWith('/')) {
        const ticker = v.slice(1);
        // future: navigate to stock detail
        console.log('Search:', ticker);
      }
      setCmd('');
      inputRef.current?.blur();
    }
  };

  // Filter trades for display
  const displayTrades = trades;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bl-bg)',
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 22, padding: '0 8px',
        fontSize: 9, color: 'var(--bl-gray)', background: 'var(--bl-bg-panel)',
        borderBottom: '1px solid var(--bl-border)', gap: 12,
      }}>
        <span style={{ color: filter === 'buy' ? 'var(--bl-green)' : filter === 'sell' ? 'var(--bl-red)' : filter === 'cluster' ? 'var(--bl-amber)' : 'var(--bl-white)' }}>
          FILTER: {filter.toUpperCase()}
        </span>
        <span>{trades.length} trades</span>
        <span style={{ color: 'var(--bl-green)' }}>● LIVE</span>
        <span style={{ marginLeft: 'auto', color: 'var(--bl-amber)' }}>1-4 filter  /=cmd  ESC=exit</span>
      </div>

      {/* 2x2 Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
        flex: 1, overflow: 'hidden',
      }}>
        {/* Q1: Insider Trades */}
        <div style={{ borderRight: '1px solid var(--bl-border)', borderBottom: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="INSIDER TRADES" detail="SEC FORM 4" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 100, color: 'var(--bl-gray)' }}>INSIDER</span>
              <span style={{ width: 40, color: 'var(--bl-gray)', textAlign: 'right' }}>DIR</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>SHARES</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>PRICE</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>VALUE</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>DATE</span>
            </Row>
            {loading ? (
              [1,2,3,4,5,6,7,8,9,10].map(i => <Row key={i}><span style={{color:'var(--bl-gray)'}}>Loading...</span></Row>)
            ) : displayTrades.length === 0 ? (
              <Row><span style={{color:'var(--bl-gray)'}}>No trades found for filter: {filter}</span></Row>
            ) : displayTrades.slice(0, 30).map((t, i) => (
              <Row key={t.id || i} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{t.ticker}</span>
                <span style={{ width: 100, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s(t.insider_name, 12)}</span>
                <span style={{ width: 40, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                  {t.transaction_type === 'BUY' ? 'BUY' : 'SEL'}
                </span>
                <span style={{ width: 60, textAlign: 'right', color: 'var(--bl-white)' }}>{fmt(t.shares)}</span>
                <span style={{ width: 60, textAlign: 'right', color: 'var(--bl-white)' }}>{(t.price ?? 0).toFixed(2)}</span>
                <span style={{ width: 70, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)' }}>{fmt(t.total_value)}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-gray)' }}>{t.trade_date.slice(5)}</span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q2: Resonance Signals */}
        <div style={{ borderBottom: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="RESONANCE SIGNALS" detail="WHALE TRACKER" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 90, color: 'var(--bl-gray)' }}>COMPANY</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>INST BUY</span>
              <span style={{ width: 35, color: 'var(--bl-gray)', textAlign: 'right' }}>#I</span>
              <span style={{ width: 35, color: 'var(--bl-gray)', textAlign: 'right' }}>#P</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>STREN</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>BAR</span>
            </Row>
            {signals.map((sig, i) => (
              <Row key={sig.ticker} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{sig.ticker}</span>
                <span style={{ width: 90, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s(sig.company_name, 11)}</span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-green)' }}>{fmt(sig.total_institutional_buy)}</span>
                <span style={{ width: 35, textAlign: 'right', color: 'var(--bl-white)' }}>{sig.institution_count}</span>
                <span style={{ width: 35, textAlign: 'right', color: 'var(--bl-white)' }}>{sig.insider_buy_count}</span>
                <span style={{ width: 60, textAlign: 'right', color: 'var(--bl-amber)', fontWeight: 700 }}>{sig.signal_strength}</span>
                <span style={{ width: 60, paddingLeft: 2 }}>
                  <span style={{ display: 'inline-block', width: 50, height: 5, background: 'var(--bl-gray-dark)', verticalAlign: 'middle' }}>
                    <span style={{ display: 'block', width: `${sig.signal_strength}%`, height: '100%', background: 'var(--bl-amber)' }} />
                  </span>
                </span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q3: Institution Flow */}
        <div style={{ borderRight: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="INSTITUTION FLOW" detail="> $100M" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 110, color: 'var(--bl-gray)' }}>INSTITUTION</span>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICK</span>
              <span style={{ width: 75, color: 'var(--bl-gray)', textAlign: 'right' }}>AMOUNT</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>CHG%</span>
            </Row>
            {instOrders.map((o, i) => (
              <Row key={`${o.institution}-${o.ticker}`} highlight={i % 2 === 0}>
                <span style={{ width: 110, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s(o.institution, 14)}</span>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{o.ticker}</span>
                <span style={{ width: 75, textAlign: 'right', color: 'var(--bl-white)' }}>{fmt(o.amount)}</span>
                <span style={{ width: 55, textAlign: 'right', color: o.direction === 'NEW' ? 'var(--bl-amber)' : o.change_pct > 0 ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                  {o.direction === 'NEW' ? 'NEW' : `${o.change_pct > 0 ? '+' : ''}${o.change_pct}%`}
                </span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q4: Command Input */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="COMMAND INPUT" />
          <div style={{ flex: 1, padding: 8, fontFamily: 'JetBrains Mono, monospace', overflow: 'auto' }}>
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, fontSize: 10, marginBottom: 6 }}>KEYBOARD SHORTCUTS</div>
            <div style={{ fontSize: 10, color: 'var(--bl-gray)' }}>
              <div><span style={{ color: 'var(--bl-white)' }}>1</span> = ALL trades</div>
              <div><span style={{ color: 'var(--bl-white)' }}>2</span> = BUY only</div>
              <div><span style={{ color: 'var(--bl-white)' }}>3</span> = SELL only</div>
              <div><span style={{ color: 'var(--bl-white)' }}>4</span> = CLUSTER signals</div>
              <div style={{ marginTop: 2 }}><span style={{ color: 'var(--bl-white)' }}>/</span> = activate command line</div>
              <div><span style={{ color: 'var(--bl-white)' }}>ESC</span> = exit command line</div>
            </div>
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, fontSize: 10, marginTop: 8, marginBottom: 4 }}>COMMANDS</div>
            <div style={{ fontSize: 10, color: 'var(--bl-gray)' }}>
              <div><span style={{ color: 'var(--bl-white)' }}>/AAPL</span> — search by ticker</div>
              <div><span style={{ color: 'var(--bl-white)' }}>buy</span> / <span style={{ color: 'var(--bl-white)' }}>sell</span> / <span style={{ color: 'var(--bl-white)' }}>all</span> / <span style={{ color: 'var(--bl-white)' }}>cluster</span> — set filter</div>
              <div><span style={{ color: 'var(--bl-white)' }}>1-4</span> — filter shortcut</div>
            </div>
            {/* Command input */}
            <div style={{
              marginTop: 10, display: 'flex', alignItems: 'center',
              border: '1px solid var(--bl-border)', padding: '4px 8px',
            }}>
              <span style={{ color: 'var(--bl-green)', fontSize: 12, marginRight: 6 }}>&gt;</span>
              <input
                ref={inputRef}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={handleCmdKey}
                placeholder="type /ticker or filter..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--bl-amber)', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, caretColor: 'var(--bl-amber)',
                }}
              />
              <span style={{ color: 'var(--bl-gray-dim)', fontSize: 9 }}>ENTER ↵</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 18, padding: '0 8px',
        fontSize: 9, color: 'var(--bl-gray-dim)', background: 'var(--bl-bg-panel)',
        borderTop: '1px solid var(--bl-border)', gap: 12,
      }}>
        <span>DATA: SEC EDGAR via n8n | mock fallback active</span>
        <span style={{ marginLeft: 'auto' }}>🐋 WhaleTrace v2 | BLOOMBERG MODE</span>
      </div>
    </div>
  );
}
