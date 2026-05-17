import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { TradeCard } from '@/components/features/TradeCard';
import { ResonanceCard } from '@/components/features/ResonanceCard';
import { CompactDataTable, INSTITUTION_COLUMNS } from '@/components/features/CompactDataTable';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useInsiderTrades, type TradeFilter } from '@/hooks/useInsiderTrades';
import { MOCK_RESONANCE_SIGNALS, MOCK_INSTITUTION_ORDERS } from '@/lib/mock-data';
import type { InsiderTrade } from '@/types';

// ============================================================
// 篩選選項（內部人交易區使用）
// ============================================================

interface FilterOption {
  key: TradeFilter;
  label: string;
}

const FILTERS: FilterOption[] = [
  { key: 'all', label: '全部' },
  { key: 'buy', label: '🟢 買入' },
  { key: 'sell', label: '🔴 賣出' },
  { key: 'cluster', label: '⚡ 群組信號' },
];

// ============================================================
// 摘要數字
// ============================================================

function SummaryBar() {
  const signalCount = MOCK_RESONANCE_SIGNALS.length;
  const totalCapital = MOCK_RESONANCE_SIGNALS.reduce(
    (sum, s) => sum + s.total_institutional_buy, 0,
  );

  return (
    <div className="flex items-center gap-4 text-xs text-text-tertiary mb-5 px-1">
      <span>
        本週共振訊號：<span className="text-signal-purple font-semibold">{signalCount} 筆</span>
      </span>
      <span className="text-text-muted">·</span>
      <span>
        涉及資金：<span className="text-text-primary font-semibold font-mono tabular-nums">{formatCurrency(totalCapital)}</span>
      </span>
    </div>
  );
}

// ============================================================
// FeedPage v2 — 三段式儀表板
// ============================================================

export default function FeedPage() {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInsiderTrades(filter);

  const trades = data?.pages.flatMap((p) => p.data) ?? [];
  const recentTrades = trades.slice(0, 8); // 只顯示最新 8 筆在首頁

  // ---- 捲到底載入更多 ----
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ---- Virtuoso Footer ----
  const Footer = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <div className="py-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      );
    }
    return null;
  }, [isFetchingNextPage]);

  // ---- 渲染單筆交易 ----
  const renderItem = useCallback(
    (_index: number, trade: InsiderTrade) => (
      <TradeCard trade={trade} index={_index} />
    ),
    [],
  );

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="h-5 w-48 rounded skeleton mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-card skeleton" />
          ))}
        </div>
        <div className="h-4 w-32 rounded skeleton mb-3" />
        <div className="h-48 rounded-card skeleton mb-8" />
        <div className="h-4 w-32 rounded skeleton mb-3" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  // ---- 首頁（正常狀態） ----
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ---- 頁面標題 ---- */}
      <div className="mb-1">
        <h1 className="text-heading-2 text-text-primary">🐋 WhaleTrace</h1>
      </div>
      <SummaryBar />

      {/* ============================================ */}
      {/* 第一區：鯨魚共振訊號                          */}
      {/* ============================================ */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-signal-purple">
            📡 SIGNALS · 鯨魚共振訊號
          </h2>
          <span className="text-[10px] text-text-muted">
            共 {MOCK_RESONANCE_SIGNALS.length} 筆
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MOCK_RESONANCE_SIGNALS.map((signal, i) => (
            <Link
              key={signal.ticker}
              to={`/stocks/${signal.ticker}`}
              className="block"
            >
              <ResonanceCard signal={signal} index={i} />
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* 第二區：今日機構大單                            */}
      {/* ============================================ */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            📊 INSTITUTIONS · 今日機構大單
          </h2>
          <span className="text-[10px] text-text-muted">
            {'>$100M 單筆'}
          </span>
        </div>

        <div className="rounded-card border border-border-subtle bg-bg-surface overflow-hidden">
          <CompactDataTable
            data={MOCK_INSTITUTION_ORDERS}
            columns={INSTITUTION_COLUMNS}
            compact
          />
        </div>
      </section>

      {/* ============================================ */}
      {/* 第三區：最新內部人交易                            */}
      {/* ============================================ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            🔔 INSIDER TRADES · 最新內部人交易
          </h2>
          <Link
            to="/signals"
            className="text-[10px] text-green-primary hover:text-green-hover transition-colors"
          >
            查看全部 →
          </Link>
        </div>

        {/* 篩選列 */}
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
              {f.label}
            </button>
          ))}
        </div>

        {recentTrades.length === 0 ? (
          <EmptyState
            icon="📭"
            title="尚無符合條件的交易"
            description="切換篩選條件或稍後再來查看"
          />
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, i) => (
              <TradeCard key={trade.id} trade={trade} index={i} />
            ))}
            {trades.length > recentTrades.length && (
              <Link
                to="/signals"
                className="block text-center text-xs text-text-tertiary hover:text-green-primary py-3 transition-colors"
              >
                還有 {trades.length - recentTrades.length} 筆交易 · 點擊查看全部 →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
