// useMemo removed: unused import
// seedFrom removed: dead code after getMockOwnership deletion

interface OwnershipDonutProps {
  ticker: string;
  instPct: number;
  insiderPct: number;
}

export default function OwnershipDonut({ ticker, instPct, insiderPct }: OwnershipDonutProps) {
  const retailPct = Math.max(0, 100 - instPct - insiderPct);

  // SVG donut: radius=40, strokeWidth=16, circumference = 2*PI*40 ≈ 251.33
  const circumference = 2 * Math.PI * 40;
  const instDash = (instPct / 100) * circumference;
  const insiderDash = (insiderPct / 100) * circumference;
  const retailDash = (retailPct / 100) * circumference;

  return (
    <div style={{ padding: 12, background: '#0a0a0a', border: '1px solid #1f1f1f' }}>
      <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>
        持有人結構 OWNERSHIP
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
        {/* Donut SVG */}
        <svg width="110" height="110" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="#1f1f1f" strokeWidth="16" />

          {/* Institutional slice (green) - starts at top */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="#0c6" strokeWidth="16"
            strokeDasharray={`${instDash} ${circumference - instDash}`}
            strokeDashoffset={-(circumference * 0.25)}
            transform="rotate(-90 60 60)" strokeLinecap="butt"
          />
          {/* Insider slice (amber) - starts after institutional */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="#ff8c00" strokeWidth="16"
            strokeDasharray={`${insiderDash} ${circumference - insiderDash}`}
            strokeDashoffset={-(circumference * 0.25 + instDash)}
            transform="rotate(-90 60 60)" strokeLinecap="butt"
          />
          {/* Retail slice (gray) - starts after insider */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="#333" strokeWidth="16"
            strokeDasharray={`${retailDash} ${circumference - retailDash}`}
            strokeDashoffset={-(circumference * 0.25 + instDash + insiderDash)}
            transform="rotate(-90 60 60)" strokeLinecap="butt"
          />

          {/* Center text */}
          <text x="60" y="56" textAnchor="middle" fill="#ff8c00" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            {ticker}
          </text>
          <text x="60" y="70" textAnchor="middle" fill="#888" fontSize="7" fontFamily="JetBrains Mono, monospace">
            OWNERSHIP
          </text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: '#0c6', borderRadius: 1 }} />
            <div>
              <div style={{ fontSize: 11, color: '#0c6', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{instPct.toFixed(1)}%</div>
              <div style={{ fontSize: 7, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>機構法人</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: '#ff8c00', borderRadius: 1 }} />
            <div>
              <div style={{ fontSize: 11, color: '#ff8c00', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{insiderPct.toFixed(1)}%</div>
              <div style={{ fontSize: 7, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>內部人</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: '#333', borderRadius: 1 }} />
            <div>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{retailPct.toFixed(1)}%</div>
              <div style={{ fontSize: 7, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>散戶/其他</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// getMockOwnership removed: dead code, never imported elsewhere
