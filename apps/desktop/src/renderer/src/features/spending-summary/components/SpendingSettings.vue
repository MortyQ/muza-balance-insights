<script setup lang="ts">
import { useId } from 'vue';
import type { SpendingFx } from '@contract/api.ts';
import { currencySymbol } from '@/shared/lib';
import { VPopover, VSwitch } from '@/shared/ui';
import { FX_CURRENCIES } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';

const { prefs, family, fx } = defineProps<{ prefs: Readonly<SpendingPrefs>; family: boolean; fx: ReadonlyArray<SpendingFx> }>();
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
const id = useId();
const hasRate = (c: number) => fx.some((f) => f.currency === c && f.rate !== null);
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.spending.settings.button')">
    <div class="flex flex-col">
      <p class="px-2 pt-2 pb-1 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.bars') }}</p>
      <div v-if="family" class="flex items-center gap-3 rounded-lg px-2 py-2.5">
        <label :for="`${id}-split`" class="flex grow cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.split') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.splitHint') }}</span>
        </label>
        <VSwitch :id="`${id}-split`" :model-value="prefs.split" role="switch" @update:model-value="emit('set', 'split', $event)" />
      </div>
      <div class="flex items-center gap-3 rounded-lg px-2 py-2.5">
        <label :for="`${id}-mark`" class="flex grow cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.mark') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.markHint') }}</span>
        </label>
        <VSwitch :id="`${id}-mark`" :model-value="prefs.mark" role="switch" @update:model-value="emit('set', 'mark', $event)" />
      </div>
      <div class="mx-2 my-1 h-px bg-border-subtle" />
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.currency') }}</p>
      <p class="px-2 pb-1 text-xs text-foreground-muted">{{ $t('home.spending.settings.currencyNote') }}</p>
      <div v-for="c in FX_CURRENCIES" :key="c.key" class="flex items-center gap-3 rounded-lg px-2 py-2.5" :class="{ 'opacity-60': !hasRate(c.currency) }">
        <label :for="`${id}-${c.key}`" class="flex grow flex-col gap-0.5" :class="{ 'cursor-pointer': hasRate(c.currency) }">
          <span class="font-semibold">{{ $t(c.label) }}</span>
          <span class="text-xs text-foreground-muted">
            {{ hasRate(c.currency) ? $t('home.spending.settings.rateHint') : $t('home.spending.settings.noRate', { symbol: currencySymbol(c.currency) }) }}
          </span>
        </label>
        <VSwitch
          :id="`${id}-${c.key}`"
          :model-value="prefs[c.key] && hasRate(c.currency)"
          :disabled="!hasRate(c.currency)"
          role="switch"
          @update:model-value="emit('set', c.key, $event)"
        />
      </div>
    </div>
  </VPopover>
</template>
