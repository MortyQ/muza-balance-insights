<script setup lang="ts">
import { computed } from 'vue';
import type { YearMonth } from '@/shared/lib';
import { VMonthRangePicker } from '@/shared/ui';
import { useMonthStore } from '../store/useMonthStore.ts';
import { useRangeStore, type MonthRange } from '../store/useRangeStore.ts';
import { rangePresets } from '../utils.ts';
import RangeNote from './RangeNote.vue';

// dataFrom comes as a prop: an entity does not read another entity (sync-status); the widget passes it.
const { min, dataFrom } = defineProps<{
  /** The import floor's month. */
  min: YearMonth;
  /** The first date with data, or null. */
  dataFrom: string | null;
}>();

const months = useMonthStore();
const store = useRangeStore();
const range = computed<{ from: string; to: string }>({
  get: () => store.range,
  // `as`: the picker hands back only months of its own grid and picks, "YYYY-MM".
  set: (v) => store.set(v as MonthRange, min),
});
const presets = computed(() => rangePresets(months.thisMonth, min));
</script>

<template>
  <VMonthRangePicker v-model="range" :min :max="months.thisMonth" :presets :label="$t('common.monthRangePicker.label')">
    <template #note="{ from, to }">
      <RangeNote :from :to :this-month="months.thisMonth" :data-from />
    </template>
  </VMonthRangePicker>
</template>
