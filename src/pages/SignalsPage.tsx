export default function SignalsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">
          ⚡ 群組交易信號
        </h1>
        <p className="text-text-tertiary text-sm">
          ≥3 位內部人 30 天內集中買入 → 最強看漲信號。Phase 3 實作完整信號頁。
        </p>
      </div>

      <div className="p-8 rounded-card bg-surface border border-signal-subtle text-center">
        <div className="text-4xl mb-3">⚡</div>
        <p className="text-text-secondary text-sm mb-1">
          群組信號是 WhaleTrace 的核心差異化功能
        </p>
        <p className="text-text-muted text-xs">
          學術研究證實：內部人群組買入預測超額報酬的成功率最高
        </p>
      </div>
    </div>
  );
}
