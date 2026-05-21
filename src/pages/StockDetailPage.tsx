import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { InsiderTrade } from '@/types';
import { MOCK_TRADES, MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InstitutionOrder } from '@/lib/mock-data';
import { formatCurrency, formatNumber } from '@/lib/utils';

// ── Deterministic mock prices (reused from Bloomberg version) ──

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generatePrices(ticker: string, count: number) {
  const seed = seedFrom(ticker + '_prices');
  const rng = (i: number) => { const x = Math.sin(seed + i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const base = 80 + rng(0) * 220;
  const drift = rng(1) > 0.5 ? 1.003 : 0.997;
  const prices: number[] = [base];
  for (let i = 1; i < count; i++) {
    prices.push(+(prices[i - 1] * drift * (0.97 + rng(i * 3) * 0.06)).toFixed(2));
  }
  return prices;
}

// ── Component ──

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [tf, setTf] = useState(20);

  const trades = useMemo(() =>
    MOCK_TRADES
      .filter(t => t.ticker === ticker)
      .sort((a, b) => b.filing_date.localeCompare(a.filing_date)),
  [ticker]);

  const resonance = useMemo(() =>
    MOCK_RESONANCE_SIGNALS.find(r => r.ticker === ticker),
  [ticker]);

  const institutions = useMemo(() =>
    MOCK_INSTITUTION_ORDERS.filter(o => o.ticker === ticker),
  [ticker]);

  const prices = useMemo(() => generatePrices(ticker!, tf), [ticker, tf]);

  if (!ticker || trades.length === 0) {
    return (
      <div style={{ maxWidth: 1000, margin: '40px auto', textAlign: 'center', color: '#7a8088' }}>
        No data for {ticker}
      </div>
    );
  }

  const buys = trades.filter(t => t.transaction_type === 'BUY');
  const sells = trades.filter(t => t.transaction_type === 'SELL');
  const buyV = buys.reduce((s, t) => s + t.total_value, 0);
  const sellV = sells.reduce((s, t) => s + t.total_value, 0);
  const avgSig = Math.round(trades.reduce((s, t) => s + t.signal_strength, 0) / trades.length);

  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const changePct = ((last - first) / first) * 100;

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e0e3e8',
    borderRadius: 3,
    padding: 14,
  };

  const th2Style: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#fff',
    background: '#1e3a5f', whiteSpace: 'nowrap', textAlign: 'left',
    borderRight: '1px solid rgba(255,255,255,0.1)',
  };

  const td2Style: React.CSSProperties = {
    padding: '4px 10px', fontSize: 12, borderBottom: '1px solid #edf0f3', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{
          padding: '5px 14px', fontSize: 11, cursor: 'pointer',
          background: '#fff', border: '1px solid #d0d5dd', borderRadius: 3,
          color: '#4a5058', fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1a1d23', marginRight: 8 }}>{ticker}</span>
          <span style={{ fontSize: 14, color: '#7a8088' }}>{trades[0]?.company_name}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          <Stat label="Trades" value={String(trades.length)} />
          <Stat label="Buys" value={String(buys.length)} color="#00aa44" />
          <Stat label="Sells" value={String(sells.length)} color="#e53935" />
          <Stat label="Signal" value={String(avgSig)} color={avgSig >= 50 ? '#00aa44' : '#e53935'} />
        </div>
      </div>

      {/* ── Stat Cards Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: '#7a8088', marginBottom: 4, textTransform: 'uppercase' }}>Net Flow</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: buyV > sellV ? '#00aa44' : '#e53935', fontFamily: 'JetBrains Mono, monospace' }}>
            {buyV > sellV ? '+' : ''}{formatCurrency(buyV - sellV)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: '#7a8088', marginBottom: 4, textTransform: 'uppercase' }}>Buy Value</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#00aa44', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(buyV)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: '#7a8088', marginBottom: 4, textTransform: 'uppercase' }}>Sell Value</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e53935', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(sellV)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: '#7a8088', marginBottom: 4, textTransform: 'uppercase' }}>Last Price</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1d23', fontFamily: 'JetBrains Mono, monospace' }}>
            ${last.toFixed(2)}
            <span style={{ fontSize: 12, marginLeft: 6, color: changePct >= 0 ? '#00aa44' : '#e53935' }}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Price Chart ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', textTransform: 'uppercase' }}>Price Chart</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {[8, 12, 20, 30].map(n => (
              <button key={n} onClick={() => setTf(n)} style={{
                padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                background: tf === n ? '#1a73e8' : '#fff', color: tf === n ? '#fff' : '#7a8088',
                border: tf === n ? '1px solid #1a73e8' : '1px solid #d0d5dd', borderRadius: 2,
              }}>{n}d</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 80, gap: 2 }}>
          {prices.map((p, i) => {
            const h = ((p - pMin) / pRange) * 100;
            const prev = i > 0 ? prices[i - 1] : p;
            return (
              <div key={i} style={{
                flex: 1, height: `${Math.max(h, 3)}%`,
                background: p >= prev ? '#00aa44' : '#e53935',
                opacity: 0.75, minWidth: 2,
              }} title={`$${p.toFixed(2)}`} />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7a8088', marginTop: 4 }}>
          <span style={{ color: '#e53935' }}>L: ${pMin.toFixed(2)}</span>
          <span>LAST: <span style={{ color: '#1a73e8', fontWeight: 600 }}>${last.toFixed(2)}</span></span>
          <span style={{ color: '#00aa44' }}>H: ${pMax.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Resonance Signal ── */}
      {resonance && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', textTransform: 'uppercase', marginBottom: 8 }}>
            📡 Resonance Signal — {resonance.signal_date}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>Institutional Buy</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#00aa44', fontFamily: 'JetBrains Mono, monospace' }}>
                {formatCurrency(resonance.total_institutional_buy)}
              </div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>{resonance.institution_count} institutions</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>Insider Buyers</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1d23' }}>{resonance.insider_buy_count}</div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>{resonance.insider_names.slice(0, 2).join(', ')}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>Signal Strength</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: resonance.signal_strength >= 60 ? '#00aa44' : resonance.signal_strength >= 30 ? '#ff6d00' : '#e53935',
              }}>{resonance.signal_strength}/100</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#7a8088' }}>Sector</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1d23' }}>{resonance.sector}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Institution Holdings ── */}
      {institutions.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', textTransform: 'uppercase', marginBottom: 8 }}>
            🏦 Institutional Holdings
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th2Style}>Institution</th>
                <th style={{ ...th2Style, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th2Style, textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((o, i) => (
                <tr key={i}>
                  <td style={td2Style}>{o.institution}</td>
                  <td style={{ ...td2Style, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(o.amount)}</td>
                  <td style={{
                    ...td2Style, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                    color: o.direction === 'INCREASED' ? '#00aa44' : o.direction === 'DECREASED' ? '#e53935' : '#1a73e8',
                  }}>
                    {o.direction === 'NEW' ? 'NEW' : o.direction === 'INCREASED' ? `+${o.change_pct}%` : `-${o.change_pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Insider Trades Table ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5058', textTransform: 'uppercase', marginBottom: 8 }}>
          👤 Insider Trades ({trades.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th2Style}>Date</th>
              <th style={th2Style}>Insider</th>
              <th style={th2Style}>Title</th>
              <th style={{ ...th2Style, textAlign: 'center', width: 40 }}>Dir</th>
              <th style={{ ...th2Style, textAlign: 'right' }}>Shares</th>
              <th style={{ ...th2Style, textAlign: 'right' }}>Price</th>
              <th style={{ ...th2Style, textAlign: 'right' }}>Value</th>
              <th style={{ ...th2Style, textAlign: 'center' }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 30).map(t => (
              <tr key={t.id}>
                <td style={{ ...td2Style, color: '#7a8088', fontSize: 11 }}>{t.filing_date.slice(5)}</td>
                <td style={{ ...td2Style, color: '#1a1d23', fontWeight: 500 }}>{t.insider_name}</td>
                <td style={{ ...td2Style, color: '#7a8088', fontSize: 11 }}>{t.title.slice(0, 20)}</td>
                <td style={{ ...td2Style, textAlign: 'center' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                    background: t.transaction_type === 'BUY' ? '#e8f5e9' : '#ffebee',
                    color: t.transaction_type === 'BUY' ? '#00aa44' : '#e53935',
                  }}>{t.transaction_type === 'BUY' ? 'B' : 'S'}</span>
                </td>
                <td style={{ ...td2Style, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{formatNumber(t.shares)}</td>
                <td style={{ ...td2Style, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>${t.price}</td>
                <td style={{
                  ...td2Style, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                  color: t.transaction_type === 'BUY' ? '#00aa44' : '#e53935',
                }}>{formatCurrency(t.total_value)}</td>
                <td style={{ ...td2Style, textAlign: 'center' }}>
                  <span style={{
                    padding: '1px 5px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                    background: t.signal_strength >= 60 ? '#e8f5e9' : t.signal_strength >= 30 ? '#fff3e0' : '#ffebee',
                    color: t.signal_strength >= 60 ? '#00aa44' : t.signal_strength >= 30 ? '#ff6d00' : '#e53935',
                  }}>{t.signal_strength}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#7a8088' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || '#1a1d23', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
    </div>
  );
}
