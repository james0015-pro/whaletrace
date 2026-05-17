import { useInfiniteQuery } from '@tanstack/react-query';
import { getPaginatedTrades } from '@/lib/mock-data';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { InsiderTrade, PaginatedResponse } from '@/types';

// ============================================================
// Types
// ============================================================

export type TradeFilter = 'all' | 'buy' | 'sell' | 'cluster';

// ============================================================
// Simulated API delay
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// useInsiderTrades
// ============================================================

export function useInsiderTrades(filter: TradeFilter) {
  return useInfiniteQuery<PaginatedResponse<InsiderTrade>>({
    queryKey: ['insiderTrades', filter],

    queryFn: async ({ pageParam = 1 }) => {
      // 模擬 API 延遲
      await delay(300);
      return getPaginatedTrades(filter, pageParam as number, DEFAULT_PAGE_SIZE);
    },

    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.page + 1 : undefined,

    initialPageParam: 1,

    staleTime: 60_000,
  });
}
