import type { RecurringMarkQuery, RecurringOverview, RecurringOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useRecurringRequest(): {
  fetchRecurringOverview: (q: RecurringOverviewQuery) => Promise<RecurringOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekRecurringOverview: (q: RecurringOverviewQuery) => { data: RecurringOverview; fresh: boolean } | null;
  saveRecurringMark: (q: RecurringMarkQuery) => Promise<void>;
} {
  return {
    fetchRecurringOverview: (q) => balanceApi.getRecurringOverview(q),
    peekRecurringOverview: (q) => readCache.peek<RecurringOverview>(readKey('getRecurringOverview', [q])),
    saveRecurringMark: (q) => balanceApi.setRecurringMark(q),
  };
}
