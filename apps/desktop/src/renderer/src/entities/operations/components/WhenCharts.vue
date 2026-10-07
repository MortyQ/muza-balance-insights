<script setup lang="ts">
import type { WhenView } from '../types.ts';
import DayPartBars from './DayPartBars.vue';
import MonthDayBars from './MonthDayBars.vue';
import WeekdayBars from './WeekdayBars.vue';

const { when } = defineProps<{ when: WhenView }>();
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="min-w-0 truncate text-base font-bold" :title="when.title">{{ when.title }}</h2>
      <span v-if="when.peak" class="text-xs text-foreground-secondary">{{ when.peak }}</span>
    </div>
    <div class="flex flex-wrap gap-6">
      <WeekdayBars :bars="when.weekdays" />
      <DayPartBars :parts="when.dayParts" />
    </div>
    <MonthDayBars :bars="when.days" />
  </section>
</template>
