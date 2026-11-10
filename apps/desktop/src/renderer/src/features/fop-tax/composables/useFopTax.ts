import { computed, ref, watch } from 'vue';
import type { Quarter } from '@contract/api.ts';
import { quarterOf } from '@contract/quarters.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { localToday, useAsyncData } from '@/shared/lib';
import { useFopTaxRequest } from '../api/useFopTaxRequest.ts';
import type { BaseChoice, RateChoice, UseFopTaxReturn } from '../types.ts';
import { FOP_RATES } from '../constants.ts';
import { amountMinor, percentValue, quarterAllowed as allowed, taxView, yearOptions } from '../utils.ts';

/**
 * The FOP tax screen: the picked quarter (today's at first) for the global filter's person, reloaded when either
 * changes and quietly when the data changes; the rate and the base are the screen's own (not remembered).
 */
export function useFopTax(): UseFopTaxReturn {
  const { fetchFopTax, peekFopTax } = useFopTaxRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const current = quarterOf(localToday(new Date()));
  const year = ref(current.year);
  const quarter = ref<Quarter>(current.quarter);
  const rate = ref<RateChoice>(FOP_RATES[0]);
  const percentText = ref('');
  const base = ref<BaseChoice>('income');
  const amountText = ref('');

  const quarterAllowed = (q: Quarter) => allowed(year.value, q, current);
  // Back to this year with a quarter still ahead: the latest one allowed.
  watch(year, () => {
    if (!quarterAllowed(quarter.value)) quarter.value = current.quarter;
  });

  const query = () => {
    const id = participant.selectedId;
    return { year: year.value, quarter: quarter.value, ...(id !== null ? { participantId: id } : {}) };
  };
  const { state } = useAsyncData(() => fetchFopTax(query()), [year, quarter, () => participant.selectedId], {
    quiet: [() => syncStatus.version],
    cached: () => peekFopTax(query()),
  });
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  const percent = computed(() => (rate.value === 'custom' ? percentValue(percentText.value) : rate.value));
  const amount = computed(() => amountMinor(amountText.value));
  const view = computed(() => {
    const v = state.value.data;
    if (!v?.available) return null;
    return taxView(v, { percent: percent.value, base: base.value, amount: amount.value }, fmt.value);
  });

  return {
    state,
    year,
    quarter,
    rate,
    percentText,
    base,
    amountText,
    years: computed(() => yearOptions(current.year)),
    quarterAllowed,
    percentError: computed(() => rate.value === 'custom' && percentText.value.trim() !== '' && percent.value === null),
    amountError: computed(() => base.value === 'custom' && amountText.value.trim() !== '' && amount.value === null),
    view,
  };
}
