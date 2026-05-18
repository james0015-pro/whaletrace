import { useState, useEffect, useRef } from 'react';
import { MOCK_TRADES, filterTrades, getPaginatedTrades, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

/* ============================================================
   BLOOMBERG 4-QUADRANT — Direct Mock Data
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

function ss(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) : str.padEnd(n);
}

type FilterMode = 'all' | 'buy' | 'sell' | 'cluster';

export default function FeedPage() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [allTrades] = useState<InsiderTrade[]>(() => MOCK_TRADES);
  const [signals] = useState<ResonanceSignal[]>(MOCK_RESONANCE_SIGNALS);
  const [instOrders] = useState<InstitutionOrder[]>(MOCK_INSTITUTION_ORDERS);
  const [cmd, setCmd] = useState('');
  const [cmdResult, setCmdResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter trades based on current filter
  const filteredTrades = (() => {
    switch (filter) {
      case 'buy': return allTrades.filter(t => t.transaction_type === 'BUY' && !t.is_10b5_1 && t.signal_category !== 'CLUSTER');
      case 'sell': return allTrades.filter(t => t.transaction_type === 'SELL' && !t.is_10b5_1);
      case 'cluster': return allTrades.filter(t => t.signal_category === 'CLUSTER');
      default: return allTrades;
    }
  })().slice(0, 40);

  // Keyboard: 1-4 filter, / focus cmd
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;
      if (e.key === '1') { setFilter('all'); setCmdResult('Filter: ALL'); }
      if (e.key === '2') { setFilter('buy'); setCmdResult('Filter: BUY only'); }
      if (e.key === '3') { setFilter('sell'); setCmdResult('Filter: SELL only'); }
      if (e.key === '4') { setFilter('cluster'); setCmdResult('Filter: CLUSTER'); }
      if (e.key === '/' || e.key === '`') {
        e.preventDefault();
        inputRef.current?.focus();
        setCmdResult('');
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setCmd('');
        setCmdResult('');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Command handler
  const handleCmdKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = cmd.trim().toLowerCase();
      setCmd('');
      if (v === '1' || v === 'all') { setFilter('all'); setCmdResult('Filter: ALL'); }
      else if (v === '2' || v === 'buy') { setFilter('buy'); setCmdResult('Filter: BUY only'); }
      else if (v === '3' || v === 'sell') { setFilter('sell'); setCmdResult('Filter: SELL only'); }
      else if (v === '4' || v === 'cluster') { setFilter('cluster'); setCmdResult('Filter: CLUSTER'); }
      else if (v.startsWith('/')) { setCmdResult(`Searching for: ${v.slice(1).toUpperCase()} (NYI)`); }
      else { setCmdResult(`Unknown: "${v}"`); }
      inputRef.current?.blur();
      setTimeout(() => setCmdResult(''), 3000);
    }
  };

  const buyCount = allTrades.filter(t => t.transaction_type === 'BUY').length;
  const sellCount = allTrades.filter(t => t.transaction_type === 'SELL').length;
  const clusterCount = allTrades.filter(t => t.signal_category === 'CLUSTER').length;

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
        <span style={{ color: 'var(--bl-white)', fontWeight: 600 }}>
          {filter === 'buy' ? '🟢 BUY' : filter === 'sell' ? '🔴 SELL' : filter === 'cluster' ? '🟣 CLUSTER' : '◉ ALL'}
        </span>
        <span>{filteredTrades.length}/{allTrades.length} trades</span>
        <span>BUY:{buyCount} SEL:{sellCount} CLU:{clusterCount}</span>
        <span style={{ marginLeft: 'auto' }}>{cmdResult && <span style={{ color: 'var(--bl-amber)' }}>{cmdResult}</span>}</span>
        <span style={{ color: 'var(--bl-gray-dim)' }}>1-4=filter /=cmd</span>
      </div>

      {/* 2x2 Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
        flex: 1, overflow: 'hidden',
      }}>
        {/* Q1: Insider Trades */}
        <div style={{ borderRight: '1px solid var(--bl-border)', borderBottom: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="INSIDER TRADES" detail={`${filteredTrades.length} rows`} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 110, color: 'var(--bl-gray)' }}>INSIDER</span>
              <span style={{ width: 38, color: 'var(--bl-gray)', textAlign: 'right' }}>DIR</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>SHARES</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>PRICE</span>
              <span style={{ width: 65, color: 'var(--bl-gray)', textAlign: 'right' }}>VALUE</span>
              <span style={{ width: 52, color: 'var(--bl-gray)', textAlign: 'right' }}>DATE</span>
            </Row>
            {filteredTrades.map((t, i) => (
              <Row key={t.id} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{t.ticker}</span>
                <span style={{ width: 110, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss(t.insider_name, 14)}</span>
                <span style={{ width: 38, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                  {t.transaction_type === 'BUY' ? 'BUY' : 'SEL'}
                </span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-white)' }}>{fmt(t.shares)}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-white)' }}>{(t.price ?? 0).toFixed(2)}</span>
                <span style={{ width: 65, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)' }}>{fmt(t.total_value)}</span>
                <span style={{ width: 52, textAlign: 'right', color: 'var(--bl-gray)' }}>{t.trade_date.slice(5)}</span>
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
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>STREN</span>
              <span style={{ width: 65, color: 'var(--bl-gray)' }}>BAR</span>
            </Row>
            {signals.map((sig, i) => (
              <Row key={sig.ticker} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{sig.ticker}</span>
                <span style={{ width: 90, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss(sig.company_name, 11)}</span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-green)' }}>{fmt(sig.total_institutional_buy)}</span>
                <span style={{ width: 35, textAlign: 'right', color: 'var(--bl-white)' }}>{sig.institution_count}</span>
                <span style={{ width: 35, textAlign: 'right', color: 'var(--bl-white)' }}>{sig.insider_buy_count}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-amber)', fontWeight: 700 }}>{sig.signal_strength}</span>
                <span style={{ width: 65, paddingLeft: 2 }}>
                  <span style={{ display: 'inline-block', width: 55, height: 5, background: 'var(--bl-gray-dark)', verticalAlign: 'middle' }}>
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
                <span style={{ width: 110, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss(o.institution, 14)}</span>
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
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, fontSize: 10, marginBottom: 4 }}>QUICK STATS</div>
            <div style={{ fontSize: 10, color: 'var(--bl-gray)', marginBottom: 8 }}>
              <div>Total trades: <span style={{ color: 'var(--bl-white)' }}>{allTrades.length}</span></div>
              <div>Buys: <span style={{ color: 'var(--bl-green)' }}>{buyCount}</span> | Sells: <span style={{ color: 'var(--bl-red)' }}>{sellCount}</span></div>
              <div>Cluster signals: <span style={{ color: 'var(--bl-amber)' }}>{clusterCount}</span></div>
              <div>Resonance signals: <span style={{ color: 'var(--bl-amber)' }}>{signals.length}</span></div>
            </div>
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, fontSize: 10, marginBottom: 4 }}>SHORTCUTS</div>
            <div style={{ fontSize: 10, color: 'var(--bl-gray)', marginBottom: 8 }}>
              <div><span style={{ color: 'var(--bl-white)' }}>1</span> ALL | <span style={{ color: 'var(--bl-white)' }}>2</span> BUY | <span style={{ color: 'var(--bl-white)' }}>3</span> SELL | <span style={{ color: 'var(--bl-white)' }}>4</span> CLUSTER</div>
              <div><span style={{ color: 'var(--bl-white)' }}>/</span> focus cmd | <span style={{ color: 'var(--bl-white)' }}>ESC</span> cancel</div>
            </div>
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, fontSize: 10, marginBottom: 2 }}>COMMAND</div>
            <div style={{
              display: 'flex', alignItems: 'center',
              border: '1px solid var(--bl-border)', padding: '3px 6px',
            }}>
              <span style={{ color: 'var(--bl-green)', fontSize: 12, marginRight: 6 }}>&gt;</span>
              <input
                ref={inputRef}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={handleCmdKey}
                placeholder="buy / sell / all / /AAPL"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--bl-amber)', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, caretColor: 'var(--bl-amber)',
                }}
              />
              <span style={{ color: 'var(--bl-gray-dim)', fontSize: 9 }}>↵</span>
            </div>
            {cmdResult && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--bl-green)' }}>
                {cmdResult}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 18, padding: '0 8px',
        fontSize: 9, color: 'var(--bl-gray-dim)', background: 'var(--bl-bg-panel)',
        borderTop: '1px solid var(--bl-border)', gap: 12,
      }}>
        <span>MOCK DATA (500 trades) | Real SEC EDGAR: ready — needs frontend hookup</span>
        <span style={{ marginLeft: 'auto' }}>🐋 WhaleTrace v2 BLOOMBERG</span>
      </div>
    </div>
  );
}
