<script setup lang="ts">
import type { SummaryView } from '../../types.ts';
import OpsDiff from '../OpsDiff.vue';

const { stats } = defineProps<{ stats: SummaryView['stats'] }>();
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <div class="flex flex-col gap-0.5 rounded-lg bg-surface-sunken px-2.5 py-2">
      <span class="text-xs text-foreground-muted">{{ $t('home.spending.operations') }}</span>
      <span class="flex items-baseline gap-1.5 whitespace-nowrap">
        <span class="text-lg font-bold tabular-nums">{{ stats.ops }}</span>
        <OpsDiff :diff="stats.opsVs" class="text-xs" />
      </span>
    </div>
    <div v-if="stats.prev" class="flex flex-col gap-0.5 rounded-lg bg-surface-sunken px-2.5 py-2" :title="stats.prev.title || undefined">
      <span class="text-xs text-foreground-muted">{{ stats.prev.label }}</span>
      <span class="whitespace-nowrap text-lg font-bold tabular-nums">{{ stats.prev.amount }}</span>
    </div>
  </div>
</template>
