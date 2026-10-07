import type { RecurringOverview, RecurringOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useRecurringRequest(): { fetchRecurringOverview: (q: RecurringOverviewQuery) => Promise<RecurringOverview> } {
  return { fetchRecurringOverview: (q) => balanceApi.getRecurringOverview(q) };
}
