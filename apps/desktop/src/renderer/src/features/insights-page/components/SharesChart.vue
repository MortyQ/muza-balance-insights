<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Standing } from '@contract/api.ts';
import { VChart, VIcon, VSegmentedControl } from '@/shared/ui';
import type { ChartMetric, HealthChartView, HealthTileView } from '../types.ts';
import { STANDING_COLOR, USUAL_COLOR, healthChartOption } from '../utils/health.ts';

// The shares chart (spec desktop-insights-health): what is left of income each month, or what goes on wants, as bars
// coloured against the guide, beside the user's own usual and its range, unusual months marked, the running month's
// forecast hatched; three tiles above say it in words. It grows to its column's height.
const { chart } = defineProps<{ chart: Readonly<Record<ChartMetric, HealthChartView>> }>();
const metric = ref<ChartMetric>('left');
const shown = computed(() => chart[metric.value]);
const option = computed(() => healthChartOption(shown.value));
const options = computed(() => (['left', 'wants'] as const).map((m) => ({ value: m, label: chart[m].tab })));
const TEXT: Readonly<Record<Standing, string>> = { within: 'text-success', near: 'text-warning', outside: 'text-danger' };
const TILE: Readonly<Record<HealthTileView['tone'], string>> = { good: 'text-success', bad: 'text-danger', warn: 'text-warning', neutral: '' };
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

    <ul class="grid grid-cols-1 gap-2 @lg:grid-cols-3" data-test="shares-tiles">
      <li v-for="tile in shown.tiles" :key="tile.key" class="min-w-0 rounded-xl bg-surface-sunken px-3 py-2" :data-test="`shares-tile-${tile.key}`">
        <div class="truncate text-xs text-foreground-muted">{{ tile.label }}</div>
        <div class="flex items-center gap-1.5 text-lg font-bold tabular-nums" :class="TILE[tile.tone]">
          <VIcon v-if="tile.icon" :icon="tile.icon" class="size-4 shrink-0" />
          <span class="truncate">{{ tile.value }}</span>
        </div>
        <div class="text-xs text-foreground-muted">{{ tile.sub }}</div>
      </li>
    </ul>

    <div v-if="shown.latest" class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-2xl font-bold tabular-nums" :class="shown.latest.standing ? TEXT[shown.latest.standing] : ''" data-test="shares-latest">{{ shown.latest.value }}</span>
      <span class="text-sm" data-test="shares-sentence">{{ shown.latest.sentence }}</span>
      <span v-if="shown.before" class="ml-auto text-xs text-foreground-muted" data-test="shares-before">{{ shown.before }}</span>
    </div>
    <div class="relative min-h-56 flex-1" role="img" :aria-label="shown.text" data-test="shares-plot">
      <span class="absolute right-0 top-0 z-10 flex gap-3 text-xs">
        <span v-if="shown.usual" :style="{ color: USUAL_COLOR }" data-test="shares-usual">{{ shown.usual.text }}</span>
        <span class="text-foreground-muted">{{ shown.guideText }}</span>
      </span>
      <VChart :option class="absolute inset-0" />
    </div>

    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-secondary" data-test="shares-legend">
      <li v-for="l in shown.legend" :key="l.standing" class="flex items-center gap-1.5">
        <span class="size-2.5 shrink-0 rounded-sm" :style="{ background: STANDING_COLOR[l.standing] }" aria-hidden="true" />
        {{ l.text }}
      </li>
    </ul>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted" data-test="shares-references">
      <li v-for="r in shown.references" :key="r.key" class="flex items-center gap-1.5">
        <span v-if="r.key === 'guide'" class="w-3.5 border-t-[1.5px] border-dashed border-foreground-muted" aria-hidden="true" />
        <span v-else-if="r.key === 'usual'" class="w-3.5 border-t-[1.5px]" :style="{ borderColor: USUAL_COLOR }" aria-hidden="true" />
        <span v-else-if="r.key === 'band'" class="h-2.5 w-3.5 rounded-sm bg-[color-mix(in_oklch,var(--series-blue)_14%,transparent)]" aria-hidden="true" />
        <span v-else-if="r.key === 'unusual'" class="size-2.5 rounded-sm border-[1.5px] border-dashed border-foreground" aria-hidden="true" />
        <span v-else class="size-2.5 rounded-sm border border-dashed border-warning bg-[color-mix(in_oklch,var(--warning)_22%,transparent)]" aria-hidden="true" />
        {{ r.text }}
      </li>
    </ul>
    <p v-if="shown.belowZero" class="border-t border-border-subtle pt-2 text-xs text-foreground-muted" data-test="shares-below-zero">{{ shown.belowZero }}</p>
  </div>
</template>
