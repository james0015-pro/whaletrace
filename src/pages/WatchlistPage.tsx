import { useTranslation } from 'react-i18next';

export default function WatchlistPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">{t('watchlist.title')}</h1>
        <p className="text-text-tertiary text-sm">{t('watchlist.description')}</p>
      </div>

      <div className="p-8 rounded-card bg-surface border border-border-subtle text-center">
        <div className="text-4xl mb-3">⭐</div>
        <p className="text-text-secondary text-sm mb-2">{t('watchlist.not_logged_in')}</p>
        <p className="text-text-muted text-xs">{t('watchlist.login_prompt')}</p>
      </div>
    </div>
  );
}
