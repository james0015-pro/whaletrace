import { useInfiniteQuery } from '@tanstack/react-query';
import { getInsiderTrades } from '@/lib/data-layer';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { InsiderTrade, PaginatedResponse } from '@/types';

// ============================================================
// Types
// ============================================================

export type TradeFilter = 'all' | 'buy' | 'sell' | 'cluster';

// ============================================================
// useInsiderTrades
// ============================================================

export function useInsiderTrades(filter: TradeFilter) {
  return useInfiniteQuery<PaginatedResponse<InsiderTrade>>({
    queryKey: ['insiderTrades', filter],

    queryFn: async ({ pageParam = 1 }) => {
      return getInsiderTrades(filter, pageParam as number, DEFAULT_PAGE_SIZE);
    },

    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.page + 1 : undefined,

    initialPageParam: 1,

    staleTime: 60_000,
  });
}
