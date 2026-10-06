<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { currencySymbol, t } from '@/shared/lib';
import { VSegmentedControl } from '@/shared/ui';
import { VIEW_ICON, VIEW_IDS } from '../constants.ts';
import type { CategoryRow, LinesMode, ViewId } from '../types.ts';
import { columns, compareRows, heatRows, miniCards } from '../utils.ts';
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
const hint = computed(() => {
  if (current.value === 'heat') return t('analytics.views.heatHint');
  if (current.value === 'small') return t(view.unit === 'day' ? 'analytics.views.smallHintDay' : 'analytics.views.smallHintMonth');
  return t(current.value === 'lines' ? 'analytics.views.linesHint' : 'analytics.views.compareHint');
});
// What the heatmap's numbers are: thousands of the shown currency per column (a month, or a week of one month).
const heatUnit = computed(() =>
  t(view.unit === 'day' ? 'analytics.views.heatUnitWeek' : 'analytics.views.heatUnitMonth', { currency: currencySymbol(fmt.currency) }),
);
const options = computed(() => VIEW_IDS.map((id) => ({ value: id, label: t(NAMES[id]), icon: VIEW_ICON[id] })));
const heat = computed(() => (current.value === 'heat' ? heatRows(rows, columns(view), fmt) : []));
const cols = computed(() => columns(view));
const cards = computed(() => (current.value === 'small' ? miniCards(view, rows, fmt) : []));
const compare = computed(() => (current.value === 'compare' ? compareRows(view, fmt) : []));
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold">{{ $t('analytics.views.title') }}</h2>
        <p class="text-sm text-foreground-muted">{{ hint }}</p>
      </div>
      <VSegmentedControl v-model="current" :options size="md" />
    </div>
    <HeatmapView v-if="current === 'heat'" :rows="heat" :cols :unit="heatUnit" />
    <SmallChartsView v-else-if="current === 'small'" :view :rows :cards :fmt />
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
