export default function InstitutionsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">
          🏛️ 機構 13F 持股追蹤
        </h1>
        <p className="text-text-tertiary text-sm">
          追蹤巴菲特、Burry、Dalio 等 25 位超級投資人的每季持股變動。Phase 3 實作。
        </p>
      </div>

      {/* Super investor grid placeholder */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {['Buffett', 'Burry', 'Dalio', 'Ackman', 'Wood', 'Tepper'].map((name) => (
          <div
            key={name}
            className="p-4 rounded-card bg-surface border border-border-subtle text-center"
          >
            <div className="w-10 h-10 rounded-full bg-elevated mx-auto mb-2 flex items-center justify-center text-text-muted text-xs">
              {name[0]}
            </div>
            <p className="text-text-secondary text-sm font-medium">{name}</p>
            <p className="text-text-muted text-xs mt-0.5">載入中...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
