import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { t } = useTranslation();

  const metrics = [
    { key: 'confidence', label: t('stockDetail.metrics.confidence') },
    { key: 'buy12m', label: t('stockDetail.metrics.buy12m') },
    { key: 'sell12m', label: t('stockDetail.metrics.sell12m') },
    { key: 'cluster', label: t('stockDetail.metrics.cluster') },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-heading-2 text-text-primary mb-1">
          {ticker?.toUpperCase() || '???'}
        </h1>
        <p className="text-text-tertiary text-sm">{t('stockDetail.description')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {metrics.map((m) => (
          <div
            key={m.key}
            className="p-4 rounded-card bg-surface border border-border-subtle text-center"
          >
            <p className="text-2xl font-semibold text-text-primary">—</p>
            <p className="text-text-muted text-xs mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="p-16 rounded-card bg-surface border border-border-subtle text-center text-text-muted text-sm">
        {t('stockDetail.chart_placeholder')}
      </div>
    </div>
  );
}
