import { computed } from 'vue';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { usePaceRequest } from '../api/usePaceRequest.ts';
import type { UseMonthPaceReturn } from '../types.ts';
import { paceBanks, paceView } from '../utils.ts';
import { usePaceSplit } from './usePaceSplit.ts';

/**
 * The month pace of the block's month and person: one month of the analytics answer, plus «Available per day» while the
 * month is the current one (its failure only drops that figure). Reloads like the block, quietly on new data. «By
 * banks» is offered while two or more banks are on; otherwise the chart is drawn together (spec desktop-spending-split).
 */
export function useMonthPace(): UseMonthPaceReturn {
  const { fetchAnalytics, fetchAllowance } = usePaceRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const monthStore = useMonthStore();

  const { state } = useAsyncData(
    async () => {
      const id = participant.selectedId;
      const month = monthStore.month;
      const who = { ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
      const [analytics, perDay] = await Promise.all([
        fetchAnalytics({ from: month, to: month, ...who }),
        month === monthStore.thisMonth ? fetchAllowance(who).then((a) => a.perDay, () => null) : Promise.resolve(null),
      ]);
      return { analytics, perDay };
    },
    [() => monthStore.month, () => participant.selectedId, () => participant.banksKey],
    { quiet: [() => syncStatus.version] },
  );
  const view = computed(() => (state.value.data ? paceView(state.value.data.analytics, state.value.data.perDay) : null));
  const fmt = useMoneyFormat(() => state.value.data?.analytics.rates);
  const { split, setSplit } = usePaceSplit();
  const offered = computed(() => participant.shown.length > 1);
  const banks = computed(() => paceBanks(view.value, offered.value, split.value));
  return { view, fmt, offered, split, setSplit, banks };
}
