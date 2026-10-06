<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';
import { VSegmentedControl } from '@/shared/ui';
import { VIEW_ICON, VIEW_IDS } from '../constants.ts';
import type { CategoryRow, LinesMode, ViewId } from '../types.ts';
import { categoryRows, columns, compareRows, heatRows, miniCards } from '../utils.ts';
import CompareView from './CompareView.vue';
import HeatmapView from './HeatmapView.vue';
import LinesView from './LinesView.vue';
import SmallChartsView from './SmallChartsView.vue';

const { view, rows, on, fmt } = defineProps<{ view: AnalyticsOverview; rows: ReadonlyArray<CategoryRow>; on: ReadonlySet<string>; fmt: MoneyFormat }>();
const current = defineModel<ViewId>('current', { required: true });
const hover = defineModel<string | null>('hover', { required: true });
const mode = defineModel<LinesMode>('mode', { required: true });
const emit = defineEmits<{ toggle: [key: string]; top: []; all: [] }>();

const NAMES: Readonly<Record<ViewId, 'analytics.views.heat' | 'analytics.views.small' | 'analytics.views.lines' | 'analytics.views.compare'>> = {
  heat: 'analytics.views.heat',
  small: 'analytics.views.small',
  lines: 'analytics.views.lines',
  compare: 'analytics.views.compare',
};
const HINTS: Readonly<Record<ViewId, 'analytics.views.heatHint' | 'analytics.views.smallHint' | 'analytics.views.linesHint' | 'analytics.views.compareHint'>> = {
  heat: 'analytics.views.heatHint',
  small: 'analytics.views.smallHint',
  lines: 'analytics.views.linesHint',
  compare: 'analytics.views.compareHint',
};
const options = computed(() => VIEW_IDS.map((id) => ({ value: id, label: t(NAMES[id]), icon: VIEW_ICON[id] })));
// The heatmap has room for every category: no «Other N».
const heat = computed(() => (current.value === 'heat' ? heatRows(categoryRows(view.categories, view.buckets.length, Infinity), columns(view), fmt) : []));
const cols = computed(() => columns(view));
const cards = computed(() => (current.value === 'small' ? miniCards(view, rows, fmt) : []));
const compare = computed(() => (current.value === 'compare' ? compareRows(view, fmt) : []));
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold">{{ $t('analytics.views.title') }}</h2>
        <p class="text-sm text-foreground-muted">{{ $t(HINTS[current]) }}</p>
      </div>
      <VSegmentedControl v-model="current" :options size="md" />
    </div>
    <HeatmapView v-if="current === 'heat'" :rows="heat" :cols />
    <SmallChartsView v-else-if="current === 'small'" :view :rows :cards />
    <LinesView
      v-else-if="current === 'lines'"
      v-model:hover="hover"
      v-model:mode="mode"
      :view
      :rows
      :on
      :fmt
      @toggle="emit('toggle', $event)"
      @top="emit('top')"
      @all="emit('all')"
    />
    <CompareView v-else :rows="compare" />
  </section>
</template>
