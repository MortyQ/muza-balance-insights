<script setup lang="ts">
import type { AnalyticsOverview } from '@contract/api.ts';
import { VChart } from '@/shared/ui';
import type { CategoryRow, MiniCard } from '../types.ts';
import { miniOption } from '../utils.ts';

const { view, rows, cards } = defineProps<{ view: AnalyticsOverview; rows: ReadonlyArray<CategoryRow>; cards: ReadonlyArray<MiniCard> }>();
</script>

<template>
  <ul class="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
    <li v-for="(c, i) in cards" :key="c.key" data-test="mini" class="flex min-w-0 flex-col rounded-xl border border-border-subtle p-3.5">
      <div class="flex items-center gap-2 text-sm font-semibold">
        <span class="size-2 shrink-0 rounded-full bg-(--dot)" :style="{ '--dot': c.color }" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate" :title="c.name">{{ c.name }}</span>
        <span
          v-if="c.chip"
          class="rounded-full px-2 py-0.5 text-xs tabular-nums"
          :class="c.up ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'"
        >
          {{ c.chip }}
        </span>
      </div>
      <div class="mt-2 text-lg font-bold tabular-nums">{{ c.total }}</div>
      <div class="text-xs text-foreground-muted">{{ c.avg }}</div>
      <div class="mt-2 h-20" aria-hidden="true"><VChart v-if="rows[i]" :option="miniOption(view, rows[i])" /></div>
    </li>
  </ul>
</template>
