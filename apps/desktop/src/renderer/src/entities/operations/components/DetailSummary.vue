<script setup lang="ts">
import type { SummaryView } from '../types.ts';
import StatGrid from './StatGrid.vue';
import SummaryFigure from './SummaryFigure.vue';
import SummaryHeader from './SummaryHeader.vue';

const { summary, label } = defineProps<{ summary: SummaryView; label: string }>();
</script>

<template>
  <section class="flex flex-col gap-5">
    <SummaryHeader :name="summary.name" :icon="summary.icon" :color="summary.color" :subtitle="summary.subtitle" />
    <div class="flex flex-wrap gap-x-8 gap-y-5">
      <SummaryFigure :summary :label />
      <StatGrid :stats="summary.stats" />
    </div>
  </section>
</template>
