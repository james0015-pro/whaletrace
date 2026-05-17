import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Simulated ticker tape data
const TAPE_DATA = [
  { ticker: 'AAPL', price: '196.34', change: '+2.15', up: true },
  { ticker: 'NVDA', price: '1,036.80', change: '+24.50', up: true },
  { ticker: 'MSFT', price: '412.11', change: '-3.22', up: false },
  { ticker: 'TSLA', price: '248.90', change: '+8.40', up: true },
  { ticker: 'META', price: '585.21', change: '-5.10', up: false },
  { ticker: 'AMZN', price: '197.82', change: '+1.33', up: true },
  { ticker: 'GOOGL', price: '175.44', change: '-0.88', up: false },
  { ticker: 'JPM', price: '224.67', change: '+3.01', up: true },
  { ticker: 'V', price: '310.92', change: '+1.45', up: true },
  { ticker: 'WMT', price: '78.56', change: '-0.32', up: false },
];

export function TopNavBar() {
  const { t } = useTranslation();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' ET');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        height: 'var(--bl-topbar-h)',
        background: 'var(--bl-bg-panel)',
        borderBottom: '1px solid var(--bl-border)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Left: logo */}
      <div style={{
        padding: '0 8px', color: 'var(--bl-amber)', fontWeight: 700,
        fontSize: 'var(--bl-font-lg)', borderRight: '1px solid var(--bl-border)',
        letterSpacing: 1, height: '100%', display: 'flex', alignItems: 'center',
      }}>
        WHALETRACE
      </div>

      {/* Ticker tape */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          display: 'flex', gap: 24, padding: '0 12px', animation: 'scroll-tape 60s linear infinite',
          width: 'max-content',
        }}>
          {[...TAPE_DATA, ...TAPE_DATA].map((q, i) => (
            <span key={i} style={{ fontSize: 'var(--bl-font)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--bl-white)', fontWeight: 500 }}>{q.ticker}</span>
              <span style={{ color: 'var(--bl-white)' }}>{q.price}</span>
              <span style={{ color: q.up ? 'var(--bl-green)' : 'var(--bl-red)', fontWeight: 600 }}>
                {q.up ? '+' : ''}{q.change}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Right: clock */}
      <div style={{
        padding: '0 10px', color: 'var(--bl-white)', fontSize: 'var(--bl-font)',
        borderLeft: '1px solid var(--bl-border)', fontFamily: 'JetBrains Mono, monospace',
        height: '100%', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--bl-amber)' }}>●</span>
        <span>{time}</span>
      </div>

      <style>{`
        @keyframes scroll-tape {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </header>
  );
}
