<script setup lang="ts">
import { computed } from 'vue';
import { VChart } from '@/shared/ui';
import type { MonthsView } from '../types.ts';
import { monthsChartOption } from '../utils.ts';

const { months, title } = defineProps<{ months: MonthsView; title: string }>();
const option = computed(() => monthsChartOption(months));
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-base font-bold">{{ title }}</h2>
      <span v-if="months.caption" class="text-xs text-foreground-secondary">{{ months.caption }}</span>
    </div>
    <div class="h-40"><VChart :option /></div>
    <ul class="sr-only">
      <li v-for="b in months.bars" :key="b.key">{{ b.title }}</li>
    </ul>
  </section>
</template>
