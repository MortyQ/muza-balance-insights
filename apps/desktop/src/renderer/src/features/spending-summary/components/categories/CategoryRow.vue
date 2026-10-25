<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { VChangeChip, VIcon, VShareBar } from '@/shared/ui';
import type { CategoryRowView } from '../../types.ts';
import OpsDiff from '../OpsDiff.vue';
import AmountCell from './AmountCell.vue';

// `row.to` — the category's screen; null (the «N more categories» line) — a plain row.
const { row } = defineProps<{ row: CategoryRowView }>();
</script>

<template>
  <!-- The «Today» tile's look (spec desktop-home-tiles): the icon in a soft circle of the category's colour, the name with
       its share and operations under it, the change, the amount; the bar (last month's mark, the people split) under them. -->
  <component
    :is="row.to ? RouterLink : 'div'"
    :to="row.to ?? undefined"
    class="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto_auto_0.875rem] items-center gap-x-3 gap-y-1.5 rounded-xl px-2.5 py-2 text-left"
    :class="{ 'cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': row.to }"
    :style="{ '--c': row.color }"
  >
    <span class="grid size-7 place-items-center rounded-full bg-[color-mix(in_oklch,var(--c)_16%,transparent)]" aria-hidden="true">
      <VIcon :icon="row.icon" :color="row.color" class="size-3.5" />
    </span>
    <span class="flex min-w-0 flex-col">
      <span class="min-w-0 truncate font-semibold" :title="row.name">{{ row.name }}</span>
      <span class="inline-flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-xs text-foreground-muted tabular-nums" :title="row.ops.title">
        <span>{{ row.share }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ row.ops.text }}</span>
        <OpsDiff v-if="row.ops.diff" :diff="{ text: row.ops.diff, tone: row.ops.tone, sr: row.ops.sr }" />
      </span>
    </span>
    <span class="flex justify-end"><VChangeChip v-if="row.chip" :chip="row.chip" size="sm" /></span>
    <AmountCell :amount="row.amount" :conv="row.conv" />
    <VIcon v-if="row.to" icon="lucide:chevron-right" class="size-3.5 text-foreground-muted" />
    <span v-else aria-hidden="true" />
    <VShareBar :value="row.width" :segments="row.segments" :mark="row.mark" :mark-title="row.markTitle" size="xs" class="col-start-2 col-end-5" />
  </component>
</template>
