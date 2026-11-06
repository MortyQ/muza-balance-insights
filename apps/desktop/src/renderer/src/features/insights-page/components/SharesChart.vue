<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Standing } from '@contract/api.ts';
import { VChart, VSegmentedControl } from '@/shared/ui';
import type { ChartMetric, HealthChartView } from '../types.ts';
import { STANDING_COLOR, healthChartOption } from '../utils/health.ts';

// The shares chart (spec desktop-insights-health «Shares chart», «Chart switch»): what is left of income each month, or
// what goes on wants, as bars coloured against the guide, said in plain words; it grows to its column's height.
const { chart } = defineProps<{ chart: Readonly<Record<ChartMetric, HealthChartView>> }>();
const metric = ref<ChartMetric>('left');
const shown = computed(() => chart[metric.value]);
const option = computed(() => healthChartOption(shown.value));
const options = computed(() => (['left', 'wants'] as const).map((m) => ({ value: m, label: chart[m].tab })));
const TEXT: Readonly<Record<Standing, string>> = { within: 'text-success', near: 'text-warning', outside: 'text-danger' };
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3" data-test="shares-chart">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-base font-bold" data-test="shares-title">{{ shown.title }}</h3>
        <p class="text-xs text-foreground-muted">{{ shown.hint }}</p>
      </div>
      <VSegmentedControl v-model="metric" :options size="sm" :aria-label="$t('insights.health.chart.switch')" data-test="shares-switch" />
    </div>
    <div v-if="shown.latest" class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-2xl font-bold tabular-nums" :class="shown.latest.standing ? TEXT[shown.latest.standing] : ''" data-test="shares-latest">{{ shown.latest.value }}</span>
      <span class="text-sm" data-test="shares-sentence">{{ shown.latest.sentence }}</span>
      <span v-if="shown.before" class="ml-auto text-xs text-foreground-muted" data-test="shares-before">{{ shown.before }}</span>
    </div>
    <div class="relative min-h-56 flex-1" role="img" :aria-label="shown.text" data-test="shares-plot">
      <span class="absolute right-0 top-0 text-xs text-foreground-muted">{{ shown.guideText }}</span>
      <VChart :option class="absolute inset-0" />
    </div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-secondary" data-test="shares-legend">
      <li v-for="l in shown.legend" :key="l.standing" class="flex items-center gap-1.5">
        <span class="size-2.5 shrink-0 rounded-sm" :style="{ background: STANDING_COLOR[l.standing] }" aria-hidden="true" />
        {{ l.text }}
      </li>
    </ul>
    <p v-if="shown.belowZero" class="border-t border-border-subtle pt-2 text-xs text-foreground-muted" data-test="shares-below-zero">{{ shown.belowZero }}</p>
  </div>
</template>
