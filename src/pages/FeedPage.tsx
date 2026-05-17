import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { TradeCard } from '@/components/features/TradeCard';
import { ResonanceCard } from '@/components/features/ResonanceCard';
import { CompactDataTable, INSTITUTION_COLUMNS } from '@/components/features/CompactDataTable';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useInsiderTrades, type TradeFilter } from '@/hooks/useInsiderTrades';
import { MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade } from '@/types';

const FILTERS: { key: TradeFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'feed.filters.all' },
  { key: 'buy', labelKey: 'feed.filters.buy' },
  { key: 'sell', labelKey: 'feed.filters.sell' },
  { key: 'cluster', labelKey: 'feed.filters.cluster' },
];

function SummaryBar() {
  const { t } = useTranslation();
  const signalCount = MOCK_RESONANCE_SIGNALS.length;
  const totalCapital = MOCK_RESONANCE_SIGNALS.reduce((s, r) => s + r.total_institutional_buy, 0);

  return (
    <div className="flex items-center gap-4 text-xs text-text-tertiary mb-5 px-1">
      <span>
        {t('feed.summary_week')}<span className="text-signal-purple font-semibold">{signalCount} {t('feed.summary_count')}</span>
      </span>
      <span className="text-text-muted">·</span>
      <span>
        {t('feed.summary_capital')}<span className="text-text-primary font-semibold font-mono tabular-nums">{formatCurrency(totalCapital)}</span>
      </span>
    </div>
  );
}

export default function FeedPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TradeFilter>('all');
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInsiderTrades(filter);

  const trades = data?.pages.flatMap((p) => p.data) ?? [];
  const recentTrades = trades.slice(0, 8);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const Footer = useCallback(() => {
    if (isFetchingNextPage) {
      return <div className="py-2">{[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}</div>;
    }
    return null;
  }, [isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="h-5 w-48 rounded skeleton mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-card skeleton" />)}
        </div>
        <div className="h-4 w-32 rounded skeleton mb-3" />
        <div className="h-48 rounded-card skeleton mb-8" />
        <div className="h-4 w-32 rounded skeleton mb-3" />
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-1">
        <h1 className="text-heading-2 text-text-primary">{t('feed.title')}</h1>
      </div>
      <SummaryBar />

      {/* 鯨魚共振訊號 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-signal-purple">
            {t('feed.section_signals')}
          </h2>
          <span className="text-[10px] text-text-muted">
            {t('feed.total_signals', { count: MOCK_RESONANCE_SIGNALS.length })}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MOCK_RESONANCE_SIGNALS.map((signal, i) => (
            <Link key={signal.ticker} to={`/stocks/${signal.ticker}`} className="block">
              <ResonanceCard signal={signal} index={i} />
            </Link>
          ))}
        </div>
      </section>

      {/* 今日機構大單 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            {t('feed.section_institutions')}
          </h2>
          <span className="text-[10px] text-text-muted">{t('feed.min_order')}</span>
        </div>
        <div className="rounded-card border border-border-subtle bg-bg-surface overflow-hidden">
          <CompactDataTable data={MOCK_INSTITUTION_ORDERS} columns={INSTITUTION_COLUMNS} compact />
        </div>
      </section>

      {/* 最新內部人交易 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            {t('feed.section_insider_trades')}
          </h2>
          <Link to="/signals" className="text-[10px] text-green-primary hover:text-green-hover transition-colors">
            {t('feed.view_all')}
          </Link>
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150 flex-shrink-0',
                filter === f.key
                  ? 'bg-green-subtle text-green-primary border-green-primary/30'
                  : 'border-border-default text-text-tertiary hover:text-text-primary hover:border-border-default/50',
              )}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {recentTrades.length === 0 ? (
          <EmptyState icon="📭" title={t('feed.empty_title')} description={t('feed.empty_desc')} />
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, i) => (
              <TradeCard key={trade.id} trade={trade} index={i} />
            ))}
            {trades.length > recentTrades.length && (
              <Link to="/signals" className="block text-center text-xs text-text-tertiary hover:text-green-primary py-3 transition-colors">
                {t('feed.more_trades', { count: trades.length - recentTrades.length })}
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
