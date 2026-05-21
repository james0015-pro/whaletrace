import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Screener' },
  { path: '/heatmap', label: 'Maps' },
  { path: '/watchlist', label: 'Watchlist' },
];

export function FinvizNav() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [search, setSearch] = useState('');

  const isActive = (path: string) => {
    if (path === '/') return loc.pathname === '/';
    return loc.pathname.startsWith(path);
  };

  return (
    <header style={{
      background: '#1e3a5f',
      borderBottom: '3px solid #ff6d00',
      padding: 0,
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Top row: logo + search + nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 16px',
        height: 44,
        gap: 0,
      }}>
        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          style={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            marginRight: 24,
            letterSpacing: -0.5,
            whiteSpace: 'nowrap',
          }}
        >
          WhaleTrace
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && search.trim()) {
                navigate(`/stocks/${search.trim().toUpperCase()}`);
                setSearch('');
              }
            }}
            placeholder="Ticker search (e.g. AAPL, NVDA)..."
            style={{
              width: '100%',
              height: 30,
              padding: '0 12px',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 3,
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'Inter, system-ui, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.4)', fontSize: 12, pointerEvents: 'none',
          }}>
            🔍
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: isActive(item.path) ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: 'none',
                color: isActive(item.path) ? '#fff' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: isActive(item.path) ? 600 : 400,
                fontFamily: 'Inter, system-ui, sans-serif',
                borderRadius: 3,
                transition: 'background 0.15s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
