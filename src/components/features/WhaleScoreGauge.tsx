// useMemo removed: unused import

interface WhaleScoreGaugeProps {
  score: number; // 0-100
  ticker: string;
}

export default function WhaleScoreGauge({ score, ticker }: WhaleScoreGaugeProps) {
  const color = score > 65 ? '#0c6' : score > 35 ? '#ff8c00' : '#f33';
  const label = score > 80 ? '強勢鯨訊' : score > 65 ? '積極流入' : score > 35 ? '中性觀望' : score > 20 ? '偏向流出' : '鯨群撤離';

  // SVG arc calculation: angle from -π to 0 (left to right, top half)
  const radius = 56;
  const cx = 90;
  const cy = 95;
  const strokeW = 10;

  const startAngle = Math.PI; // left
  const endAngle = Math.PI * (1 - score / 100); // clockwise
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy - radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy - radius * Math.sin(endAngle);
  const largeArc = score > 50 ? 1 : 0;

  return (
    <div style={{ padding: 10, background: '#0a0a0a', border: '1px solid #1f1f1f', textAlign: 'center', position: 'relative' }}>
      <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        🐋 鯨力計 WHALESCORE
      </div>
      <svg width="180" height="115" viewBox="0 0 180 115" style={{ display: 'block', margin: '0 auto' }}>
        {/* Background arc */}
        <path
          d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="#1f1f1f" strokeWidth={strokeW} strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        />
        {/* Center number */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="30" fontWeight="700" fontFamily="JetBrains Mono, monospace">
          {score}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#555" fontSize="8" fontFamily="JetBrains Mono, monospace">
          /100
        </text>
        {/* Tick labels */}
        <text x="20" y="100" textAnchor="middle" fill="#555" fontSize="7" fontFamily="JetBrains Mono, monospace">0</text>
        <text x="90" y="16" textAnchor="middle" fill="#555" fontSize="7" fontFamily="JetBrains Mono, monospace">50</text>
        <text x="160" y="100" textAnchor="middle" fill="#555" fontSize="7" fontFamily="JetBrains Mono, monospace">100</text>
        {/* Small ticks */}
        {[25, 75].map(v => {
          const a = Math.PI * (1 - v / 100);
          const tx = cx + (radius - 14) * Math.cos(a);
          const ty = cy - (radius - 14) * Math.sin(a);
          return <text key={v} x={tx} y={ty} textAnchor="middle" fill="#333" fontSize="6" fontFamily="JetBrains Mono, monospace">{v}</text>;
        })}
      </svg>
      <div style={{ fontSize: 9, color, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginTop: -2 }}>
        {label}
      </div>
      <div style={{ fontSize: 8, color: '#555', marginTop: 1 }}>{ticker}</div>
    </div>
  );
}
