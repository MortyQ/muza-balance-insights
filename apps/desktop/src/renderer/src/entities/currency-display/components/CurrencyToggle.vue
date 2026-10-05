<script setup lang="ts">
import { computed, useId } from 'vue';
import { t, UAH } from '@/shared/lib';
import { VPopover, VSegmentedControl, VSwitch, type SegmentOption } from '@/shared/ui';
import { CURRENCIES } from '../constants.ts';
import { useCurrencyDisplayStore } from '../store/useCurrencyDisplayStore.ts';
import type { MainCurrency } from '../types.ts';
import { hasRate, rateDate, shownText } from '../utils.ts';

const store = useCurrencyDisplayStore();
const id = useId();
const rates = computed(() => store.rates ?? null);
const shown = computed(() => shownText(rates.value, store.choice));
const rated = computed(() => CURRENCIES.filter((c) => hasRate(rates.value, c.currency)));
const options = computed<SegmentOption<MainCurrency>[]>(() => rated.value.map((c) => ({ label: t(c.label), value: c.currency })));
// A main currency without a rate falls back to hryvnia on screen, so the control shows hryvnia too.
const main = computed<MainCurrency>({
  get: () => (hasRate(rates.value, store.choice.main) ? store.choice.main : UAH),
  set: (v) => store.setMain(v),
});
const also = computed(() => rated.value.filter((c) => c.currency !== main.value));
const footer = computed(() => {
  const r = store.rates;
  if (r === undefined) return '';
  if (r === null) return t('entities.currencyDisplay.noRates');
  return t(r.saved ? 'entities.currencyDisplay.savedRate' : 'entities.currencyDisplay.rate', { date: rateDate(r.fetchedAt) });
});
</script>

<template>
  <VPopover icon="lucide:chevron-down" :text="shown" :label="$t('entities.currencyDisplay.button', { shown })" align="start">
    <div class="flex flex-col gap-1">
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('entities.currencyDisplay.mainTitle') }}</p>
      <p class="px-2 text-xs text-foreground-muted">{{ $t('entities.currencyDisplay.mainNote') }}</p>
      <div class="px-2 py-1.5">
        <VSegmentedControl v-model="main" :options role="group" :aria-label="$t('entities.currencyDisplay.mainTitle')" />
      </div>
      <template v-if="also.length > 0">
        <p class="px-2 pt-1 text-xs font-semibold text-foreground-muted">{{ $t('entities.currencyDisplay.alsoTitle') }}</p>
        <div v-for="c in also" :key="c.key" class="flex items-center gap-3 rounded-lg px-2 py-2">
          <label :for="`${id}-${c.key}`" class="grow cursor-pointer font-semibold">{{ $t(c.label) }}</label>
          <VSwitch
            :id="`${id}-${c.key}`"
            :model-value="store.choice.also[c.key]"
            role="switch"
            @update:model-value="store.setAlso(c.key, $event)"
          />
        </div>
      </template>
      <p v-if="footer" class="border-t border-border-subtle px-2 pt-2 pb-1 text-xs text-foreground-muted">{{ footer }}</p>
    </div>
  </VPopover>
</template>
