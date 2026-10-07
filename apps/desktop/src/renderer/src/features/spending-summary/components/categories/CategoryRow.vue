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
  <component
    :is="row.to ? RouterLink : 'div'"
    :to="row.to ?? undefined"
    class="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left"
    :class="{ 'cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': row.to }"
  >
    <VIcon :icon="row.icon" :color="row.color" class="size-4 shrink-0" />
    <span class="flex min-w-0 grow flex-col gap-1.5">
      <span class="flex min-w-0 items-baseline justify-between gap-2.5">
        <span class="min-w-0 truncate font-semibold" :title="row.name">{{ row.name }}</span>
        <span class="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs tabular-nums" :title="row.ops.title">
          <span class="text-foreground-muted">{{ row.ops.text }}</span>
          <OpsDiff v-if="row.ops.diff" :diff="{ text: row.ops.diff, tone: row.ops.tone, sr: row.ops.sr }" />
        </span>
      </span>
      <span class="flex items-center gap-2.5">
        <VShareBar :value="row.width" :segments="row.segments" :mark="row.mark" :mark-title="row.markTitle" size="xs" :track="false" class="grow" />
        <span class="w-8 shrink-0 whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums">{{ row.share }}</span>
      </span>
    </span>
    <AmountCell :amount="row.amount" :conv="row.conv" />
    <span class="flex w-22.5 shrink-0 justify-end"><VChangeChip v-if="row.chip" :chip="row.chip" size="sm" /></span>
    <VIcon v-if="row.to" icon="lucide:chevron-right" class="size-3.5 shrink-0 text-foreground-muted" />
    <span v-else class="w-3.5 shrink-0" aria-hidden="true" />
  </component>
</template>
