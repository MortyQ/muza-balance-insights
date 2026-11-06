<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/shared/lib';
import type { FeedFilter, FeedItemView } from '../types.ts';
import { KIND_FILTERS, SEVERITY_FILTERS, kindCounts, severityCounts } from '../utils/feed.ts';

// The feed's two filter rows (spec desktop-insights-page «Feed filters»): severity with the month's counts, then kind.
// One choice per row; each button says whether it is pressed.
const { items, filter } = defineProps<{ items: ReadonlyArray<FeedItemView>; filter: Readonly<FeedFilter> }>();
const emit = defineEmits<{ change: [f: Partial<FeedFilter>] }>();

const rows = computed(() => {
  const sev = severityCounts(items);
  const kind = kindCounts(items);
  return [
    {
      key: 'severity' as const,
      label: t('insights.filter.severityGroup'),
      options: SEVERITY_FILTERS.map((v) => ({ value: v, text: t(`insights.filter.severity.${v}`), count: sev[v], on: filter.severity === v })),
    },
    {
      key: 'kind' as const,
      label: t('insights.filter.kindGroup'),
      options: KIND_FILTERS.map((v) => ({ value: v, text: t(`insights.filter.kind.${v}`), count: kind[v], on: filter.kind === v })),
    },
  ];
});
</script>

<template>
  <div class="flex flex-col gap-1.5" data-test="feed-filters">
    <div v-for="row in rows" :key="row.key" role="group" :aria-label="row.label" class="flex flex-wrap gap-1.5" :data-test="`filter-${row.key}`">
      <button
        v-for="o in row.options"
        :key="o.value"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-border-focus"
        :class="o.on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground-secondary hover:bg-surface-hover'"
        :aria-pressed="o.on"
        :data-test="`filter-${row.key}-${o.value}`"
        @click="emit('change', { [row.key]: o.value })"
      >
        {{ o.text }}
        <span v-if="row.key === 'severity'" class="tabular-nums" :class="o.on ? 'opacity-80' : 'text-foreground-muted'">{{ o.count }}</span>
      </button>
    </div>
  </div>
</template>
