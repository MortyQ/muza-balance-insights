import type { MonthOverview } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { kyivToday, monthOf, useAsyncData, type UseAsyncDataReturn } from '@/shared/lib';
import { useBalancesRequest } from '../api/useBalancesRequest.ts';

/**
 * Balances of the selected participant (or the whole family) for the current Kyiv month; reloaded in the background
 * whenever the data changes. Temporary bridge to getMonthOverview — rewritten with month selection in a later task.
 */
export function useBalances(): UseAsyncDataReturn<MonthOverview> {
  const { fetchMonthOverview } = useBalancesRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const participantId = () => participant.selectedId;
  const month = () => monthOf(kyivToday(new Date()));
  return useAsyncData(
    () => {
      const id = participantId();
      return fetchMonthOverview({ month: month(), ...(id !== null ? { participantId: id } : {}) });
    },
    [participantId],
    { quiet: [() => syncStatus.version] },
  );
}
