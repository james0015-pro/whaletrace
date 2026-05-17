export default function WatchlistPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">⭐ 我的關注</h1>
        <p className="text-text-tertiary text-sm">
          追蹤最多 20 檔股票，任何變動優先推送。Phase 4 實作（需登入）。
        </p>
      </div>

      <div className="p-8 rounded-card bg-surface border border-border-subtle text-center">
        <div className="text-4xl mb-3">⭐</div>
        <p className="text-text-secondary text-sm mb-2">
          尚未登入
        </p>
        <p className="text-text-muted text-xs">
          Phase 4 將整合 Supabase Auth，登入後即可建立關注清單
        </p>
      </div>
    </div>
  );
}
