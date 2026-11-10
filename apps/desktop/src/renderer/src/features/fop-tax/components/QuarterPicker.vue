<script setup lang="ts">
import { computed } from 'vue';
import type { Quarter } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VSegmentedControl, VSelect, type SegmentOption, type VSelectOption } from '@/shared/ui';

const { years, allowed } = defineProps<{
  years: ReadonlyArray<number>;
  /** Quarters after today's are not offered. */
  allowed: (q: Quarter) => boolean;
}>();
const year = defineModel<number>('year', { required: true });
const quarter = defineModel<Quarter>('quarter', { required: true });

const QUARTERS: ReadonlyArray<Quarter> = [1, 2, 3, 4];
const yearOptions = computed<VSelectOption[]>(() => years.map((y) => ({ label: String(y), value: y })));
const quarterOptions = computed<SegmentOption<Quarter>[]>(() =>
  QUARTERS.map((q) => ({ label: t('fopTax.quarterShort', { n: q }), value: q, disabled: !allowed(q) })),
);
const yearModel = computed<string | number | null>({
  get: () => year.value,
  set: (v) => {
    if (typeof v === 'number') year.value = v;
  },
});
</script>

<template>
  <div class="flex flex-wrap items-end gap-3" data-test="quarter-picker">
    <VSelect v-model="yearModel" :options="yearOptions" :label="$t('fopTax.year')" class="w-28" />
    <div class="flex flex-col gap-1">
      <span class="text-xs text-foreground-muted" aria-hidden="true">{{ $t('fopTax.quarter') }}</span>
      <VSegmentedControl v-model="quarter" :options="quarterOptions" :aria-label="$t('fopTax.quarter')" />
    </div>
  </div>
</template>
