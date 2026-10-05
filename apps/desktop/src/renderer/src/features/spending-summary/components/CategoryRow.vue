<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { RouterLink } from 'vue-router';
import { VChangeChip, VIcon } from '@/shared/ui';
import type { RowView } from '../types.ts';
import { OPS_TONE } from '../constants.ts';

// `to` — the category's screen; null (the «N more categories» line) — a plain row.
const { row, to } = defineProps<{ row: RowView; to: RouteLocationRaw | null }>();
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to ?? undefined"
    class="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left"
    :class="{ 'cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': to }"
  >
    <VIcon :icon="row.icon" :color="row.color" class="size-4 shrink-0" />
    <span class="flex min-w-0 grow flex-col gap-1.5">
      <span class="flex min-w-0 items-baseline justify-between gap-2.5">
        <span class="min-w-0 truncate font-semibold" :title="row.name">{{ row.name }}</span>
        <span class="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs tabular-nums" :title="row.ops.title">
          <span class="text-foreground-muted">{{ row.ops.text }}</span>
          <span v-if="row.ops.diff" class="font-bold" :class="OPS_TONE[row.ops.tone]">{{ row.ops.diff }}<span v-if="row.ops.sr" class="sr-only"> {{ row.ops.sr }}</span></span>
        </span>
      </span>
      <span class="flex items-center gap-2.5">
        <span class="relative block h-1 grow">
          <span class="absolute inset-y-0 left-0 flex w-(--w) gap-0.5" :style="{ '--w': `${row.width}%` }">
            <span v-for="(s, i) in row.segments" :key="i" class="block grow-(--g) basis-0 rounded-sm bg-(--s)" :style="{ '--g': s.value, '--s': s.color }" :title="s.title" />
          </span>
          <span v-if="row.mark !== null" class="absolute -top-1 left-(--m) -ms-px h-3 w-0.5 rounded-sm bg-foreground" :style="{ '--m': `${row.mark}%` }" :title="row.markTitle" />
        </span>
        <span class="w-8 shrink-0 whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums">{{ row.share }}</span>
      </span>
    </span>
    <span class="flex w-25 shrink-0 flex-col items-end gap-px">
      <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
      <span v-for="c in row.conv" :key="c" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ c }}</span>
    </span>
    <span class="flex w-22.5 shrink-0 justify-end"><VChangeChip v-if="row.chip" :chip="row.chip" size="sm" /></span>
    <VIcon v-if="to" icon="lucide:chevron-right" class="size-3.5 shrink-0 text-foreground-muted" />
    <span v-else class="w-3.5 shrink-0" aria-hidden="true" />
  </component>
</template>
