<script setup lang="ts">
import { computed, ref } from 'vue';
import { VChart, VSegmentedControl } from '@/shared/ui';
import type { ChartMetric, HealthChartView } from '../types.ts';
import { healthChartOption } from '../utils/health.ts';

// The shares chart (spec desktop-insights-health «Shares chart», «Chart switch»): what is left of income by month
// against 20%, or wants against 30%; the choice lives for the visit only.
const { chart } = defineProps<{ chart: Readonly<Record<ChartMetric, HealthChartView>> }>();
const metric = ref<ChartMetric>('left');
const shown = computed(() => chart[metric.value]);
const option = computed(() => healthChartOption(shown.value));
const options = computed(() => (['left', 'wants'] as const).map((m) => ({ value: m, label: chart[m].name })));
const TONE = { good: 'text-success', bad: 'text-danger', neutral: 'text-foreground-muted' } as const;
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-test="shares-chart">
    <div class="text-sm text-foreground-muted">{{ $t('insights.health.chart.caption') }}</div>
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-2xl font-bold tabular-nums" data-test="shares-latest">{{ shown.latest ?? '—' }}</span>
      <span v-if="shown.change" class="text-sm" :class="TONE[shown.changeTone]" data-test="shares-change">{{ shown.change }}</span>
      <span class="ml-auto text-xs text-foreground-muted">{{ shown.guideText }}</span>
    </div>
    <div class="h-40" role="img" :aria-label="shown.text" data-test="shares-plot">
      <VChart :option class="size-full" />
    </div>
    <VSegmentedControl v-model="metric" :options size="sm" class="self-start" :aria-label="$t('insights.health.chart.switch')" data-test="shares-switch" />
  </div>
</template>
