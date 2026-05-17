export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">⚙️ 設定</h1>
        <p className="text-text-tertiary text-sm">
          Telegram 綁定、Email 通知、帳號管理。Phase 4 實作。
        </p>
      </div>

      <div className="space-y-4">
        {[
          { label: 'Telegram 綁定', desc: '接收即時警報與每日摘要', status: '未連接' },
          { label: 'Email 通知', desc: '每週摘要與重大信號', status: '未設定' },
          { label: '帳號管理', desc: '登入/登出/密碼修改', status: '未登入' },
        ].map((item) => (
          <div
            key={item.label}
            className="p-4 rounded-card bg-surface border border-border-subtle flex items-center justify-between"
          >
            <div>
              <p className="text-text-secondary text-sm font-medium">{item.label}</p>
              <p className="text-text-muted text-xs mt-0.5">{item.desc}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-elevated text-text-muted border border-border-subtle">
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
