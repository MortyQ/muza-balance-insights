<script setup lang="ts">
import { VCard } from '@/shared/ui';
import type { HealthView } from '../types.ts';
import HealthChecklist from './HealthChecklist.vue';
import SharesChart from './SharesChart.vue';

// «Financial health» (spec desktop-insights-health): the shares chart beside the checklist on a wide screen, stacked on
// a narrow one; the checklist alone while there is too little history for a chart.
const { health } = defineProps<{ health: HealthView }>();
</script>

<template>
  <VCard as="section" padding="md" :aria-label="$t('insights.health.title')" data-test="insights-health">
    <div class="@container">
      <h2 class="mb-3 text-base font-bold">{{ $t('insights.health.title') }}</h2>
      <div class="grid grid-cols-1 items-stretch gap-6" :class="{ '@3xl:grid-cols-12': health.chart }">
        <SharesChart v-if="health.chart" :chart="health.chart" class="@3xl:col-span-7" />
        <HealthChecklist :health class="@3xl:col-span-5" />
      </div>
    </div>
  </VCard>
</template>
