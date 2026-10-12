import type { RecurringMarkQuery, RecurringOverview, RecurringOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useRecurringRequest(): {
  fetchRecurringOverview: (q: RecurringOverviewQuery) => Promise<RecurringOverview>;
  saveRecurringMark: (q: RecurringMarkQuery) => Promise<void>;
} {
  return { fetchRecurringOverview: (q) => balanceApi.getRecurringOverview(q), saveRecurringMark: (q) => balanceApi.setRecurringMark(q) };
}
