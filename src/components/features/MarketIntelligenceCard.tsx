// ============================================================
// Market Intelligence Card — Bloomberg-style news card
// Used in DashboardPage MARKET INTELLIGENCE section.
// Data sourced from public/data/market_intelligence.json
// ============================================================

import type { MarketIntelligenceItem } from '@/types';

interface Props {
  item: MarketIntelligenceItem;
}

export default function MarketIntelligenceCard({ item }: Props) {
  const hlColor = item.highlight_color ?? item.border_color;

  return (
    <div
      style={{
        padding: 12,
        background: '#0a0a0a',
        border: `1px solid ${item.border_color}`,
        borderLeft: `3px solid ${item.border_color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: item.border_color,
          }}
        >
          {item.title}
        </span>
        <span style={{ fontSize: 9, color: '#555' }}>{item.source}</span>
      </div>
      <div style={{ fontSize: 9, color: '#e6e6e6', lineHeight: 1.8 }}>
        <div style={{ color: hlColor, fontWeight: 600 }}>{item.highlight}</div>
        <div style={{ color: '#888', fontSize: 8 }}>{item.detail}</div>
      </div>
    </div>
  );
}
