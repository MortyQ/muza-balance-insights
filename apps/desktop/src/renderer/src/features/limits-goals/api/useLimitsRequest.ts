import type { GoalPayload, LimitsOverview, LimitsOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useLimitsRequest(): {
  fetchLimits: (q: LimitsOverviewQuery) => Promise<LimitsOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekLimits: (q: LimitsOverviewQuery) => { data: LimitsOverview; fresh: boolean } | null;
  saveGoal: (id: number | null, g: GoalPayload) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  addSuggested: (q: { participantId?: number }) => Promise<void>;
} {
  return {
    fetchLimits: (q) => balanceApi.getLimitsOverview(q),
    peekLimits: (q) => readCache.peek<LimitsOverview>(readKey('getLimitsOverview', [q])),
    saveGoal: (id, g) => balanceApi.saveGoal(id, g),
    deleteGoal: (id) => balanceApi.deleteGoal(id),
    addSuggested: (q) => balanceApi.addSuggestedLimits(q),
  };
}
