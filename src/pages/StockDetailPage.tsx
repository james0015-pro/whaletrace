import { useParams } from 'react-router-dom';

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">
          {ticker?.toUpperCase() || '???'}
        </h1>
        <p className="text-text-tertiary text-sm">
          股票詳情頁 — 信心分數、內部人時間軸、機構持股。Phase 2 實作。
        </p>
      </div>

      {/* Placeholder metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {['信心分數', '12月買入', '12月賣出', '群組信號'].map((label) => (
          <div
            key={label}
            className="p-4 rounded-card bg-surface border border-border-subtle text-center"
          >
            <p className="text-2xl font-semibold text-text-primary">—</p>
            <p className="text-text-muted text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="p-16 rounded-card bg-surface border border-border-subtle text-center text-text-muted text-sm">
        📈 時間軸圖表將在 Phase 2 實作
      </div>
    </div>
  );
}
