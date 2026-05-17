import { useState, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradeCard } from '@/components/features/TradeCard';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useInsiderTrades, type TradeFilter } from '@/hooks/useInsiderTrades';
import type { InsiderTrade } from '@/types';

// ============================================================
// 篩選選項
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
// FeedPage
// ============================================================

export default function FeedPage() {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInsiderTrades(filter);

  // 攤平所有分頁
  const trades = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

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

    if (!hasNextPage && trades.length > 0) {
      return (
        <p className="text-center text-text-muted text-xs py-6">
          已顯示全部 {total} 筆交易
        </p>
      );
    }

    return null;
  }, [isFetchingNextPage, hasNextPage, trades.length, total]);

  // ---- 渲染單筆交易 ----
  const renderItem = useCallback(
    (_index: number, trade: InsiderTrade) => (
      <TradeCard trade={trade} index={_index} />
    ),
    [],
  );

  // ---- 載入中 ----
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <div className="h-8 w-40 rounded skeleton mb-1" />
          <div className="h-4 w-64 rounded skeleton" />
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full skeleton" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  // ---- 空狀態 ----
  if (!isLoading && trades.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 h-full flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-heading-2 text-text-primary mb-1">交易動態</h1>
            <p className="text-text-tertiary text-sm">即時追蹤內部人買賣</p>
          </div>
        </div>
        <EmptyState
          icon="📭"
          title="尚無符合條件的交易"
          description="切換篩選條件或稍後再來查看"
        />
      </div>
    );
  }

  // ---- 正常狀態 ----
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 h-full flex flex-col">
      {/* 頂部標題列 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-heading-2 text-text-primary mb-1">交易動態</h1>
          <p className="text-text-tertiary text-sm">
            即時追蹤內部人買賣 · 共 {total} 筆
          </p>
        </div>

        {/* 重整按鈕 */}
        <button
          onClick={() => refetch()}
          className={cn(
            'p-2 rounded-button border border-border-subtle',
            'text-text-tertiary hover:text-text-primary hover:border-border-default',
            'transition-all duration-150',
          )}
          title="重新整理"
        >
          <RefreshCw
            size={16}
            className={cn(isRefetching && 'animate-spin')}
          />
        </button>
      </div>

      {/* 篩選列 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
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

      {/* 虛擬滾動交易牆 */}
      <div className="flex-1 min-h-0">
        <Virtuoso
          data={trades}
          itemContent={renderItem}
          endReached={handleEndReached}
          components={{ Footer }}
          overscan={200}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
