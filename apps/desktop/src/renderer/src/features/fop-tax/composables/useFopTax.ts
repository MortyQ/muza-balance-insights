import { computed, ref, watch } from 'vue';
import type { Quarter } from '@contract/api.ts';
import { quarterOf } from '@contract/quarters.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { localToday, useAsyncData } from '@/shared/lib';
import { useFopTaxRequest } from '../api/useFopTaxRequest.ts';
import type { BaseChoice, PeriodPick, RatePreset, UseFopTaxReturn } from '../types.ts';
import { FOP_RATES } from '../constants.ts';
import { amountMinor, percentValue, periodBounds, periodName, quarterAllowed as allowed, taxView, yearOptions } from '../utils.ts';

/**
 * The FOP tax screen: the picked period (today's quarter at first) and base for the global filter's person, reloaded
 * when any changes and quietly when the data changes. The base defaults to the FOP accounts' income while the view has
 * one, all income otherwise. Nothing is remembered.
 */
export function useFopTax(): UseFopTaxReturn {
  const { fetchFopTax, peekFopTax } = useFopTaxRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const today = localToday(new Date());
  const current = quarterOf(today);
  const period = ref<PeriodPick>({
    kind: 'quarter',
    month: today.slice(0, 7),
    year: current.year,
    quarter: current.quarter,
    from: `${today.slice(0, 7)}-01`,
    to: today,
  });
  const rate = ref<RatePreset>(FOP_RATES[0]);
  const percentText = ref('');
  const picked = ref<BaseChoice | null>(null);
  const amountText = ref('');

  const quarterAllowed = (q: Quarter) => allowed(period.value.year, q, current);
  // Back to this year with a quarter still ahead: the latest one allowed.
  watch(
    () => period.value.year,
    () => {
      if (!quarterAllowed(period.value.quarter)) period.value.quarter = current.quarter;
    },
  );
  // Dates: the end never before the start.
  watch(
    () => period.value.from,
    (from) => {
      if (period.value.to < from) period.value.to = from;
    },
  );

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
      ...(p.kind === 'quarter' ? { yearToDate: true } : {}),
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
    taxView(state.value.data ?? null, { percent: percent.value, base: base.value, amount: amount.value, period: periodName(period.value) }, fmt.value),
  );

  return {
    state,
    period,
    rate,
    percentText,
    base,
    businessOffered,
    amountText,
    today,
    years: computed(() => yearOptions(current.year)),
    quarterAllowed,
    presetShown: computed(() => (typed.value === null ? rate.value : null)),
    percentError: computed(() => percentText.value.trim() !== '' && typed.value === null),
    amountError: computed(() => base.value === 'custom' && amountText.value.trim() !== '' && amount.value === null),
    view,
  };
}
