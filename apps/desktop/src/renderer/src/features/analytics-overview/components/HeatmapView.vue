<script setup lang="ts">
import { ref } from 'vue';
import type { Column, HeatRow } from '../types.ts';

const { rows, cols, unit } = defineProps<{ rows: ReadonlyArray<HeatRow>; cols: ReadonlyArray<Column>; unit: string }>();
const SWATCHES = [
  'color-mix(in oklch, var(--heat-cold) 60%, var(--surface))',
  'color-mix(in oklch, var(--heat-cold) 25%, var(--surface))',
  'var(--surface-sunken)',
  'color-mix(in oklch, var(--heat-hot) 25%, var(--surface))',
  'color-mix(in oklch, var(--heat-hot) 60%, var(--surface))',
];

// The crosshair under the pointer: a cell lights its row and column and fades the rest; a name lights its row alone.
const at = ref<{ row: number; col: number | null } | null>(null);
const lit = (i: number, j: number | null = null): boolean => at.value?.row === i || (j !== null && at.value?.col === j);
const faded = (i: number, j: number): boolean => at.value !== null && !lit(i, j);
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-foreground-secondary">
      <div class="flex items-center gap-2" aria-hidden="true">
        <span>{{ $t('analytics.views.less') }}</span>
        <span class="flex gap-0.5">
          <span v-for="s in SWATCHES" :key="s" class="h-3 w-5 rounded-sm bg-(--swatch)" :style="{ '--swatch': s }" />
        </span>
        <span>{{ $t('analytics.views.more') }}</span>
      </div>
      <span data-test="heat-unit" class="font-medium">{{ unit }}</span>
    </div>
    <div class="overflow-x-auto">
      <div
        role="table"
        :aria-label="$t('analytics.views.heat')"
        class="grid w-max min-w-full grid-cols-[max-content_repeat(var(--cols),minmax(2.75rem,1fr))_4.5rem] gap-0.75 text-xs"
        :style="{ '--cols': cols.length }"
        @mouseleave="at = null"
      >
        <div role="row" class="contents">
          <!-- A real cell (not sr-only itself): an absolutely placed item would take no grid track and shift every row. -->
          <span role="columnheader" class="sticky left-0 z-1 bg-surface"><span class="sr-only">{{ $t('analytics.views.category') }}</span></span>
          <span
            v-for="(c, j) in cols"
            :key="c.label"
            role="columnheader"
            class="pb-1 text-center whitespace-nowrap transition-colors"
            :class="at?.col === j ? 'font-semibold text-foreground' : 'text-foreground-muted'"
          >
            {{ c.label }}
          </span>
          <span role="columnheader" class="sticky right-0 z-1 bg-surface pb-1 pl-2 text-right text-foreground-muted">{{ $t('analytics.views.avg') }}</span>
        </div>
        <div v-for="(r, i) in rows" :key="r.key" role="row" class="contents">
          <span
            role="rowheader"
            class="sticky left-0 z-1 flex items-center gap-2 bg-surface pr-3 text-sm"
            :class="{ 'font-semibold': lit(i) }"
            @mouseenter="at = { row: i, col: null }"
          >
            <span class="size-2 shrink-0 rounded-full bg-(--dot)" :style="{ '--dot': r.color }" aria-hidden="true" />
            <span class="max-w-56 truncate" :title="r.name">{{ r.name }}</span>
          </span>
          <span
            v-for="(c, j) in r.cells"
            :key="j"
            role="cell"
            :title="c.title"
            class="grid h-8.5 place-items-center rounded-md bg-(--cell) tabular-nums transition-opacity"
            :class="{
              'font-bold': c.strong,
              'outline-1 -outline-offset-1 outline-dashed outline-border-strong': c.running,
              'opacity-40': faded(i, j),
              'ring-2 ring-foreground ring-inset': at?.row === i && at.col === j,
            }"
            :style="{ '--cell': c.background }"
            @mouseenter="at = { row: i, col: j }"
          >
            {{ c.text }}
          </span>
          <span
            role="cell"
            class="sticky right-0 z-1 grid place-items-center justify-end bg-surface pl-2 tabular-nums"
            :class="lit(i) ? 'font-semibold text-foreground' : 'text-foreground-secondary'"
            @mouseenter="at = { row: i, col: null }"
          >
            {{ r.avg }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
