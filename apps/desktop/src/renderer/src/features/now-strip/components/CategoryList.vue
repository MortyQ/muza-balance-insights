<script setup lang="ts">
import { VChangeChip } from '@/shared/ui';
import type { CategoryBreakdown } from '../types.ts';

const { list, empty } = defineProps<{ list: CategoryBreakdown; empty: string }>();
</script>

<template>
  <ul v-if="list.rows.length > 0" class="flex flex-col">
    <li
      v-for="r in list.rows"
      :key="r.key"
      class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2 text-sm [grid-template-areas:'name_amount_chip''bar_bar_ops'] first:border-t-0 @2xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem_4rem_5.5rem] @2xl:[grid-template-areas:'name_bar_amount_ops_chip']"
      :style="{ '--c': r.color }"
    >
      <span class="flex min-w-0 items-center gap-2 [grid-area:name]">
        <span class="size-2.5 shrink-0 rounded-full bg-(--c)" aria-hidden="true" />
        <span class="truncate" :title="r.name">{{ r.name }}</span>
      </span>
      <span class="h-1.5 overflow-hidden rounded-full bg-surface-sunken [grid-area:bar]" aria-hidden="true">
        <span class="block h-full rounded-full bg-(--c)" :style="{ width: `${r.share}%` }" />
      </span>
      <span class="whitespace-nowrap text-right font-semibold tabular-nums [grid-area:amount]">{{ r.amount }}</span>
      <span class="whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums [grid-area:ops]">{{ r.ops }}</span>
      <span class="flex justify-end [grid-area:chip]">
        <VChangeChip v-if="r.chip" :chip="r.chip" size="sm" />
      </span>
    </li>
  </ul>
  <p v-else class="py-2 text-sm text-foreground-muted">{{ empty }}</p>
</template>
