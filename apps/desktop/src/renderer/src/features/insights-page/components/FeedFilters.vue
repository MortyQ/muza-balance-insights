<script setup lang="ts">
import { computed, useId } from 'vue';
import { t } from '@/shared/lib';
import { VSelect, type VSelectOption } from '@/shared/ui';
import type { FeedFilter, FeedItemView } from '../types.ts';
import { KIND_FILTERS, SEVERITY_FILTERS, severityCounts } from '../utils/feed.ts';

// The feed's filters, one row (spec desktop-insights-page «Feed filters»): severity as toggle buttons with the month's
// counts, each saying whether it is pressed, and the kind as a select at the row's end.
const { items, filter } = defineProps<{ items: ReadonlyArray<FeedItemView>; filter: Readonly<FeedFilter> }>();
const emit = defineEmits<{ change: [f: Partial<FeedFilter>] }>();

const kindId = useId();
const severity = computed(() => {
  const counts = severityCounts(items);
  return SEVERITY_FILTERS.map((v) => ({ value: v, text: t(`insights.filter.severity.${v}`), count: counts[v], on: filter.severity === v }));
});
const kinds = computed<VSelectOption[]>(() => KIND_FILTERS.map((v) => ({ label: t(`insights.filter.kind.${v}`), value: v })));

function pickKind(v: string | number | null): void {
  const kind = KIND_FILTERS.find((k) => k === v);
  if (kind) emit('change', { kind });
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2" data-test="feed-filters">
    <div role="group" :aria-label="$t('insights.filter.severityGroup')" class="flex flex-wrap gap-1.5" data-test="filter-severity">
      <button
        v-for="o in severity"
        :key="o.value"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-border-focus"
        :class="o.on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground-secondary hover:bg-surface-hover'"
        :aria-pressed="o.on"
        :data-test="`filter-severity-${o.value}`"
        @click="emit('change', { severity: o.value })"
      >
        {{ o.text }}
        <span class="tabular-nums" :class="o.on ? 'opacity-80' : 'text-foreground-muted'">{{ o.count }}</span>
      </button>
    </div>
    <div class="w-44" data-test="filter-kind">
      <label :for="kindId" class="sr-only">{{ $t('insights.filter.kindGroup') }}</label>
      <VSelect :id="kindId" :model-value="filter.kind" :options="kinds" :placeholder="$t('insights.filter.kindGroup')" @update:model-value="pickKind" />
    </div>
  </div>
</template>
