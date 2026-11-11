<script setup lang="ts">
import { VMonthRangePicker, type MonthRangePreset } from '@/shared/ui';
import type { PeriodPick } from '../types.ts';

// The analytics screen's month range picker: one month or a range of whole months, with the screen's quick picks.
const { min, max, presets } = defineProps<{
  /** YYYY-MM bounds: nothing after this month. */
  min: string;
  max: string;
  presets: { month: MonthRangePreset[]; range: MonthRangePreset[] };
}>();
const period = defineModel<PeriodPick>({ required: true });
</script>

<template>
  <div class="flex flex-col gap-1" data-test="period-picker">
    <span class="text-xs text-foreground-muted" aria-hidden="true">{{ $t('fopTax.period') }}</span>
    <VMonthRangePicker v-model="period" :min :max :presets :label="$t('fopTax.period')" />
  </div>
</template>
