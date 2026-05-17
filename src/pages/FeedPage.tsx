import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useInsiderTrades, type TradeFilter } from '@/hooks/useInsiderTrades';
import { MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import { getResonanceSignals, getInstitutionOrders } from '@/lib/data-layer';
import type { InsiderTrade, ResonanceSignal } from '@/types';
import type { InstitutionOrder } from '@/lib/mock-data';

/* ============================================================
   BLOOMBERG 4-QUADRANT SCREEN
   Q1: 最新內部人交易 (左上)
   Q2: 共振訊號 (右上)
   Q3: 機構大單 (左下)
   Q4: 交易明細 (右下)
   ============================================================ */

const ROW_H = 20;
const ROW_FONT = '11px';

function Row({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: ROW_H,
      padding: '0 6px', fontSize: ROW_FONT, fontFamily: 'JetBrains Mono, monospace',
      background: highlight ? 'var(--bl-bg-hover)' : 'transparent',
      borderBottom: '1px solid var(--bl-bg-row)',
    }}>
      {children}
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 22, padding: '0 8px',
      background: 'var(--bl-bg-panel)', borderBottom: '1px solid var(--bl-border)',
      fontSize: 'var(--bl-font-sm)', fontWeight: 700, color: 'var(--bl-amber)',
      letterSpacing: 1, textTransform: 'uppercase',
    }}>
      <span>{title}</span>
      <span style={{ color: 'var(--bl-gray-dim)', fontWeight: 400, fontSize: 9 }}>F1-F4 NAV</span>
    </div>
  );
}

function formatVal(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(2)}B`.padStart(8);
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`.padStart(7);
  if (v >= 1_000) return `${(v/1_000).toFixed(0)}K`.padStart(6);
  return `${v}`.padStart(8);
}

function formatPrice(v: number | null | undefined): string {
  if (v == null) return '   —';
  return v.toFixed(2).padStart(7);
}

function formatShares(v: number | null | undefined): string {
  if (v == null) return '  —';
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`.padStart(6);
  if (v >= 1_000) return `${(v/1_000).toFixed(0)}K`.padStart(6);
  return `${v}`.padStart(6);
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s.padEnd(max);
}

export default function FeedPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TradeFilter>('all');
  const { data, isLoading, fetchNextPage } = useInsiderTrades(filter);
  const [signals, setSignals] = useState<ResonanceSignal[]>(MOCK_RESONANCE_SIGNALS);
  const [instOrders, setInstOrders] = useState<InstitutionOrder[]>(MOCK_INSTITUTION_ORDERS);

  useEffect(() => {
    getResonanceSignals().then(setSignals).catch(() => {});
    getInstitutionOrders().then(setInstOrders).catch(() => {});
  }, []);

  const trades = data?.pages.flatMap((p) => p.data) ?? [];
  const recentTrades = trades.slice(0, 20);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' || e.key === '`') {
        e.preventDefault();
        // Focus command input
      }
      if (e.ctrlKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case '1': setFilter('all'); break;
        case '2': setFilter('buy'); break;
        case '3': setFilter('sell'); break;
        case '4': setFilter('cluster'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--bl-topbar-h))',
      background: 'var(--bl-bg)', overflow: 'hidden',
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 'var(--bl-statusbar-h)',
        padding: '0 8px', fontSize: 9, color: 'var(--bl-gray)',
        background: 'var(--bl-bg-panel)', borderBottom: '1px solid var(--bl-border)',
        gap: 12,
      }}>
        <span>SCREENER: {filter.toUpperCase()}</span>
        <span>{recentTrades.length} trades loaded</span>
        <span style={{ color: 'var(--bl-green)' }}>SEC EDGAR ▲ LIVE</span>
        <span style={{ marginLeft: 'auto', color: 'var(--bl-amber)' }}>Press 1-4 to filter | / = search</span>
      </div>

      {/* 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
        
        {/* Q1: Insider Trades (左上) */}
        <div style={{ borderRight: '1px solid var(--bl-border)', borderBottom: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="INSIDER TRADES (24H)" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Header row */}
            <Row>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 120, color: 'var(--bl-gray)' }}>INSIDER</span>
              <span style={{ width: 50, color: 'var(--bl-gray)', textAlign: 'right' }}>TYPE</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>SHARES</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>PRICE</span>
              <span style={{ width: 80, color: 'var(--bl-gray)', textAlign: 'right' }}>VALUE</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>DATE</span>
            </Row>
            {isLoading ? (
              [1,2,3,4,5,6,7,8].map(i => <Row key={i}><span style={{color:'var(--bl-gray-dim)'}}>Loading...</span></Row>)
            ) : recentTrades.map((t, i) => (
              <Row key={t.id || i} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{t.ticker}</span>
                <span style={{ width: 120, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shorten(t.insider_name, 14)}</span>
                <span style={{ width: 50, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                  {t.transaction_type}
                </span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-white)' }}>{formatShares(t.shares)}</span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-white)' }}>{formatPrice(t.price)}</span>
                <span style={{ width: 80, textAlign: 'right', color: t.transaction_type === 'BUY' ? 'var(--bl-green)' : 'var(--bl-red)' }}>
                  {formatVal(t.total_value)}
                </span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-gray)' }}>{t.trade_date.slice(5)}</span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q2: Resonance Signals (右上) */}
        <div style={{ borderBottom: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="WHALE RESONANCE SIGNALS" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 100, color: 'var(--bl-gray)' }}>COMPANY</span>
              <span style={{ width: 70, color: 'var(--bl-gray)', textAlign: 'right' }}>INST BUY</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>#INST</span>
              <span style={{ width: 55, color: 'var(--bl-gray)', textAlign: 'right' }}>#INSDR</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>STRENG</span>
            </Row>
            {signals.map((s, i) => (
              <Row key={s.ticker} highlight={i % 2 === 0}>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{s.ticker}</span>
                <span style={{ width: 100, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shorten(s.company_name, 12)}</span>
                <span style={{ width: 70, textAlign: 'right', color: 'var(--bl-green)' }}>{formatVal(s.total_institutional_buy)}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-white)' }}>{s.institution_count}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--bl-white)' }}>{s.insider_buy_count}</span>
                <span style={{ width: 60, textAlign: 'right', color: 'var(--bl-amber)', fontWeight: 700 }}>
                  {s.signal_strength}
                  <span style={{ display: 'inline-block', width: 40, height: 4, background: 'var(--bl-gray-dark)', marginLeft: 4, verticalAlign: 'middle' }}>
                    <span style={{ display: 'block', width: `${s.signal_strength}%`, height: '100%', background: 'var(--bl-amber)' }} />
                  </span>
                </span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q3: Institution Orders (左下) */}
        <div style={{ borderRight: '1px solid var(--bl-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="INSTITUTION FLOW (>100M)" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Row>
              <span style={{ width: 120, color: 'var(--bl-gray)' }}>INSTITUTION</span>
              <span style={{ width: 50, color: 'var(--bl-gray)' }}>TICKER</span>
              <span style={{ width: 80, color: 'var(--bl-gray)', textAlign: 'right' }}>AMOUNT</span>
              <span style={{ width: 60, color: 'var(--bl-gray)', textAlign: 'right' }}>CHANGE</span>
            </Row>
            {instOrders.map((o, i) => (
              <Row key={`${o.institution}-${o.ticker}`} highlight={i % 2 === 0}>
                <span style={{ width: 120, color: 'var(--bl-white)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shorten(o.institution, 15)}</span>
                <span style={{ width: 50, color: 'var(--bl-amber)', fontWeight: 600 }}>{o.ticker}</span>
                <span style={{ width: 80, textAlign: 'right', color: 'var(--bl-white)' }}>{formatVal(o.amount)}</span>
                <span style={{ width: 60, textAlign: 'right', color: o.direction === 'NEW' ? 'var(--bl-amber)' : o.change_pct > 0 ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                  {o.direction === 'NEW' ? 'NEW' : `${o.change_pct > 0 ? '+' : ''}${o.change_pct}%`}
                </span>
              </Row>
            ))}
          </div>
        </div>

        {/* Q4: Detail (右下) */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelHeader title="FILTERS & COMMANDS" />
          <div style={{ flex: 1, padding: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--bl-gray)', overflow: 'auto' }}>
            <div style={{ color: 'var(--bl-amber)', fontWeight: 600, marginBottom: 4 }}>KEYBOARD SHORTCUTS</div>
            <div style={{ marginBottom: 6 }}>
              <div><span style={{ color: 'var(--bl-white)' }}>1</span>  ALL trades</div>
              <div><span style={{ color: 'var(--bl-white)' }}>2</span>  BUY only</div>
              <div><span style={{ color: 'var(--bl-white)' }}>3</span>  SELL only</div>
              <div><span style={{ color: 'var(--bl-white)' }}>4</span>  CLUSTER signals</div>
            </div>
            <div style={{ marginBottom: 4, color: 'var(--bl-amber)', fontWeight: 600 }}>COMMAND LINE</div>
            <div><span style={{ color: 'var(--bl-white)' }}>/AAPL</span>  jump to stock</div>
            <div><span style={{ color: 'var(--bl-white)' }}>/buy 10M</span>  filter buy &gt;10M</div>
            <div style={{ marginTop: 8, padding: 4, border: '1px solid var(--bl-border)', color: 'var(--bl-amber)' }}>
              <span style={{ color: 'var(--bl-green)', marginRight: 4 }}>&gt;</span>_
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 18, padding: '0 8px',
        fontSize: 9, color: 'var(--bl-gray-dim)', background: 'var(--bl-bg-panel)',
        borderTop: '1px solid var(--bl-border)', gap: 16,
      }}>
        <span>Filters: {filter}</span>
        <span>DataSource: SEC EDGAR via n8n</span>
        <span style={{ marginLeft: 'auto' }}>🐋 WhaleTrace v2.0 BLOOMBERG MODE</span>
      </div>
    </div>
  );
}
