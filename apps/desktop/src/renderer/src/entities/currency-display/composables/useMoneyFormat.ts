import { computed, watch, type ComputedRef } from 'vue';
import type { RatesView } from '@contract/api.ts';
import { useCurrencyDisplayStore } from '../store/useCurrencyDisplayStore.ts';
import type { MoneyFormat } from '../types.ts';
import { moneyFormat } from '../utils.ts';

/**
 * The format of one block's answer: its own rates (every amount of an answer was folded by them) and the home-wide
 * choice. Also publishes the rates to the switch.
 */
export function useMoneyFormat(rates: () => RatesView | null | undefined): ComputedRef<MoneyFormat> {
  const store = useCurrencyDisplayStore();
  watch(
    rates,
    (r) => {
      if (r !== undefined) store.setRates(r);
    },
    { immediate: true },
  );
  return computed(() => moneyFormat(rates() ?? null, store.choice));
}
