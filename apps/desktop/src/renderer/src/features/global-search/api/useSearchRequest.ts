import type { SearchOverview, SearchOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

/** The global search's one read; never kept (searchOverview is not a cached read). */
export function useSearchRequest(): { fetchSearch: (q: SearchOverviewQuery) => Promise<SearchOverview> } {
  return { fetchSearch: (q) => balanceApi.searchOverview(q) };
}
