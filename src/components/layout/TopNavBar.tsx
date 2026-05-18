import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TAPE = [
  { t: 'AAPL', p: '196.34', c: '+2.15', up: true },
  { t: 'NVDA', p: '1,036.80', c: '+24.50', up: true },
  { t: 'MSFT', p: '412.11', c: '-3.22', up: false },
  { t: 'TSLA', p: '248.90', c: '+8.40', up: true },
  { t: 'META', p: '585.21', c: '-5.10', up: false },
  { t: 'AMZN', p: '197.82', c: '+1.33', up: true },
  { t: 'GOOGL', p: '175.44', c: '-0.88', up: false },
  { t: 'JPM', p: '224.67', c: '+3.01', up: true },
  { t: 'V', p: '310.92', c: '+1.45', up: true },
  { t: 'WMT', p: '78.56', c: '-0.32', up: false },
];

export function TopNavBar() {
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState('');
  const [lang, setLang] = useState(i18n.language);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' ET');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const toggleLang = () => {
    const next = lang.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(next);
    setLang(next);
  };

  return (
    <header style={{
      height: 'var(--bl-topbar-h)', background: '#0a0a0a',
      borderBottom: '1px solid #1f1f1f', display: 'flex',
      alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 10px', color: '#ff8c00', fontWeight: 700,
        fontSize: '12px', borderRight: '1px solid #1f1f1f',
        height: '100%', display: 'flex', alignItems: 'center', letterSpacing: 1,
      }}>
        🐋 WHALETRACE
      </div>

      {/* Ticker tape */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          display: 'flex', gap: 24, padding: '0 12px',
          animation: 'scroll-tape 60s linear infinite', width: 'max-content',
        }}>
          {[...TAPE, ...TAPE].map((q, i) => (
            <span key={i} style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#e6e6e6', fontWeight: 500 }}>{q.t}</span>
              <span style={{ color: '#e6e6e6' }}>{q.p}</span>
              <span style={{ color: q.up ? '#0c6' : '#f33', fontWeight: 600 }}>{q.c}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Language switch */}
      <button onClick={()=>{window.location.hash='#/dashboard';window.location.reload();}}
        style={{background:'transparent',border:'1px solid #333',color:window.location.hash.includes('dashboard')?'#ff8c00':'#888',cursor:'pointer',padding:'2px 8px',fontSize:10,fontFamily:'JetBrains Mono,monospace',marginRight:4,height:20,borderRadius:2}}>
        DASH
      </button>
      <button onClick={()=>{window.location.hash='#/';window.location.reload();}}
        style={{background:'transparent',border:'1px solid #333',color:!window.location.hash.includes('dashboard')?'#ff8c00':'#888',cursor:'pointer',padding:'2px 8px',fontSize:10,fontFamily:'JetBrains Mono,monospace',marginRight:4,height:20,borderRadius:2}}>
        TERM
      </button>

      {/* Language switch */}
      <button onClick={toggleLang}
        style={{
          background: 'transparent', border: '1px solid #333', color: '#888',
          cursor: 'pointer', padding: '2px 8px', fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace', marginRight: 8,
          height: 20, borderRadius: 2,
        }}>
        {lang.startsWith('zh') ? '中文' : 'EN'}
      </button>

      {/* Login */}
      <button
        style={{
          background: 'transparent', border: '1px solid #333', color: '#888',
          cursor: 'pointer', padding: '2px 8px', fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace', marginRight: 8,
          height: 20, borderRadius: 2,
        }}
        onClick={() => alert('Login (NYI)')}>
        LOGIN
      </button>

      {/* Clock */}
      <div style={{
        padding: '0 10px', color: '#e6e6e6', fontSize: 11,
        borderLeft: '1px solid #1f1f1f', fontFamily: 'JetBrains Mono, monospace',
        height: '100%', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: '#0c6' }}>●</span>
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
