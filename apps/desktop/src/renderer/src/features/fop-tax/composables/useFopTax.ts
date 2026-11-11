import { computed, ref, watch } from 'vue';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { localToday, useAsyncData } from '@/shared/lib';
import { useFopTaxRequest } from '../api/useFopTaxRequest.ts';
import type { BaseChoice, PeriodPick, RatePreset, UseFopTaxReturn } from '../types.ts';
import { FOP_RATES, YEARS_BACK } from '../constants.ts';
import { amountMinor, fopPresets, percentValue, periodBounds, periodName, quarterOfPick, taxView } from '../utils.ts';

/**
 * The FOP tax screen: the picked months (today's quarter so far at first) and base for the global filter's person, reloaded
 * when any changes and quietly when the data changes. The base defaults to the FOP accounts' income while the view has
 * one, all income otherwise. Nothing is remembered.
 */
export function useFopTax(): UseFopTaxReturn {
  const { fetchFopTax, peekFopTax } = useFopTaxRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const today = localToday(new Date());
  const thisMonth = today.slice(0, 7);
  const minMonth = `${Number(today.slice(0, 4)) - YEARS_BACK}-01`;
  const presets = computed(() => fopPresets(thisMonth));
  const quarterNow = presets.value.range.find((p) => p.id === 'q')!;
  const period = ref<PeriodPick>({ from: quarterNow.from, to: quarterNow.to });
  const rate = ref<RatePreset>(FOP_RATES[0]);
  const percentText = ref('');
  const picked = ref<BaseChoice | null>(null);
  const amountText = ref('');

  // Until the first answer, the FOP base is assumed: one without a FOP account switches to all income.
  const available = ref(true);
  const businessOffered = computed(() => available.value);
  const base = computed<BaseChoice>({
    get: () => (picked.value === 'custom' || picked.value === 'all' ? picked.value : businessOffered.value ? 'business' : 'all'),
    set: (b) => {
      picked.value = b;
    },
  });

  const query = () => {
    const id = participant.selectedId;
    const p = period.value;
    return {
      ...periodBounds(p),
      base: base.value === 'business' ? ('business' as const) : ('all' as const),
      ...(quarterOfPick(p, thisMonth) ? { yearToDate: true } : {}),
      ...(id !== null ? { participantId: id } : {}),
    };
  };
  const { state } = useAsyncData(() => fetchFopTax(query()), [() => JSON.stringify(query())], {
    quiet: [() => syncStatus.version],
    cached: () => peekFopTax(query()),
  });
  watch(
    () => state.value.data?.available,
    (a) => {
      if (a !== undefined) available.value = a;
    },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  const typed = computed(() => percentValue(percentText.value));
  const percent = computed(() => typed.value ?? rate.value);
  const amount = computed(() => amountMinor(amountText.value));
  const view = computed(() =>
    taxView(state.value.data ?? null, { percent: percent.value, base: base.value, amount: amount.value, period: periodName(period.value, thisMonth) }, fmt.value),
  );

  return {
    state,
    period,
    rate,
    percentText,
    base,
    businessOffered,
    amountText,
    minMonth,
    thisMonth,
    presets,
    presetShown: computed(() => (typed.value === null ? rate.value : null)),
    percentError: computed(() => percentText.value.trim() !== '' && typed.value === null),
    amountError: computed(() => base.value === 'custom' && amountText.value.trim() !== '' && amount.value === null),
    view,
  };
}
