import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { t } = useTranslation();

  const items = [
    { label: t('settings.telegram.label'), desc: t('settings.telegram.desc'), status: t('settings.telegram.status') },
    { label: t('settings.email.label'), desc: t('settings.email.desc'), status: t('settings.email.status') },
    { label: t('settings.account.label'), desc: t('settings.account.desc'), status: t('settings.account.status') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">{t('settings.title')}</h1>
        <p className="text-text-tertiary text-sm">{t('settings.description')}</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
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
