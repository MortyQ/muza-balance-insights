import type { BalancesView } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData, type UseAsyncDataReturn } from '@/shared/lib';
import { useBalancesRequest } from '../api/useBalancesRequest.ts';

/** Balances of the selected participant (or the whole family); reloaded in the background whenever the data changes. */
export function useBalances(): UseAsyncDataReturn<BalancesView> {
  const { fetchBalances } = useBalancesRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const participantId = () => participant.selectedId;
  return useAsyncData(
    () => {
      const id = participantId();
      return fetchBalances(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version] },
  );
}
