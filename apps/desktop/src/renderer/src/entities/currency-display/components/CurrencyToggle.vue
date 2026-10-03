<script setup lang="ts">
import { computed, useId } from 'vue';
import { currencySymbol } from '@/shared/lib';
import { VPopover, VSwitch } from '@/shared/ui';
import { FX_CURRENCIES } from '../constants.ts';
import { useCurrencyDisplayStore } from '../store/useCurrencyDisplayStore.ts';
import { shownText } from '../utils.ts';

const store = useCurrencyDisplayStore();
const id = useId();
const shown = computed(() => shownText(store.fx ?? [], store.prefs));
// Rates not loaded yet: the switches stay usable (the choice is saved either way) and no rate hint is shown.
const loaded = computed(() => store.fx !== null);
const hasRate = (c: number) => store.fx === null || store.fx.some((f) => f.currency === c && f.rate !== null);
const nearest = (c: number) => !!store.fx?.some((f) => f.currency === c && f.rate !== null && f.nearest);
</script>

<template>
  <VPopover icon="lucide:chevron-down" :text="shown" :label="$t('entities.currencyDisplay.button', { shown })" align="start">
    <div class="flex flex-col">
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('entities.currencyDisplay.title') }}</p>
      <p class="px-2 pb-1 text-xs text-foreground-muted">{{ $t('entities.currencyDisplay.note') }}</p>
      <div v-for="c in FX_CURRENCIES" :key="c.key" class="flex items-center gap-3 rounded-lg px-2 py-2.5" :class="{ 'opacity-60': !hasRate(c.currency) }">
        <label :for="`${id}-${c.key}`" class="flex grow flex-col gap-0.5" :class="{ 'cursor-pointer': hasRate(c.currency) }">
          <span class="font-semibold">{{ $t(c.label) }}</span>
          <span v-if="loaded" class="text-xs text-foreground-muted">
            {{
              !hasRate(c.currency)
                ? $t('entities.currencyDisplay.noRate', { symbol: currencySymbol(c.currency) })
                : nearest(c.currency) ? $t('entities.currencyDisplay.nearestHint') : $t('entities.currencyDisplay.rateHint')
            }}
          </span>
        </label>
        <VSwitch
          :id="`${id}-${c.key}`"
          :model-value="store.prefs[c.key] && hasRate(c.currency)"
          :disabled="!hasRate(c.currency)"
          role="switch"
          @update:model-value="store.set(c.key, $event)"
        />
      </div>
    </div>
  </VPopover>
</template>
