<script setup lang="ts">
import { computed, watch } from 'vue';
import type { YearMonth } from '@/shared/lib';
import { VMonthPicker } from '@/shared/ui';
import { useMonthStore } from '../store/useMonthStore.ts';

const { min } = defineProps<{
  /** The first month with data (Kyiv), or null while unknown. */
  min: YearMonth | null;
}>();

const monthStore = useMonthStore();
const month = computed<string>({
  get: () => monthStore.month,
  set: (v) => monthStore.set(v as YearMonth, min),
});
const currentYear = computed(() => Number(monthStore.thisMonth.slice(0, 4)));
// The first data month can move later (a re-import that starts fresher); re-clamp the selection to it.
watch(
  () => min,
  (first) => monthStore.set(monthStore.month, first),
);
</script>

<template>
  <VMonthPicker v-model="month" :min="min ?? undefined" :max="monthStore.thisMonth" :current-year label="Месяц" />
</template>
